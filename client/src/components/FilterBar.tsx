import { useEffect, useState } from 'react';
import { api } from '../api/client.ts';
import { useApp } from '../state/AppState.tsx';
import { useToast } from '../state/ToastProvider.tsx';
import type { CustomField, Department, FilterPreset, FilterState, Status } from '../api/types.ts';
import { Modal } from './ui.tsx';

const PRESETS: Array<{ id: string; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'thisWeek', label: 'This week' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'thisYear', label: 'This year' },
];

export function FilterBar({
  value,
  onChange,
  statuses,
  departments,
  customFields,
  roles = [],
  showSort = true,
}: {
  value: FilterState;
  onChange: (f: FilterState) => void;
  statuses: Status[];
  departments: Department[];
  customFields: CustomField[];
  roles?: string[];
  showSort?: boolean;
}) {
  const { currentOrg } = useApp();
  const toast = useToast();
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const orgId = currentOrg?.id;

  const loadPresets = () => {
    if (orgId) api.get<FilterPreset[]>(`/orgs/${orgId}/presets`).then(setPresets).catch(() => {});
  };
  useEffect(loadPresets, [orgId]);

  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  const toggleStatus = (id: number) => {
    const cur = value.statusIds || [];
    set({ statusIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  async function savePreset() {
    if (!presetName.trim() || !orgId) return;
    await api.post(`/orgs/${orgId}/presets`, { name: presetName.trim(), config: value });
    toast.success('Preset saved');
    setSaveOpen(false);
    setPresetName('');
    loadPresets();
  }

  async function deletePreset(id: number) {
    if (!orgId) return;
    await api.del(`/orgs/${orgId}/presets/${id}`);
    toast.info('Preset deleted');
    loadPresets();
  }

  return (
    <div className="card pad mb-16">
      {/* date presets */}
      <div className="row gap-6 wrap mb-8">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`chip ${value.preset === p.id ? 'on' : ''}`}
            onClick={() => set({ preset: p.id, dateFrom: undefined, dateTo: undefined })}
          >
            {p.label}
          </button>
        ))}
        <button
          className={`chip ${value.preset === 'custom' ? 'on' : ''}`}
          onClick={() => set({ preset: 'custom' })}
        >
          Custom
        </button>
      </div>

      {value.preset === 'custom' && (
        <div className="row gap-8 mb-8 wrap">
          <div className="fb-field">
            <label>From</label>
            <input type="date" value={value.dateFrom || ''} onChange={(e) => set({ dateFrom: e.target.value })} />
          </div>
          <div className="fb-field">
            <label>To</label>
            <input type="date" value={value.dateTo || ''} onChange={(e) => set({ dateTo: e.target.value })} />
          </div>
        </div>
      )}

      {/* status multi-select */}
      {statuses.length > 0 && (
        <div className="mb-8">
          <label>Status</label>
          <div className="row gap-6 wrap">
            {statuses.map((s) => (
              <button
                key={s.id}
                className={`chip ${(value.statusIds || []).includes(s.id) ? 'on' : ''}`}
                onClick={() => toggleStatus(s.id)}
                style={
                  (value.statusIds || []).includes(s.id)
                    ? { background: s.color + '33', borderColor: s.color, color: 'var(--text)' }
                    : {}
                }
              >
                <span style={{ width: 8, height: 8, borderRadius: 99, background: s.color }} /> {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* row of selects */}
      <div className="filterbar">
        <div className="fb-field grow">
          <label>Search</label>
          <input
            placeholder="Name, code or note…"
            value={value.search || ''}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
        {departments.length > 0 && (
          <div className="fb-field">
            <label>Department</label>
            <select
              value={(value.departmentIds || [])[0] || ''}
              onChange={(e) => set({ departmentIds: e.target.value ? [Number(e.target.value)] : undefined })}
            >
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {roles.length > 0 && (
          <div className="fb-field">
            <label>Role</label>
            <select
              value={(value.roles || [])[0] || ''}
              onChange={(e) => set({ roles: e.target.value ? [e.target.value] : undefined })}
            >
              <option value="">All</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}
        {customFields.map((f) => (
          <div className="fb-field" key={f.id}>
            <label>{f.label}</label>
            {f.type === 'select' ? (
              <select
                value={(value.customFields || []).find((c) => c.fieldId === f.id)?.value || ''}
                onChange={(e) => {
                  const others = (value.customFields || []).filter((c) => c.fieldId !== f.id);
                  set({ customFields: e.target.value ? [...others, { fieldId: f.id, value: e.target.value }] : others });
                }}
              >
                <option value="">All</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                placeholder={`Filter ${f.label}`}
                value={(value.customFields || []).find((c) => c.fieldId === f.id)?.value || ''}
                onChange={(e) => {
                  const others = (value.customFields || []).filter((c) => c.fieldId !== f.id);
                  set({ customFields: e.target.value ? [...others, { fieldId: f.id, value: e.target.value }] : others });
                }}
              />
            )}
          </div>
        ))}
        {showSort && (
          <>
            <div className="fb-field">
              <label>Sort by</label>
              <select value={value.sortBy || 'date'} onChange={(e) => set({ sortBy: e.target.value as any })}>
                <option value="date">Date</option>
                <option value="name">Name</option>
                <option value="status">Status</option>
                <option value="hours">Hours</option>
                <option value="department">Department</option>
              </select>
            </div>
            <div className="fb-field">
              <label>Order</label>
              <select value={value.sortDir || 'desc'} onChange={(e) => set({ sortDir: e.target.value as any })}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* presets + actions */}
      <div className="row between mt-16 wrap gap-8">
        <div className="row gap-6 wrap">
          {presets.map((p) => (
            <span key={p.id} className="chip" style={{ cursor: 'default' }}>
              <button
                style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                onClick={() => onChange(p.config)}
                title="Apply preset"
              >
                ★ {p.name}
              </button>
              <span onClick={() => deletePreset(p.id)} style={{ cursor: 'pointer', opacity: 0.6 }} title="Delete preset">
                ✕
              </span>
            </span>
          ))}
        </div>
        <div className="row gap-8">
          <button className="btn ghost sm" onClick={() => onChange({ preset: value.preset || 'thisMonth' })}>
            Clear
          </button>
          <button className="btn sm" onClick={() => setSaveOpen(true)}>
            ★ Save preset
          </button>
        </div>
      </div>

      {saveOpen && (
        <Modal
          title="Save filter preset"
          onClose={() => setSaveOpen(false)}
          width={400}
          footer={
            <>
              <button className="btn ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={savePreset} disabled={!presetName.trim()}>
                Save
              </button>
            </>
          }
        >
          <div className="field">
            <label>Preset name</label>
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. This month · Present"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && savePreset()}
            />
          </div>
          <p className="muted small">Saves the current date range, statuses, department, search and sort.</p>
        </Modal>
      )}
    </div>
  );
}

/** Convert a FilterState to a query string for API calls. */
export function filterToQuery(f: FilterState, today: string): string {
  const p = new URLSearchParams();
  p.set('today', today);
  if (f.preset && f.preset !== 'custom') p.set('preset', f.preset);
  if (f.dateFrom) p.set('dateFrom', f.dateFrom);
  if (f.dateTo) p.set('dateTo', f.dateTo);
  if (f.statusIds?.length) p.set('statusIds', f.statusIds.join(','));
  if (f.memberIds?.length) p.set('memberIds', f.memberIds.join(','));
  if (f.departmentIds?.length) p.set('departmentIds', f.departmentIds.join(','));
  if (f.roles?.length) p.set('roles', f.roles.join(','));
  if (f.search) p.set('search', f.search);
  if (f.customFields?.length) p.set('cf', JSON.stringify(f.customFields));
  if (f.sortBy) p.set('sortBy', f.sortBy);
  if (f.sortDir) p.set('sortDir', f.sortDir);
  return p.toString();
}
