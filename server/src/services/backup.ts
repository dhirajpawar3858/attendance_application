// Backup / restore of the local SQLite database file, plus JSON export-all.
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { db, DB_PATH, DATA_DIR, tx } from '../db/connection.ts';
import { join } from 'node:path';
import { migrate } from '../db/migrate.ts';
import { all } from '../db/connection.ts';
import { badRequest } from '../util/errors.ts';

/** Checkpoint WAL and return the raw DB file bytes for download. */
export function backupBytes(): Buffer {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  return readFileSync(DB_PATH);
}

// Order matters for FK-safe insert (parents before children).
const RESTORE_ORDER = [
  'users',
  'organisations',
  'user_orgs',
  'departments',
  'members',
  'custom_fields',
  'custom_field_values',
  'attendance_statuses',
  'attendance',
  'holidays',
  'filter_presets',
  'audit_log',
  'sessions',
];

/**
 * Restore from an uploaded .db file via a DATA-LEVEL copy (no file swap → no
 * Windows file-lock issues). Opens the upload with a throwaway handle, validates
 * it, then wipes + repopulates the live DB inside one transaction.
 */
export function restoreFromBytes(bytes: Buffer): void {
  const tmp = join(DATA_DIR, `restore_tmp.db`);
  writeFileSync(tmp, bytes);
  let src: InstanceType<typeof DatabaseSync> | null = null;
  try {
    src = new DatabaseSync(tmp);
    const check = src
      .prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='users'")
      .get() as { c: number };
    if (!check || check.c === 0) throw new Error('not an attendance database');

    // snapshot all source tables into memory first
    const snapshot: Record<string, any[]> = {};
    for (const t of RESTORE_ORDER) {
      try {
        snapshot[t] = src.prepare(`SELECT * FROM ${t}`).all() as any[];
      } catch {
        snapshot[t] = [];
      }
    }
    src.close();
    src = null;

    // ensure live schema exists, then wipe + repopulate atomically
    migrate();
    tx(() => {
      db.exec('PRAGMA foreign_keys = OFF;');
      for (const t of [...RESTORE_ORDER].reverse()) {
        try {
          db.exec(`DELETE FROM ${t};`);
        } catch {
          /* ignore missing table */
        }
      }
      for (const t of RESTORE_ORDER) {
        const rows = snapshot[t];
        if (!rows || rows.length === 0) continue;
        const cols = Object.keys(rows[0]);
        const placeholders = cols.map(() => '?').join(',');
        const stmt = db.prepare(
          `INSERT INTO ${t} (${cols.join(',')}) VALUES (${placeholders})`,
        );
        for (const row of rows) stmt.run(...cols.map((c) => row[c]));
      }
      db.exec('PRAGMA foreign_keys = ON;');
    });
  } catch (e) {
    throw badRequest('Uploaded file is not a valid attendance database backup');
  } finally {
    if (src) {
      try {
        src.close();
      } catch {
        /* ignore */
      }
    }
    if (existsSync(tmp)) {
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }
}

const EXPORT_TABLES = [
  'users',
  'organisations',
  'user_orgs',
  'departments',
  'members',
  'custom_fields',
  'custom_field_values',
  'attendance_statuses',
  'attendance',
  'holidays',
  'filter_presets',
  'audit_log',
];

/** Export all data as a single JSON object (excludes password hashes). */
export function exportAllJSON(): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const t of EXPORT_TABLES) {
    const rows = all<any>(`SELECT * FROM ${t}`);
    if (t === 'users') {
      out[t] = rows.map((r) => ({ ...r, password_hash: undefined }));
    } else {
      out[t] = rows;
    }
  }
  return out;
}

/** Danger: wipe all data and recreate empty schema. */
export function resetAll(): void {
  const tables = [...EXPORT_TABLES, 'sessions'].reverse();
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const t of tables) {
    try {
      db.exec(`DELETE FROM ${t};`);
    } catch {
      /* table may not exist */
    }
  }
  db.exec('PRAGMA foreign_keys = ON;');
  migrate();
}
