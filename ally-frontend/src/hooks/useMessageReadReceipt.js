import { useEffect, useRef } from 'react';

export default function useMessageReadReceipt(chatroomId, userId, messages, markChatAsRead) {
  const lastSeen = useRef({ room: null, timestamp: 0 });
  useEffect(() => {
    if (!chatroomId || !userId) return;
    const markVisibleMessages = () => {
      if (document.visibilityState === 'hidden') return;
      const timestamp = Math.max(0, ...messages.filter(message => String(message.senderId) !== String(userId))
        .map(message => new Date(message.timestamp).getTime()).filter(Number.isFinite));
      if (!timestamp || (lastSeen.current.room === chatroomId && lastSeen.current.timestamp >= timestamp)) return;
      lastSeen.current = { room: chatroomId, timestamp };
      markChatAsRead(chatroomId, userId, timestamp).catch(error => {
        if (lastSeen.current.room === chatroomId && lastSeen.current.timestamp === timestamp) lastSeen.current.timestamp = 0;
        console.error('Unable to update the conversation read status:', error);
      });
    };
    markVisibleMessages();
    document.addEventListener('visibilitychange', markVisibleMessages);
    window.addEventListener('focus', markVisibleMessages);
    return () => {
      document.removeEventListener('visibilitychange', markVisibleMessages);
      window.removeEventListener('focus', markVisibleMessages);
    };
  }, [chatroomId, userId, messages, markChatAsRead]);
}
