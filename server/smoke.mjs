// Ad-hoc smoke test against a running server (node test/smoke.mjs <port>)
const PORT = process.argv[2] || '3009';
const base = `http://localhost:${PORT}`;
let cookie = '';

async function call(method, path, body, raw = false) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setc = res.headers.get('set-cookie');
  if (setc) cookie = setc.split(';')[0];
  if (raw) return { status: res.status, buf: Buffer.from(await res.arrayBuffer()) };
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data };
}

const out = [];
const log = (m) => out.push(m);
const ok = (label, cond) => log(`${cond ? 'OK ' : 'FAIL '} ${label}`);

const login = await call('POST', '/api/auth/login', { username: 'admin@demo.com', password: 'password' });
ok('login', login.status === 200 && login.data.user?.name);

const me = await call('GET', '/api/auth/me');
ok('session persists (me)', me.status === 200 && me.data.user);

const orgs = await call('GET', '/api/orgs');
ok('orgs list', orgs.status === 200 && orgs.data.length >= 1);
const orgId = orgs.data[0].id;

const members = await call('GET', `/api/orgs/${orgId}/members`);
ok('members (15)', members.status === 200 && members.data.length === 15);

const statuses = await call('GET', `/api/orgs/${orgId}/statuses`);
ok('statuses (7)', statuses.status === 200 && statuses.data.length === 7);

const today = new Date().toISOString().slice(0, 10);
const dash = await call('GET', `/api/orgs/${orgId}/dashboard?today=${today}&from=${today}&to=${today}`);
ok('dashboard cards', dash.status === 200 && typeof dash.data.cards.totalMembers === 'number');

const mid = members.data[0].id;
const sid = statuses.data[0].id;
const mark = await call('POST', `/api/orgs/${orgId}/attendance`, { member_id: mid, date: today, status_id: sid, check_in: '09:00', check_out: '17:30' });
ok('mark attendance + hours calc', mark.status === 200 && mark.data.hours === 8.5);

const roster = await call('GET', `/api/orgs/${orgId}/attendance/roster?from=${today}&to=${today}`);
ok('roster grid', roster.status === 200 && roster.data.members.length === 15);

const rep = await call('GET', `/api/orgs/${orgId}/reports/members?preset=thisMonth&today=${today}`);
ok('member report', rep.status === 200 && rep.data.length >= 1);

const repCsv = await call('GET', `/api/orgs/${orgId}/reports/members/export?preset=thisMonth&today=${today}`);
ok('report CSV export', repCsv.status === 200 && String(repCsv.data).includes('Member'));

const preset = await call('POST', `/api/orgs/${orgId}/presets`, { name: 'smoke', config: { preset: 'today' } });
ok('save preset', preset.status === 200 && preset.data.id);

const cf = await call('GET', `/api/orgs/${orgId}/custom-fields`);
ok('custom fields', cf.status === 200 && cf.data.length === 2);

// custom field filter
const cfFilter = JSON.stringify([{ fieldId: cf.data[0].id, value: 'Morning' }]);
const filtered = await call('GET', `/api/orgs/${orgId}/attendance?cf=${encodeURIComponent(cfFilter)}&preset=thisMonth&today=${today}`);
ok('custom-field filter', filtered.status === 200 && Array.isArray(filtered.data));

// members CSV export
const memCsv = await call('GET', `/api/orgs/${orgId}/members/export`);
ok('members CSV export', memCsv.status === 200 && String(memCsv.data).includes('name'));

// audit log
const audit = await call('GET', `/api/orgs/${orgId}/audit`);
ok('audit log', audit.status === 200 && audit.data.length >= 1);

// holidays
const hols = await call('GET', `/api/orgs/${orgId}/holidays?year=${new Date().getFullYear()}`);
ok('holidays', hols.status === 200 && hols.data.length >= 1);

// backup download
const bk = await call('GET', '/api/backup/download', null, true);
ok('backup .db download', bk.status === 200 && bk.buf.length > 1000 && bk.buf.slice(0, 6).toString() === 'SQLite');

// static client (prod only) — index.html
const idx = await call('GET', '/');
ok('serves client index', idx.status === 200 && String(idx.data).includes('<div id="root">'));

console.log(out.join('\n'));
const fails = out.filter((l) => l.startsWith('FAIL'));
if (fails.length) { console.error(`\n${fails.length} FAILURES`); process.exit(1); }
console.log('\nALL OK');
