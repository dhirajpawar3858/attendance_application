import { all, get, run } from '../db/connection.ts';
import { assertCanEdit, assertMember } from './org.ts';
import { badRequest, notFound } from '../util/errors.ts';
import { logAudit } from './audit.ts';

const TYPES = ['text', 'number', 'date', 'select'];

export function listCustomFields(userId: number, orgId: number, entity = 'member') {
  assertMember(userId, orgId);
  return all(
    'SELECT * FROM custom_fields WHERE org_id = ? AND entity = ? ORDER BY sort, id',
    orgId,
    entity,
  ).map((f: any) => ({ ...f, options: f.options_json ? JSON.parse(f.options_json) : [] }));
}

export function createCustomField(
  userId: number,
  orgId: number,
  input: { label: string; type: string; options?: string[]; entity?: string },
) {
  assertCanEdit(userId, orgId);
  if (!input.label?.trim()) throw badRequest('Field label is required');
  if (!TYPES.includes(input.type)) throw badRequest('Invalid field type');
  const maxSort =
    (get<{ m: number }>('SELECT MAX(sort) AS m FROM custom_fields WHERE org_id = ?', orgId)?.m ??
      -1) + 1;
  const info = run(
    'INSERT INTO custom_fields (org_id, entity, label, type, options_json, sort) VALUES (?, ?, ?, ?, ?, ?)',
    orgId,
    input.entity ?? 'member',
    input.label.trim(),
    input.type,
    input.options ? JSON.stringify(input.options) : null,
    maxSort,
  );
  const id = Number(info.lastInsertRowid);
  logAudit({ userId, orgId, entity: 'custom_field', entityId: id, action: 'create', after: input });
  return get('SELECT * FROM custom_fields WHERE id = ?', id);
}

export function updateCustomField(
  userId: number,
  orgId: number,
  id: number,
  input: { label?: string; type?: string; options?: string[] },
) {
  assertCanEdit(userId, orgId);
  const before = get<any>('SELECT * FROM custom_fields WHERE id = ? AND org_id = ?', id, orgId);
  if (!before) throw notFound('Custom field not found');
  run(
    'UPDATE custom_fields SET label = ?, type = ?, options_json = ? WHERE id = ?',
    input.label?.trim() ?? before.label,
    input.type ?? before.type,
    input.options ? JSON.stringify(input.options) : before.options_json,
    id,
  );
  logAudit({ userId, orgId, entity: 'custom_field', entityId: id, action: 'update', before, after: input });
  return get('SELECT * FROM custom_fields WHERE id = ?', id);
}

export function deleteCustomField(userId: number, orgId: number, id: number) {
  assertCanEdit(userId, orgId);
  const before = get('SELECT * FROM custom_fields WHERE id = ? AND org_id = ?', id, orgId);
  if (!before) throw notFound('Custom field not found');
  run('DELETE FROM custom_fields WHERE id = ?', id); // values cascade
  logAudit({ userId, orgId, entity: 'custom_field', entityId: id, action: 'delete', before });
}

/** Read all custom-field values for a given member. Returns { field_id: value }. */
export function valuesForEntity(entityId: number): Record<number, string> {
  const rows = all<{ field_id: number; value: string }>(
    'SELECT field_id, value FROM custom_field_values WHERE entity_id = ?',
    entityId,
  );
  const out: Record<number, string> = {};
  for (const r of rows) out[r.field_id] = r.value;
  return out;
}

/** Upsert values for a member from a { field_id: value } map. */
export function setValuesForEntity(entityId: number, values: Record<string, string>) {
  for (const [fieldId, value] of Object.entries(values || {})) {
    const fid = Number(fieldId);
    if (!Number.isFinite(fid)) continue;
    run(
      `INSERT INTO custom_field_values (field_id, entity_id, value) VALUES (?, ?, ?)
       ON CONFLICT(field_id, entity_id) DO UPDATE SET value = excluded.value`,
      fid,
      entityId,
      value ?? '',
    );
  }
}
