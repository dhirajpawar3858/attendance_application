import { useEffect, useState } from 'react';
import { api } from '../../api/client.ts';
import { useApp } from '../../state/AppState.tsx';
import { useMembers } from '../../state/useOrgData.ts';
import type { Attendance, Status } from '../../api/types.ts';
import { Loading, EmptyState, StatusPill, Avatar } from '../../components/ui.tsx';
import { fmtDate } from '../../util/format.ts';

export default function MemberView({ statuses }: { statuses: Status[] }) {
  const { currentOrg } = useApp();
  const { members, loading: mLoading } = useMembers();
  const orgId = currentOrg?.id;
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selected && members.length) setSelected(members[0].id);
  }, [members, selected]);

  useEffect(() => {
    if (!orgId || !selected) return;
    setLoading(true);
    api
      .get<Attendance[]>(`/orgs/${orgId}/attendance/member/${selected}`)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [orgId, selected]);

  if (mLoading) return <Loading />;
  if (!members.length) return <EmptyState title="No members" icon="☺" />;

  const member = members.find((m) => m.id === selected);

  // quick stats
  const present = history.filter((h) => {
    const s = statuses.find((x) => x.id === h.status_id);
    return s?.counts_present;
  }).length;
  const rate = history.length ? Math.round((present / history.length) * 100) : 0;
  const totalHours = history.reduce((a, h) => a + (h.hours || 0), 0);

  return (
    <div className="split detail-open">
      {/* member list */}
      <div className="card pad" style={{ maxHeight: 'calc(100vh - 230px)', overflow: 'auto' }}>
        <h3>Members</h3>
        {members.map((m) => (
          <div key={m.id} className={`list-row ${selected === m.id ? 'active' : ''}`} onClick={() => setSelected(m.id)}>
            <Avatar name={m.name} src={m.avatar} size={32} />
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{m.name}</div>
              <div className="muted small">{m.department_name || m.role || '—'}</div>
            </div>
          </div>
        ))}
      </div>

      {/* history */}
      <div className="card pad" style={{ maxHeight: 'calc(100vh - 230px)', overflow: 'auto' }}>
        {member && (
          <>
            <div className="row gap-12 mb-16">
              <Avatar name={member.name} src={member.avatar} size={48} />
              <div>
                <h2 style={{ margin: 0 }}>{member.name}</h2>
                <div className="muted small">
                  {member.member_code} · {member.department_name || '—'} · {member.role || '—'}
                </div>
              </div>
            </div>

            <div className="stat-grid mb-16" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="stat">
                <span className="label">Records</span>
                <div className="value">{history.length}</div>
              </div>
              <div className="stat">
                <span className="label">Attendance rate</span>
                <div className="value">{rate}%</div>
              </div>
              <div className="stat">
                <span className="label">Total hours</span>
                <div className="value">{Math.round(totalHours * 10) / 10}</div>
              </div>
            </div>

            {loading ? (
              <Loading />
            ) : history.length === 0 ? (
              <EmptyState title="No attendance records" icon="🗓" hint="Mark attendance in the roster or daily views." />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Hours</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="mono">{fmtDate(h.date, 'DD MMM YYYY')}</td>
                      <td><StatusPill name={h.status_name} color={h.status_color} code={h.status_code} /></td>
                      <td className="mono">{h.check_in || '—'}</td>
                      <td className="mono">{h.check_out || '—'}</td>
                      <td className="mono">{h.hours ?? '—'}</td>
                      <td className="muted small">{h.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
