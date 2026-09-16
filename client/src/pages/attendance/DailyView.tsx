import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.ts';
import { useApp } from '../../state/AppState.tsx';
import { useToast } from '../../state/ToastProvider.tsx';
import { useMembers } from '../../state/useOrgData.ts';
import type { Attendance, Status } from '../../api/types.ts';
import { Loading, EmptyState, StatusPill, Avatar } from '../../components/ui.tsx';
import { addDays, todayStr, fmtDate } from '../../util/format.ts';

export default function DailyView({ statuses }: { statuses: Status[] }) {
  const { currentOrg } = useApp();
  const toast = useToast();
  const { members, loading: membersLoading } = useMembers();
  const orgId = currentOrg?.id;
  const canEdit = currentOrg?.my_role !== 'viewer';

  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState<Record<number, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const defaultStatus = useMemo(() => statuses.find((s) => s.is_default) || statuses[0], [statuses]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const list = await api.get<Attendance[]>(`/orgs/${orgId}/attendance?dateFrom=${date}&dateTo=${date}`);
      const map: Record<number, Attendance> = {};
      for (const r of list) map[r.member_id] = r;
      setRecords(map);
    } finally {
      setLoading(false);
    }
  }, [orgId, date]);

  useEffect(() => {
    load();
  }, [load]);

  async function mark(memberId: number, patch: Partial<Attendance>) {
    if (!orgId || !canEdit) return;
    const existing = records[memberId];
    const body = {
      member_id: memberId,
      date,
      status_id: patch.status_id ?? existing?.status_id ?? defaultStatus?.id,
      check_in: patch.check_in ?? existing?.check_in ?? null,
      check_out: patch.check_out ?? existing?.check_out ?? null,
      location: patch.location ?? existing?.location ?? null,
      note: patch.note ?? existing?.note ?? null,
    };
    const saved = await api.post<Attendance>(`/orgs/${orgId}/attendance`, body);
    setRecords((r) => ({ ...r, [memberId]: saved }));
  }

  async function markAll() {
    if (!orgId || !defaultStatus || !canEdit) return;
    const present = statuses.find((s) => s.name.toLowerCase() === 'present') || defaultStatus;
    const entries = members.filter((m) => !records[m.id]).map((m) => ({ member_id: m.id, date, status_id: present.id }));
    if (!entries.length) return toast.info('Everyone is already marked');
    await api.post(`/orgs/${orgId}/attendance/bulk`, { entries });
    toast.success(`Marked ${entries.length} present`);
    load();
  }

  async function copyYesterday() {
    if (!orgId || !canEdit) return;
    try {
      const res = await api.post<{ copied: number }>(`/orgs/${orgId}/attendance/copy-day`, {
        targetDate: date,
        sourceDate: addDays(date, -1),
      });
      toast.success(`Copied ${res.copied} records from yesterday`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (membersLoading || (loading && !Object.keys(records).length)) return <Loading />;

  const markedCount = members.filter((m) => records[m.id]).length;

  return (
    <div>
      <div className="toolbar">
        <div className="row gap-6">
          <button className="btn sm" onClick={() => setDate(addDays(date, -1))}>‹</button>
          <input type="date" style={{ width: 160 }} value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn sm" onClick={() => setDate(addDays(date, 1))}>›</button>
          <button className="btn ghost sm" onClick={() => setDate(todayStr())}>Today</button>
        </div>
        <span className="pill" style={{ background: 'var(--surface-2)' }}>
          {markedCount}/{members.length} marked
        </span>
        <div className="grow" />
        {canEdit && (
          <>
            <button className="btn sm" onClick={copyYesterday}>⧉ Copy yesterday</button>
            <button className="btn primary sm" onClick={markAll}>✓ Mark all present</button>
          </>
        )}
      </div>

      <div className="muted small mb-16">{fmtDate(date, 'DD MMM YYYY')}</div>

      {members.length === 0 ? (
        <EmptyState title="No members" icon="☺" hint="Add members to start marking attendance." />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Member</th>
                <th>Status</th>
                <th>Quick set</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const rec = records[m.id];
                const st = rec ? statuses.find((s) => s.id === rec.status_id) : undefined;
                return (
                  <Fragment key={m.id}>
                    <tr>
                      <td>
                        <div className="row gap-8">
                          <Avatar name={m.name} src={m.avatar} size={30} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{m.name}</div>
                            <div className="muted small">{m.department_name || m.role || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td>{rec ? <StatusPill name={st?.name} color={st?.color} code={st?.code} /> : <span className="muted small">Not marked</span>}</td>
                      <td>
                        <div className="row gap-6 wrap">
                          {statuses.slice(0, 7).map((s) => (
                            <button
                              key={s.id}
                              className="chip"
                              disabled={!canEdit}
                              onClick={() => mark(m.id, { status_id: s.id })}
                              style={rec?.status_id === s.id ? { background: s.color + '44', borderColor: s.color } : {}}
                              title={s.name}
                            >
                              {s.code}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button className="btn ghost sm" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                          {expanded === m.id ? 'Close' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {expanded === m.id && (
                      <tr>
                        <td colSpan={4} style={{ background: 'var(--surface-2)' }}>
                          <div className="row gap-12 wrap" style={{ padding: '4px 0' }}>
                            <div>
                              <label>Check in</label>
                              <input type="time" style={{ width: 120 }} defaultValue={rec?.check_in || ''} disabled={!canEdit}
                                onBlur={(e) => mark(m.id, { check_in: e.target.value })} />
                            </div>
                            <div>
                              <label>Check out</label>
                              <input type="time" style={{ width: 120 }} defaultValue={rec?.check_out || ''} disabled={!canEdit}
                                onBlur={(e) => mark(m.id, { check_out: e.target.value })} />
                            </div>
                            <div>
                              <label>Location</label>
                              <input style={{ width: 150 }} defaultValue={rec?.location || ''} disabled={!canEdit}
                                onBlur={(e) => mark(m.id, { location: e.target.value })} placeholder="HQ / Remote" />
                            </div>
                            <div className="grow">
                              <label>Note</label>
                              <input defaultValue={rec?.note || ''} disabled={!canEdit}
                                onBlur={(e) => mark(m.id, { note: e.target.value })} placeholder="Reason / comment" />
                            </div>
                            {rec?.hours != null && (
                              <div>
                                <label>Hours</label>
                                <div className="pill" style={{ background: 'var(--surface-3)' }}>{rec.hours}h</div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
