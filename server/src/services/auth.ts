import { get, run, tx } from '../db/connection.ts';
import { hashPassword, verifyPassword } from '../util/password.ts';
import { newToken } from '../util/token.ts';
import { badRequest, conflict, unauthorized } from '../util/errors.ts';
import { logAudit } from './audit.ts';

const SESSION_DAYS = 30;

export interface PublicUser {
  id: number;
  name: string;
  username: string;
  role: string;
  avatar?: string | null;
  contact?: string | null;
  settings: Record<string, unknown>;
}

function toPublic(row: any): PublicUser {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    avatar: row.avatar,
    contact: row.contact,
    settings: JSON.parse(row.settings_json || '{}'),
  };
}

export function signup(name: string, username: string, password: string) {
  if (!name?.trim()) throw badRequest('Name is required');
  if (!username?.trim()) throw badRequest('Username/email is required');
  if (!password || password.length < 6)
    throw badRequest('Password must be at least 6 characters');

  const existing = get('SELECT id FROM users WHERE username = ?', username.trim());
  if (existing) throw conflict('An account with that username already exists');

  return tx(() => {
    const info = run(
      'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
      name.trim(),
      username.trim(),
      hashPassword(password),
      'admin',
    );
    const userId = Number(info.lastInsertRowid);
    logAudit({ userId, entity: 'user', entityId: userId, action: 'create', after: { name, username } });
    const token = createSession(userId);
    const user = get('SELECT * FROM users WHERE id = ?', userId);
    return { user: toPublic(user), token };
  });
}

export function login(username: string, password: string) {
  const row = get<any>('SELECT * FROM users WHERE username = ?', username?.trim());
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw unauthorized('Invalid username or password');
  }
  const token = createSession(row.id);
  return { user: toPublic(row), token };
}

export function logout(token?: string) {
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
}

export function createSession(userId: number): string {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, expires);
  return token;
}

export function currentUser(userId: number): PublicUser {
  const row = get('SELECT * FROM users WHERE id = ?', userId);
  return toPublic(row);
}

export function updateProfile(
  userId: number,
  patch: { name?: string; avatar?: string | null; contact?: string | null },
) {
  const cur = get<any>('SELECT * FROM users WHERE id = ?', userId);
  if (!cur) throw badRequest('User not found');
  run(
    'UPDATE users SET name = ?, avatar = ?, contact = ? WHERE id = ?',
    patch.name ?? cur.name,
    patch.avatar !== undefined ? patch.avatar : cur.avatar,
    patch.contact !== undefined ? patch.contact : cur.contact,
    userId,
  );
  return currentUser(userId);
}

export function changePassword(userId: number, oldPassword: string, newPassword: string) {
  const row = get<any>('SELECT * FROM users WHERE id = ?', userId);
  if (!row || !verifyPassword(oldPassword, row.password_hash))
    throw unauthorized('Current password is incorrect');
  if (!newPassword || newPassword.length < 6)
    throw badRequest('New password must be at least 6 characters');
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(newPassword), userId);
}

export function saveSettings(userId: number, settings: Record<string, unknown>) {
  const cur = get<any>('SELECT settings_json FROM users WHERE id = ?', userId);
  const merged = { ...JSON.parse(cur?.settings_json || '{}'), ...settings };
  run('UPDATE users SET settings_json = ? WHERE id = ?', JSON.stringify(merged), userId);
  return merged;
}
