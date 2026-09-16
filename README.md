# Attendance Management Application

A feature-rich, **offline-first** attendance management app. All data lives in a local
SQLite database on your machine — no cloud, no network required. It ships with account
sign-up/login, multiple organisations, rich member profiles with admin-defined custom
fields, three attendance-entry modes (roster grid / daily / per-member), advanced
filters with saveable presets, a dashboard with charts, reports with CSV/Excel/PDF
export, a holiday calendar, five pastel themes (light + soft-dark), and backup/restore.

---

## Tech stack & why

| Layer | Choice | Why |
|------|--------|-----|
| **Runtime** | **Node.js ≥ 22.5** | Already the strongest toolchain on the target machine. |
| **Database** | **`node:sqlite`** (built-in) | Embedded, persistent, **zero native compilation** — the biggest cross-platform/Windows risk (native rebuilds of `better-sqlite3`) is eliminated. Synchronous API keeps the data layer simple and transactional. |
| **Server** | **Express** + TypeScript | Small, well-understood HTTP layer. Node 22+ runs `.ts` directly (type-stripping) so there is **no server build step**. |
| **Passwords** | **scrypt** (`node:crypto`) | Salted, memory-hard hashing with no native dependency (avoids a bcrypt build). |
| **Frontend** | **React + Vite + TypeScript** | Component model fits the feature-dense UI; Vite gives a fast dev server and a small production bundle. |
| **Charts** | **Recharts** | Trend (area), per-department (bar), per-status (donut). |
| **Theming** | **CSS variables** | 5 palettes × light/soft-dark switch instantly and are persisted per user. |

The three layers are cleanly separated:

```
server/src/
  db/         connection, schema.sql, migrate, seed
  domain/     PURE logic (attendance calcs, filter→SQL builder, CSV, dates) — unit-tested
  services/   DB-backed use cases (transactions + audit writes)
  routes/     thin Express controllers
  middleware/ auth guard, error handler
client/src/
  api/        typed fetch client + shared types
  state/      auth/org/theme context, toasts, per-org data hooks
  components/  Layout (sidebar+topbar), FilterBar, UI primitives
  pages/       Dashboard, Attendance (roster/daily/member), Members, Reports, Calendar,
               Organisation, Settings, Auth, Onboarding
  theme/ styles/  pastel theme catalogue + CSS
```

---

## Prerequisites

- **Node.js ≥ 22.5.0** (uses the built-in `node:sqlite` module and native TypeScript
  execution). Check with `node --version`.
- No database server to install — the DB is a local file.

---

## Setup & run

From the `attendance-app/` directory:

```bash
npm install          # installs server + client workspaces
npm run seed         # creates the local DB + sample data (safe to run once)
npm run dev          # starts API (:3001) + Vite client (:5173) together
```

Then open **http://localhost:5173**.

**Demo login** (created by the seed):

```
username: admin@demo.com
password: password
```

### Production / single-command run

```bash
npm start            # builds the client, then serves client + API on one port
```

This serves the built SPA and the API together on **http://localhost:3000** (override
with `PORT`). Fully offline.

### Other scripts

| Command | What it does |
|--------|--------------|
| `npm run migrate` | Apply the schema (idempotent). |
| `npm run seed` | Insert sample org / 15 members / ~2–3 weeks attendance (skips if already seeded). |
| `npm test` | Run the domain unit tests (`node --test`). |
| `npm run build` | Build the client to `client/dist`. |

---

## Where the data lives

The SQLite database file is:

```
server/data/attendance.db      (+ -wal / -shm sidecar files while running)
```

- **Backup:** Settings → *Data & backup* → **Download backup (.db)** streams a
  consistent copy of this file.
- **Restore:** upload a previously downloaded `.db`. Restore is done as a **data-level
  copy** (rows are read from the uploaded file and written into the live DB inside a
  transaction), so it works reliably on Windows without file-lock problems.
- **Export all:** downloads every table as a single JSON document (password hashes
  excluded).
- Override the DB location with the `ATT_DB_PATH` environment variable.

To start completely fresh, stop the app and delete `server/data/attendance.db*`, then
re-run `npm run seed`.

---

## Feature tour

- **Accounts** — sign up / login / logout; scrypt-hashed passwords; a persistent session
  cookie ("remember me") that survives restarts; profile + password change.
- **Organisations** — create/edit/archive; logo, address, contact, timezone; working days
  and work-hours; org switcher in the top bar; multiple orgs per account.
- **Members** — rich profiles, avatars, departments, activate/archive; **admin-defined
  custom fields** (text/number/date/select) that appear on every member and are
  filterable; **CSV import & export** (import upserts by member code/name and auto-creates
  departments).
- **Attendance** — configurable statuses (colour + short code + "counts as present");
  **roster grid** (click a cell to paint/cycle, "mark all present"), **daily** view
  ("mark all present", "copy yesterday", inline check-in/out/hours/location/note), and
  **per-member** history with stats. Every create/edit is written to the **audit log**.
- **Filters** — date presets + custom range, multi-select status, department, role,
  free-text search, per-custom-field filters, and sorting; **save/name/apply filter
  presets**.
- **Dashboard & reports** — summary cards, trend/department/status charts, per-member
  report table; export to **CSV**, **Excel (.xls)**, and **PDF** (print-friendly layout).
- **Calendar** — month grid highlighting holidays, weekly-offs, and low-attendance days;
  add/remove holidays (one-off or yearly-recurring).
- **Settings** — 5 pastel themes × light/soft-dark (persisted), status & custom-field
  management, date-format & first-day-of-week preferences, and backup/restore/reset.

---

## Data model

SQLite tables (see `server/src/db/schema.sql`): `users`, `sessions`, `organisations`,
`user_orgs`, `departments`, `members`, `custom_fields`, `custom_field_values`,
`attendance_statuses`, `attendance`, `holidays`, `filter_presets`, `audit_log`.

Key constraints/indexes: unique `attendance(member_id, date)`; unique member code per org;
foreign keys with `ON DELETE CASCADE` (and `SET NULL` where history must survive);
indexes on `attendance(date)`, `attendance(member_id)`, `attendance(org_id, date)`,
`members(org_id)`, and `custom_field_values(field_id, entity_id)`.

---

## Testing

```bash
npm test
```

Unit tests cover the pure domain logic: attendance rate/totals/summaries/trend/streaks,
the filter→SQL builder and date-preset resolution, CSV parse/serialise round-trips, and
date helpers. There is also `server/smoke.mjs`, an end-to-end API check you can run
against a live server with `npm run smoke -w server -- <port>`.

---

## Accessibility & UX

- WCAG-AA-minded contrast across all themes; `prefers-reduced-motion` respected.
- Full-landscape layout: persistent left sidebar + top bar, wide roster grid with sticky
  header/name column, and list+detail split views on large screens that collapse on
  small ones.
- Empty states, loading spinners/skeletons, and toasts throughout.
```
