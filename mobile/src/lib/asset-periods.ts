import { cycleRange } from '@/lib/cycle';

// Periods for the realized P/L of asset sales. A period only filters what is shown: it never changes a sale's date,
// the wallets, the cost basis or an asset's status. Ranges are [start, end) in the device's local time, so a sale
// at 23:59 on the last day of a custom range is still inside it.
//   cycle / prev_cycle  the user's monthly cycle ("Bulan ini" follows payday, like the rest of the app)
//   year / prev_year    calendar years
//   all                 no limits
//   custom              a named range picked by the user ("Lainnya"), inclusive of both days

export type PeriodKey = 'cycle' | 'prev_cycle' | 'year' | 'prev_year' | 'all' | 'custom';

export type CustomPeriod = { name: string; from: string; to: string }; // from/to: "2026-10-01" (inclusive)

export type Range = { start: Date | null; end: Date | null };

export const PERIOD_OPTIONS: { key: Exclude<PeriodKey, 'custom'>; label: string }[] = [
  { key: 'cycle', label: 'Bulan ini' },
  { key: 'prev_cycle', label: 'Bulan lalu' },
  { key: 'year', label: 'Tahun ini' },
  { key: 'prev_year', label: 'Tahun lalu' },
  { key: 'all', label: 'Semua waktu' },
];

const MAX_NAME = 40;
const STORAGE_KEY = 'flowku.assetPeriods';
const MAX_SAVED = 6;

/** "2026-10-01" -> local midnight of that day; null when it isn't a real date. */
export function parseDay(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

/** Local date -> "2026-10-01". */
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function periodRange(key: PeriodKey, now: Date, cycleDay: number, custom?: CustomPeriod | null): Range {
  switch (key) {
    case 'cycle':
      return cycleRange(now, cycleDay);
    case 'prev_cycle':
      return cycleRange(now, cycleDay, -1);
    case 'year':
      return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
    case 'prev_year':
      return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear(), 0, 1) };
    case 'all':
      return { start: null, end: null };
    case 'custom': {
      const from = custom ? parseDay(custom.from) : null;
      const to = custom ? parseDay(custom.to) : null;
      if (!from || !to) return { start: null, end: null };
      return { start: from, end: new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1) };
    }
  }
}

export function inRange(at: Date, range: Range) {
  return (!range.start || at >= range.start) && (!range.end || at < range.end);
}

/** What is wrong with a custom period, or null when it can be applied. */
export function customProblem(p: { name: string; from: string; to: string }) {
  const from = parseDay(p.from);
  const to = parseDay(p.to);
  if (!from) return 'Pilih tanggal mulai.';
  if (!to) return 'Pilih tanggal akhir.';
  if (from > to) return 'Tanggal mulai tidak boleh setelah tanggal akhir.';
  if (p.name.trim().length > MAX_NAME) return `Nama periode maksimal ${MAX_NAME} huruf.`;
  return null;
}

/** Cleans a custom period before it is used or saved; an empty name becomes "Periode khusus". */
export function normalizeCustom(p: CustomPeriod): CustomPeriod {
  return { name: p.name.trim().slice(0, MAX_NAME) || 'Periode khusus', from: p.from, to: p.to };
}

const rangeFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/** "1 Okt 2026 – 31 Okt 2026" for a custom period. */
export function customLabel(p: CustomPeriod) {
  const from = parseDay(p.from);
  const to = parseDay(p.to);
  return from && to ? `${rangeFormat.format(from)} – ${rangeFormat.format(to)}` : '';
}

/** Saved custom periods (per device). Adding one with the same name replaces it; newest first. */
export function addSaved(list: CustomPeriod[], p: CustomPeriod): CustomPeriod[] {
  const clean = normalizeCustom(p);
  return [clean, ...list.filter((x) => x.name.toLowerCase() !== clean.name.toLowerCase())].slice(0, MAX_SAVED);
}

export function loadSavedPeriods(): CustomPeriod[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p): p is CustomPeriod => !!p && typeof p.name === 'string' && typeof p.from === 'string' && typeof p.to === 'string')
      .filter((p) => customProblem(p) === null)
      .slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

export function storeSavedPeriods(list: CustomPeriod[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Still usable for this session.
  }
}
