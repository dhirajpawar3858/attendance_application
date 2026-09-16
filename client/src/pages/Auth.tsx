import { useState } from 'react';
import { api, ApiError } from '../api/client.ts';
import { useApp } from '../state/AppState.tsx';
import { useToast } from '../state/ToastProvider.tsx';
import type { User } from '../api/types.ts';
import { Spinner } from '../components/ui.tsx';

export default function Auth() {
  const { setUser } = useApp();
  const toast = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/signup';
      const body = mode === 'login' ? { username, password, remember } : { name, username, password, remember };
      const { user } = await api.post<{ user: User }>(path, body);
      setUser(user);
      toast.success(mode === 'login' ? `Welcome back, ${user.name}!` : `Account created — welcome, ${user.name}!`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function fillDemo() {
    setMode('login');
    setUsername('admin@demo.com');
    setPassword('password');
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="auth-brand">
          <span className="brand-mark">◷</span> Attendance
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          {mode === 'login' ? 'Sign in to your local workspace.' : 'Create your account — it stays on this device.'}
        </p>

        <div className="seg" style={{ margin: '14px 0 20px', width: '100%' }}>
          <button className={mode === 'login' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button className={mode === 'signup' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setMode('signup')}>
            Create account
          </button>
        </div>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div className="field">
              <label>Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required autoFocus />
            </div>
          )}
          <div className="field">
            <label>Email or username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>
          <label className="row gap-8" style={{ marginBottom: 18, cursor: 'pointer', fontWeight: 500 }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 'auto' }} />
            Remember me on this device
          </label>
          <button className="btn primary" style={{ width: '100%' }} disabled={busy} type="submit">
            {busy ? <Spinner size={16} /> : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="divider" />
        <button className="btn ghost" style={{ width: '100%' }} onClick={fillDemo}>
          Use demo account
        </button>
        <p className="muted small center" style={{ textAlign: 'center', marginTop: 10 }}>
          Demo: admin@demo.com · password
        </p>
      </div>
    </div>
  );
}
