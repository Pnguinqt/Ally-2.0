import { ref, push, update, get, remove, onValue, runTransaction } from 'firebase/database';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { messagingAuth, messagingDatabase } from '../firebase/messaging.js';
import { fetchUserDetails, getAuthData } from '../utils/auth';
import { createMessagingStore } from './messagingStore.js';

const messaging = createMessagingStore({
  ref: path => ref(messagingDatabase, path), push, update, get, remove, onValue, runTransaction, fetchUserDetails,
});

let session;

async function ensureMessagingSession() {
  const auth = getAuthData();
  if (!auth) throw new Error('Sign in to use messaging.');

  if (session?.token !== auth.token) {
    const previous = session?.ready;
    const attempt = { token: auth.token };
    attempt.ready = (async () => {
      await previous?.catch(() => {});
      if (getAuthData()?.token !== auth.token) throw new Error('Your sign-in changed. Reopen messaging.');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/messaging/session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
        cache: 'no-store',
      });
      if (response.status === 401) throw new Error('Sign in again to use messaging.');
      if (!response.ok) throw new Error('Unable to connect to messaging. Try again.');
      const { token } = await response.json();
      const { user } = await signInWithCustomToken(messagingAuth, token);
      if (user.uid !== String(auth.userId) || getAuthData()?.token !== auth.token) {
        await signOut(messagingAuth);
        throw new Error('Your sign-in changed. Reopen messaging.');
      }
    })().catch(error => {
      if (session === attempt) session = undefined;
      throw error;
    });
    session = attempt;
  }

  await session.ready;
  if (getAuthData()?.token !== auth.token || messagingAuth.currentUser?.uid !== String(auth.userId)) {
    throw new Error('Your sign-in changed. Reopen messaging.');
  }
}

const authenticated = operation => async (...args) => {
  await ensureMessagingSession();
  return operation(...args);
};

function authenticatedListener(subscribe, onError) {
  let active = true;
  let unsubscribe;
  ensureMessagingSession().then(() => {
    if (active) unsubscribe = subscribe();
  }).catch(error => { if (active) onError(error); });
  return () => {
    active = false;
    unsubscribe?.();
  };
}

export const fetchActiveConversations = authenticated(messaging.fetchActiveConversations);
export const sendMessage = authenticated(messaging.sendMessage);
export const markChatAsRead = authenticated(messaging.markChatAsRead);
export const editMessage = authenticated(messaging.editMessage);
export const deleteMessage = authenticated(messaging.deleteMessage);

export const subscribeToConversations = (user, callback, onError = console.error) =>
  authenticatedListener(() => messaging.subscribeToConversations(user, callback, onError), onError);

export const subscribeToMessages = (sender, receiver, callback, onError = console.error) =>
  authenticatedListener(() => messaging.subscribeToMessages(sender, receiver, callback, onError), onError);
