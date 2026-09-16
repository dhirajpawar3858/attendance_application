// Small reusable UI primitives: Modal, EmptyState, Spinner, StatusPill, Avatar, ConfirmButton.
import { useEffect, useState, type ReactNode } from 'react';

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke="var(--border)" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="row gap-8 center" style={{ padding: 40, color: 'var(--text-muted)' }}>
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon = '✨',
  action,
}: {
  title: string;
  hint?: string;
  icon?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {hint && <div className="muted small" style={{ maxWidth: 380, textAlign: 'center' }}>{hint}</div>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  width = 520,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: number;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal card" style={{ width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head row between">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot row gap-8 between">{footer}</div>}
      </div>
    </div>
  );
}

export function StatusPill({ name, color, code }: { name?: string; color?: string; code?: string }) {
  if (!name) return <span className="muted small">—</span>;
  const c = color || '#A7A0E8';
  return (
    <span className="pill" style={{ background: c + '33', color: 'var(--text)', border: `1px solid ${c}` }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: c, display: 'inline-block' }} />
      {name} {code ? <span className="muted" style={{ fontWeight: 500 }}>· {code}</span> : null}
    </span>
  );
}

export function Avatar({ name, src, size = 34 }: { name: string; src?: string | null; size?: number }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  if (src) {
    return <img className="avatar" src={src} alt={name} style={{ width: size, height: size }} />;
  }
  // deterministic pastel from name
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: `hsl(${h} 55% 82%)`,
        color: `hsl(${h} 45% 30%)`,
        fontSize: size * 0.38,
      }}
    >
      {initials}
    </div>
  );
}

export function ConfirmButton({
  onConfirm,
  children,
  className = 'btn danger sm',
  confirmLabel = 'Click again to confirm',
}: {
  onConfirm: () => void;
  children: ReactNode;
  className?: string;
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2600);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      onClick={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
