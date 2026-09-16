import { all, get, run } from '../db/connection.ts';
import { assertMember } from './org.ts';
import { badRequest, notFound } from '../util/errors.ts';

export function listPresets(userId: number, orgId: number) {
  assertMember(userId, orgId);
  return all(
    'SELECT * FROM filter_presets WHERE user_id = ? AND org_id = ? ORDER BY name',
    userId,
    orgId,
  ).map((p: any) => ({ ...p, config: JSON.parse(p.config_json) }));
}

export function createPreset(userId: number, orgId: number, name: string, config: unknown) {
  assertMember(userId, orgId);
  if (!name?.trim()) throw badRequest('Preset name is required');
  const info = run(
    'INSERT INTO filter_presets (user_id, org_id, name, config_json) VALUES (?, ?, ?, ?)',
    userId,
    orgId,
    name.trim(),
    JSON.stringify(config ?? {}),
  );
  const row = get<any>('SELECT * FROM filter_presets WHERE id = ?', Number(info.lastInsertRowid));
  return { ...row, config: JSON.parse(row.config_json) };
}

export function deletePreset(userId: number, orgId: number, id: number) {
  assertMember(userId, orgId);
  const before = get('SELECT * FROM filter_presets WHERE id = ? AND user_id = ?', id, userId);
  if (!before) throw notFound('Preset not found');
  run('DELETE FROM filter_presets WHERE id = ?', id);
}
