import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caseActivityTimestamp, organizeWorkspaceCases } from './workspaceCases.js';

const now = Date.parse('2026-11-04T12:00:00+08:00');
const daysAgo = days => new Date(now - days * 86400000).toISOString();
const cases = [
  { caseId: 1, title: 'Property dispute', updatedAt: daysAgo(31) },
  { caseId: 2, title: 'Case 10', updatedAt: daysAgo(7) },
  { caseId: 3, title: 'Case 2', updatedAt: daysAgo(1) },
  { caseId: 4, title: 'Contract review', dateSubmitted: daysAgo(30) },
  { caseId: 5, title: 'Undated case', updatedAt: 'invalid' },
];
const ids = items => items.map(item => item.caseId);

test('recent shows newest activity first, keeps undated cases, and does not mutate input', () => {
  assert.deepEqual(ids(organizeWorkspaceCases(cases, 'recent', now)), [3, 2, 4, 1, 5]);
  assert.deepEqual(ids(cases), [1, 2, 3, 4, 5]);
});

test('week and month include their exact boundaries and exclude undated or future cases', () => {
  const input = [...cases, { caseId: 6, updatedAt: daysAgo(-1) }, { caseId: 7, updatedAt: daysAgo(7.001) }];
  assert.deepEqual(ids(organizeWorkspaceCases(input, 'week', now)), [3, 2]);
  assert.deepEqual(ids(organizeWorkspaceCases(input, 'month', now)), [3, 2, 7, 4]);
});

test('by case uses natural alphabetical title order including numbered and unnamed cases', () => {
  assert.deepEqual(ids(organizeWorkspaceCases([...cases, { caseId: 6 }], 'case', now)), [6, 3, 2, 4, 1, 5]);
});

test('invalid update dates fall back to submission or creation dates', () => {
  assert.equal(caseActivityTimestamp({ updatedAt: 'invalid', dateSubmitted: daysAgo(2) }), now - 2 * 86400000);
  assert.equal(caseActivityTimestamp({ createdAt: daysAgo(1) }), now - 86400000);
  assert.equal(caseActivityTimestamp({}), null);
});

test('date organization preserves a prior client or status scope and handles empty lists', () => {
  const input = cases.map(item => ({ ...item, clientId: item.caseId % 2 }));
  const scoped = input.filter(item => item.clientId === 1);
  assert.deepEqual(ids(organizeWorkspaceCases(scoped, 'month', now)), [3]);
  assert.deepEqual(organizeWorkspaceCases([], 'week', now), []);
});
