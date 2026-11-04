import { ref, push, update, get, remove, onValue, runTransaction } from 'firebase/database';
import { database } from '../firebase/config';
import { fetchUserDetails } from '../utils/auth';
import { createMessagingStore } from './messagingStore.js';

const messaging = createMessagingStore({
  ref: path => ref(database, path), push, update, get, remove, onValue, runTransaction, fetchUserDetails,
});

export const { fetchActiveConversations, subscribeToConversations, sendMessage, subscribeToMessages,
  markChatAsRead, editMessage, deleteMessage } = messaging;
