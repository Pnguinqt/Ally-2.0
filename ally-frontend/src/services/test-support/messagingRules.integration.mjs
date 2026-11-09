import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectDatabaseEmulator, getDatabase, get, onValue, push, ref, remove, runTransaction, update } from 'firebase/database';
import { createMessagingStore } from '../messagingStore.js';

test('Firebase rules authorize both chat participants and reject outsiders and expired sessions', async t => {
  const projectId = 'demo-ally-messaging';
  const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
  const [hostname, port] = host.split(':');
  assert.ok(['localhost', '127.0.0.1'].includes(hostname), 'Use a local emulator for this test.');

  function connect(name, claims) {
    const app = initializeApp({ projectId, databaseURL: `https://${projectId}-default-rtdb.firebaseio.com` }, name);
    t.after(() => deleteApp(app));
    const db = getDatabase(app);
    connectDatabaseEmulator(db, hostname, Number(port), claims && { mockUserToken: claims });
    return db;
  }

  const run = Date.now().toString();
  const clientId = `12${run}`;
  const lawyerId = `8${run}`;
  const claims = (sub, allyRole, allyMessagingExpiresAt = Date.now() + 60_000) => ({ sub, allyRole, allyMessagingExpiresAt });
  const client = connect('client', claims(clientId, 'CLIENT'));
  const lawyer = connect('lawyer', claims(lawyerId, 'LAWYER'));
  const outsider = connect('outsider', claims('3', 'CLIENT'));
  const expired = connect('expired', claims(clientId, 'CLIENT', Date.now() - 1));
  const anonymous = connect('anonymous');
  const store = db => createMessagingStore({ ref: path => ref(db, path), get, onValue, push, remove, runTransaction, update });
  const room = `${clientId}_${lawyerId}`;
  const messagePath = `messages/${room}`;

  await new Promise((resolve, reject) => {
    store(client).subscribeToMessages(clientId, lawyerId, resolve, reject);
  }).then(({ messages }) => assert.equal(messages.length, 0));
  await assert.rejects(get(ref(outsider, messagePath)), /permission.?denied/i);
  await assert.rejects(store(anonymous).sendMessage(clientId, lawyerId, 'Anonymous send', 'CLIENT'), /permission.?denied/i);
  await assert.rejects(store(outsider).sendMessage(clientId, lawyerId, 'Forged sender', 'CLIENT'), /permission.?denied/i);

  await store(client).sendMessage(clientId, lawyerId, 'First message', 'CLIENT');
  assert.equal((await get(ref(lawyer, `userChatrooms/${lawyerId}/${room}`))).val(), true);
  const [messageId] = Object.keys((await get(ref(lawyer, messagePath))).val());
  const message = `${messagePath}/${messageId}`;
  await assert.rejects(get(ref(outsider, `chatrooms/${room}`)), /permission.?denied/i);
  await assert.rejects(get(ref(expired, message)), /permission.?denied/i);
  await assert.rejects(update(ref(lawyer, message), { content: 'Forged edit' }), /permission.?denied/i);
  await assert.rejects(store(lawyer).deleteMessage(room, messageId), /permission.?denied/i);

  await store(client).editMessage(room, messageId, 'Edited message');
  assert.equal((await get(ref(lawyer, `${message}/content`))).val(), 'Edited message');
  const timestamp = (await get(ref(lawyer, `${message}/timestamp`))).val();
  await store(lawyer).markChatAsRead(room, lawyerId, timestamp);
  const readReceipt = `chatrooms/${room}/participantDetails/${lawyerId}/lastRead`;
  await assert.rejects(remove(ref(client, readReceipt)), /permission.?denied/i);
  assert.equal((await get(ref(lawyer, readReceipt))).val(), timestamp);

  await store(lawyer).sendMessage(lawyerId, clientId, 'Reply', 'LAWYER');
  await store(client).deleteMessage(room, messageId);
  assert.equal((await get(ref(lawyer, message))).exists(), false);
  assert.equal((await get(ref(client, `chatrooms/${room}/lastMessage`))).val(), 'Reply');
});
