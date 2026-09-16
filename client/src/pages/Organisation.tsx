import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.ts';
import { useApp } from '../state/AppState.tsx';
import { useToast } from '../state/ToastProvider.tsx';
import { useOrgData } from '../state/useOrgData.ts';
import type { Org } from '../api/types.ts';
import { Loading, Modal, ConfirmButton } from '../components/ui.tsx';
import { WEEKDAYS } from '../util/format.ts';

export default function Organisation() {
  const { currentOrg, orgs, refreshOrgs, setCurrentOrg } = useApp();
  const toast = useToast();
  const { departments, reload: reloadRef } = useOrgData();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<Org | null>(currentOrg);
  const [busy, setBusy] = useState(false);
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [deptName, setDeptName] = useState('');

  useEffect(() => setForm(currentOrg), [currentOrg]);
  useEffect(() => {
    if (params.get('new') === '1') {
      setNewOrgOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  if (!form) return <Loading />;
  const canEdit = currentOrg?.my_role !== 'viewer';
  const workingDays = (form.working_days || '').split(',').filter(Boolean).map(Number);

  const set = (patch: Partial<Org>) => setForm((f) => ({ ...f!, ...patch }));

  function toggleDay(d: number) {
    const has = workingDays.includes(d);
    const next = has ? workingDays.filter((x) => x !== d) : [...workingDays, d].sort();
    set({ working_days: next.join(',') });
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      await api.put(`/orgs/${form.id}`, {
        name: form.name,
        address: form.address,
        contact: form.contact,
        timezone: form.timezone,
        logo: form.logo,
        working_days: form.working_days,
        work_hours_start: form.work_hours_start,
        work_hours_end: form.work_hours_end,
      });
      toast.success('Organisation saved');
      await refreshOrgs();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set({ logo: reader.result as string });
    reader.readAsDataURL(file);
  }

  async function createOrg() {
    if (!newOrgName.trim()) return;
    const org = await api.post<Org>('/orgs', { name: newOrgName.trim() });
    const list = await refreshOrgs();
    const created = list.find((o) => o.id === org.id);
    if (created) setCurrentOrg(created);
    toast.success(`Created ${org.name}`);
    setNewOrgOpen(false);
    setNewOrgName('');
  }

  async function addDept() {
    if (!deptName.trim() || !currentOrg) return;
    await api.post(`/orgs/${currentOrg.id}/departments`, { name: deptName.trim() });
    setDeptName('');
    reloadRef();
    toast.success('Department added');
  }

  async function delDept(id: number) {
    if (!currentOrg) return;
    await api.del(`/orgs/${currentOrg.id}/departments/${id}`);
    reloadRef();
    toast.info('Department deleted');
  }

  return (
    <div>
      <div className="row between mb-16 wrap gap-12">
        <h1 className="page-title">Organisation</h1>
        <button className="btn sm" onClick={() => setNewOrgOpen(true)}>＋ New organisation</button>
      </div>

      <div className="grid2">
        {/* details */}
        <div className="card pad">
          <h3>Details</h3>
          <div className="row gap-12 mb-16">
            <div className="brand-mark" style={{ width: 56, height: 56, fontSize: 24 }}>
              {form.logo ? <img src={form.logo} alt="" style={{ width: 56, height: 56, borderRadius: 9, objectFit: 'cover' }} /> : form.name[0]}
            </div>
            {canEdit && (
              <div className="row gap-8">
                <label className="btn sm" style={{ cursor: 'pointer' }}>
                  Upload logo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onLogo} />
                </label>
                {form.logo && <button className="btn ghost sm" onClick={() => set({ logo: null })}>Remove</button>}
              </div>
            )}
          </div>
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} disabled={!canEdit} />
          </div>
          <div className="field">
            <label>Address</label>
            <input value={form.address || ''} onChange={(e) => set({ address: e.target.value })} disabled={!canEdit} />
          </div>
          <div className="field">
            <label>Contact</label>
            <input value={form.contact || ''} onChange={(e) => set({ contact: e.target.value })} disabled={!canEdit} />
          </div>
          <div className="field">
            <label>Timezone</label>
            <input value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} disabled={!canEdit} placeholder="UTC" />
          </div>
        </div>

        {/* working config */}
        <div className="card pad">
          <h3>Working schedule</h3>
          <div className="field">
            <label>Working days</label>
            <div className="row gap-6 wrap">
              {WEEKDAYS.map((w, i) => (
                <button key={i} className={`chip ${workingDays.includes(i) ? 'on' : ''}`} onClick={() => canEdit && toggleDay(i)}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label>Work hours start</label>
              <input type="time" value={form.work_hours_start} onChange={(e) => set({ work_hours_start: e.target.value })} disabled={!canEdit} />
            </div>
            <div className="field">
              <label>Work hours end</label>
              <input type="time" value={form.work_hours_end} onChange={(e) => set({ work_hours_end: e.target.value })} disabled={!canEdit} />
            </div>
          </div>

          <div className="divider" />
          <h3>Departments</h3>
          {canEdit && (
            <div className="row gap-8 mb-16">
              <input placeholder="New department name" value={deptName} onChange={(e) => setDeptName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDept()} />
              <button className="btn sm" onClick={addDept}>Add</button>
            </div>
          )}
          <div className="col gap-6">
            {departments.map((d) => (
              <div key={d.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span>{d.name} <span className="muted small">· {d.member_count} members</span></span>
                {canEdit && <ConfirmButton className="btn ghost sm" onConfirm={() => delDept(d.id)}>Delete</ConfirmButton>}
              </div>
            ))}
            {departments.length === 0 && <div className="muted small">No departments yet.</div>}
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="row gap-8 mt-16">
          <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      )}

      {/* all orgs */}
      <div className="card pad mt-16">
        <h3>All organisations</h3>
        <div className="col gap-6">
          {orgs.map((o) => (
            <div key={o.id} className={`list-row ${o.id === currentOrg?.id ? 'active' : ''}`} onClick={() => setCurrentOrg(o)}>
              <div className="brand-mark" style={{ width: 30, height: 30, fontSize: 14 }}>{o.name[0]}</div>
              <div className="grow"><span style={{ fontWeight: 600 }}>{o.name}</span> <span className="muted small">· {o.my_role}</span></div>
              {o.id === currentOrg?.id && <span className="pill" style={{ background: 'var(--primary-soft)', color: 'var(--primary-strong)' }}>Current</span>}
            </div>
          ))}
        </div>
      </div>

      {newOrgOpen && (
        <Modal
          title="New organisation"
          onClose={() => setNewOrgOpen(false)}
          width={400}
          footer={
            <>
              <button className="btn ghost" onClick={() => setNewOrgOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={createOrg} disabled={!newOrgName.trim()}>Create</button>
            </>
          }
        >
          <div className="field">
            <label>Organisation name</label>
            <input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && createOrg()} />
          </div>
        </Modal>
      )}
    </div>
  );
}
