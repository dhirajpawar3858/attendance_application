import { useState } from 'react';
import { api, ApiError } from '../api/client.ts';
import { useApp } from '../state/AppState.tsx';
import { useToast } from '../state/ToastProvider.tsx';
import type { Org } from '../api/types.ts';
import { Spinner } from '../components/ui.tsx';

export default function Onboarding() {
  const { refreshOrgs, setCurrentOrg, logout } = useApp();
  const toast = useToast();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const org = await api.post<Org>('/orgs', { name, address, contact });
      const list = await refreshOrgs();
      const created = list.find((o) => o.id === org.id);
      if (created) setCurrentOrg(created);
      toast.success(`Created ${org.name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create organisation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card card" style={{ maxWidth: 460 }}>
        <div className="auth-brand">
          <span className="brand-mark">⌂</span> Set up your organisation
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Create your first organisation to start tracking attendance. You can add more later.
        </p>
        <form onSubmit={submit} className="mt-16">
          <div className="field">
            <label>Organisation name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." required autoFocus />
          </div>
          <div className="field">
            <label>Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
          </div>
          <div className="field">
            <label>Contact</label>
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="hello@acme.com" />
          </div>
          <button className="btn primary" style={{ width: '100%' }} disabled={busy || !name.trim()} type="submit">
            {busy ? <Spinner size={16} /> : 'Create organisation'}
          </button>
        </form>
        <div className="divider" />
        <button className="btn ghost" style={{ width: '100%' }} onClick={() => logout()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
