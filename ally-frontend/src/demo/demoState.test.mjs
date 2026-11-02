import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_KEY, demoReducer, newDemoSession, quests, questUnlocked, readDemoSession } from './demoState.js';

const step = (state, type, rest = {}) => demoReducer(state, { type, ...rest });
const create = state => step(state, 'create-case', { legalCase: { id: 'practice-case' } });
const finishChats = state => step(step(state, 'chat-success', { mode: 'normal' }), 'chat-success', { mode: 'case-search' });

test('normal queries and Case Search complete separately; both unlock case creation', () => {
  let state = newDemoSession();
  assert.equal(questUnlocked(state, 0), false);
  assert.equal(create(state).legalCase, null);
  state = step(state, 'start');
  assert.equal(questUnlocked(state, 0), true);
  assert.equal(create(state).legalCase, null);
  state = step(state, 'chat-success', { mode: 'normal' });
  assert.deepEqual(state.completed, ['chat']);
  assert.equal(create(state).legalCase, null);
  assert.equal(questUnlocked(state, 'case-search'), true);
  assert.equal(questUnlocked(state, 'case'), false);
  state = step(state, 'chat-success', { mode: 'normal' });
  assert.deepEqual(state.completed, ['chat']);
  state = step(state, 'chat-success', { mode: 'case-search' });
  state = create(state);
  assert.deepEqual(state.completed, ['chat', 'case-search', 'case']);
  assert.equal(questUnlocked(state, 'workspace'), true);
  assert.equal(step(state, 'upload', { document: {} }).document, null);
});

test('workspace requires both tool visits and a saved nonempty note, in any order', () => {
  let state = create(finishChats(step(newDemoSession(), 'start')));
  state = step(state, 'save-notes', { notes: 'Review agreement with counsel' });
  state = step(state, 'visit', { tab: 'hearings' });
  assert.equal(state.completed.includes('workspace'), false);
  state = step(state, 'visit', { tab: 'overview' });
  assert.equal(state.completed.includes('workspace'), true);
  assert.equal(questUnlocked(state, 'upload'), true);
});

test('a replacement PDF invalidates the previous summary; reset clears all respondent data', () => {
  let state = create(finishChats(step(newDemoSession(), 'start')));
  state = step(step(state, 'visit', { tab: 'overview' }), 'visit', { tab: 'hearings' });
  state = step(state, 'save-notes', { notes: 'Gather the agreement' });
  state = step(state, 'upload', { document: { name: 'first.pdf' } });
  state = step(state, 'summary', { summary: { summary: 'First document summary' } });
  assert.equal(state.completed.length, quests.length);
  state = step(state, 'upload', { document: { name: 'replacement.pdf' } });
  assert.equal(state.completed.includes('summary'), false);
  assert.equal(state.summary, null);
  const reset = step(state, 'reset');
  assert.notEqual(reset.id, state.id);
  assert.equal(reset.legalCase, null);
  assert.equal(reset.document, null);
  assert.equal(reset.notes, '');
  assert.deepEqual(reset.messages, []);
  assert.deepEqual(reset.completed, []);
});

test('separate demo sessions have separate identities and activity', () => {
  const first = step(step(newDemoSession(), 'start'), 'chat-success', { mode: 'normal' });
  const second = newDemoSession();
  assert.notEqual(first.id, second.id);
  assert.deepEqual(second.completed, []);
  assert.equal(second.started, false);
});

test('Case Search alone and unspecified chat successes do not fulfill the normal-query quest', () => {
  let state = step(newDemoSession(), 'start');
  state = step(state, 'chat-success');
  assert.deepEqual(state.completed, []);
  state = step(state, 'chat-success', { mode: 'case-search' });
  assert.deepEqual(state.completed, ['case-search']);
  assert.equal(questUnlocked(state, 'case'), false);
  assert.equal(create(state).legalCase, null);
});

test('old sessions retain data and receive credit only for chatbot modes with saved successful replies', () => {
  const previousStorage = globalThis.sessionStorage;
  const saved = { ...newDemoSession(), version: 1, started: true, completed: ['chat', 'case'],
    legalCase: { id: 'existing-practice-case' }, messages: [{ sender: 'ai', text: 'A normal explanation', ragEnabled: false }] };
  globalThis.sessionStorage = { getItem: key => key === DEMO_KEY ? JSON.stringify(saved) : null };
  try {
    let restored = readDemoSession();
    assert.deepEqual(restored.completed, ['chat', 'case']);
    assert.deepEqual(restored.legalCase, saved.legalCase);
    assert.equal(questUnlocked(restored, 'case'), false);
    saved.conversations = { earlier: { messages: [{ sender: 'ai', text: 'No matching cases found', ragEnabled: true, relevantCases: [] }] } };
    restored = readDemoSession();
    assert.deepEqual(restored.completed, ['chat', 'case-search', 'case']);
    assert.equal(restored.version, 2);
  } finally {
    if (previousStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previousStorage;
  }
});

test('starting another chat preserves demo history and deleting a turn affects only that demo', () => {
  const messages = [{ id: 'question', sender: 'user', requestId: 'turn-1', text: 'Question' },
    { id: 'answer', sender: 'ai', requestId: 'turn-1', text: 'Answer' }];
  let state = step(newDemoSession(), 'save-chat', { chat: { conversationId: 'first', messages, useRAG: true } });
  state = step(state, 'save-chat', { chat: { conversationId: 'second', messages: [], useRAG: false } });
  assert.equal(state.conversations.first.messages.length, 2);
  assert.equal(state.messages.length, 0);
  state = step(state, 'remove-chat-turn', { id: 'turn-1' });
  assert.deepEqual(state.conversations.first.messages, []);
});

test('reset also removes simulated messages, appointments, profile changes, and chat archives', () => {
  let state = step(newDemoSession(), 'contact-messages', { messages: [{ content: 'Practice message' }] });
  state = step(state, 'appointment', { appointment: { scheduleId: -1 } });
  state = step(state, 'profile', { profile: { firstName: 'Practice' } });
  state = step(state, 'archive-chat', { id: 'workspace-chat', messages: [{ text: 'Private practice chat' }] });
  state = step(state, 'reset');
  for (const field of ['contactMessages', 'appointments', 'profile', 'conversations']) assert.equal(state[field], undefined);
});

test('hints reveal independently, persist on refresh, and never complete or unlock quests', () => {
  const initial = newDemoSession();
  assert.equal(step(initial, 'reveal-hint', { questId: 'chat' }), initial);
  let state = step(initial, 'start');
  for (const quest of quests) {
    for (let i = 0; i < 5; i++) state = step(state, 'reveal-hint', { questId: quest.id });
    assert.equal(state.hints[quest.id], quest.hints.length);
  }
  assert.deepEqual(state.completed, []);
  assert.equal(questUnlocked(state, 'case-search'), false);
  assert.equal(step(state, 'reveal-hint', { questId: 'unknown-quest' }), state);
  const previousStorage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => JSON.stringify(state) };
  try { assert.deepEqual(readDemoSession().hints, state.hints); }
  finally {
    if (previousStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previousStorage;
  }
  assert.deepEqual(step(state, 'reset').hints, {});
});
