// Client-side date + formatting helpers.

export function todayStr(): string {
  const d = new Date();
  return ymd(d);
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(s?: string | null, fmt = 'YYYY-MM-DD'): string {
  if (!s) return '—';
  const d = parseYmd(s);
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  switch (fmt) {
    case 'DD/MM/YYYY':
      return `${String(day).padStart(2, '0')}/${String(mo + 1).padStart(2, '0')}/${y}`;
    case 'MM/DD/YYYY':
      return `${String(mo + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}/${y}`;
    case 'DD MMM YYYY':
      return `${day} ${MONTHS[mo]} ${y}`;
    default:
      return s;
  }
}

export function shortDay(s: string): { dow: string; day: number; dowIdx: number } {
  const d = parseYmd(s);
  return { dow: WEEKDAYS[d.getDay()], day: d.getDate(), dowIdx: d.getDay() };
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export { WEEKDAYS, MONTHS };

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') || iso.includes('Z') ? iso : iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
