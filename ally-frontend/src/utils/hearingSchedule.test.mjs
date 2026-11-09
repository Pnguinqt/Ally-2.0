import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHearingSchedule } from './hearingSchedule.js';

const hearing = { hearingId: 1, startsAt: '2026-11-12T01:00:00Z', endsAt: '2026-11-12T02:00:00Z' };

test('one malformed appointment does not hide valid appointments', () => {
  const result = readHearingSchedule([
    hearing,
    { ...hearing, startsAt: 'invalid' },
    { ...hearing, endsAt: null },
    { ...hearing, title: { text: 'invalid title' } },
    null,
  ]);
  assert.deepEqual(result, { appointments: [hearing], incomplete: true });
});

test('an empty schedule is valid and a non-list response produces a useful error', () => {
  assert.deepEqual(readHearingSchedule([]), { appointments: [], incomplete: false });
  assert.throws(() => readHearingSchedule({ message: 'Unexpected response' }), /unexpected format/);
});
