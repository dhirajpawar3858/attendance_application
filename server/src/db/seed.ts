// Seeds the DB with sample data so the app is immediately explorable.
// Idempotent-ish: if the demo user already exists, it exits without duplicating.
import { db, get, run, tx } from './connection.ts';
import { migrate } from './migrate.ts';
import { hashPassword } from '../util/password.ts';
import { DEFAULT_STATUSES } from '../services/org.ts';

const DEMO_USERNAME = 'admin@demo.com';
const DEMO_PASSWORD = 'password';

// deterministic pseudo-random so seed is stable across runs (no Math.random)
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

const FIRST = [
  'Aarav', 'Priya', 'Rohan', 'Sofia', 'Liam', 'Maya', 'Noah', 'Ava', 'Ethan', 'Isla',
  'Kabir', 'Zara', 'Diego', 'Lena', 'Yuki', 'Omar', 'Nina', 'Leo', 'Amara', 'Finn',
];
const LAST = [
  'Sharma', 'Patel', 'Kim', 'Garcia', 'Smith', 'Chen', 'Khan', 'Rossi', 'Silva', 'Novak',
  'Haddad', 'Weber', 'Ali', 'Costa', 'Tan', 'Brown', 'Mehta', 'Lopez', 'Okafor', 'Dubois',
];
const ROLES = ['Engineer', 'Designer', 'Analyst', 'Manager', 'Coordinator', 'Specialist'];

export function seed() {
  migrate();

  const existing = get('SELECT id FROM users WHERE username = ?', DEMO_USERNAME);
  if (existing) {
    console.log('Seed: demo data already present — skipping. (Delete the DB to reseed.)');
    return;
  }

  const rng = makeRng(42);

  tx(() => {
    // --- user ---
    const userInfo = run(
      'INSERT INTO users (name, username, password_hash, role, settings_json) VALUES (?, ?, ?, ?, ?)',
      'Demo Admin',
      DEMO_USERNAME,
      hashPassword(DEMO_PASSWORD),
      'admin',
      JSON.stringify({ theme: 'lavender', mode: 'light', dateFormat: 'YYYY-MM-DD', firstDayOfWeek: 1 }),
    );
    const userId = Number(userInfo.lastInsertRowid);

    // --- organisation ---
    const orgInfo = run(
      `INSERT INTO organisations (name, address, contact, timezone, working_days, work_hours_start, work_hours_end)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'Aurora Labs',
      '221B Innovation Way, Springfield',
      'hello@auroralabs.example',
      'UTC',
      '1,2,3,4,5',
      '09:00',
      '17:00',
    );
    const orgId = Number(orgInfo.lastInsertRowid);
    run('INSERT INTO user_orgs (user_id, org_id, role) VALUES (?, ?, ?)', userId, orgId, 'admin');

    // --- statuses ---
    const statusIds: number[] = [];
    DEFAULT_STATUSES.forEach((s, i) => {
      const info = run(
        `INSERT INTO attendance_statuses (org_id, name, code, color, is_default, counts_present, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        orgId,
        s.name,
        s.code,
        s.color,
        s.is_default,
        s.counts_present,
        i,
      );
      statusIds.push(Number(info.lastInsertRowid));
    });
    const presentId = statusIds[0];
    const absentId = statusIds[1];
    const lateId = statusIds[2];
    const halfId = statusIds[3];
    const leaveId = statusIds[4];
    const remoteId = statusIds[6];

    // --- departments ---
    const deptNames = ['Engineering', 'Design', 'Operations', 'Sales'];
    const deptIds = deptNames.map((n) => {
      const info = run('INSERT INTO departments (org_id, name) VALUES (?, ?)', orgId, n);
      return Number(info.lastInsertRowid);
    });

    // --- custom fields ---
    const cfShiftInfo = run(
      'INSERT INTO custom_fields (org_id, entity, label, type, options_json, sort) VALUES (?, ?, ?, ?, ?, ?)',
      orgId,
      'member',
      'Shift',
      'select',
      JSON.stringify(['Morning', 'Evening', 'Night']),
      0,
    );
    const cfShift = Number(cfShiftInfo.lastInsertRowid);
    const cfLocInfo = run(
      'INSERT INTO custom_fields (org_id, entity, label, type, options_json, sort) VALUES (?, ?, ?, ?, ?, ?)',
      orgId,
      'member',
      'Work Location',
      'text',
      null,
      1,
    );
    const cfLoc = Number(cfLocInfo.lastInsertRowid);

    // --- members (15) ---
    const shifts = ['Morning', 'Evening', 'Night'];
    const locs = ['HQ', 'Remote', 'Branch-2'];
    const memberIds: number[] = [];
    for (let i = 0; i < 15; i++) {
      const name = `${FIRST[i]} ${LAST[i]}`;
      const dept = deptIds[i % deptIds.length];
      const role = ROLES[i % ROLES.length];
      const joinYear = 2021 + (i % 4);
      const info = run(
        `INSERT INTO members (org_id, name, member_code, role, department_id, phone, email, join_date, active, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        orgId,
        name,
        `EMP${String(i + 1).padStart(3, '0')}`,
        role,
        dept,
        `+1-555-01${String(i).padStart(2, '0')}`,
        `${FIRST[i].toLowerCase()}.${LAST[i].toLowerCase()}@auroralabs.example`,
        `${joinYear}-0${(i % 9) + 1}-1${i % 9}`,
        1,
        i % 5 === 0 ? 'Team lead' : null,
      );
      const mid = Number(info.lastInsertRowid);
      memberIds.push(mid);
      // custom field values
      run(
        'INSERT INTO custom_field_values (field_id, entity_id, value) VALUES (?, ?, ?)',
        cfShift,
        mid,
        shifts[i % shifts.length],
      );
      run(
        'INSERT INTO custom_field_values (field_id, entity_id, value) VALUES (?, ?, ?)',
        cfLoc,
        mid,
        locs[i % locs.length],
      );
    }

    // --- holidays ---
    const year = new Date().getFullYear();
    run('INSERT INTO holidays (org_id, date, name, recurring) VALUES (?, ?, ?, ?)', orgId, `${year}-01-01`, "New Year's Day", 1);
    run('INSERT INTO holidays (org_id, date, name, recurring) VALUES (?, ?, ?, ?)', orgId, `${year}-12-25`, 'Winter Holiday', 1);

    // --- attendance for the last ~18 days (skip weekends) ---
    const weightedPick = (r: number): number => {
      // ~78% present, 6% remote, 5% late, 4% half, 4% leave, 3% absent
      if (r < 0.78) return presentId;
      if (r < 0.84) return remoteId;
      if (r < 0.89) return lateId;
      if (r < 0.93) return halfId;
      if (r < 0.97) return leaveId;
      return absentId;
    };

    const today = new Date();
    for (let back = 18; back >= 0; back--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      const dateStr = ymd(d);
      for (const mid of memberIds) {
        const r = rng();
        const statusId = weightedPick(r);
        let checkIn: string | null = null;
        let checkOut: string | null = null;
        let hours: number | null = null;
        if (statusId === presentId || statusId === remoteId) {
          checkIn = '09:00';
          checkOut = '17:00';
          hours = 8;
        } else if (statusId === lateId) {
          checkIn = '10:1' + Math.floor(rng() * 9);
          checkOut = '17:30';
          hours = 7;
        } else if (statusId === halfId) {
          checkIn = '09:00';
          checkOut = '13:00';
          hours = 4;
        }
        run(
          `INSERT INTO attendance (org_id, member_id, date, status_id, check_in, check_out, hours, location, note, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          orgId,
          mid,
          dateStr,
          statusId,
          checkIn,
          checkOut,
          hours,
          statusId === remoteId ? 'Remote' : 'HQ',
          null,
          userId,
        );
      }
    }

    // --- a sample filter preset ---
    run(
      'INSERT INTO filter_presets (user_id, org_id, name, config_json) VALUES (?, ?, ?, ?)',
      userId,
      orgId,
      'This month — Present only',
      JSON.stringify({ preset: 'thisMonth', statusIds: [presentId] }),
    );

    console.log('Seed complete:');
    console.log(`  Login:    ${DEMO_USERNAME}`);
    console.log(`  Password: ${DEMO_PASSWORD}`);
    console.log(`  Org: Aurora Labs · 4 departments · 15 members · ~2-3 weeks attendance`);
  });
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seed();
}
