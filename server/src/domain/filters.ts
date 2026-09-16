// Pure filter -> parameterised SQL builder for attendance queries.
// Never interpolates user input directly; always returns (clause, params).

export interface FilterConfig {
  orgId: number;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;
  statusIds?: number[]; // multi-select
  memberIds?: number[];
  departmentIds?: number[];
  roles?: string[];
  search?: string; // free text across member name + note
  // custom field filters: [{fieldId, value}]
  customFields?: Array<{ fieldId: number; value: string }>;
  sortBy?: 'date' | 'name' | 'status' | 'hours' | 'department';
  sortDir?: 'asc' | 'desc';
}

export interface BuiltQuery {
  where: string; // begins with "WHERE " or is ""
  params: any[];
  order: string; // begins with "ORDER BY " or default
}

/**
 * Builds WHERE + ORDER for a query that joins:
 *   attendance a
 *   JOIN members m ON m.id = a.member_id
 *   LEFT JOIN attendance_statuses s ON s.id = a.status_id
 *   LEFT JOIN departments d ON d.id = m.department_id
 */
export function buildAttendanceQuery(cfg: FilterConfig): BuiltQuery {
  const clauses: string[] = ['a.org_id = ?'];
  const params: any[] = [cfg.orgId];

  if (cfg.dateFrom) {
    clauses.push('a.date >= ?');
    params.push(cfg.dateFrom);
  }
  if (cfg.dateTo) {
    clauses.push('a.date <= ?');
    params.push(cfg.dateTo);
  }
  if (cfg.statusIds && cfg.statusIds.length) {
    clauses.push(`a.status_id IN (${cfg.statusIds.map(() => '?').join(',')})`);
    params.push(...cfg.statusIds);
  }
  if (cfg.memberIds && cfg.memberIds.length) {
    clauses.push(`a.member_id IN (${cfg.memberIds.map(() => '?').join(',')})`);
    params.push(...cfg.memberIds);
  }
  if (cfg.departmentIds && cfg.departmentIds.length) {
    clauses.push(`m.department_id IN (${cfg.departmentIds.map(() => '?').join(',')})`);
    params.push(...cfg.departmentIds);
  }
  if (cfg.roles && cfg.roles.length) {
    clauses.push(`m.role IN (${cfg.roles.map(() => '?').join(',')})`);
    params.push(...cfg.roles);
  }
  if (cfg.search && cfg.search.trim()) {
    const like = `%${cfg.search.trim()}%`;
    clauses.push('(m.name LIKE ? OR a.note LIKE ? OR m.member_code LIKE ?)');
    params.push(like, like, like);
  }
  if (cfg.customFields && cfg.customFields.length) {
    for (const cf of cfg.customFields) {
      if (cf.value === '' || cf.value == null) continue;
      clauses.push(
        `m.id IN (SELECT entity_id FROM custom_field_values WHERE field_id = ? AND value LIKE ?)`,
      );
      params.push(cf.fieldId, `%${cf.value}%`);
    }
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const dir = cfg.sortDir === 'desc' ? 'DESC' : 'ASC';
  let orderCol = 'a.date';
  switch (cfg.sortBy) {
    case 'name':
      orderCol = 'm.name';
      break;
    case 'status':
      orderCol = 's.sort';
      break;
    case 'hours':
      orderCol = 'a.hours';
      break;
    case 'department':
      orderCol = 'd.name';
      break;
    case 'date':
    default:
      orderCol = 'a.date';
  }
  const order = `ORDER BY ${orderCol} ${dir}, m.name ASC`;

  return { where, params, order };
}

/** Resolve a date-range preset into concrete from/to given a reference "today". */
export function resolvePreset(
  preset: string,
  today: string,
): { from: string; to: string } | null {
  const [y, m, d] = today.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  const fmt = (dt: Date) => {
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };
  const clone = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());

  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const yd = clone(base);
      yd.setDate(yd.getDate() - 1);
      return { from: fmt(yd), to: fmt(yd) };
    }
    case 'last7': {
      const s = clone(base);
      s.setDate(s.getDate() - 6);
      return { from: fmt(s), to: today };
    }
    case 'last30': {
      const s = clone(base);
      s.setDate(s.getDate() - 29);
      return { from: fmt(s), to: today };
    }
    case 'thisWeek': {
      const s = clone(base);
      s.setDate(s.getDate() - s.getDay()); // back to Sunday
      const e = clone(s);
      e.setDate(e.getDate() + 6);
      return { from: fmt(s), to: fmt(e) };
    }
    case 'thisMonth': {
      const s = new Date(base.getFullYear(), base.getMonth(), 1);
      const e = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case 'lastMonth': {
      const s = new Date(base.getFullYear(), base.getMonth() - 1, 1);
      const e = new Date(base.getFullYear(), base.getMonth(), 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case 'thisYear': {
      const s = new Date(base.getFullYear(), 0, 1);
      const e = new Date(base.getFullYear(), 11, 31);
      return { from: fmt(s), to: fmt(e) };
    }
    default:
      return null;
  }
}
