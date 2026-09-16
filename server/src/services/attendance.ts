import { all, get, run, tx } from '../db/connection.ts';
import { assertCanEdit, assertMember } from './org.ts';
import { badRequest, notFound } from '../util/errors.ts';
import { logAudit } from './audit.ts';
import { buildAttendanceQuery, type FilterConfig } from '../domain/filters.ts';
import { hoursBetween, dateRange } from '../domain/dates.ts';

export interface AttInput {
  member_id: number;
  date: string;
  status_id: number;
  check_in?: string | null;
  check_out?: string | null;
  hours?: number | null;
  location?: string | null;
  note?: string | null;
}

/** Query attendance records with joins + filters. */
export function queryAttendance(userId: number, cfg: FilterConfig) {
  assertMember(userId, cfg.orgId);
  const { where, params, order } = buildAttendanceQuery(cfg);
  const sql = `
    SELECT a.*, m.name AS member_name, m.member_code, m.department_id,
           d.name AS department_name, s.name AS status_name, s.code AS status_code,
           s.color AS status_color
      FROM attendance a
      JOIN members m ON m.id = a.member_id
      LEFT JOIN attendance_statuses s ON s.id = a.status_id
      LEFT JOIN departments d ON d.id = m.department_id
      ${where}
      ${order}`;
  return all(sql, ...params);
}

/** Roster grid: rows = members, columns = dates in range, cell = attendance record. */
export function roster(
  userId: number,
  orgId: number,
  from: string,
  to: string,
  opts: { departmentId?: number; search?: string } = {},
) {
  assertMember(userId, orgId);
  const dates = dateRange(from, to);
  let msql = 'SELECT id, name, member_code, department_id FROM members WHERE org_id = ? AND archived = 0';
  const mparams: any[] = [orgId];
  if (opts.departmentId) {
    msql += ' AND department_id = ?';
    mparams.push(opts.departmentId);
  }
  if (opts.search?.trim()) {
    msql += ' AND (name LIKE ? OR member_code LIKE ?)';
    mparams.push(`%${opts.search.trim()}%`, `%${opts.search.trim()}%`);
  }
  msql += ' ORDER BY name';
  const members = all<any>(msql, ...mparams);

  const records = all<any>(
    `SELECT a.member_id, a.date, a.status_id, a.check_in, a.check_out, a.hours, a.note, a.location,
            s.code AS status_code, s.color AS status_color, s.name AS status_name
       FROM attendance a LEFT JOIN attendance_statuses s ON s.id = a.status_id
      WHERE a.org_id = ? AND a.date >= ? AND a.date <= ?`,
    orgId,
    from,
    to,
  );
  const byMemberDate = new Map<string, any>();
  for (const r of records) byMemberDate.set(`${r.member_id}|${r.date}`, r);

  const grid = members.map((m) => {
    const cells: Record<string, any> = {};
    for (const d of dates) cells[d] = byMemberDate.get(`${m.id}|${d}`) ?? null;
    return { member: m, cells };
  });
  return { dates, members, grid };
}

/** Upsert a single attendance record (member+date unique). Writes audit trail. */
export function markAttendance(userId: number, orgId: number, input: AttInput) {
  assertCanEdit(userId, orgId);
  if (!input.member_id) throw badRequest('member_id required');
  if (!input.date) throw badRequest('date required');
  if (!input.status_id) throw badRequest('status_id required');

  // ensure member + status belong to org
  const member = get('SELECT id FROM members WHERE id = ? AND org_id = ?', input.member_id, orgId);
  if (!member) throw notFound('Member not found in this organisation');
  const status = get('SELECT id FROM attendance_statuses WHERE id = ? AND org_id = ?', input.status_id, orgId);
  if (!status) throw badRequest('Invalid status');

  const computedHours =
    input.hours != null ? input.hours : hoursBetween(input.check_in, input.check_out);

  const before = get<any>(
    'SELECT * FROM attendance WHERE member_id = ? AND date = ?',
    input.member_id,
    input.date,
  );

  if (before) {
    run(
      `UPDATE attendance SET status_id=?, check_in=?, check_out=?, hours=?, location=?, note=?,
         updated_at=datetime('now') WHERE id=?`,
      input.status_id,
      input.check_in ?? null,
      input.check_out ?? null,
      computedHours,
      input.location ?? null,
      input.note ?? null,
      before.id,
    );
    const after = get('SELECT * FROM attendance WHERE id = ?', before.id);
    logAudit({ userId, orgId, entity: 'attendance', entityId: before.id, action: 'update', before, after });
    return after;
  }

  const info = run(
    `INSERT INTO attendance
      (org_id, member_id, date, status_id, check_in, check_out, hours, location, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    orgId,
    input.member_id,
    input.date,
    input.status_id,
    input.check_in ?? null,
    input.check_out ?? null,
    computedHours,
    input.location ?? null,
    input.note ?? null,
    userId,
  );
  const id = Number(info.lastInsertRowid);
  const after = get('SELECT * FROM attendance WHERE id = ?', id);
  logAudit({ userId, orgId, entity: 'attendance', entityId: id, action: 'create', after });
  return after;
}

/** Bulk mark many records (e.g., "mark all present", roster fill). */
export function markBulk(userId: number, orgId: number, entries: AttInput[]) {
  assertCanEdit(userId, orgId);
  return tx(() => {
    const results = [];
    for (const e of entries) results.push(markAttendance(userId, orgId, { ...e }));
    return results;
  });
}

export function deleteAttendance(userId: number, orgId: number, id: number) {
  assertCanEdit(userId, orgId);
  const before = get('SELECT * FROM attendance WHERE id = ? AND org_id = ?', id, orgId);
  if (!before) throw notFound('Attendance record not found');
  run('DELETE FROM attendance WHERE id = ?', id);
  logAudit({ userId, orgId, entity: 'attendance', entityId: id, action: 'delete', before });
}

/** All records for a single member (per-member view). */
export function memberHistory(userId: number, orgId: number, memberId: number, from?: string, to?: string) {
  assertMember(userId, orgId);
  let sql = `SELECT a.*, s.name AS status_name, s.code AS status_code, s.color AS status_color
               FROM attendance a LEFT JOIN attendance_statuses s ON s.id = a.status_id
              WHERE a.org_id = ? AND a.member_id = ?`;
  const params: any[] = [orgId, memberId];
  if (from) {
    sql += ' AND a.date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND a.date <= ?';
    params.push(to);
  }
  sql += ' ORDER BY a.date DESC';
  return all(sql, ...params);
}

/** Copy the previous day's records into a target date (fills missing only). */
export function copyPreviousDay(userId: number, orgId: number, targetDate: string, sourceDate: string) {
  assertCanEdit(userId, orgId);
  const src = all<any>('SELECT * FROM attendance WHERE org_id = ? AND date = ?', orgId, sourceDate);
  if (src.length === 0) throw badRequest('No records on the source date to copy');
  return tx(() => {
    let copied = 0;
    for (const r of src) {
      const exists = get('SELECT id FROM attendance WHERE member_id = ? AND date = ?', r.member_id, targetDate);
      if (exists) continue;
      markAttendance(userId, orgId, {
        member_id: r.member_id,
        date: targetDate,
        status_id: r.status_id,
        check_in: r.check_in,
        check_out: r.check_out,
        hours: r.hours,
        location: r.location,
        note: r.note,
      });
      copied++;
    }
    return { copied };
  });
}
