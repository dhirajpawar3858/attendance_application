import { all, get, run } from '../db/connection.ts';
import { assertCanEdit, assertMember } from './org.ts';
import { badRequest, notFound } from '../util/errors.ts';
import { logAudit } from './audit.ts';

export function listDepartments(userId: number, orgId: number) {
  assertMember(userId, orgId);
  return all(
    `SELECT d.*, (SELECT COUNT(*) FROM members m WHERE m.department_id = d.id AND m.archived = 0) AS member_count
       FROM departments d WHERE d.org_id = ? ORDER BY d.name`,
    orgId,
  );
}

export function createDepartment(userId: number, orgId: number, name: string) {
  assertCanEdit(userId, orgId);
  if (!name?.trim()) throw badRequest('Department name is required');
  const info = run('INSERT INTO departments (org_id, name) VALUES (?, ?)', orgId, name.trim());
  const id = Number(info.lastInsertRowid);
  logAudit({ userId, orgId, entity: 'department', entityId: id, action: 'create', after: { name } });
  return get('SELECT * FROM departments WHERE id = ?', id);
}

export function updateDepartment(userId: number, orgId: number, id: number, name: string) {
  assertCanEdit(userId, orgId);
  const before = get('SELECT * FROM departments WHERE id = ? AND org_id = ?', id, orgId);
  if (!before) throw notFound('Department not found');
  run('UPDATE departments SET name = ? WHERE id = ?', name.trim(), id);
  logAudit({ userId, orgId, entity: 'department', entityId: id, action: 'update', before, after: { name } });
  return get('SELECT * FROM departments WHERE id = ?', id);
}

export function deleteDepartment(userId: number, orgId: number, id: number) {
  assertCanEdit(userId, orgId);
  const before = get('SELECT * FROM departments WHERE id = ? AND org_id = ?', id, orgId);
  if (!before) throw notFound('Department not found');
  run('DELETE FROM departments WHERE id = ?', id); // members.department_id -> SET NULL
  logAudit({ userId, orgId, entity: 'department', entityId: id, action: 'delete', before });
}
