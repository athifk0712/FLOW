import { localDate } from '@/lib/debts';

// "Safe to spend": cash that is not already promised to something until the end of the cycle.
//   safe = cash − upcoming bills − debts falling due − money set aside for goals − essentials reserve
// The daily limit is computed from this morning's position, so it stays put while you spend during the day.

export type SafeRule = { name: string; amount: number; type: 'INCOME' | 'EXPENSE' | 'TRANSFER'; active: boolean; next_due: string; day_of_month: number };
export type SafeDebt = { direction: 'OWED_TO_ME' | 'I_OWE' | null; remaining: number | null; due_date: string | null; settled: boolean | null };
export type EssentialBudget = { limit_amount: number; remaining: number } | null;

export type SafeInput = {
  cash: number;
  rules: SafeRule[];
  debts: SafeDebt[];
  goalsSaved: number; // earmarked money still sitting in the accounts
  essential: EssentialBudget; // this week's ESSENTIAL budget, if the user set one
  spentToday: number;
  cycleEnd: Date; // exclusive, local midnight
};

export type Bill = { name: string; amount: number; date: Date };

export type SafeToSpend = {
  safe: number; // can be negative: promises exceed cash
  bills: Bill[];
  billsTotal: number;
  debtsDue: number;
  goalsSaved: number;
  essentials: number;
  hasEssentialBudget: boolean;
  daysLeft: number; // including today
  dailyLimit: number; // per day from this morning's position, 0 when nothing is safe
  leftToday: number; // dailyLimit − spentToday (negative = over)
};

const DAY = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Same day of month in a later month, clamped to that month's length (31 -> 30 Nov, 28/29 Feb). */
function monthlyOn(year: number, month: number, day: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

/** Occurrences of a monthly rule from its next due date until `end` (exclusive). */
export function occurrences(rule: SafeRule, end: Date) {
  const dates: Date[] = [];
  const first = localDate(rule.next_due);
  for (let i = 0; i < 24; i++) {
    const d = i === 0 ? first : monthlyOn(first.getFullYear(), first.getMonth() + i, rule.day_of_month);
    if (d >= end) break;
    dates.push(d);
  }
  return dates;
}

/** End of the cycle: the 1st of next month (payday cycles plug in here). */
export function monthCycleEnd(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

export function computeSafeToSpend(input: SafeInput, now = new Date()): SafeToSpend {
  const today = startOfDay(now);
  const daysLeft = Math.max(1, Math.round((input.cycleEnd.getTime() - today.getTime()) / DAY));

  const bills: Bill[] = input.rules
    .filter((r) => r.active && r.type === 'EXPENSE')
    .flatMap((r) => occurrences(r, input.cycleEnd).map((date) => ({ name: r.name, amount: r.amount, date })))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const billsTotal = bills.reduce((s, b) => s + b.amount, 0);

  const debtsDue = input.debts
    .filter((d) => d.direction === 'I_OWE' && !d.settled && d.due_date && localDate(d.due_date) < input.cycleEnd)
    .reduce((s, d) => s + Math.max(0, d.remaining ?? 0), 0);

  // Essentials: what is left of this week's budget, then the weekly limit spread over the days after this week.
  let essentials = 0;
  if (input.essential) {
    const daysThisWeek = 7 - ((now.getDay() + 6) % 7); // Monday-based, including today
    const laterDays = Math.max(0, daysLeft - daysThisWeek);
    const thisWeek = Math.max(0, input.essential.remaining) * Math.min(1, daysLeft / daysThisWeek);
    essentials = Math.round((thisWeek + (input.essential.limit_amount / 7) * laterDays) / 1000) * 1000; // calm, round numbers
  }

  const goalsSaved = Math.max(0, input.goalsSaved);
  const safe = input.cash - billsTotal - debtsDue - goalsSaved - essentials;
  // Today's spending already left the accounts; add it back to get this morning's position.
  // Rounded down to whole thousands: easy to remember at the till, and never more than is safe.
  const perDay = Math.max(0, (safe + input.spentToday) / daysLeft);
  const dailyLimit = perDay >= 1000 ? Math.floor(perDay / 1000) * 1000 : Math.floor(perDay);

  return {
    safe,
    bills,
    billsTotal,
    debtsDue,
    goalsSaved,
    essentials,
    hasEssentialBudget: !!input.essential,
    daysLeft,
    dailyLimit,
    leftToday: dailyLimit - input.spentToday,
  };
}
