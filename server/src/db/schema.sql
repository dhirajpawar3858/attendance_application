-- Attendance Management Application — SQLite schema
-- Implements the data model from Attendance_App_Spec.md §4.
-- Applied idempotently by migrate.ts. Foreign keys are enforced (PRAGMA in connection.ts).

-- ---------------------------------------------------------------------------
-- users: application accounts. Passwords are stored hashed (scrypt).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  username      TEXT    NOT NULL UNIQUE,          -- email or username
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'admin', -- global default role
  avatar        TEXT,                              -- base64 data URL (optional)
  contact       TEXT,
  settings_json TEXT    NOT NULL DEFAULT '{}',    -- theme, date format, prefs, last filters
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- sessions: persistent login tokens ("remember me").
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ---------------------------------------------------------------------------
-- organisations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organisations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  logo            TEXT,                              -- base64 data URL (optional)
  address         TEXT,
  contact         TEXT,
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  working_days    TEXT NOT NULL DEFAULT '1,2,3,4,5', -- 0=Sun..6=Sat, comma list
  work_hours_start TEXT NOT NULL DEFAULT '09:00',
  work_hours_end   TEXT NOT NULL DEFAULT '17:00',
  archived        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- membership of a user in an organisation, with per-org role
CREATE TABLE IF NOT EXISTS user_orgs (
  user_id INTEGER NOT NULL,
  org_id  INTEGER NOT NULL,
  role    TEXT NOT NULL DEFAULT 'admin', -- admin | manager | viewer
  PRIMARY KEY (user_id, org_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (org_id)  REFERENCES organisations(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- departments / teams
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  name   TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(org_id);

-- ---------------------------------------------------------------------------
-- members / workers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id        INTEGER NOT NULL,
  name          TEXT NOT NULL,
  member_code   TEXT,
  avatar        TEXT,
  role          TEXT,                          -- designation
  department_id INTEGER,
  phone         TEXT,
  email         TEXT,
  join_date     TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  archived      INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_members_org ON members(org_id);
CREATE INDEX IF NOT EXISTS idx_members_dept ON members(department_id);
-- member_code unique within an org (when provided)
CREATE UNIQUE INDEX IF NOT EXISTS uq_members_code
  ON members(org_id, member_code) WHERE member_code IS NOT NULL AND member_code <> '';

-- ---------------------------------------------------------------------------
-- custom fields: admin-defined extra fields on members (or attendance)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_fields (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id       INTEGER NOT NULL,
  entity       TEXT NOT NULL DEFAULT 'member', -- member | attendance
  label        TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'text',   -- text | number | date | select
  options_json TEXT,                            -- for select: JSON array of strings
  sort         INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_custom_fields_org ON custom_fields(org_id);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  field_id  INTEGER NOT NULL,
  entity_id INTEGER NOT NULL,                   -- e.g. member id
  value     TEXT,
  FOREIGN KEY (field_id) REFERENCES custom_fields(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cfv ON custom_field_values(field_id, entity_id);

-- ---------------------------------------------------------------------------
-- attendance statuses (configurable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_statuses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id     INTEGER NOT NULL,
  name       TEXT NOT NULL,
  code       TEXT NOT NULL,                      -- short code e.g. P, A, L
  color      TEXT NOT NULL DEFAULT '#A7A0E8',
  is_default INTEGER NOT NULL DEFAULT 0,         -- default when marking
  counts_present INTEGER NOT NULL DEFAULT 0,     -- counts toward attendance rate
  sort       INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_statuses_org ON attendance_statuses(org_id);

-- ---------------------------------------------------------------------------
-- attendance records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id     INTEGER NOT NULL,
  member_id  INTEGER NOT NULL,
  date       TEXT NOT NULL,                       -- YYYY-MM-DD
  status_id  INTEGER NOT NULL,
  check_in   TEXT,
  check_out  TEXT,
  hours      REAL,
  location   TEXT,
  note       TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (org_id)    REFERENCES organisations(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (status_id) REFERENCES attendance_statuses(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
-- one entry per member per day
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_member_date ON attendance(member_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org_date ON attendance(org_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status_id);

-- ---------------------------------------------------------------------------
-- holidays
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS holidays (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id    INTEGER NOT NULL,
  date      TEXT NOT NULL,                        -- YYYY-MM-DD
  name      TEXT NOT NULL,
  recurring INTEGER NOT NULL DEFAULT 0,           -- repeats yearly (month-day)
  FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_holidays_org_date ON holidays(org_id, date);

-- ---------------------------------------------------------------------------
-- saved filter presets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS filter_presets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  org_id      INTEGER NOT NULL,
  name        TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (org_id)  REFERENCES organisations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_presets_user_org ON filter_presets(user_id, org_id);

-- ---------------------------------------------------------------------------
-- audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  org_id     INTEGER,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  action     TEXT NOT NULL,                       -- create | update | delete
  before_json TEXT,
  after_json  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id);
