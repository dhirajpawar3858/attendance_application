import { useEffect, useMemo, useRef, useState } from 'react';
import { api, downloadFile } from '../api/client.ts';
import { useApp } from '../state/AppState.tsx';
import { useToast } from '../state/ToastProvider.tsx';
import { useOrgData } from '../state/useOrgData.ts';
import type { Member } from '../api/types.ts';
import { Loading, EmptyState, Modal, Avatar, ConfirmButton } from '../components/ui.tsx';
import { fmtDate } from '../util/format.ts';

export default function Members() {
  const { currentOrg } = useApp();
  const toast = useToast();
  const { departments, customFields, loading: refLoading, reload: reloadRef } = useOrgData();
  const orgId = currentOrg?.id;
  const canEdit = currentOrg?.my_role !== 'viewer';

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [isNew, setIsNew] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (showArchived) q.set('includeArchived', '1');
      const list = await api.get<Member[]>(`/orgs/${orgId}/members?${q.toString()}`);
      setMembers(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [orgId, showArchived]);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (deptFilter && String(m.department_id) !== deptFilter) return false;
      if (search && !`${m.name} ${m.member_code} ${m.email} ${m.role}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [members, search, deptFilter]);

  function openNew() {
    setIsNew(true);
    setEditing({
      id: 0,
      org_id: orgId!,
      name: '',
      active: 1,
      archived: 0,
      customValues: {},
    } as Member);
  }

  function openEdit(m: Member) {
    setIsNew(false);
    api.get<Member>(`/orgs/${orgId}/members/${m.id}`).then((full) => setEditing(full));
  }

  async function selectMember(m: Member) {
    const full = await api.get<Member>(`/orgs/${orgId}/members/${m.id}`);
    setSelected(full);
  }

  async function archiveMember(m: Member, archived: boolean) {
    await api.post(`/orgs/${orgId}/members/${m.id}/archive`, { archived });
    toast.info(archived ? 'Member archived' : 'Member restored');
    load();
    if (selected?.id === m.id) setSelected(null);
  }

  function triggerImport() {
    fileRef.current?.click();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    const text = await file.text();
    try {
      const res = await api.post<{ created: number; updated: number; total: number; errors: string[] }>(
        `/orgs/${orgId}/members/import`,
        { csv: text },
      );
      toast.success(`Imported: ${res.created} new, ${res.updated} updated`);
      if (res.errors?.length) toast.info(`${res.errors.length} rows skipped`);
      reloadRef();
      load();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    }
    e.target.value = '';
  }

  if (refLoading || (loading && !members.length)) return <Loading />;

  return (
    <div>
      <div className="row between mb-16 wrap gap-12">
        <div>
          <h1 className="page-title">Members</h1>
          <div className="muted small">{members.filter((m) => !m.archived).length} active members</div>
        </div>
        <div className="row gap-8 wrap">
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          <button className="btn sm" onClick={() => downloadFile(`/orgs/${orgId}/members/export`, 'members.csv')}>
            ↓ Export CSV
          </button>
          {canEdit && (
            <button className="btn sm" onClick={triggerImport}>
              ↑ Import CSV
            </button>
          )}
          {canEdit && (
            <button className="btn primary sm" onClick={openNew}>
              ＋ Add member
            </button>
          )}
        </div>
      </div>

      <div className="toolbar">
        <input style={{ width: 240 }} placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ width: 180 }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <label className="row gap-6" style={{ fontWeight: 500, cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} style={{ width: 'auto' }} />
          Show archived
        </label>
      </div>

      <div className={`split ${selected ? 'detail-open' : ''}`}>
        <div className="card" style={{ overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <EmptyState title="No members found" icon="☺" hint="Try adjusting filters or add a new member." action={canEdit && <button className="btn primary sm" onClick={openNew}>＋ Add member</button>} />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} onClick={() => selectMember(m)} style={{ cursor: 'pointer', opacity: m.archived ? 0.55 : 1 }} className={selected?.id === m.id ? 'active-row' : ''}>
                    <td>
                      <div className="row gap-8">
                        <Avatar name={m.name} src={m.avatar} size={30} />
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                      </div>
                    </td>
                    <td className="mono muted">{m.member_code || '—'}</td>
                    <td>{m.department_name || '—'}</td>
                    <td>{m.role || '—'}</td>
                    <td>
                      {m.archived ? (
                        <span className="pill" style={{ background: 'var(--surface-3)' }}>Archived</span>
                      ) : m.active ? (
                        <span className="pill" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>Active</span>
                      ) : (
                        <span className="pill" style={{ background: 'var(--warning-soft)' }}>Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className="card pad" style={{ maxHeight: 'calc(100vh - 260px)', overflow: 'auto' }}>
            <div className="row between mb-16">
              <div className="row gap-12">
                <Avatar name={selected.name} src={selected.avatar} size={52} />
                <div>
                  <h2 style={{ margin: 0 }}>{selected.name}</h2>
                  <div className="muted small">{selected.role || '—'}</div>
                </div>
              </div>
              <button className="btn ghost icon" onClick={() => setSelected(null)}>✕</button>
            </div>

            <DetailRow label="Member code" value={selected.member_code} />
            <DetailRow label="Department" value={selected.department_name} />
            <DetailRow label="Email" value={selected.email} />
            <DetailRow label="Phone" value={selected.phone} />
            <DetailRow label="Join date" value={selected.join_date ? fmtDate(selected.join_date, 'DD MMM YYYY') : null} />
            <DetailRow label="Notes" value={selected.notes} />
            {customFields.map((f) => (
              <DetailRow key={f.id} label={f.label} value={selected.customValues?.[f.id]} />
            ))}

            {canEdit && (
              <div className="row gap-8 mt-16 wrap">
                <button className="btn sm" onClick={() => openEdit(selected)}>✎ Edit</button>
                {selected.archived ? (
                  <button className="btn sm" onClick={() => archiveMember(selected, false)}>↺ Restore</button>
                ) : (
                  <ConfirmButton className="btn danger sm" onConfirm={() => archiveMember(selected, true)} confirmLabel="Confirm archive">
                    🗄 Archive
                  </ConfirmButton>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {editing && (
        <MemberEditModal
          member={editing}
          isNew={isNew}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            if (selected) selectMember(selected);
          }}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="row between" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="muted small">{label}</span>
      <span style={{ fontWeight: 550, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

// ---------------- edit modal ----------------
function MemberEditModal({
  member,
  isNew,
  onClose,
  onSaved,
}: {
  member: Member;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { currentOrg } = useApp();
  const toast = useToast();
  const { departments, customFields } = useOrgData();
  const orgId = currentOrg?.id;
  const [form, setForm] = useState<Member>({ ...member, customValues: { ...(member.customValues || {}) } });
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Member>) => setForm((f) => ({ ...f, ...patch }));
  const setCF = (fieldId: number, value: string) =>
    setForm((f) => ({ ...f, customValues: { ...(f.customValues || {}), [fieldId]: value } }));

  async function save() {
    if (!form.name.trim()) return toast.error('Name is required');
    setBusy(true);
    try {
      const body = {
        name: form.name,
        member_code: form.member_code,
        role: form.role,
        department_id: form.department_id ? Number(form.department_id) : null,
        phone: form.phone,
        email: form.email,
        join_date: form.join_date,
        active: form.active,
        notes: form.notes,
        avatar: form.avatar,
        customValues: form.customValues,
      };
      if (isNew) await api.post(`/orgs/${orgId}/members`, body);
      else await api.put(`/orgs/${orgId}/members/${form.id}`, body);
      toast.success(isNew ? 'Member added' : 'Member updated');
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set({ avatar: reader.result as string });
    reader.readAsDataURL(file);
  }

  return (
    <Modal
      title={isNew ? 'Add member' : 'Edit member'}
      onClose={onClose}
      width={620}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save member'}</button>
        </>
      }
    >
      <div className="row gap-12 mb-16">
        <Avatar name={form.name || '?'} src={form.avatar} size={56} />
        <label className="btn sm" style={{ cursor: 'pointer' }}>
          Upload photo
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatar} />
        </label>
        {form.avatar && <button className="btn ghost sm" onClick={() => set({ avatar: null })}>Remove</button>}
      </div>

      <div className="grid2">
        <div className="field">
          <label>Name *</label>
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        </div>
        <div className="field">
          <label>Member code</label>
          <input value={form.member_code || ''} onChange={(e) => set({ member_code: e.target.value })} placeholder="EMP001" />
        </div>
        <div className="field">
          <label>Department</label>
          <select value={form.department_id || ''} onChange={(e) => set({ department_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Role / designation</label>
          <input value={form.role || ''} onChange={(e) => set({ role: e.target.value })} />
        </div>
        <div className="field">
          <label>Email</label>
          <input value={form.email || ''} onChange={(e) => set({ email: e.target.value })} />
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={form.phone || ''} onChange={(e) => set({ phone: e.target.value })} />
        </div>
        <div className="field">
          <label>Join date</label>
          <input type="date" value={form.join_date || ''} onChange={(e) => set({ join_date: e.target.value })} />
        </div>
        <div className="field">
          <label>Active</label>
          <select value={form.active} onChange={(e) => set({ active: Number(e.target.value) })}>
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Notes</label>
        <textarea rows={2} value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
      </div>

      {customFields.length > 0 && (
        <>
          <div className="divider" />
          <div className="muted small mb-8" style={{ fontWeight: 700 }}>CUSTOM FIELDS</div>
          <div className="grid2">
            {customFields.map((f) => (
              <div className="field" key={f.id}>
                <label>{f.label}</label>
                {f.type === 'select' ? (
                  <select value={form.customValues?.[f.id] || ''} onChange={(e) => setCF(f.id, e.target.value)}>
                    <option value="">—</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    value={form.customValues?.[f.id] || ''}
                    onChange={(e) => setCF(f.id, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
