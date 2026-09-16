import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateRange, addDays, dayOfWeek, hoursBetween, ymd, parseYmd } from '../src/domain/dates.ts';

test('dateRange: inclusive list', () => {
  assert.deepEqual(dateRange('2026-01-01', '2026-01-03'), ['2026-01-01', '2026-01-02', '2026-01-03']);
});

test('dateRange: single day', () => {
  assert.deepEqual(dateRange('2026-01-01', '2026-01-01'), ['2026-01-01']);
});

test('dateRange: crosses month boundary', () => {
  assert.deepEqual(dateRange('2026-01-30', '2026-02-02'), ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02']);
});

test('addDays: forward and backward, crossing year', () => {
  assert.equal(addDays('2026-01-01', 31), '2026-02-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('dayOfWeek: 0=Sun..6=Sat', () => {
  assert.equal(dayOfWeek('2026-09-13'), 0); // Sunday
  assert.equal(dayOfWeek('2026-09-16'), 3); // Wednesday
});

test('hoursBetween: normal shift', () => {
  assert.equal(hoursBetween('09:00', '17:00'), 8);
  assert.equal(hoursBetween('09:15', '17:45'), 8.5);
});

test('hoursBetween: overnight shift wraps midnight', () => {
  assert.equal(hoursBetween('22:00', '06:00'), 8);
});

test('hoursBetween: missing values → null', () => {
  assert.equal(hoursBetween(null, '17:00'), null);
  assert.equal(hoursBetween('09:00', undefined), null);
});

test('ymd / parseYmd round-trip', () => {
  const d = parseYmd('2026-09-16');
  assert.equal(ymd(d), '2026-09-16');
});
