// Firebase operations are injected so messaging behavior can be tested without live accounts.
export function createMessagingStore({ ref, push, update, get, remove, onValue, runTransaction, fetchUserDetails, now = Date.now }) {
  const id = value => {
    const result = String(value ?? '');
    if (!/^[A-Za-z0-9_-]+$/.test(result) || ['undefined', 'null'].includes(result)) throw new Error('Invalid messaging account.');
    return result;
  };
  const roomId = (sender, receiver) => {
    const participants = [id(sender), id(receiver)].sort();
    if (participants[0] === participants[1]) throw new Error('Choose another person to message.');
    return participants.join('_');
  };
  const messageText = value => {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Enter a message first.');
    return value.trim();
  };
  const profiles = new Map();
  const profile = userId => {
    if (!profiles.has(userId)) profiles.set(userId, Promise.resolve().then(() => fetchUserDetails(userId)).catch(error => { profiles.delete(userId); throw error; }));
    return profiles.get(userId);
  };
  const conversation = (key, data, userId, person) => {
    const accountType = String(person.accountType || '').toUpperCase();
    const timestamp = Number(data.lastMessageTimestamp) || 0;
    return { id: String(person.id), name: person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Contact',
      role: accountType, accountType, profilePhotoUrl: person.profilePhotoUrl || null, chatroomId: key,
      lastMessage: data.lastMessage || '', lastMessageTimestamp: timestamp,
      isRead: !timestamp || Number(data.participantDetails?.[userId]?.lastRead || 0) >= timestamp };
  };
  const otherParticipant = (data, userId) => data?.participants?.[userId]
    ? Object.keys(data.participants).find(participant => participant !== userId && data.participants[participant]) : null;
  const sortConversations = items => items.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);

  const fetchActiveConversations = async user => {
    const userId = id(user);
    const index = (await get(ref(`userChatrooms/${userId}`))).val() || {};
    const items = await Promise.all(Object.keys(index).filter(key => index[key]).map(async key => {
      const data = (await get(ref(`chatrooms/${key}`))).val();
      const otherId = otherParticipant(data, userId);
      if (!otherId) return null;
      return conversation(key, data, userId, await profile(otherId));
    }));
    return sortConversations(items.filter(Boolean));
  };

  const subscribeToConversations = (user, callback, onError = console.error) => {
    const userId = id(user);
    const rooms = new Map();
    let active = true;
    const publish = () => {
      if (active) callback(sortConversations([...rooms.values()].map(room => room.value).filter(Boolean)));
    };
    const stopIndex = onValue(ref(`userChatrooms/${userId}`), snapshot => {
      if (!active) return;
      const index = snapshot.val() || {};
      const keys = new Set(Object.keys(index).filter(key => index[key]));
      for (const [key, room] of rooms) if (!keys.has(key)) { room.stop(); rooms.delete(key); }
      for (const key of keys) {
        if (rooms.has(key)) continue;
        const room = { version: 0, value: null, stop: () => {} };
        rooms.set(key, room);
        room.stop = onValue(ref(`chatrooms/${key}`), async snapshot => {
          const version = ++room.version;
          const data = snapshot.val();
          const otherId = otherParticipant(data, userId);
          if (!otherId) { room.value = null; publish(); return; }
          try {
            const person = await profile(otherId);
            if (!active || rooms.get(key) !== room || room.version !== version) return;
            room.value = conversation(key, data, userId, person);
            publish();
          } catch (error) { if (active && rooms.get(key) === room) onError(error); }
        }, error => { if (active) onError(error); });
      }
      publish();
    }, error => { if (active) onError(error); });
    return () => { active = false; stopIndex(); for (const room of rooms.values()) room.stop(); rooms.clear(); };
  };

  const sendMessage = async (sender, receiver, content, senderRole) => {
    const senderId = id(sender), receiverId = id(receiver);
    const chatroomId = roomId(senderId, receiverId);
    const text = messageText(content);
    const role = String(senderRole || '').toUpperCase();
    if (!['CLIENT', 'LAWYER', 'ADMIN'].includes(role)) throw new Error('Your messaging role is missing. Sign in again.');
    const timestamp = now();
    const messageId = push(ref(`messages/${chatroomId}`)).key;
    await update(ref(), {
      [`messages/${chatroomId}/${messageId}`]: { senderId, receiverId, content: text, timestamp, isEdited: false, senderRole: role },
      [`chatrooms/${chatroomId}/lastMessage`]: text,
      [`chatrooms/${chatroomId}/lastMessageId`]: messageId,
      [`chatrooms/${chatroomId}/lastSenderId`]: senderId,
      [`chatrooms/${chatroomId}/lastMessageTimestamp`]: timestamp,
      [`chatrooms/${chatroomId}/participants/${senderId}`]: true,
      [`chatrooms/${chatroomId}/participants/${receiverId}`]: true,
      [`chatrooms/${chatroomId}/participantDetails/${senderId}/role`]: role,
      [`chatrooms/${chatroomId}/participantDetails/${senderId}/lastRead`]: timestamp,
      [`userChatrooms/${senderId}/${chatroomId}`]: true,
      [`userChatrooms/${receiverId}/${chatroomId}`]: true,
    });
    return { success: true, chatroomId };
  };

  const subscribeToMessages = (sender, receiver, callback, onError = console.error) => {
    const chatroomId = roomId(sender, receiver);
    // Unsubscribe this listener only; the same conversation may also be open in the inbox.
    return onValue(ref(`messages/${chatroomId}`), snapshot => {
      const messages = Object.entries(snapshot.val() || {}).map(([key, item]) => ({ ...item, id: key,
        senderId: String(item.senderId), receiverId: String(item.receiverId), timestamp: new Date(Number(item.timestamp) || 0) }));
      messages.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
      callback({ messages, chatroomId });
    }, onError);
  };

  const markChatAsRead = async (key, user, seenTimestamp) => {
    const userId = id(user);
    const room = (await get(ref(`chatrooms/${id(key)}`))).val();
    if (!room?.participants?.[userId]) return;
    const timestamp = Number(seenTimestamp ?? room.lastMessageTimestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return;
    await runTransaction(ref(`chatrooms/${key}/participantDetails/${userId}/lastRead`), current =>
      Number(current) >= timestamp ? undefined : timestamp, { applyLocally: false });
  };

  const refreshPreview = async (key, affectedId, previous) => {
    const messages = (await get(ref(`messages/${key}`))).val() || {};
    const latest = Object.entries(messages).sort(([aId, a], [bId, b]) => Number(b.timestamp) - Number(a.timestamp) || bId.localeCompare(aId))[0];
    await runTransaction(ref(`chatrooms/${key}`), room => {
      if (!room) return;
      const affected = room.lastMessageId ? room.lastMessageId === affectedId : Number(room.lastMessageTimestamp) === Number(previous.timestamp);
      if (!affected) return; // A newer send must not be replaced by an older edit/delete.
      return { ...room, lastMessage: latest?.[1].content || '', lastMessageId: latest?.[0] || null,
        lastSenderId: latest?.[1].senderId || null, lastMessageTimestamp: Number(latest?.[1].timestamp) || 0 };
    }, { applyLocally: false });
  };
  const editMessage = async (key, messageId, content) => {
    const path = `messages/${id(key)}/${id(messageId)}`;
    const text = messageText(content);
    const previous = (await get(ref(path))).val();
    if (!previous) throw new Error('This message is no longer available.');
    const result = await runTransaction(ref(path), current => current
      ? { ...current, content: text, isEdited: true, editedAt: now() } : undefined, { applyLocally: false });
    if (!result.committed) throw new Error('This message is no longer available.');
    await refreshPreview(key, messageId, previous);
    return { success: true };
  };
  const deleteMessage = async (key, messageId) => {
    const path = `messages/${id(key)}/${id(messageId)}`;
    const previous = (await get(ref(path))).val();
    if (!previous) return { success: true };
    await remove(ref(path));
    await refreshPreview(key, messageId, previous);
    return { success: true };
  };
  return { fetchActiveConversations, subscribeToConversations, sendMessage, subscribeToMessages, markChatAsRead, editMessage, deleteMessage };
}
