import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.ts';
import { useApp } from '../state/AppState.tsx';
import { useToast } from '../state/ToastProvider.tsx';
import type { Holiday } from '../api/types.ts';
import { Loading, Modal, EmptyState, ConfirmButton } from '../components/ui.tsx';
import { WEEKDAYS, MONTHS, ymd } from '../util/format.ts';

interface DayStat {
  date: string;
  present: number;
  total: number;
  ratePct: number;
}

export default function Calendar() {
  const { currentOrg } = useApp();
  const toast = useToast();
  const orgId = currentOrg?.id;
  const canEdit = currentOrg?.my_role !== 'viewer';

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [dayStats, setDayStats] = useState<Record<string, DayStat>>({});
  const [loading, setLoading] = useState(true);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [holName, setHolName] = useState('');
  const [holRecurring, setHolRecurring] = useState(false);

  const workingDays = (currentOrg?.working_days || '1,2,3,4,5').split(',').map(Number);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const from = ymd(new Date(year, month, 1));
      const to = ymd(new Date(year, month + 1, 0));
      const [hols, trend] = await Promise.all([
        api.get<Holiday[]>(`/orgs/${orgId}/holidays?year=${year}`),
        api.get<{ trend: DayStat[] }>(`/orgs/${orgId}/dashboard?today=${from}&from=${from}&to=${to}`),
      ]);
      setHolidays(hols);
      const map: Record<string, DayStat> = {};
      for (const t of trend.trend) map[t.date] = t;
      setDayStats(map);
    } finally {
      setLoading(false);
    }
  }, [orgId, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  const holidayByDate: Record<string, Holiday> = {};
  for (const h of holidays) holidayByDate[h.date] = h;

  async function addHoliday() {
    if (!orgId || !addFor || !holName.trim()) return;
    await api.post(`/orgs/${orgId}/holidays`, { date: addFor, name: holName.trim(), recurring: holRecurring ? 1 : 0 });
    toast.success('Holiday added');
    setAddFor(null);
    setHolName('');
    setHolRecurring(false);
    load();
  }

  async function removeHoliday(id: number) {
    if (!orgId) return;
    await api.del(`/orgs/${orgId}/holidays/${id}`);
    toast.info('Holiday removed');
    load();
  }

  // build calendar grid
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: string; inMonth: boolean; dow: number } | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    cells.push({ date: ymd(dateObj), inMonth: true, dow: dateObj.getDay() });
  }
  const todayS = ymd(now);

  if (loading && !holidays.length && !Object.keys(dayStats).length) return <Loading />;

  return (
    <div>
      <div className="row between mb-16 wrap gap-12">
        <h1 className="page-title">Calendar</h1>
        <div className="row gap-6">
          <button className="btn sm" onClick={prevMonth}>‹</button>
          <span className="pill" style={{ background: 'var(--surface-2)', minWidth: 140, justifyContent: 'center' }}>
            {MONTHS[month]} {year}
          </span>
          <button className="btn sm" onClick={nextMonth}>›</button>
        </div>
      </div>

      <div className="row gap-16 mb-16 wrap small muted">
        <span className="row gap-6"><span className="theme-swatch" style={{ background: 'var(--warning-soft)', width: 16, height: 16 }} /> Holiday</span>
        <span className="row gap-6"><span className="theme-swatch" style={{ background: 'var(--surface-2)', width: 16, height: 16 }} /> Weekly off</span>
        <span className="row gap-6"><span className="theme-swatch" style={{ background: 'var(--danger-soft)', width: 16, height: 16 }} /> Low attendance (&lt;60%)</span>
      </div>

      <div className="card pad">
        <div className="cal-grid mb-8">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-head">{w}</div>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const hol = holidayByDate[c.date];
            const stat = dayStats[c.date];
            const isWeekOff = !workingDays.includes(c.dow);
            const low = stat && stat.total > 0 && stat.ratePct < 60;
            const classes = ['cal-cell'];
            if (c.date === todayS) classes.push('today');
            if (hol) classes.push('holiday');
            else if (isWeekOff) classes.push('weekoff');
            return (
              <div
                key={i}
                className={classes.join(' ')}
                style={low ? { background: 'var(--danger-soft)' } : undefined}
                onClick={() => canEdit && !hol && setAddFor(c.date)}
                title={canEdit && !hol ? 'Click to add a holiday' : ''}
              >
                <div className="cal-date">{Number(c.date.slice(-2))}</div>
                {hol && (
                  <div className="cal-tag" style={{ background: 'var(--warning)', color: '#3d3524' }}>
                    {hol.name}
                    {canEdit && (
                      <span onClick={(e) => { e.stopPropagation(); removeHoliday(hol.id); }} style={{ marginLeft: 4, cursor: 'pointer' }}>✕</span>
                    )}
                  </div>
                )}
                {stat && stat.total > 0 && (
                  <div className="cal-tag" style={{ background: 'var(--surface-3)' }}>
                    {stat.present}/{stat.total} · {stat.ratePct}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* holiday list */}
      <div className="card pad mt-16">
        <h3>Holidays in {year}</h3>
        {holidays.length === 0 ? (
          <EmptyState title="No holidays configured" icon="🎉" hint={canEdit ? 'Click a day above to add one.' : undefined} />
        ) : (
          <table className="table">
            <thead><tr><th>Date</th><th>Name</th><th>Recurring</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id}>
                  <td className="mono">{h.date}</td>
                  <td>{h.name}</td>
                  <td>{h.recurring ? 'Yearly' : '—'}</td>
                  {canEdit && (
                    <td><ConfirmButton className="btn danger sm" onConfirm={() => removeHoliday(h.id)}>Delete</ConfirmButton></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {addFor && (
        <Modal
          title={`Add holiday · ${addFor}`}
          onClose={() => setAddFor(null)}
          width={400}
          footer={
            <>
              <button className="btn ghost" onClick={() => setAddFor(null)}>Cancel</button>
              <button className="btn primary" onClick={addHoliday} disabled={!holName.trim()}>Add holiday</button>
            </>
          }
        >
          <div className="field">
            <label>Holiday name</label>
            <input value={holName} onChange={(e) => setHolName(e.target.value)} placeholder="e.g. Founders Day" autoFocus onKeyDown={(e) => e.key === 'Enter' && addHoliday()} />
          </div>
          <label className="row gap-8" style={{ fontWeight: 500, cursor: 'pointer' }}>
            <input type="checkbox" checked={holRecurring} onChange={(e) => setHolRecurring(e.target.checked)} style={{ width: 'auto' }} />
            Repeats every year
          </label>
        </Modal>
      )}
    </div>
  );
}
