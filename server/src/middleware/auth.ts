// Session auth guard: resolves the session cookie to a user and attaches it to req.
import type { Request, Response, NextFunction } from 'express';
import { get, run } from '../db/connection.ts';
import { unauthorized } from '../util/errors.ts';

export interface AuthedUser {
  id: number;
  name: string;
  username: string;
  role: string;
}

// augment Express Request
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export const SESSION_COOKIE = 'att_session';

/** Resolve a token to a live (non-expired) user; deletes expired tokens. */
export function resolveSession(token?: string): AuthedUser | null {
  if (!token) return null;
  const row = get<{
    user_id: number;
    expires_at: string;
    id: number;
    name: string;
    username: string;
    role: string;
  }>(
    `SELECT s.user_id, s.expires_at, u.id, u.name, u.username, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`,
    token,
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run('DELETE FROM sessions WHERE token = ?', token);
    return null;
  }
  return { id: row.id, name: row.name, username: row.username, role: row.role };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  const user = resolveSession(token);
  if (!user) return next(unauthorized());
  req.user = user;
  next();
}
