import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attendanceRate,
  totalHours,
  summarizeByMember,
  trendByDate,
  longestPresentStreak,
  countByStatus,
  type AttRow,
  type StatusMeta,
} from '../src/domain/attendance.ts';

const statuses: StatusMeta[] = [
  { id: 1, name: 'Present', code: 'P', color: '#0f0', counts_present: 1 },
  { id: 2, name: 'Absent', code: 'A', color: '#f00', counts_present: 0 },
  { id: 3, name: 'Late', code: 'L', color: '#ff0', counts_present: 1 },
  { id: 4, name: 'On Leave', code: 'LV', color: '#00f', counts_present: 0 },
];

const rows: AttRow[] = [
  { member_id: 1, date: '2026-01-01', status_id: 1, hours: 8 },
  { member_id: 1, date: '2026-01-02', status_id: 3, hours: 7 },
  { member_id: 1, date: '2026-01-03', status_id: 2, hours: 0 },
  { member_id: 2, date: '2026-01-01', status_id: 1, hours: 8 },
  { member_id: 2, date: '2026-01-02', status_id: 4, hours: 0 },
];

test('attendanceRate: present (incl. late) over total', () => {
  // 3 counts_present (id 1,3,1) out of 5 total = 60%
  assert.equal(attendanceRate(rows, statuses), 60);
});

test('attendanceRate: empty rows → 0', () => {
  assert.equal(attendanceRate([], statuses), 0);
});

test('attendanceRate: rounds to one decimal', () => {
  const r: AttRow[] = [
    { member_id: 1, date: 'd', status_id: 1 },
    { member_id: 1, date: 'e', status_id: 2 },
    { member_id: 1, date: 'f', status_id: 2 },
  ];
  // 1/3 = 33.333 → 33.3
  assert.equal(attendanceRate(r, statuses), 33.3);
});

test('totalHours sums and rounds', () => {
  assert.equal(totalHours(rows), 23);
  assert.equal(totalHours([{ member_id: 1, date: 'd', status_id: 1, hours: 1.126 }]), 1.13);
  assert.equal(totalHours([{ member_id: 1, date: 'd', status_id: 1, hours: 8.5 }, { member_id: 1, date: 'e', status_id: 1, hours: 7.25 }]), 15.75);
});

test('countByStatus tallies per status', () => {
  const c = countByStatus(rows);
  assert.equal(c.get(1), 2);
  assert.equal(c.get(2), 1);
  assert.equal(c.get(3), 1);
  assert.equal(c.get(4), 1);
});

test('summarizeByMember produces per-member totals + rate', () => {
  const s = summarizeByMember(rows, statuses);
  const m1 = s.find((x) => x.member_id === 1)!;
  assert.equal(m1.total, 3);
  assert.equal(m1.present, 2); // present + late
  assert.equal(m1.ratePct, 66.7);
  assert.equal(m1.hours, 15);
  const m2 = s.find((x) => x.member_id === 2)!;
  assert.equal(m2.total, 2);
  assert.equal(m2.present, 1);
  assert.equal(m2.ratePct, 50);
});

test('trendByDate aggregates by date sorted ascending', () => {
  const t = trendByDate(rows, statuses);
  assert.equal(t.length, 3);
  assert.deepEqual(t.map((x) => x.date), ['2026-01-01', '2026-01-02', '2026-01-03']);
  // 2026-01-01: both present → 2/2 = 100
  assert.equal(t[0].ratePct, 100);
  // 2026-01-02: late(present) + leave(not) → 1/2 = 50
  assert.equal(t[1].ratePct, 50);
  // 2026-01-03: absent only → 0/1 = 0
  assert.equal(t[2].ratePct, 0);
});

test('longestPresentStreak counts consecutive present days', () => {
  const streakRows: AttRow[] = [
    { member_id: 1, date: '2026-01-01', status_id: 1 },
    { member_id: 1, date: '2026-01-02', status_id: 3 }, // late counts present
    { member_id: 1, date: '2026-01-03', status_id: 2 }, // absent breaks
    { member_id: 1, date: '2026-01-04', status_id: 1 },
    { member_id: 1, date: '2026-01-05', status_id: 1 },
    { member_id: 1, date: '2026-01-06', status_id: 1 },
  ];
  assert.equal(longestPresentStreak(streakRows, statuses), 3);
});
