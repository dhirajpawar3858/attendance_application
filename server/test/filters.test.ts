import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAttendanceQuery, resolvePreset } from '../src/domain/filters.ts';

test('buildAttendanceQuery: always scopes to org', () => {
  const { where, params } = buildAttendanceQuery({ orgId: 5 });
  assert.match(where, /a\.org_id = \?/);
  assert.deepEqual(params, [5]);
});

test('buildAttendanceQuery: date range adds bounded clauses + params in order', () => {
  const { where, params } = buildAttendanceQuery({ orgId: 1, dateFrom: '2026-01-01', dateTo: '2026-01-31' });
  assert.match(where, /a\.date >= \?/);
  assert.match(where, /a\.date <= \?/);
  assert.deepEqual(params, [1, '2026-01-01', '2026-01-31']);
});

test('buildAttendanceQuery: multi-select status uses correct placeholder count', () => {
  const { where, params } = buildAttendanceQuery({ orgId: 1, statusIds: [2, 3, 4] });
  assert.match(where, /a\.status_id IN \(\?,\?,\?\)/);
  assert.deepEqual(params, [1, 2, 3, 4]);
});

test('buildAttendanceQuery: search binds three LIKE params', () => {
  const { where, params } = buildAttendanceQuery({ orgId: 1, search: 'ana' });
  assert.match(where, /m\.name LIKE \? OR a\.note LIKE \? OR m\.member_code LIKE \?/);
  assert.deepEqual(params, [1, '%ana%', '%ana%', '%ana%']);
});

test('buildAttendanceQuery: custom fields become subquery params', () => {
  const { where, params } = buildAttendanceQuery({
    orgId: 1,
    customFields: [{ fieldId: 9, value: 'Morning' }],
  });
  assert.match(where, /custom_field_values WHERE field_id = \? AND value LIKE \?/);
  assert.deepEqual(params, [1, 9, '%Morning%']);
});

test('buildAttendanceQuery: empty custom-field value is ignored', () => {
  const { params } = buildAttendanceQuery({ orgId: 1, customFields: [{ fieldId: 9, value: '' }] });
  assert.deepEqual(params, [1]);
});

test('buildAttendanceQuery: sort maps to columns + direction', () => {
  assert.match(buildAttendanceQuery({ orgId: 1, sortBy: 'name', sortDir: 'asc' }).order, /ORDER BY m\.name ASC/);
  assert.match(buildAttendanceQuery({ orgId: 1, sortBy: 'hours', sortDir: 'desc' }).order, /ORDER BY a\.hours DESC/);
  assert.match(buildAttendanceQuery({ orgId: 1, sortBy: 'department' }).order, /ORDER BY d\.name ASC/);
  // default
  assert.match(buildAttendanceQuery({ orgId: 1 }).order, /ORDER BY a\.date ASC/);
});

test('buildAttendanceQuery: combined filters keep param order aligned with clauses', () => {
  const { params } = buildAttendanceQuery({
    orgId: 7,
    dateFrom: '2026-02-01',
    statusIds: [1, 2],
    departmentIds: [3],
    search: 'x',
  });
  assert.deepEqual(params, [7, '2026-02-01', 1, 2, 3, '%x%', '%x%', '%x%']);
});

// ---- preset resolution ----
test('resolvePreset: today / yesterday', () => {
  assert.deepEqual(resolvePreset('today', '2026-09-16'), { from: '2026-09-16', to: '2026-09-16' });
  assert.deepEqual(resolvePreset('yesterday', '2026-09-16'), { from: '2026-09-15', to: '2026-09-15' });
});

test('resolvePreset: last7 / last30 inclusive windows', () => {
  assert.deepEqual(resolvePreset('last7', '2026-09-16'), { from: '2026-09-10', to: '2026-09-16' });
  assert.deepEqual(resolvePreset('last30', '2026-09-16'), { from: '2026-08-18', to: '2026-09-16' });
});

test('resolvePreset: thisMonth spans first→last day', () => {
  assert.deepEqual(resolvePreset('thisMonth', '2026-09-16'), { from: '2026-09-01', to: '2026-09-30' });
});

test('resolvePreset: lastMonth handles year boundary', () => {
  assert.deepEqual(resolvePreset('lastMonth', '2026-01-10'), { from: '2025-12-01', to: '2025-12-31' });
});

test('resolvePreset: thisYear', () => {
  assert.deepEqual(resolvePreset('thisYear', '2026-09-16'), { from: '2026-01-01', to: '2026-12-31' });
});

test('resolvePreset: unknown → null', () => {
  assert.equal(resolvePreset('nope', '2026-09-16'), null);
});
