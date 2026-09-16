import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '../api/client.ts';
import { useApp } from '../state/AppState.tsx';
import type { DashboardData } from '../api/types.ts';
import { Loading, EmptyState } from '../components/ui.tsx';
import { Icon, type IconName } from '../components/Icon.tsx';
import { Sparkline } from '../components/Sparkline.tsx';
import { todayStr, addDays } from '../util/format.ts';

// key = card metric, sparkKey/deltaKey = which series in data.spark / data.delta,
// invert = a rising value is "bad" (absent/late) so colour the delta accordingly.
const CARD_META: Array<{
  key: keyof DashboardData['cards'];
  label: string;
  icon: IconName;
  color: string;
  sparkKey: string;
  invert?: boolean;
}> = [
  { key: 'totalMembers', label: 'Total members', icon: 'members', color: 'var(--primary)', sparkKey: 'marked' },
  { key: 'presentToday', label: 'Present today', icon: 'present', color: 'var(--success)', sparkKey: 'present' },
  { key: 'absentToday', label: 'Absent today', icon: 'absent', color: 'var(--danger)', sparkKey: 'absent', invert: true },
  { key: 'lateToday', label: 'Late today', icon: 'late', color: 'var(--warning)', sparkKey: 'late', invert: true },
  { key: 'onLeaveToday', label: 'On leave today', icon: 'leave', color: 'var(--info)', sparkKey: 'onLeave' },
];

function TrendLabel({ delta, invert }: { delta: number; invert?: boolean }) {
  if (!delta) return <span className="trend flat">— no change vs last week</span>;
  const positive = invert ? delta < 0 : delta > 0;
  return (
    <span className={`trend ${positive ? 'up' : 'down'}`}>
      <Icon name={delta > 0 ? 'trendUp' : 'trendDown'} size={13} />
      {delta > 0 ? '+' : ''}{delta} vs last week
    </span>
  );
}

export default function Dashboard() {
  const { currentOrg } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const orgId = currentOrg?.id;

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    const today = todayStr();
    const from = addDays(today, -29);
    api
      .get<DashboardData>(`/orgs/${orgId}/dashboard?today=${today}&from=${from}&to=${today}`)
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [orgId]);

  if (loading) return <Loading />;
  if (!data) return <EmptyState title="No data yet" icon="▦" />;

  const { cards, statusDist, byDepartment, trend, spark, delta } = data;
  const hasTrend = trend.some((t) => t.total > 0);

  return (
    <div>
      <div className="row between mb-16 wrap gap-12">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="muted small">{currentOrg?.name} · overview of the last 30 days</div>
        </div>
        <button className="btn primary" onClick={() => navigate('/attendance')}>
          <Icon name="attendance" size={16} /> Mark attendance
        </button>
      </div>

      {/* summary cards — white card + colored accent + icon + sparkline + trend */}
      <div className="stat-grid mb-16">
        {CARD_META.map((c) => (
          <div key={c.key} className="stat accented" style={{ ['--accent-c' as any]: c.color }}>
            <div className="row between">
              <span className="label">{c.label}</span>
              <span className="stat-accent" style={{ background: c.color + '22', color: c.color }}>
                <Icon name={c.icon} size={19} />
              </span>
            </div>
            <div className="value">{cards[c.key]}</div>
            <TrendLabel delta={delta?.[c.sparkKey] ?? 0} invert={c.invert} />
            <Sparkline data={spark?.[c.sparkKey] ?? []} color={c.color} />
          </div>
        ))}
        {/* attendance-rate hero card */}
        <div className="stat accented" style={{ ['--accent-c' as any]: 'var(--primary)', background: 'linear-gradient(135deg, var(--primary-soft), var(--surface))' }}>
          <div className="row between">
            <span className="label">Attendance rate (30d)</span>
            <span className="stat-accent" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
              <Icon name="rate" size={19} />
            </span>
          </div>
          <div className="value">{cards.rangeRatePct}%</div>
          <TrendLabel delta={delta?.rate ?? 0} />
          <Sparkline data={spark?.rate ?? []} color="var(--primary)" />
        </div>
      </div>

      {/* charts */}
      <div className="chart-grid mb-16">
        <div className="card pad">
          <h3>Attendance trend</h3>
          {hasTrend ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ left: -18, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="ratePct" name="Rate %" stroke="var(--primary)" strokeWidth={2.5} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No attendance in this range" icon="📈" hint="Mark some attendance to see the trend." />
          )}
        </div>

        <div className="card pad">
          <h3>By status</h3>
          {statusDist.some((s) => s.count > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusDist.filter((s) => s.count > 0)}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {statusDist.filter((s) => s.count > 0).map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No records" icon="🍩" />
          )}
        </div>
      </div>

      <div className="card pad">
        <h3>By department</h3>
        {byDepartment.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byDepartment} margin={{ left: -18, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="present" name="Present" fill="var(--success)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="total" name="Total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No departments yet" icon="🏢" />
        )}
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text)',
};
