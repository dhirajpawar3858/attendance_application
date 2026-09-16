import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../util/errors.ts';

/** Central error handler → JSON { error }. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  // SQLite unique-constraint → 409 for friendlier messages
  if (/UNIQUE constraint failed/i.test(message)) {
    res.status(409).json({ error: 'That value must be unique (duplicate detected).' });
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: message });
}

/** Wrap an async route handler so thrown errors reach errorHandler. */
export function wrap(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
