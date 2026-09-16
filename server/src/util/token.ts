import { randomBytes } from 'node:crypto';

/** Opaque random session token. */
export function newToken(): string {
  return randomBytes(32).toString('hex');
}
