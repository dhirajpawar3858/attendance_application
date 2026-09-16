import { all, get } from '../db/connection.ts';
import { assertMember } from './org.ts';
import {
  attendanceRate,
  summarizeByMember,
  trendByDate,
  type AttRow,
  type StatusMeta,
} from '../domain/attendance.ts';
import { buildAttendanceQuery, type FilterConfig } from '../domain/filters.ts';
import { toCSV } from '../domain/csv.ts';
import { addDays, dateRange } from '../domain/dates.ts';

function statusesFor(orgId: number): StatusMeta[] {
  return all<StatusMeta>(
    'SELECT id, name, code, color, counts_present FROM attendance_statuses WHERE org_id = ?',
    orgId,
  );
}

function rowsFor(cfg: FilterConfig): AttRow[] {
  const { where, params } = buildAttendanceQuery(cfg);
  return all<AttRow>(
    `SELECT a.member_id, a.date, a.status_id, a.hours
       FROM attendance a
       JOIN members m ON m.id = a.member_id
       LEFT JOIN attendance_statuses s ON s.id = a.status_id
       LEFT JOIN departments d ON d.id = m.department_id
       ${where}`,
    ...params,
  );
}

/** Dashboard for a single day + range trend. */
export function dashboard(userId: number, orgId: number, today: string, from: string, to: string) {
  assertMember(userId, orgId);
  const statuses = statusesFor(orgId);
  const presentIds = new Set(statuses.filter((s) => s.counts_present === 1).map((s) => s.id));

  const totalMembers =
    get<{ c: number }>('SELECT COUNT(*) AS c FROM members WHERE org_id = ? AND archived = 0', orgId)
      ?.c ?? 0;

  const todayRows = all<AttRow>(
    'SELECT member_id, date, status_id, hours FROM attendance WHERE org_id = ? AND date = ?',
    orgId,
    today,
  );

  // count today's records by status name
  const byStatusToday: Record<string, number> = {};
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  for (const r of todayRows) {
    const s = statusById.get(r.status_id);
    if (s) byStatusToday[s.name] = (byStatusToday[s.name] ?? 0) + 1;
  }
  const presentToday = todayRows.filter((r) => presentIds.has(r.status_id)).length;

  const rangeRows = all<AttRow>(
    'SELECT member_id, date, status_id, hours FROM attendance WHERE org_id = ? AND date >= ? AND date <= ?',
    orgId,
    from,
    to,
  );

  // per-status distribution over range
  const statusDist = statuses.map((s) => ({
    name: s.name,
    color: s.color,
    count: rangeRows.filter((r) => r.status_id === s.id).length,
  }));

  // per-department breakdown over range
  const deptRows = all<{ department_name: string | null; member_id: number; status_id: number }>(
    `SELECT d.name AS department_name, a.member_id, a.status_id
       FROM attendance a JOIN members m ON m.id = a.member_id
       LEFT JOIN departments d ON d.id = m.department_id
      WHERE a.org_id = ? AND a.date >= ? AND a.date <= ?`,
    orgId,
    from,
    to,
  );
  const deptMap = new Map<string, { total: number; present: number }>();
  for (const r of deptRows) {
    const key = r.department_name || 'Unassigned';
    const e = deptMap.get(key) ?? { total: 0, present: 0 };
    e.total++;
    if (presentIds.has(r.status_id)) e.present++;
    deptMap.set(key, e);
  }
  const byDepartment = [...deptMap.entries()].map(([name, v]) => ({
    name,
    total: v.total,
    present: v.present,
    ratePct: v.total ? Math.round((v.present / v.total) * 1000) / 10 : 0,
  }));

  // ----- per-card 7-day sparklines + week-over-week deltas -----
  // Pull the last 14 days so we can compare this week vs the prior week.
  const spkFrom = addDays(today, -13);
  const spkRows = all<AttRow>(
    'SELECT member_id, date, status_id, hours FROM attendance WHERE org_id = ? AND date >= ? AND date <= ?',
    orgId,
    spkFrom,
    today,
  );
  const statusByName = (name: string) => statuses.find((s) => s.name === name)?.id;
  const days7 = dateRange(addDays(today, -6), today); // oldest→newest

  // count matcher per metric
  const matchers: Record<string, (r: AttRow) => boolean> = {
    present: (r) => presentIds.has(r.status_id),
    absent: (r) => r.status_id === statusByName('Absent'),
    late: (r) => r.status_id === statusByName('Late'),
    onLeave: (r) => r.status_id === statusByName('On Leave'),
    marked: () => true,
  };

  const spark: Record<string, number[]> = {};
  const delta: Record<string, number> = {};
  for (const [key, match] of Object.entries(matchers)) {
    // daily series for the last 7 days
    spark[key] = days7.map((d) => spkRows.filter((r) => r.date === d && match(r)).length);
    // this week (last 7) vs prior week (7 before that)
    const thisWeek = spkRows.filter((r) => r.date >= addDays(today, -6) && match(r)).length;
    const priorWeek = spkRows.filter(
      (r) => r.date >= addDays(today, -13) && r.date <= addDays(today, -7) && match(r),
    ).length;
    delta[key] = thisWeek - priorWeek;
  }

  // attendance-rate sparkline (percent per day) + delta
  const rateSpark = days7.map((d) => {
    const dayRows = spkRows.filter((r) => r.date === d);
    return dayRows.length
      ? Math.round((dayRows.filter((r) => presentIds.has(r.status_id)).length / dayRows.length) * 100)
      : 0;
  });
  const rateThis = attendanceRate(
    spkRows.filter((r) => r.date >= addDays(today, -6)),
    statuses,
  );
  const ratePrior = attendanceRate(
    spkRows.filter((r) => r.date >= addDays(today, -13) && r.date <= addDays(today, -7)),
    statuses,
  );

  return {
    cards: {
      totalMembers,
      presentToday,
      absentToday: byStatusToday['Absent'] ?? 0,
      lateToday: byStatusToday['Late'] ?? 0,
      onLeaveToday: byStatusToday['On Leave'] ?? 0,
      marketToday: todayRows.length,
      rangeRatePct: attendanceRate(rangeRows, statuses),
      todayRatePct: attendanceRate(todayRows, statuses),
    },
    spark: { ...spark, rate: rateSpark },
    delta: { ...delta, rate: Math.round((rateThis - ratePrior) * 10) / 10 },
    byStatusToday,
    statusDist,
    byDepartment,
    trend: trendByDate(rangeRows, statuses),
  };
}

/** Per-member report over a filtered range. */
export function memberReport(userId: number, cfg: FilterConfig) {
  assertMember(userId, cfg.orgId);
  const statuses = statusesFor(cfg.orgId);
  const rows = rowsFor(cfg);
  const summaries = summarizeByMember(rows, statuses);
  const members = all<{ id: number; name: string; member_code: string; department_name: string }>(
    `SELECT m.id, m.name, m.member_code, d.name AS department_name
       FROM members m LEFT JOIN departments d ON d.id = m.department_id
      WHERE m.org_id = ?`,
    cfg.orgId,
  );
  const memberById = new Map(members.map((m) => [m.id, m]));
  return summaries.map((s) => ({
    ...s,
    name: memberById.get(s.member_id)?.name ?? `#${s.member_id}`,
    member_code: memberById.get(s.member_id)?.member_code ?? '',
    department_name: memberById.get(s.member_id)?.department_name ?? '',
  }));
}

/** Export a report (member summary) to CSV. */
export function memberReportCSV(userId: number, cfg: FilterConfig): string {
  const statuses = statusesFor(cfg.orgId);
  const report = memberReport(userId, cfg);
  const statusHeaders = statuses.map((s) => s.name);
  const headers = ['Member', 'Code', 'Department', 'Total', 'Present', 'Rate %', 'Hours', ...statusHeaders];
  const rows = report.map((r) => {
    const row: Record<string, unknown> = {
      Member: r.name,
      Code: r.member_code,
      Department: r.department_name,
      Total: r.total,
      Present: r.present,
      'Rate %': r.ratePct,
      Hours: r.hours,
    };
    for (const s of statuses) row[s.name] = r.byStatus[s.id] ?? 0;
    return row;
  });
  return toCSV(headers, rows);
}

/** Raw detail export (one row per attendance record) to CSV. */
export function detailCSV(userId: number, cfg: FilterConfig): string {
  assertMember(userId, cfg.orgId);
  const { where, params, order } = buildAttendanceQuery(cfg);
  const rows = all<any>(
    `SELECT a.date, m.name AS member, m.member_code AS code, d.name AS department,
            s.name AS status, a.check_in, a.check_out, a.hours, a.location, a.note
       FROM attendance a JOIN members m ON m.id = a.member_id
       LEFT JOIN attendance_statuses s ON s.id = a.status_id
       LEFT JOIN departments d ON d.id = m.department_id
       ${where} ${order}`,
    ...params,
  );
  const headers = ['date', 'member', 'code', 'department', 'status', 'check_in', 'check_out', 'hours', 'location', 'note'];
  return toCSV(headers, rows);
}
