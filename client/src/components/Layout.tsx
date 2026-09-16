import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppState.tsx';
import { useToast } from '../state/ToastProvider.tsx';
import { Avatar } from './ui.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { THEMES } from '../theme/themes.ts';

const NAV: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/attendance', label: 'Attendance', icon: 'attendance' },
  { to: '/members', label: 'Members', icon: 'members' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
];
const NAV_MANAGE: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/organisation', label: 'Organisation', icon: 'organisation' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, orgs, currentOrg, setCurrentOrg, logout, theme, applyTheme } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [orgOpen, setOrgOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  async function doLogout() {
    await logout();
    toast.info('Signed out');
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">◷</span> Attendance
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setMobileNav(false)}
          >
            <span className="ico"><Icon name={n.icon} size={18} /></span> {n.label}
          </NavLink>
        ))}
        <div className="nav-section">Manage</div>
        {NAV_MANAGE.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setMobileNav(false)}
          >
            <span className="ico"><Icon name={n.icon} size={18} /></span> {n.label}
          </NavLink>
        ))}

        <div className="grow" />
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn ghost icon hide-desktop" onClick={() => setMobileNav((v) => !v)} aria-label="Menu">
            <Icon name="sliders" size={18} />
          </button>

          {/* org switcher */}
          <div className="org-switcher">
            <button className="org-switcher-btn" onClick={() => setOrgOpen((v) => !v)}>
              {currentOrg?.logo ? (
                <img src={currentOrg.logo} alt="" style={{ width: 22, height: 22, borderRadius: 6 }} />
              ) : (
                <span className="brand-mark" style={{ width: 22, height: 22, fontSize: 12 }}>
                  {currentOrg?.name?.[0] || '?'}
                </span>
              )}
              {currentOrg?.name || 'No organisation'} <Icon name="chevronDown" size={15} className="muted" />
            </button>
            {orgOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOrgOpen(false)} />
                <div className="dropdown">
                  {orgs.map((o) => (
                    <button
                      key={o.id}
                      className={`dropdown-item ${o.id === currentOrg?.id ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentOrg(o);
                        setOrgOpen(false);
                        toast.info(`Switched to ${o.name}`);
                      }}
                    >
                      <span className="brand-mark" style={{ width: 22, height: 22, fontSize: 12 }}>
                        {o.name[0]}
                      </span>
                      {o.name}
                    </button>
                  ))}
                  <div className="dropdown-sep" />
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setOrgOpen(false);
                      navigate('/organisation?new=1');
                    }}
                  >
                    <span className="ico"><Icon name="plus" size={16} /></span> New organisation
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="grow" />

          {/* profile */}
          <div className="org-switcher">
            <button className="org-switcher-btn" onClick={() => setProfileOpen((v) => !v)}>
              <Avatar name={user?.name || '?'} src={user?.avatar} size={26} />
              <span className="hide-mobile">{user?.name}</span> <Icon name="chevronDown" size={15} className="muted" />
            </button>
            {profileOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setProfileOpen(false)} />
                <div className="dropdown right">
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 700 }}>{user?.name}</div>
                    <div className="muted small">{user?.username}</div>
                  </div>
                  <div className="dropdown-sep" />
                  <div style={{ padding: '4px 10px 8px' }}>
                    <div className="muted small mb-8">Theme</div>
                    <div className="row gap-6 wrap">
                      {THEMES.map((t) => (
                        <button
                          key={t.id}
                          title={t.name}
                          onClick={() => applyTheme(t.id, true)}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 7,
                            background: `linear-gradient(135deg, ${t.swatch} 60%, ${t.accent} 60%)`,
                            border: theme === t.id ? '2px solid var(--text)' : '2px solid transparent',
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="dropdown-sep" />
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/settings?tab=profile');
                    }}
                  >
                    <span className="ico"><Icon name="user" size={16} /></span> Profile & settings
                  </button>
                  <button className="dropdown-item" onClick={doLogout}>
                    <span className="ico"><Icon name="logout" size={16} /></span> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
