// Month grids and per-day / per-month money totals for the Kalender tab and the date picker.
// Weeks start on Monday, as on Indonesian calendars. Transfers move money between own accounts, so they
// count as neither income nor spending.

export type DayTotals = { in: number; out: number };
export type MoneyRow = { type: string; amount: number; occurred_at: string };

export const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-05" for a local date. */
export function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-10" for a local date. */
export function monthKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function addMonths(d: Date, months: number) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

/** Weeks of the month, Monday first; days outside the month are null. */
export function monthGrid(month: Date): (Date | null)[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function add(map: Map<string, DayTotals>, key: string, row: MoneyRow) {
  const totals = map.get(key) ?? { in: 0, out: 0 };
  if (row.type === 'INCOME') totals.in += row.amount;
  else if (row.type === 'EXPENSE') totals.out += row.amount;
  else return;
  map.set(key, totals);
}

/** Income and spending per local day ("YYYY-MM-DD"). */
export function totalsByDay(rows: MoneyRow[]) {
  const map = new Map<string, DayTotals>();
  for (const row of rows) add(map, dateKey(new Date(row.occurred_at)), row);
  return map;
}

/** Income and spending per local month ("YYYY-MM"). */
export function totalsByMonth(rows: MoneyRow[]) {
  const map = new Map<string, DayTotals>();
  for (const row of rows) add(map, monthKey(new Date(row.occurred_at)), row);
  return map;
}

export function sumTotals(map: Map<string, DayTotals>): DayTotals {
  let totals = { in: 0, out: 0 };
  for (const t of map.values()) totals = { in: totals.in + t.in, out: totals.out + t.out };
  return totals;
}

/**
 * Compact amount for a small cell: 45.000 -> "45rb", 126.800 -> "127rb", 1.250.000 -> "1,3jt". Whole units in,
 * sign kept. One decimal only below 10, so a phone-width cell never truncates.
 */
export function shortAmount(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '+';
  const trim = (n: number) => (n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, '').replace('.', ','));
  if (abs >= 1_000_000_000) return `${sign}${trim(abs / 1_000_000_000)}M`;
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}jt`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}rb`;
  return `${sign}${trim(abs)}`;
}
