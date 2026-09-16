import { useCallback, useEffect, useState } from 'react';
import { api, downloadFile } from '../api/client.ts';
import { useApp } from '../state/AppState.tsx';
import { useToast } from '../state/ToastProvider.tsx';
import { useOrgData } from '../state/useOrgData.ts';
import { FilterBar, filterToQuery } from '../components/FilterBar.tsx';
import type { FilterState, MemberReportRow, Status } from '../api/types.ts';
import { Loading, EmptyState } from '../components/ui.tsx';
import { todayStr } from '../util/format.ts';

export default function Reports() {
  const { currentOrg } = useApp();
  const toast = useToast();
  const { statuses, departments, customFields, loading: refLoading } = useOrgData();
  const orgId = currentOrg?.id;

  const [filter, setFilter] = useState<FilterState>({ preset: 'thisMonth', sortBy: 'name', sortDir: 'asc' });
  const [roles, setRoles] = useState<string[]>([]);
  const [rows, setRows] = useState<MemberReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgId) api.get<string[]>(`/orgs/${orgId}/members/roles`).then(setRoles).catch(() => {});
  }, [orgId]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const q = filterToQuery(filter, todayStr());
      const data = await api.get<MemberReportRow[]>(`/orgs/${orgId}/reports/members?${q}`);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [orgId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const q = filterToQuery(filter, todayStr());

  function exportCsv(kind: 'members' | 'detail') {
    const path = kind === 'members' ? `/orgs/${orgId}/reports/members/export?${q}` : `/orgs/${orgId}/reports/detail/export?${q}`;
    downloadFile(path, kind === 'members' ? 'member-report.csv' : 'attendance-detail.csv').catch(() => toast.error('Export failed'));
  }

  function exportExcel() {
    // SpreadsheetML (.xls) that Excel opens natively — built from current rows.
    const header = ['Member', 'Code', 'Department', 'Total', 'Present', 'Rate %', 'Hours', ...statuses.map((s) => s.name)];
    const dataRows = rows.map((r) => [
      r.name, r.member_code, r.department_name, r.total, r.present, r.ratePct, r.hours,
      ...statuses.map((s) => r.byStatus[s.id] ?? 0),
    ]);
    downloadExcel('member-report', header, dataRows);
    toast.success('Excel file downloaded');
  }

  function exportPdf() {
    printReport(currentOrg?.name || 'Report', filter, statuses, rows);
  }

  if (refLoading) return <Loading />;

  const totals = rows.reduce(
    (a, r) => ({ total: a.total + r.total, present: a.present + r.present, hours: a.hours + r.hours }),
    { total: 0, present: 0, hours: 0 },
  );
  const overallRate = totals.total ? Math.round((totals.present / totals.total) * 1000) / 10 : 0;

  return (
    <div>
      <div className="row between mb-16 wrap gap-12">
        <h1 className="page-title">Reports</h1>
        <div className="row gap-8 wrap">
          <button className="btn sm" onClick={() => exportCsv('members')}>↓ Summary CSV</button>
          <button className="btn sm" onClick={() => exportCsv('detail')}>↓ Detail CSV</button>
          <button className="btn sm" onClick={exportExcel}>↓ Excel</button>
          <button className="btn primary sm" onClick={exportPdf}>🖶 PDF / Print</button>
        </div>
      </div>

      <FilterBar
        value={filter}
        onChange={setFilter}
        statuses={statuses}
        departments={departments}
        customFields={customFields}
        roles={roles}
      />

      <div className="stat-grid mb-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="stat"><span className="label">Members</span><div className="value">{rows.length}</div></div>
        <div className="stat"><span className="label">Records</span><div className="value">{totals.total}</div></div>
        <div className="stat"><span className="label">Overall rate</span><div className="value">{overallRate}%</div></div>
        <div className="stat"><span className="label">Total hours</span><div className="value">{Math.round(totals.hours * 10) / 10}</div></div>
      </div>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState title="No data for this filter" icon="❏" hint="Adjust the date range or filters above." />
      ) : (
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Department</th>
                <th className="mono">Total</th>
                <th className="mono">Present</th>
                <th className="mono">Rate %</th>
                <th className="mono">Hours</th>
                {statuses.map((s) => (
                  <th key={s.id} className="mono" title={s.name}>{s.code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.member_id}>
                  <td style={{ fontWeight: 600 }}>{r.name}<div className="muted small">{r.member_code}</div></td>
                  <td>{r.department_name || '—'}</td>
                  <td className="mono">{r.total}</td>
                  <td className="mono">{r.present}</td>
                  <td className="mono">
                    <span className="pill" style={{ background: rateColor(r.ratePct) }}>{r.ratePct}%</span>
                  </td>
                  <td className="mono">{r.hours}</td>
                  {statuses.map((s) => (
                    <td key={s.id} className="mono">{r.byStatus[s.id] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function rateColor(pct: number): string {
  if (pct >= 90) return 'var(--success-soft)';
  if (pct >= 75) return 'var(--warning-soft)';
  return 'var(--danger-soft)';
}

// ---- Excel (SpreadsheetML 2003) export: opens natively in Excel, no deps ----
function downloadExcel(name: string, header: (string | number)[], rows: (string | number)[][]) {
  const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cell = (v: any) => {
    const isNum = typeof v === 'number';
    return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${esc(v)}</Data></Cell>`;
  };
  const rowXml = (cells: any[]) => `<Row>${cells.map(cell).join('')}</Row>`;
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Report"><Table>
${rowXml(header)}
${rows.map(rowXml).join('\n')}
</Table></Worksheet></Workbook>`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- PDF via print-friendly window ----
function printReport(orgName: string, filter: FilterState, statuses: Status[], rows: MemberReportRow[]) {
  const w = window.open('', '_blank');
  if (!w) return;
  const range = filter.preset && filter.preset !== 'custom' ? filter.preset : `${filter.dateFrom || ''} → ${filter.dateTo || ''}`;
  const statusCols = statuses.map((s) => `<th>${s.code}</th>`).join('');
  const body = rows
    .map(
      (r) => `<tr>
      <td>${r.name}</td><td>${r.member_code || ''}</td><td>${r.department_name || ''}</td>
      <td>${r.total}</td><td>${r.present}</td><td>${r.ratePct}%</td><td>${r.hours}</td>
      ${statuses.map((s) => `<td>${r.byStatus[s.id] ?? 0}</td>`).join('')}
    </tr>`,
    )
    .join('');
  w.document.write(`<!doctype html><html><head><title>${orgName} — Attendance Report</title>
    <style>
      body { font-family: Segoe UI, system-ui, sans-serif; padding: 30px; color: #322b46; }
      h1 { margin: 0 0 4px; } .sub { color: #6a6280; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #e2d9f2; padding: 6px 8px; text-align: left; }
      th { background: #f2eefb; }
      @media print { .noprint { display: none; } }
    </style></head><body>
    <h1>${orgName}</h1>
    <div class="sub">Attendance report · Range: ${range} · Generated ${new Date().toLocaleString()}</div>
    <table><thead><tr><th>Member</th><th>Code</th><th>Dept</th><th>Total</th><th>Present</th><th>Rate</th><th>Hours</th>${statusCols}</tr></thead>
    <tbody>${body}</tbody></table>
    <button class="noprint" style="margin-top:20px;padding:8px 16px" onclick="window.print()">Print / Save as PDF</button>
    </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
