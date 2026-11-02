import test from 'node:test';
import assert from 'node:assert/strict';
import { createMessagingStore } from './messagingStore.js';
import { memoryRealtimeDb } from './test-support/realtimeDb.mjs';

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const users = {
  '1': { id: 1, fullName: 'Demo Client', accountType: 'CLIENT' },
  '2': { id: 2, fullName: 'Test Lawyer', accountType: 'LAWYER', profilePhotoUrl: '/lawyer.png' },
};
function setup(seed) {
  const db = memoryRealtimeDb(seed);
  let clock = 100;
  const store = createMessagingStore({ ...db, now: () => ++clock, fetchUserDetails: async id => users[id] });
  return { db, store };
}

test('sending delivers trimmed messages and indexes both participants without overwriting recipient read status', async () => {
  const { db, store } = setup({ chatrooms: { '1_2': { participantDetails: { '2': { role: 'LAWYER', lastRead: 25 } } } } });
  await store.sendMessage(1, 2, '  Hello counsel  ', 'client');
  const messages = db.value('messages/1_2');
  assert.equal(Object.values(messages)[0].content, 'Hello counsel');
  assert.equal(db.value('userChatrooms/1/1_2'), true);
  assert.equal(db.value('userChatrooms/2/1_2'), true);
  assert.deepEqual(db.value('chatrooms/1_2/participantDetails/2'), { role: 'LAWYER', lastRead: 25 });
  assert.equal(db.value('chatrooms/1_2/lastMessageId'), Object.keys(messages)[0]);
  const [conversation] = await store.fetchActiveConversations(1);
  assert.equal(conversation.accountType, 'LAWYER');
  assert.equal(conversation.role, 'LAWYER');
  assert.equal(conversation.profilePhotoUrl, '/lawyer.png');
  assert.equal(conversation.isRead, true);
  await assert.rejects(store.sendMessage(1, 2, ' ', 'CLIENT'));
  await assert.rejects(store.sendMessage(1, 1, 'Hello', 'CLIENT'));
  await assert.rejects(store.sendMessage(undefined, 2, 'Hello', 'CLIENT'));
  assert.equal(Object.keys(db.value('messages/1_2')).length, 1);
});

test('closing one message subscription does not disconnect another view of the same conversation', async () => {
  const { db, store } = setup();
  const first = [], second = [];
  const stopFirst = store.subscribeToMessages(1, 2, value => first.push(value));
  const stopSecond = store.subscribeToMessages(2, 1, value => second.push(value));
  await settle(); stopFirst();
  await store.sendMessage(1, 2, 'Still connected', 'CLIENT'); await settle();
  assert.equal(first.at(-1).messages.length, 0);
  assert.equal(second.at(-1).messages[0].content, 'Still connected');
  assert.ok(second.at(-1).messages[0].timestamp instanceof Date);
  stopSecond(); assert.equal(db.listenerCount(), 0);
});

test('live inbox receives new conversations, message edits, and deletion fallback previews', async () => {
  const { db, store } = setup();
  let inbox = [];
  const stop = store.subscribeToConversations(2, items => { inbox = items; });
  await store.sendMessage(1, 2, 'First message', 'CLIENT'); await settle();
  assert.equal(inbox[0].lastMessage, 'First message');
  assert.equal(inbox[0].isRead, false);
  await store.sendMessage(1, 2, 'Latest message', 'CLIENT'); await settle();
  const latestId = db.value('chatrooms/1_2/lastMessageId');
  await store.editMessage('1_2', latestId, 'Corrected latest message'); await settle();
  assert.equal(inbox[0].lastMessage, 'Corrected latest message');
  await store.deleteMessage('1_2', latestId); await settle();
  assert.equal(inbox[0].lastMessage, 'First message');
  const firstId = db.value('chatrooms/1_2/lastMessageId');
  await store.deleteMessage('1_2', firstId); await settle();
  assert.equal(inbox[0].lastMessage, '');
  assert.equal(inbox[0].isRead, true);
  stop(); assert.equal(db.listenerCount(), 0);
});

test('read receipts mark only displayed messages and never move backwards', async () => {
  const { db, store } = setup();
  await store.sendMessage(1, 2, 'Earlier', 'CLIENT');
  const earlier = db.value('chatrooms/1_2/lastMessageTimestamp');
  await store.sendMessage(1, 2, 'Arrived later', 'CLIENT');
  const later = db.value('chatrooms/1_2/lastMessageTimestamp');
  await store.markChatAsRead('1_2', 2, earlier);
  assert.equal((await store.fetchActiveConversations(2))[0].isRead, false);
  await store.markChatAsRead('1_2', 2, later);
  await store.markChatAsRead('1_2', 2, earlier);
  assert.equal(db.value('chatrooms/1_2/participantDetails/2/lastRead'), later);
  assert.equal((await store.fetchActiveConversations(2))[0].isRead, true);
  await store.markChatAsRead('1_2', 99, later);
  assert.equal(db.value('chatrooms/1_2/participantDetails/99'), null);
});

test('editing an older message or racing with a newer send does not overwrite the newer preview', async () => {
  const { db, store } = setup();
  await store.sendMessage(1, 2, 'Old message', 'CLIENT');
  const oldId = db.value('chatrooms/1_2/lastMessageId');
  await store.sendMessage(2, 1, 'New message', 'LAWYER');
  await store.editMessage('1_2', oldId, 'Edited old message');
  assert.equal(db.value('chatrooms/1_2/lastMessage'), 'New message');
  const latestId = db.value('chatrooms/1_2/lastMessageId');
  db.beforeTransaction = path => {
    if (path !== 'chatrooms/1_2') return;
    db.beforeTransaction = null;
    db.update('', { 'messages/1_2/newer': { senderId: '1', receiverId: '2', content: 'Concurrent send', timestamp: 1000 },
      'chatrooms/1_2/lastMessageId': 'newer', 'chatrooms/1_2/lastMessage': 'Concurrent send', 'chatrooms/1_2/lastMessageTimestamp': 1000 });
  };
  await store.deleteMessage('1_2', latestId);
  assert.equal(db.value('chatrooms/1_2/lastMessage'), 'Concurrent send');
});

test('legacy rooms without a last-message identifier get refreshed after editing', async () => {
  const { db, store } = setup({ messages: { '1_2': { legacy: { content: 'Old preview', timestamp: 50, senderId: '1', receiverId: '2' } } },
    chatrooms: { '1_2': { participants: { '1': true, '2': true }, lastMessage: 'Old preview', lastMessageTimestamp: 50 } } });
  await store.editMessage('1_2', 'legacy', 'New preview');
  assert.equal(db.value('chatrooms/1_2/lastMessage'), 'New preview');
  assert.equal(db.value('chatrooms/1_2/lastMessageId'), 'legacy');
  await assert.rejects(store.editMessage('1_2', 'missing', 'Should not recreate a deleted message'));
  assert.equal(db.value('messages/1_2/missing'), null);
});

test('removing an inbox room cleans its listener and reports connection errors', async () => {
  const { db, store } = setup();
  await store.sendMessage(1, 2, 'Hello', 'CLIENT');
  const errors = [];
  const stop = store.subscribeToConversations(1, () => {}, error => errors.push(error.message));
  await settle(); assert.equal(db.listenerCount(), 2);
  db.fail('chatrooms/1_2', new Error('Permission denied'));
  assert.deepEqual(errors, ['Permission denied']);
  await db.remove('userChatrooms/1/1_2'); await settle();
  assert.equal(db.listenerCount(), 1);
  stop(); assert.equal(db.listenerCount(), 0);
});
