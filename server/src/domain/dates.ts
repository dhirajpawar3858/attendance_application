// Pure date helpers operating on YYYY-MM-DD strings (timezone-agnostic, no Date-now traps).

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Inclusive list of YYYY-MM-DD dates between start and end. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = parseYmd(start);
  const e = parseYmd(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(ymd(d));
  }
  return out;
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** 0=Sun..6=Sat */
export function dayOfWeek(s: string): number {
  return parseYmd(s).getDay();
}

/** Compute worked hours from HH:MM check-in/out; null if incomplete. */
export function hoursBetween(checkIn?: string | null, checkOut?: string | null): number | null {
  if (!checkIn || !checkOut) return null;
  const [ih, im] = checkIn.split(':').map(Number);
  const [oh, om] = checkOut.split(':').map(Number);
  if ([ih, im, oh, om].some((v) => Number.isNaN(v))) return null;
  let mins = oh * 60 + om - (ih * 60 + im);
  if (mins < 0) mins += 24 * 60; // overnight shift
  return Math.round((mins / 60) * 100) / 100;
}
