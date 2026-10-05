// The user's monthly cycle: starts on `day` (1–28) of each month, e.g. payday on the 25th.
// Mirrors public.cycle_start() in the database so keys match the views' `month` column.

const shortDay = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
const monthYear = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });

export const CYCLE_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** Local midnight that starts the cycle `offset` cycles from the one containing `now`. */
export function cycleStart(now: Date, day: number, offset = 0) {
  const back = now.getDate() >= day ? 0 : -1;
  return new Date(now.getFullYear(), now.getMonth() + back + offset, day);
}

/** [start, end) of the cycle `offset` cycles from the current one. */
export function cycleRange(now: Date, day: number, offset = 0) {
  return { start: cycleStart(now, day, offset), end: cycleStart(now, day, offset + 1) };
}

/** "2026-09-25": the views' `month` key for the cycle containing `now`. */
export function cycleKey(now: Date, day: number) {
  const s = cycleStart(now, day);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
}

/** "Oktober 2026" for calendar months, "25 Sep – 24 Okt" for a payday cycle. */
export function cycleLabel(start: Date, day: number) {
  if (day === 1) return monthYear.format(start);
  const last = new Date(start.getFullYear(), start.getMonth() + 1, day - 1);
  return `${shortDay.format(start)} – ${shortDay.format(last)}`;
}

/** What the current cycle runs up to, for "N hari lagi sampai …". */
export function untilLabel(end: Date, day: number) {
  return day === 1 ? 'akhir bulan' : `gajian ${shortDay.format(end)}`;
}
