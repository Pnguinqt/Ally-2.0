import { initializeApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Messaging uses the project that holds the existing chats and signs ALLY messaging tokens.
const app = initializeApp({
  apiKey: 'AIzaSyCRzcdZsqQgUI_f-icMCxzIWPvSQsQfe64',
  projectId: 'ally-2-3936e',
  databaseURL: 'https://ally-2-3936e-default-rtdb.asia-southeast1.firebasedatabase.app',
  appId: '1:987902081832:web:e4e4f1f6029d4fa1c66e1d',
}, 'ally-messaging');

export const messagingAuth = initializeAuth(app, { persistence: inMemoryPersistence });
export const messagingDatabase = getDatabase(app);
