import { all, get, run, tx } from '../db/connection.ts';
import { badRequest, forbidden, notFound } from '../util/errors.ts';
import { logAudit } from './audit.ts';

// Default pastel statuses created for every new organisation (spec §3.4).
export const DEFAULT_STATUSES = [
  { name: 'Present', code: 'P', color: '#B8E0C2', is_default: 1, counts_present: 1 },
  { name: 'Absent', code: 'A', color: '#F2A6A0', is_default: 0, counts_present: 0 },
  { name: 'Late', code: 'L', color: '#F6D9A0', is_default: 0, counts_present: 1 },
  { name: 'Half-day', code: 'H', color: '#F7C9B6', is_default: 0, counts_present: 1 },
  { name: 'On Leave', code: 'LV', color: '#A7A0E8', is_default: 0, counts_present: 0 },
  { name: 'Holiday', code: 'HO', color: '#A8DCD1', is_default: 0, counts_present: 0 },
  { name: 'Remote', code: 'R', color: '#F3B8C6', is_default: 0, counts_present: 1 },
];

export interface OrgInput {
  name: string;
  logo?: string | null;
  address?: string | null;
  contact?: string | null;
  timezone?: string;
  working_days?: string;
  work_hours_start?: string;
  work_hours_end?: string;
}

export function listOrgs(userId: number) {
  return all(
    `SELECT o.*, uo.role AS my_role
       FROM organisations o
       JOIN user_orgs uo ON uo.org_id = o.id
      WHERE uo.user_id = ? AND o.archived = 0
      ORDER BY o.name`,
    userId,
  );
}

export function getOrg(userId: number, orgId: number) {
  const row = get<any>(
    `SELECT o.*, uo.role AS my_role
       FROM organisations o JOIN user_orgs uo ON uo.org_id = o.id
      WHERE o.id = ? AND uo.user_id = ?`,
    orgId,
    userId,
  );
  if (!row) throw notFound('Organisation not found');
  return row;
}

/** Assert the user belongs to the org; returns their role. */
export function assertMember(userId: number, orgId: number): string {
  const row = get<{ role: string }>(
    'SELECT role FROM user_orgs WHERE user_id = ? AND org_id = ?',
    userId,
    orgId,
  );
  if (!row) throw forbidden('You do not have access to this organisation');
  return row.role;
}

export function assertCanEdit(userId: number, orgId: number) {
  const role = assertMember(userId, orgId);
  if (role === 'viewer') throw forbidden('Viewers cannot make changes');
  return role;
}

export function createOrg(userId: number, input: OrgInput) {
  if (!input.name?.trim()) throw badRequest('Organisation name is required');
  return tx(() => {
    const info = run(
      `INSERT INTO organisations
        (name, logo, address, contact, timezone, working_days, work_hours_start, work_hours_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.name.trim(),
      input.logo ?? null,
      input.address ?? null,
      input.contact ?? null,
      input.timezone ?? 'UTC',
      input.working_days ?? '1,2,3,4,5',
      input.work_hours_start ?? '09:00',
      input.work_hours_end ?? '17:00',
    );
    const orgId = Number(info.lastInsertRowid);
    run('INSERT INTO user_orgs (user_id, org_id, role) VALUES (?, ?, ?)', userId, orgId, 'admin');

    // seed default statuses
    DEFAULT_STATUSES.forEach((s, i) => {
      run(
        `INSERT INTO attendance_statuses (org_id, name, code, color, is_default, counts_present, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        orgId,
        s.name,
        s.code,
        s.color,
        s.is_default,
        s.counts_present,
        i,
      );
    });

    logAudit({ userId, orgId, entity: 'organisation', entityId: orgId, action: 'create', after: input });
    return getOrg(userId, orgId);
  });
}

export function updateOrg(userId: number, orgId: number, input: OrgInput) {
  assertCanEdit(userId, orgId);
  const before = getOrg(userId, orgId);
  run(
    `UPDATE organisations SET name=?, logo=?, address=?, contact=?, timezone=?,
       working_days=?, work_hours_start=?, work_hours_end=? WHERE id=?`,
    input.name?.trim() ?? before.name,
    input.logo !== undefined ? input.logo : before.logo,
    input.address !== undefined ? input.address : before.address,
    input.contact !== undefined ? input.contact : before.contact,
    input.timezone ?? before.timezone,
    input.working_days ?? before.working_days,
    input.work_hours_start ?? before.work_hours_start,
    input.work_hours_end ?? before.work_hours_end,
    orgId,
  );
  const after = getOrg(userId, orgId);
  logAudit({ userId, orgId, entity: 'organisation', entityId: orgId, action: 'update', before, after });
  return after;
}

export function archiveOrg(userId: number, orgId: number) {
  assertCanEdit(userId, orgId);
  run('UPDATE organisations SET archived = 1 WHERE id = ?', orgId);
  logAudit({ userId, orgId, entity: 'organisation', entityId: orgId, action: 'delete' });
}
