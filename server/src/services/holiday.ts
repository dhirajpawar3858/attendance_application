import { all, get, run } from '../db/connection.ts';
import { assertCanEdit, assertMember } from './org.ts';
import { badRequest, notFound } from '../util/errors.ts';
import { logAudit } from './audit.ts';

export function listHolidays(userId: number, orgId: number, year?: number) {
  assertMember(userId, orgId);
  const rows = all<any>('SELECT * FROM holidays WHERE org_id = ? ORDER BY date', orgId);
  if (!year) return rows;
  // expand recurring holidays into the requested year
  return rows.map((h) => {
    if (h.recurring) {
      const md = h.date.slice(5); // MM-DD
      return { ...h, date: `${year}-${md}` };
    }
    return h;
  });
}

export function createHoliday(
  userId: number,
  orgId: number,
  input: { date: string; name: string; recurring?: number },
) {
  assertCanEdit(userId, orgId);
  if (!input.date) throw badRequest('Holiday date is required');
  if (!input.name?.trim()) throw badRequest('Holiday name is required');
  const info = run(
    'INSERT INTO holidays (org_id, date, name, recurring) VALUES (?, ?, ?, ?)',
    orgId,
    input.date,
    input.name.trim(),
    input.recurring ? 1 : 0,
  );
  const id = Number(info.lastInsertRowid);
  logAudit({ userId, orgId, entity: 'holiday', entityId: id, action: 'create', after: input });
  return get('SELECT * FROM holidays WHERE id = ?', id);
}

export function deleteHoliday(userId: number, orgId: number, id: number) {
  assertCanEdit(userId, orgId);
  const before = get('SELECT * FROM holidays WHERE id = ? AND org_id = ?', id, orgId);
  if (!before) throw notFound('Holiday not found');
  run('DELETE FROM holidays WHERE id = ?', id);
  logAudit({ userId, orgId, entity: 'holiday', entityId: id, action: 'delete', before });
}
