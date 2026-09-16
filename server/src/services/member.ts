import { all, get, run, tx } from '../db/connection.ts';
import { assertCanEdit, assertMember } from './org.ts';
import { badRequest, notFound } from '../util/errors.ts';
import { logAudit } from './audit.ts';
import { listCustomFields, setValuesForEntity, valuesForEntity } from './customField.ts';
import { toCSV, parseCSV } from '../domain/csv.ts';

export interface MemberInput {
  name: string;
  member_code?: string | null;
  avatar?: string | null;
  role?: string | null;
  department_id?: number | null;
  phone?: string | null;
  email?: string | null;
  join_date?: string | null;
  active?: number;
  notes?: string | null;
  customValues?: Record<string, string>;
}

export function listMembers(
  userId: number,
  orgId: number,
  opts: { includeArchived?: boolean; search?: string; departmentId?: number } = {},
) {
  assertMember(userId, orgId);
  let sql = `SELECT m.*, d.name AS department_name
               FROM members m LEFT JOIN departments d ON d.id = m.department_id
              WHERE m.org_id = ?`;
  const params: any[] = [orgId];
  if (!opts.includeArchived) sql += ' AND m.archived = 0';
  if (opts.departmentId) {
    sql += ' AND m.department_id = ?';
    params.push(opts.departmentId);
  }
  if (opts.search?.trim()) {
    sql += ' AND (m.name LIKE ? OR m.member_code LIKE ? OR m.email LIKE ?)';
    const like = `%${opts.search.trim()}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY m.name';
  return all(sql, ...params);
}

export function getMember(userId: number, orgId: number, id: number) {
  assertMember(userId, orgId);
  const row = get<any>(
    `SELECT m.*, d.name AS department_name
       FROM members m LEFT JOIN departments d ON d.id = m.department_id
      WHERE m.id = ? AND m.org_id = ?`,
    id,
    orgId,
  );
  if (!row) throw notFound('Member not found');
  row.customValues = valuesForEntity(id);
  return row;
}

export function createMember(userId: number, orgId: number, input: MemberInput) {
  assertCanEdit(userId, orgId);
  if (!input.name?.trim()) throw badRequest('Member name is required');
  return tx(() => {
    const info = run(
      `INSERT INTO members
        (org_id, name, member_code, avatar, role, department_id, phone, email, join_date, active, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      orgId,
      input.name.trim(),
      input.member_code ?? null,
      input.avatar ?? null,
      input.role ?? null,
      input.department_id ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.join_date ?? null,
      input.active === 0 ? 0 : 1,
      input.notes ?? null,
    );
    const id = Number(info.lastInsertRowid);
    if (input.customValues) setValuesForEntity(id, input.customValues);
    logAudit({ userId, orgId, entity: 'member', entityId: id, action: 'create', after: input });
    return getMember(userId, orgId, id);
  });
}

export function updateMember(userId: number, orgId: number, id: number, input: MemberInput) {
  assertCanEdit(userId, orgId);
  const before = getMember(userId, orgId, id);
  return tx(() => {
    run(
      `UPDATE members SET name=?, member_code=?, avatar=?, role=?, department_id=?, phone=?,
         email=?, join_date=?, active=?, notes=? WHERE id=?`,
      input.name?.trim() ?? before.name,
      input.member_code !== undefined ? input.member_code : before.member_code,
      input.avatar !== undefined ? input.avatar : before.avatar,
      input.role !== undefined ? input.role : before.role,
      input.department_id !== undefined ? input.department_id : before.department_id,
      input.phone !== undefined ? input.phone : before.phone,
      input.email !== undefined ? input.email : before.email,
      input.join_date !== undefined ? input.join_date : before.join_date,
      input.active != null ? input.active : before.active,
      input.notes !== undefined ? input.notes : before.notes,
      id,
    );
    if (input.customValues) setValuesForEntity(id, input.customValues);
    const after = getMember(userId, orgId, id);
    logAudit({ userId, orgId, entity: 'member', entityId: id, action: 'update', before, after });
    return after;
  });
}

export function setArchived(userId: number, orgId: number, id: number, archived: boolean) {
  assertCanEdit(userId, orgId);
  const before = getMember(userId, orgId, id);
  run('UPDATE members SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
  logAudit({
    userId,
    orgId,
    entity: 'member',
    entityId: id,
    action: 'update',
    before,
    after: { archived },
  });
  return getMember(userId, orgId, id);
}

export function setActive(userId: number, orgId: number, id: number, active: boolean) {
  assertCanEdit(userId, orgId);
  getMember(userId, orgId, id);
  run('UPDATE members SET active = ? WHERE id = ?', active ? 1 : 0, id);
  return getMember(userId, orgId, id);
}

// ------------------------- CSV import / export --------------------------

export function exportMembersCSV(userId: number, orgId: number): string {
  const members = listMembers(userId, orgId, { includeArchived: true });
  const fields = listCustomFields(userId, orgId);
  const baseHeaders = [
    'name',
    'member_code',
    'role',
    'department',
    'phone',
    'email',
    'join_date',
    'active',
    'notes',
  ];
  const cfHeaders = fields.map((f: any) => `cf:${f.label}`);
  const rows = members.map((m: any) => {
    const values = valuesForEntity(m.id);
    const row: Record<string, unknown> = {
      name: m.name,
      member_code: m.member_code,
      role: m.role,
      department: m.department_name,
      phone: m.phone,
      email: m.email,
      join_date: m.join_date,
      active: m.active,
      notes: m.notes,
    };
    for (const f of fields as any[]) row[`cf:${f.label}`] = values[f.id] ?? '';
    return row;
  });
  return toCSV([...baseHeaders, ...cfHeaders], rows);
}

export function importMembersCSV(userId: number, orgId: number, csvText: string) {
  assertCanEdit(userId, orgId);
  const records = parseCSV(csvText);
  if (records.length === 0) throw badRequest('CSV is empty');

  const fields = listCustomFields(userId, orgId);
  const fieldByLabel = new Map(fields.map((f: any) => [f.label.toLowerCase(), f]));
  const depts = all<any>('SELECT id, name FROM departments WHERE org_id = ?', orgId);
  const deptByName = new Map(depts.map((d) => [String(d.name).toLowerCase(), d.id]));

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  tx(() => {
    for (const [i, rec] of records.entries()) {
      const name = (rec['name'] || '').trim();
      if (!name) {
        errors.push(`Row ${i + 2}: missing name — skipped`);
        continue;
      }
      // resolve department (create if missing)
      let departmentId: number | null = null;
      const deptName = (rec['department'] || '').trim();
      if (deptName) {
        const key = deptName.toLowerCase();
        if (deptByName.has(key)) departmentId = deptByName.get(key)!;
        else {
          const info = run('INSERT INTO departments (org_id, name) VALUES (?, ?)', orgId, deptName);
          departmentId = Number(info.lastInsertRowid);
          deptByName.set(key, departmentId);
        }
      }

      const customValues: Record<string, string> = {};
      for (const [header, val] of Object.entries(rec)) {
        if (header.toLowerCase().startsWith('cf:')) {
          const label = header.slice(3).trim().toLowerCase();
          const f = fieldByLabel.get(label);
          if (f) customValues[String(f.id)] = val;
        }
      }

      const input: MemberInput = {
        name,
        member_code: rec['member_code'] || null,
        role: rec['role'] || null,
        department_id: departmentId,
        phone: rec['phone'] || null,
        email: rec['email'] || null,
        join_date: rec['join_date'] || null,
        active: rec['active'] === '0' ? 0 : 1,
        notes: rec['notes'] || null,
        customValues,
      };

      // upsert by member_code within org, else by exact name
      let existing: any = null;
      if (input.member_code) {
        existing = get(
          'SELECT id FROM members WHERE org_id = ? AND member_code = ?',
          orgId,
          input.member_code,
        );
      }
      if (!existing) {
        existing = get('SELECT id FROM members WHERE org_id = ? AND name = ?', orgId, name);
      }

      if (existing) {
        updateMemberInternal(existing.id, input);
        updated++;
      } else {
        const info = run(
          `INSERT INTO members
            (org_id, name, member_code, role, department_id, phone, email, join_date, active, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          orgId,
          name,
          input.member_code,
          input.role,
          input.department_id,
          input.phone,
          input.email,
          input.join_date,
          input.active,
          input.notes,
        );
        const id = Number(info.lastInsertRowid);
        if (Object.keys(customValues).length) setValuesForEntity(id, customValues);
        created++;
      }
    }
    logAudit({
      userId,
      orgId,
      entity: 'member',
      action: 'create',
      after: { imported: records.length, created, updated },
    });
  });

  return { created, updated, total: records.length, errors };
}

// internal update helper used during CSV import (no extra auth/audit per row)
function updateMemberInternal(id: number, input: MemberInput) {
  const before = get<any>('SELECT * FROM members WHERE id = ?', id);
  run(
    `UPDATE members SET name=?, member_code=?, role=?, department_id=?, phone=?, email=?,
       join_date=?, active=?, notes=? WHERE id=?`,
    input.name ?? before.name,
    input.member_code ?? before.member_code,
    input.role ?? before.role,
    input.department_id ?? before.department_id,
    input.phone ?? before.phone,
    input.email ?? before.email,
    input.join_date ?? before.join_date,
    input.active ?? before.active,
    input.notes ?? before.notes,
    id,
  );
  if (input.customValues && Object.keys(input.customValues).length)
    setValuesForEntity(id, input.customValues);
}

/** Distinct role list for filter dropdowns. */
export function listRoles(userId: number, orgId: number): string[] {
  assertMember(userId, orgId);
  return all<{ role: string }>(
    "SELECT DISTINCT role FROM members WHERE org_id = ? AND role IS NOT NULL AND role <> '' ORDER BY role",
    orgId,
  ).map((r) => r.role);
}
