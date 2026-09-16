import { run, all } from '../db/connection.ts';

export function logAudit(params: {
  userId?: number | null;
  orgId?: number | null;
  entity: string;
  entityId?: number | null;
  action: 'create' | 'update' | 'delete';
  before?: unknown;
  after?: unknown;
}): void {
  run(
    `INSERT INTO audit_log (user_id, org_id, entity, entity_id, action, before_json, after_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params.userId ?? null,
    params.orgId ?? null,
    params.entity,
    params.entityId ?? null,
    params.action,
    params.before == null ? null : JSON.stringify(params.before),
    params.after == null ? null : JSON.stringify(params.after),
  );
}

export function listAudit(orgId: number, entity?: string, entityId?: number, limit = 200) {
  let sql = `SELECT al.*, u.name AS user_name
               FROM audit_log al LEFT JOIN users u ON u.id = al.user_id
              WHERE al.org_id = ?`;
  const params: any[] = [orgId];
  if (entity) {
    sql += ' AND al.entity = ?';
    params.push(entity);
  }
  if (entityId != null) {
    sql += ' AND al.entity_id = ?';
    params.push(entityId);
  }
  sql += ' ORDER BY al.id DESC LIMIT ?';
  params.push(limit);
  return all(sql, ...params);
}
