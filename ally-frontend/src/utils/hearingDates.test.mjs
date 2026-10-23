import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDate, calendarDateKey, formatHearingTime, hearingDateKey, hearingInstant } from './hearingDates.js';

test('Manila hearing dates cross the UTC day boundary correctly', () => {
  assert.equal(hearingDateKey('2026-10-21T16:30:00Z'), '2026-10-22');
  assert.equal(hearingDateKey('2026-10-21T15:59:59Z'), '2026-10-21');
  assert.equal(hearingDateKey('2026-12-31T16:00:00Z'), '2027-01-01');
});

test('booking always converts Philippine time to UTC regardless of browser timezone', () => {
  assert.equal(hearingInstant('2026-10-22', '09:00'), '2026-10-22T01:00:00.000Z');
  assert.equal(hearingInstant('2026-10-22', '00:30'), '2026-10-21T16:30:00.000Z');
  assert.match(formatHearingTime('2026-10-22T01:00:00Z'), /9:00\s?am/i);
});

test('calendar selection preserves Manila date keys across leap days and year boundaries', () => {
  for (const key of ['2026-01-01', '2028-02-29', '2026-12-31']) {
    assert.equal(calendarDateKey(calendarDate(key)), key);
    assert.equal(hearingDateKey(hearingInstant(key, '00:30')), key);
  }
});
