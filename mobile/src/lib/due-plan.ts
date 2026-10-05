import type { Enums } from '@/lib/database.types';
import { localDate } from '@/lib/debts';
import { formatMoney } from '@/lib/money';

// Which due-date reminders to schedule. Pure, so it can be tested without expo-notifications.

export const DUE_HOUR = 9;
export const DUE_LABEL = '09.00';
const HORIZON_DAYS = 60;
// iOS keeps at most 64 pending local notifications; leave room for the review reminders.
const MAX_REMINDERS = 30;

export type DueDebt = {
  id: string | null;
  person: string | null;
  direction: Enums<'debt_direction'> | null;
  remaining: number | null;
  due_date: string | null;
  settled: boolean | null;
};

export type DueRule = {
  id: string;
  name: string;
  amount: number;
  type: Enums<'transaction_type'>;
  active: boolean;
  next_due: string;
};

export type PlannedReminder = { id: string; date: Date; title: string; body: string; url: '/debts' | '/recurring' };

function at9(value: string) {
  const d = localDate(value);
  d.setHours(DUE_HOUR, 0, 0, 0);
  return d;
}

/** Reminders at 09.00 on each due day still ahead within 60 days, soonest first. */
export function planDueReminders(debts: DueDebt[], rules: DueRule[], now = new Date()): PlannedReminder[] {
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + HORIZON_DAYS);
  const planned: PlannedReminder[] = [];

  for (const d of debts) {
    if (!d.id || d.settled || !d.due_date || !d.remaining || d.remaining <= 0) continue;
    const owe = d.direction === 'I_OWE';
    planned.push({
      id: `due-debt-${d.id}`,
      date: at9(d.due_date),
      title: owe ? 'Utang jatuh tempo hari ini' : 'Piutang jatuh tempo hari ini',
      body: owe
        ? `Sisa ${formatMoney(d.remaining)} ke ${d.person ?? 'seseorang'}.`
        : `${d.person ?? 'Seseorang'} masih punya sisa ${formatMoney(d.remaining)}. Saatnya mengingatkan dengan baik.`,
      url: '/debts',
    });
  }

  for (const r of rules) {
    if (!r.active || r.type !== 'EXPENSE') continue;
    planned.push({
      id: `due-rule-${r.id}`,
      date: at9(r.next_due),
      title: `Hari ini: ${r.name}`,
      body: `${formatMoney(r.amount)} tercatat otomatis saat kamu membuka Flowku. Pastikan saldonya cukup.`,
      url: '/recurring',
    });
  }

  return planned
    .filter((p) => p.date > now && p.date < horizon)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_REMINDERS);
}
