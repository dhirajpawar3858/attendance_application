import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, downloadFile } from '../api/client.ts';
import { useApp } from '../state/AppState.tsx';
import { useToast } from '../state/ToastProvider.tsx';
import { useOrgData } from '../state/useOrgData.ts';
import { THEMES } from '../theme/themes.ts';
import type { CustomField, Status } from '../api/types.ts';
import { Modal, ConfirmButton } from '../components/ui.tsx';
import { Icon, type IconName } from '../components/Icon.tsx';

type Tab = 'appearance' | 'profile' | 'statuses' | 'fields' | 'prefs' | 'data';

export default function Settings() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'appearance');

  const TABS: Array<{ id: Tab; label: string; icon: IconName }> = [
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'profile', label: 'Profile', icon: 'user' },
    { id: 'statuses', label: 'Statuses', icon: 'tag' },
    { id: 'fields', label: 'Custom fields', icon: 'sliders' },
    { id: 'prefs', label: 'Preferences', icon: 'settings' },
    { id: 'data', label: 'Data & backup', icon: 'database' },
  ];

  return (
    <div>
      <h1 className="page-title mb-16">Settings</h1>
      <div className="tabs">
        {TABS.map((t) => (
          <div key={t.id} className={`tab row gap-6 ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={15} /> {t.label}
          </div>
        ))}
      </div>

      {tab === 'appearance' && <Appearance />}
      {tab === 'profile' && <Profile />}
      {tab === 'statuses' && <Statuses />}
      {tab === 'fields' && <Fields />}
      {tab === 'prefs' && <Preferences />}
      {tab === 'data' && <DataBackup />}
    </div>
  );
}

// ---------------- Appearance ----------------
function Appearance() {
  const { theme, applyTheme } = useApp();
  return (
    <div className="card pad">
      <h3>Theme</h3>
      <p className="muted small">Choose a colour palette. Your choice is saved to your account.</p>
      <div className="stat-grid mt-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        {THEMES.map((t) => (
          <div key={t.id} className={`theme-card ${theme === t.id ? 'active' : ''}`} onClick={() => applyTheme(t.id, true)}>
            <div className="row between">
              <strong>{t.name}</strong>
              {theme === t.id && <Icon name="check" size={16} style={{ color: 'var(--primary-strong)' }} />}
            </div>
            <div className="theme-swatches">
              <span className="theme-swatch" style={{ background: t.swatch }} />
              <span className="theme-swatch" style={{ background: t.accent }} />
              <span className="theme-swatch" style={{ background: t.swatch, opacity: 0.45 }} />
              <span className="theme-swatch" style={{ background: t.swatch, opacity: 0.2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Profile ----------------
function Profile() {
  const { user, refreshMe } = useApp();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [contact, setContact] = useState(user?.contact || '');
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');

  async function saveProfile() {
    await api.put('/auth/profile', { name, contact });
    await refreshMe();
    toast.success('Profile updated');
  }
  async function changePw() {
    try {
      await api.put('/auth/password', { oldPassword: oldPw, newPassword: newPw });
      toast.success('Password changed');
      setPwOpen(false);
      setOldPw('');
      setNewPw('');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="card pad" style={{ maxWidth: 520 }}>
      <h3>Your profile</h3>
      <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label>Username / email</label><input value={user?.username || ''} disabled /></div>
      <div className="field"><label>Contact</label><input value={contact} onChange={(e) => setContact(e.target.value)} /></div>
      <div className="row gap-8 mt-8">
        <button className="btn primary" onClick={saveProfile}>Save profile</button>
        <button className="btn" onClick={() => setPwOpen(true)}>Change password</button>
      </div>

      {pwOpen && (
        <Modal title="Change password" onClose={() => setPwOpen(false)} width={400}
          footer={<><button className="btn ghost" onClick={() => setPwOpen(false)}>Cancel</button><button className="btn primary" onClick={changePw} disabled={!oldPw || !newPw}>Update</button></>}>
          <div className="field"><label>Current password</label><input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} /></div>
          <div className="field"><label>New password</label><input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 6 characters" /></div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Statuses ----------------
function Statuses() {
  const { currentOrg } = useApp();
  const toast = useToast();
  const { statuses, reload } = useOrgData();
  const orgId = currentOrg?.id;
  const [editing, setEditing] = useState<Partial<Status> | null>(null);

  async function saveStatus() {
    if (!editing || !orgId) return;
    const body = { name: editing.name, code: editing.code, color: editing.color, counts_present: editing.counts_present ? 1 : 0, is_default: editing.is_default ? 1 : 0 };
    try {
      if (editing.id) await api.put(`/orgs/${orgId}/statuses/${editing.id}`, body);
      else await api.post(`/orgs/${orgId}/statuses`, body);
      toast.success('Status saved');
      setEditing(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function del(id: number) {
    try {
      await api.del(`/orgs/${orgId}/statuses/${id}`);
      toast.info('Status deleted');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="card pad">
      <div className="row between mb-16">
        <h3 style={{ margin: 0 }}>Attendance statuses</h3>
        <button className="btn primary sm" onClick={() => setEditing({ color: '#A7A0E8', counts_present: 1 })}>＋ Add status</button>
      </div>
      <table className="table">
        <thead><tr><th>Status</th><th>Code</th><th>Counts present</th><th>Default</th><th></th></tr></thead>
        <tbody>
          {statuses.map((s) => (
            <tr key={s.id}>
              <td><span className="pill" style={{ background: s.color + '33', border: `1px solid ${s.color}` }}><span style={{ width: 9, height: 9, borderRadius: 99, background: s.color }} /> {s.name}</span></td>
              <td className="mono">{s.code}</td>
              <td>{s.counts_present ? '✓' : '—'}</td>
              <td>{s.is_default ? '★' : '—'}</td>
              <td>
                <div className="row gap-6">
                  <button className="btn ghost sm" onClick={() => setEditing(s)}>Edit</button>
                  <ConfirmButton className="btn ghost sm" onConfirm={() => del(s.id)}>Delete</ConfirmButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <Modal title={editing.id ? 'Edit status' : 'Add status'} onClose={() => setEditing(null)} width={420}
          footer={<><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" onClick={saveStatus}>Save</button></>}>
          <div className="grid2">
            <div className="field"><label>Name</label><input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus /></div>
            <div className="field"><label>Short code</label><input value={editing.code || ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })} maxLength={4} /></div>
          </div>
          <div className="field">
            <label>Colour</label>
            <div className="row gap-8">
              <input type="color" style={{ width: 56, height: 38, padding: 2 }} value={editing.color || '#A7A0E8'} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
              <input value={editing.color || ''} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
            </div>
          </div>
          <label className="row gap-8" style={{ fontWeight: 500, cursor: 'pointer', marginBottom: 8 }}>
            <input type="checkbox" checked={!!editing.counts_present} onChange={(e) => setEditing({ ...editing, counts_present: e.target.checked ? 1 : 0 })} style={{ width: 'auto' }} />
            Counts toward attendance rate
          </label>
          <label className="row gap-8" style={{ fontWeight: 500, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!editing.is_default} onChange={(e) => setEditing({ ...editing, is_default: e.target.checked ? 1 : 0 })} style={{ width: 'auto' }} />
            Default status when marking
          </label>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Custom fields ----------------
function Fields() {
  const { currentOrg } = useApp();
  const toast = useToast();
  const { customFields, reload } = useOrgData();
  const orgId = currentOrg?.id;
  const [editing, setEditing] = useState<Partial<CustomField> & { optionsText?: string } | null>(null);

  async function save() {
    if (!editing || !orgId) return;
    const options = editing.type === 'select' ? (editing.optionsText || '').split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    const body = { label: editing.label, type: editing.type, options };
    try {
      if (editing.id) await api.put(`/orgs/${orgId}/custom-fields/${editing.id}`, body);
      else await api.post(`/orgs/${orgId}/custom-fields`, body);
      toast.success('Field saved');
      setEditing(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function del(id: number) {
    await api.del(`/orgs/${orgId}/custom-fields/${id}`);
    toast.info('Field deleted');
    reload();
  }

  return (
    <div className="card pad">
      <div className="row between mb-16">
        <div>
          <h3 style={{ margin: 0 }}>Member custom fields</h3>
          <span className="muted small">Extra fields shown on every member and available as filters.</span>
        </div>
        <button className="btn primary sm" onClick={() => setEditing({ type: 'text' })}>＋ Add field</button>
      </div>
      <table className="table">
        <thead><tr><th>Label</th><th>Type</th><th>Options</th><th></th></tr></thead>
        <tbody>
          {customFields.map((f) => (
            <tr key={f.id}>
              <td style={{ fontWeight: 600 }}>{f.label}</td>
              <td><span className="pill" style={{ background: 'var(--surface-2)' }}>{f.type}</span></td>
              <td className="muted small">{f.options?.join(', ') || '—'}</td>
              <td>
                <div className="row gap-6">
                  <button className="btn ghost sm" onClick={() => setEditing({ ...f, optionsText: f.options?.join(', ') })}>Edit</button>
                  <ConfirmButton className="btn ghost sm" onConfirm={() => del(f.id)}>Delete</ConfirmButton>
                </div>
              </td>
            </tr>
          ))}
          {customFields.length === 0 && <tr><td colSpan={4} className="muted small">No custom fields yet.</td></tr>}
        </tbody>
      </table>

      {editing && (
        <Modal title={editing.id ? 'Edit field' : 'Add custom field'} onClose={() => setEditing(null)} width={440}
          footer={<><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" onClick={save} disabled={!editing.label}>Save</button></>}>
          <div className="field"><label>Label</label><input value={editing.label || ''} onChange={(e) => setEditing({ ...editing, label: e.target.value })} autoFocus /></div>
          <div className="field">
            <label>Type</label>
            <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as any })}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Dropdown (select)</option>
            </select>
          </div>
          {editing.type === 'select' && (
            <div className="field">
              <label>Options (comma-separated)</label>
              <input value={editing.optionsText || ''} onChange={(e) => setEditing({ ...editing, optionsText: e.target.value })} placeholder="Morning, Evening, Night" />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ---------------- Preferences ----------------
function Preferences() {
  const { user, refreshMe } = useApp();
  const toast = useToast();
  const [dateFormat, setDateFormat] = useState((user?.settings?.dateFormat as string) || 'YYYY-MM-DD');
  const [firstDay, setFirstDay] = useState(Number(user?.settings?.firstDayOfWeek ?? 1));

  async function save() {
    await api.put('/auth/settings', { dateFormat, firstDayOfWeek: firstDay });
    await refreshMe();
    toast.success('Preferences saved');
  }

  return (
    <div className="card pad" style={{ maxWidth: 520 }}>
      <h3>Preferences</h3>
      <div className="field">
        <label>Date format</label>
        <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
          <option value="YYYY-MM-DD">2026-09-16 (ISO)</option>
          <option value="DD/MM/YYYY">16/09/2026</option>
          <option value="MM/DD/YYYY">09/16/2026</option>
          <option value="DD MMM YYYY">16 Sep 2026</option>
        </select>
      </div>
      <div className="field">
        <label>First day of week</label>
        <select value={firstDay} onChange={(e) => setFirstDay(Number(e.target.value))}>
          <option value={0}>Sunday</option>
          <option value={1}>Monday</option>
        </select>
      </div>
      <button className="btn primary mt-8" onClick={save}>Save preferences</button>
    </div>
  );
}

// ---------------- Data & backup ----------------
function DataBackup() {
  const { refreshMe, refreshOrgs } = useApp();
  const toast = useToast();
  const [restoring, setRestoring] = useState(false);

  function backup() {
    downloadFile('/backup/download', `attendance-backup-${new Date().toISOString().slice(0, 10)}.db`).catch(() => toast.error('Backup failed'));
  }
  function exportAll() {
    downloadFile('/backup/export-all', 'attendance-export.json').catch(() => toast.error('Export failed'));
  }
  async function restore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      await api.post('/backup/restore', { data: b64 });
      toast.success('Database restored — reloading…');
      await refreshMe();
      await refreshOrgs();
      setTimeout(() => window.location.reload(), 900);
    } catch (err: any) {
      toast.error(err.message || 'Restore failed');
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  }
  async function reset() {
    try {
      await api.post('/backup/reset', { confirm: 'RESET' });
      toast.success('All data reset — reloading…');
      setTimeout(() => window.location.reload(), 900);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="grid2">
      <div className="card pad">
        <h3>Backup & restore</h3>
        <p className="muted small">Back up the entire local database to a file, or restore from a previous backup.</p>
        <div className="col gap-8 mt-16" style={{ alignItems: 'flex-start' }}>
          <button className="btn primary" onClick={backup}>↓ Download backup (.db)</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {restoring ? 'Restoring…' : '↑ Restore from backup'}
            <input type="file" accept=".db" style={{ display: 'none' }} onChange={restore} disabled={restoring} />
          </label>
          <button className="btn" onClick={exportAll}>↓ Export all data (JSON)</button>
        </div>
      </div>

      <div className="card pad" style={{ borderColor: 'var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)' }}>Danger zone</h3>
        <p className="muted small">Permanently delete all organisations, members and attendance. Your account remains but data is wiped. Back up first!</p>
        <div className="mt-16">
          <ConfirmButton className="btn danger" onConfirm={reset} confirmLabel="Click again to erase EVERYTHING">
            Reset all data
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}
