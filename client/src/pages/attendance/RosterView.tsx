import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.ts';
import { useApp } from '../../state/AppState.tsx';
import { useToast } from '../../state/ToastProvider.tsx';
import type { Department, Roster, RosterCell, Status } from '../../api/types.ts';
import { Loading, EmptyState } from '../../components/ui.tsx';
import { addDays, shortDay, todayStr } from '../../util/format.ts';

export default function RosterView({ statuses, departments }: { statuses: Status[]; departments: Department[] }) {
  const { currentOrg } = useApp();
  const toast = useToast();
  const orgId = currentOrg?.id;
  const canEdit = currentOrg?.my_role !== 'viewer';

  const [anchor, setAnchor] = useState(() => addDays(todayStr(), -6)); // start date
  const [days, setDays] = useState(7);
  const [deptId, setDeptId] = useState('');
  const [search, setSearch] = useState('');
  const [roster, setRoster] = useState<Roster | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<number>(() => statuses.find((s) => s.is_default)?.id || statuses[0]?.id || 0);

  const from = anchor;
  const to = addDays(anchor, days - 1);
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ from, to });
      if (deptId) q.set('departmentId', deptId);
      if (search) q.set('search', search);
      const r = await api.get<Roster>(`/orgs/${orgId}/attendance/roster?${q.toString()}`);
      setRoster(r);
    } finally {
      setLoading(false);
    }
  }, [orgId, from, to, deptId, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function setCell(memberId: number, date: string, statusId: number) {
    if (!orgId || !canEdit) return;
    // optimistic update
    setRoster((prev) => {
      if (!prev) return prev;
      const s = statusById.get(statusId);
      const grid = prev.grid.map((row) =>
        row.member.id === memberId
          ? {
              ...row,
              cells: {
                ...row.cells,
                [date]: { member_id: memberId, date, status_id: statusId, status_code: s?.code, status_color: s?.color, status_name: s?.name } as RosterCell,
              },
            }
          : row,
      );
      return { ...prev, grid };
    });
    try {
      await api.post(`/orgs/${orgId}/attendance`, { member_id: memberId, date, status_id: statusId });
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
      load();
    }
  }

  function cycleCell(memberId: number, date: string, current: RosterCell | null) {
    if (!canEdit) return;
    // clicking cycles: empty -> activeStatus -> next status -> ...
    if (!current) return setCell(memberId, date, activeStatus);
    const idx = statuses.findIndex((s) => s.id === current.status_id);
    const next = statuses[(idx + 1) % statuses.length];
    setCell(memberId, date, next.id);
  }

  async function markAllPresent() {
    if (!orgId || !roster || !canEdit) return;
    const presentStatus = statuses.find((s) => s.counts_present && s.name.toLowerCase() === 'present') || statuses.find((s) => s.is_default) || statuses[0];
    if (!presentStatus) return;
    const entries: any[] = [];
    for (const row of roster.grid) {
      for (const d of roster.dates) {
        if (!row.cells[d]) entries.push({ member_id: row.member.id, date: d, status_id: presentStatus.id });
      }
    }
    if (entries.length === 0) return toast.info('All cells already marked');
    await api.post(`/orgs/${orgId}/attendance/bulk`, { entries });
    toast.success(`Marked ${entries.length} cells as ${presentStatus.name}`);
    load();
  }

  if (loading && !roster) return <Loading />;

  return (
    <div>
      {/* toolbar */}
      <div className="toolbar">
        <div className="row gap-6">
          <button className="btn sm" onClick={() => setAnchor(addDays(anchor, -days))}>
            ‹ Prev
          </button>
          <button className="btn sm" onClick={() => setAnchor(addDays(todayStr(), -(days - 1)))}>
            Today
          </button>
          <button className="btn sm" onClick={() => setAnchor(addDays(anchor, days))}>
            Next ›
          </button>
        </div>
        <div className="seg">
          {[7, 14, 30].map((d) => (
            <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>
              {d}d
            </button>
          ))}
        </div>
        <select style={{ width: 160 }} value={deptId} onChange={(e) => setDeptId(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <input style={{ width: 180 }} placeholder="Search member…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="grow" />
        {canEdit && (
          <button className="btn primary sm" onClick={markAllPresent}>
            ✓ Mark all present
          </button>
        )}
      </div>

      {/* status palette */}
      {canEdit && (
        <div className="row gap-6 wrap mb-16">
          <span className="muted small" style={{ alignSelf: 'center' }}>
            Paint with:
          </span>
          {statuses.map((s) => (
            <button
              key={s.id}
              className={`chip ${activeStatus === s.id ? 'on' : ''}`}
              onClick={() => setActiveStatus(s.id)}
              style={activeStatus === s.id ? { background: s.color + '44', borderColor: s.color } : {}}
            >
              <span style={{ width: 9, height: 9, borderRadius: 99, background: s.color }} /> {s.name} ({s.code})
            </button>
          ))}
          <span className="muted small" style={{ alignSelf: 'center' }}>
            Click a cell to paint · click again to cycle
          </span>
        </div>
      )}

      {!roster || roster.members.length === 0 ? (
        <EmptyState title="No members to show" icon="☺" hint="Add members first, or adjust your filters." />
      ) : (
        <div className="roster-scroll">
          <table className="roster">
            <thead>
              <tr>
                <th className="name-col">Member</th>
                {roster.dates.map((d) => {
                  const sd = shortDay(d);
                  const weekend = sd.dowIdx === 0 || sd.dowIdx === 6;
                  return (
                    <th key={d} className={`roster-day-head ${weekend ? 'wend' : ''}`}>
                      {sd.dow}
                      <small>{sd.day}</small>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {roster.grid.map((row) => (
                <tr key={row.member.id}>
                  <td className="name-col">
                    <div style={{ fontWeight: 650 }}>{row.member.name}</div>
                    {row.member.member_code && <div className="muted small">{row.member.member_code}</div>}
                  </td>
                  {roster.dates.map((d) => {
                    const cell = row.cells[d];
                    const sd = shortDay(d);
                    const weekend = sd.dowIdx === 0 || sd.dowIdx === 6;
                    return (
                      <td
                        key={d}
                        className={`roster-cell ${weekend ? 'wend' : ''} ${cell ? '' : 'empty-cell'}`}
                        style={cell ? { background: cell.status_color + '66', color: 'var(--text)' } : {}}
                        onClick={() => cycleCell(row.member.id, d, cell)}
                        title={cell ? `${cell.status_name}${cell.note ? ' · ' + cell.note : ''}` : 'Click to mark'}
                      >
                        {cell ? cell.status_code : '·'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
