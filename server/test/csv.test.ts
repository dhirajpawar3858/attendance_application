import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCSV, parseCSV, parseRows } from '../src/domain/csv.ts';

test('toCSV: quotes fields with commas, quotes, newlines', () => {
  const csv = toCSV(['a', 'b'], [{ a: 'hi, there', b: 'say "hi"' }, { a: 'line\nbreak', b: 'x' }]);
  assert.equal(csv, 'a,b\r\n"hi, there","say ""hi"""\r\n"line\nbreak",x');
});

test('toCSV: null/undefined become empty', () => {
  const csv = toCSV(['a', 'b'], [{ a: null, b: undefined }]);
  assert.equal(csv, 'a,b\r\n,');
});

test('parseCSV: round-trips a quoted value', () => {
  const csv = 'name,note\r\n"Doe, Jane","said ""hi"""\r\nJohn,plain';
  const rows = parseCSV(csv);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { name: 'Doe, Jane', note: 'said "hi"' });
  assert.deepEqual(rows[1], { name: 'John', note: 'plain' });
});

test('parseCSV: handles embedded newline within quotes', () => {
  const csv = 'a,b\r\n"multi\nline",second';
  const rows = parseCSV(csv);
  assert.equal(rows[0].a, 'multi\nline');
  assert.equal(rows[0].b, 'second');
});

test('parseCSV: empty input → []', () => {
  assert.deepEqual(parseCSV(''), []);
});

test('parseCSV: skips fully-empty trailing line', () => {
  const rows = parseCSV('a,b\r\n1,2\r\n');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { a: '1', b: '2' });
});

test('parseRows: tolerates CRLF and lone LF', () => {
  assert.deepEqual(parseRows('a,b\nc,d'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(parseRows('a,b\r\nc,d'), [['a', 'b'], ['c', 'd']]);
});

test('round-trip: toCSV then parseCSV preserves data', () => {
  const headers = ['name', 'member_code', 'notes'];
  const data = [
    { name: 'Aarav Sharma', member_code: 'EMP001', notes: 'Team lead, senior' },
    { name: 'Priya Patel', member_code: 'EMP002', notes: 'Line\nwith break' },
  ];
  const parsed = parseCSV(toCSV(headers, data));
  assert.deepEqual(parsed, data);
});
