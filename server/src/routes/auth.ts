import { Router } from 'express';
import { wrap } from '../middleware/error.ts';
import { requireAuth, SESSION_COOKIE, resolveSession } from '../middleware/auth.ts';
import * as auth from '../services/auth.ts';

const router = Router();
const THIRTY_DAYS = 30 * 86400_000;

function setSessionCookie(res: any, token: string, remember: boolean) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: remember ? THIRTY_DAYS : undefined, // undefined => session cookie
    path: '/',
  });
}

router.post(
  '/signup',
  wrap((req, res) => {
    const { name, username, password, remember } = req.body;
    const { user, token } = auth.signup(name, username, password);
    setSessionCookie(res, token, remember !== false);
    res.json({ user });
  }),
);

router.post(
  '/login',
  wrap((req, res) => {
    const { username, password, remember } = req.body;
    const { user, token } = auth.login(username, password);
    setSessionCookie(res, token, remember !== false);
    res.json({ user });
  }),
);

router.post(
  '/logout',
  wrap((req, res) => {
    auth.logout(req.cookies?.[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  }),
);

// current session — returns null user when not logged in (no 401)
router.get(
  '/me',
  wrap((req, res) => {
    const sessUser = resolveSession(req.cookies?.[SESSION_COOKIE]);
    if (!sessUser) return res.json({ user: null });
    res.json({ user: auth.currentUser(sessUser.id) });
  }),
);

router.put(
  '/profile',
  requireAuth,
  wrap((req, res) => {
    res.json({ user: auth.updateProfile(req.user!.id, req.body) });
  }),
);

router.put(
  '/password',
  requireAuth,
  wrap((req, res) => {
    auth.changePassword(req.user!.id, req.body.oldPassword, req.body.newPassword);
    res.json({ ok: true });
  }),
);

router.put(
  '/settings',
  requireAuth,
  wrap((req, res) => {
    const merged = auth.saveSettings(req.user!.id, req.body || {});
    res.json({ settings: merged });
  }),
);

export default router;
