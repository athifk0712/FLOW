import type { Enums, Tables } from '@/lib/database.types';

export type Debt = Tables<'v_debts'>;
export type DebtDirection = Enums<'debt_direction'>;

const dayFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/** "2026-10-05" -> local Date (a plain date string would otherwise parse as UTC midnight). */
export function localDate(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Local date `days` from today as YYYY-MM-DD. */
export function dateFromToday(days: number, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days from today to `value` (negative = in the past). */
export function daysFromToday(value: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((localDate(value).getTime() - today.getTime()) / 86_400_000);
}

export function formatDay(value: string) {
  return dayFormat.format(localDate(value));
}

/** Due-date line for an open debt, and whether it is overdue. */
export function dueStatus(debt: Pick<Debt, 'due_date' | 'settled'>) {
  if (debt.settled || !debt.due_date) return null;
  const days = daysFromToday(debt.due_date);
  if (days < 0) return { overdue: true, text: `Lewat ${-days} hari (${formatDay(debt.due_date)})` };
  if (days === 0) return { overdue: false, text: 'Jatuh tempo hari ini' };
  if (days === 1) return { overdue: false, text: 'Jatuh tempo besok' };
  return { overdue: false, text: `Jatuh tempo ${formatDay(debt.due_date)} (${days} hari lagi)` };
}

/** Open debts first by due date (no date last), then settled ones by most recent payment. */
export function sortDebts(debts: Debt[]) {
  const due = (d: Debt) => (d.due_date ? localDate(d.due_date).getTime() : Number.POSITIVE_INFINITY);
  return [...debts].sort((a, b) => {
    if (a.settled !== b.settled) return a.settled ? 1 : -1;
    if (!a.settled) return due(a) - due(b);
    return (b.last_paid_at ?? '').localeCompare(a.last_paid_at ?? '');
  });
}
