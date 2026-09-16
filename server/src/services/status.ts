import { all, get, run } from '../db/connection.ts';
import { assertCanEdit, assertMember } from './org.ts';
import { badRequest, conflict, notFound } from '../util/errors.ts';
import { logAudit } from './audit.ts';

export function listStatuses(userId: number, orgId: number) {
  assertMember(userId, orgId);
  return all('SELECT * FROM attendance_statuses WHERE org_id = ? ORDER BY sort, id', orgId);
}

export function createStatus(
  userId: number,
  orgId: number,
  input: { name: string; code: string; color?: string; counts_present?: number; is_default?: number },
) {
  assertCanEdit(userId, orgId);
  if (!input.name?.trim()) throw badRequest('Status name is required');
  if (!input.code?.trim()) throw badRequest('Status code is required');
  const maxSort =
    (get<{ m: number }>('SELECT MAX(sort) AS m FROM attendance_statuses WHERE org_id = ?', orgId)
      ?.m ?? -1) + 1;
  if (input.is_default) run('UPDATE attendance_statuses SET is_default = 0 WHERE org_id = ?', orgId);
  const info = run(
    `INSERT INTO attendance_statuses (org_id, name, code, color, is_default, counts_present, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    orgId,
    input.name.trim(),
    input.code.trim(),
    input.color ?? '#A7A0E8',
    input.is_default ? 1 : 0,
    input.counts_present ? 1 : 0,
    maxSort,
  );
  const id = Number(info.lastInsertRowid);
  logAudit({ userId, orgId, entity: 'status', entityId: id, action: 'create', after: input });
  return get('SELECT * FROM attendance_statuses WHERE id = ?', id);
}

export function updateStatus(
  userId: number,
  orgId: number,
  id: number,
  input: { name?: string; code?: string; color?: string; counts_present?: number; is_default?: number },
) {
  assertCanEdit(userId, orgId);
  const before = get<any>('SELECT * FROM attendance_statuses WHERE id = ? AND org_id = ?', id, orgId);
  if (!before) throw notFound('Status not found');
  if (input.is_default) run('UPDATE attendance_statuses SET is_default = 0 WHERE org_id = ?', orgId);
  run(
    `UPDATE attendance_statuses SET name=?, code=?, color=?, is_default=?, counts_present=? WHERE id=?`,
    input.name?.trim() ?? before.name,
    input.code?.trim() ?? before.code,
    input.color ?? before.color,
    input.is_default != null ? (input.is_default ? 1 : 0) : before.is_default,
    input.counts_present != null ? (input.counts_present ? 1 : 0) : before.counts_present,
    id,
  );
  logAudit({ userId, orgId, entity: 'status', entityId: id, action: 'update', before, after: input });
  return get('SELECT * FROM attendance_statuses WHERE id = ?', id);
}

export function deleteStatus(userId: number, orgId: number, id: number) {
  assertCanEdit(userId, orgId);
  const before = get('SELECT * FROM attendance_statuses WHERE id = ? AND org_id = ?', id, orgId);
  if (!before) throw notFound('Status not found');
  const used = get<{ c: number }>('SELECT COUNT(*) AS c FROM attendance WHERE status_id = ?', id);
  if (used && used.c > 0)
    throw conflict('Cannot delete a status that is in use by attendance records');
  run('DELETE FROM attendance_statuses WHERE id = ?', id);
  logAudit({ userId, orgId, entity: 'status', entityId: id, action: 'delete', before });
}
