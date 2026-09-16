// Pure attendance aggregation/calculation logic (unit-tested; no DB/HTTP).

export interface AttRow {
  member_id: number;
  date: string;
  status_id: number;
  hours?: number | null;
}

export interface StatusMeta {
  id: number;
  name: string;
  code: string;
  color: string;
  counts_present: number; // 1 if it counts toward attendance rate
}

/** Count records per status_id. */
export function countByStatus(rows: AttRow[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) m.set(r.status_id, (m.get(r.status_id) ?? 0) + 1);
  return m;
}

/**
 * Attendance rate = (records with a "counts_present" status) / (total marked records).
 * Returns 0 when there are no records.
 */
export function attendanceRate(rows: AttRow[], statuses: StatusMeta[]): number {
  if (rows.length === 0) return 0;
  const presentIds = new Set(statuses.filter((s) => s.counts_present === 1).map((s) => s.id));
  const present = rows.filter((r) => presentIds.has(r.status_id)).length;
  return Math.round((present / rows.length) * 1000) / 10; // one decimal %
}

/** Total worked hours across rows. */
export function totalHours(rows: AttRow[]): number {
  const sum = rows.reduce((acc, r) => acc + (r.hours ?? 0), 0);
  return Math.round(sum * 100) / 100;
}

export interface MemberSummary {
  member_id: number;
  total: number;
  present: number;
  ratePct: number;
  hours: number;
  byStatus: Record<number, number>;
}

/** Per-member summary over a set of rows. */
export function summarizeByMember(rows: AttRow[], statuses: StatusMeta[]): MemberSummary[] {
  const presentIds = new Set(statuses.filter((s) => s.counts_present === 1).map((s) => s.id));
  const byMember = new Map<number, AttRow[]>();
  for (const r of rows) {
    if (!byMember.has(r.member_id)) byMember.set(r.member_id, []);
    byMember.get(r.member_id)!.push(r);
  }
  const out: MemberSummary[] = [];
  for (const [member_id, mrows] of byMember) {
    const present = mrows.filter((r) => presentIds.has(r.status_id)).length;
    const byStatus: Record<number, number> = {};
    for (const r of mrows) byStatus[r.status_id] = (byStatus[r.status_id] ?? 0) + 1;
    out.push({
      member_id,
      total: mrows.length,
      present,
      ratePct: mrows.length ? Math.round((present / mrows.length) * 1000) / 10 : 0,
      hours: totalHours(mrows),
      byStatus,
    });
  }
  return out.sort((a, b) => a.member_id - b.member_id);
}

/** Daily trend: for each date, present count and total count. */
export function trendByDate(
  rows: AttRow[],
  statuses: StatusMeta[],
): Array<{ date: string; present: number; total: number; ratePct: number }> {
  const presentIds = new Set(statuses.filter((s) => s.counts_present === 1).map((s) => s.id));
  const byDate = new Map<string, { present: number; total: number }>();
  for (const r of rows) {
    const e = byDate.get(r.date) ?? { present: 0, total: 0 };
    e.total++;
    if (presentIds.has(r.status_id)) e.present++;
    byDate.set(r.date, e);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({
      date,
      present: v.present,
      total: v.total,
      ratePct: v.total ? Math.round((v.present / v.total) * 1000) / 10 : 0,
    }));
}

/** Longest run of consecutive "present" days for a member's chronologically-sorted rows. */
export function longestPresentStreak(rows: AttRow[], statuses: StatusMeta[]): number {
  const presentIds = new Set(statuses.filter((s) => s.counts_present === 1).map((s) => s.id));
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
  let best = 0;
  let cur = 0;
  for (const r of sorted) {
    if (presentIds.has(r.status_id)) {
      cur++;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}
