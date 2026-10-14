// The financial picture Flowku's AI reasons from. Every number here is computed by code from the user's own rows
// (read as the user, so RLS applies) and handed to the model as text to quote; the model never does the arithmetic.
// Only aggregates go in: totals, top categories, open debts, goals, upcoming bills — not the raw ledger.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const MAX_ROWS = 8;

type Money = (minor: number) => string;

/** "YYYY-MM-DD" of an instant in a time zone. */
export function localDay(at: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** First day (YYYY-MM-DD) of the payday cycle containing `day`, cycles starting on `startDay` (1-28). */
export function cycleStart(day: string, startDay: number) {
  const [y, m, d] = day.split('-').map(Number);
  if (d >= startDay) return `${y}-${pad(m)}-${pad(startDay)}`;
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-${pad(startDay)}`;
}

/** The same day one month later (cycle days are 1-28, so it always exists). */
export function addMonth(day: string, months = 1) {
  const [y, m, d] = day.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(d)}`;
}

/** Monthly rule's due date in a month, clamped to the month's length (like recurring_due_date in SQL). */
function dueIn(year: number, month0: number, dayOfMonth: number) {
  const first = new Date(Date.UTC(year, month0, 1)); // normalizes month 12 -> January of the next year
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(dayOfMonth, last))}`;
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export async function buildSnapshot(supabase: SupabaseClient, userId: string, money: Money, now = new Date()) {
  const profile = await supabase.from('profiles').select('timezone, cycle_start_day').maybeSingle();
  const tz = profile.data?.timezone ?? 'Asia/Jakarta';
  const startDay = profile.data?.cycle_start_day ?? 1;
  const today = localDay(now, tz);
  const thisStart = cycleStart(today, startDay);
  const prevStart = addMonth(thisStart, -1);
  const nextStart = addMonth(thisStart, 1);
  const since = new Date(Date.parse(`${prevStart}T00:00:00Z`) - 86_400_000).toISOString();

  const [balances, safe, tx, categories, debts, goals, rules] = await Promise.all([
    supabase.from('v_account_balances').select('name, current_balance').is('archived_at', null).order('name'),
    supabase.rpc('safe_to_spend', { p_user_id: userId }).maybeSingle(),
    supabase
      .from('transactions')
      .select('type, amount, category_id, occurred_at')
      .in('type', ['INCOME', 'EXPENSE'])
      .gte('occurred_at', since)
      .limit(3000),
    supabase.from('categories').select('id, name'),
    supabase.from('v_debts').select('direction, person, remaining, due_date').eq('settled', false),
    supabase.from('v_goal_progress').select('name, target_amount, saved, deadline'),
    supabase.from('recurring_transactions').select('name, amount, type, next_due, day_of_month').eq('active', true),
  ]);

  const gaps: string[] = [];
  const accountRows = balances.data ?? [];
  const cash = accountRows.reduce((s, a) => s + (a.current_balance ?? 0), 0);
  if (accountRows.length === 0) gaps.push('Belum ada akun/dompet, jadi saldo belum diketahui.');

  // Income/expense per cycle and the biggest expense categories (by local date in the user's time zone).
  const names = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const sums = { this: { income: 0, expense: 0 }, prev: { income: 0, expense: 0 } };
  const byCategory = new Map<string, { now: number; before: number }>();
  for (const t of tx.data ?? []) {
    const day = localDay(new Date(t.occurred_at), tz);
    const bucket = day >= thisStart ? 'this' : day >= prevStart ? 'prev' : null;
    if (!bucket) continue;
    if (t.type === 'INCOME') sums[bucket].income += t.amount;
    else {
      sums[bucket].expense += t.amount;
      const key = t.category_id ? (names.get(t.category_id) ?? 'Tanpa kategori') : 'Tanpa kategori';
      const row = byCategory.get(key) ?? { now: 0, before: 0 };
      if (bucket === 'this') row.now += t.amount;
      else row.before += t.amount;
      byCategory.set(key, row);
    }
  }
  const topCategories = [...byCategory.entries()]
    .filter(([, v]) => v.now > 0)
    .sort((a, b) => b[1].now - a[1].now)
    .slice(0, 5)
    .map(([name, v]) => ({ name, this_cycle_text: money(v.now), previous_cycle_text: money(v.before) }));

  // Upcoming bills before the cycle ends: next due date, and the month after if it still falls inside.
  const bills: { name: string; amount: number; due: string }[] = [];
  for (const r of rules.data ?? []) {
    if (r.type !== 'EXPENSE') continue;
    const [y, m] = r.next_due.split('-').map(Number);
    for (const due of [r.next_due, dueIn(y, m, r.day_of_month)]) if (due < nextStart) bills.push({ name: r.name, amount: r.amount, due });
  }
  bills.sort((a, b) => a.due.localeCompare(b.due));
  const billsTotal = bills.reduce((s, b) => s + b.amount, 0);

  const openDebts = debts.data ?? [];
  const debtsDue = openDebts
    .filter((d) => d.direction === 'I_OWE' && d.due_date && d.due_date < nextStart)
    .reduce((s, d) => s + Math.max(0, d.remaining ?? 0), 0);
  const goalRows = goals.data ?? [];
  const goalsSaved = Math.max(0, goalRows.reduce((s, g) => s + (g.saved ?? 0), 0));

  const safeRow = safe.data as { safe: number; daily_limit: number; days_left: number } | null;
  if (!safeRow) gaps.push('Safe to Spend belum bisa dihitung.');
  const essentials = safeRow ? cash - billsTotal - debtsDue - goalsSaved - safeRow.safe : null;
  if (essentials === 0) gaps.push('Belum ada budget kebutuhan pokok mingguan, jadi tidak ada dana kebutuhan yang disisihkan.');
  if (startDay === 1) gaps.push('Siklus gajian memakai tanggal 1 (bawaan); bisa diubah di Pengaturan > Siklus.');

  return {
    note: 'Semua angka dihitung aplikasi dari data pengguna. Kutip apa adanya; jangan menghitung ulang atau mengarang angka.',
    today,
    total_balance_text: money(cash),
    accounts: accountRows.slice(0, 10).map((a) => ({ name: a.name, balance_text: money(a.current_balance ?? 0) })),
    safe_to_spend: safeRow
      ? {
          safe_until_payday_text: money(safeRow.safe),
          daily_limit_text: money(safeRow.daily_limit),
          formula: 'total saldo − tagihan rutin sebelum gajian − utang jatuh tempo sebelum gajian − dana target tabungan − cadangan kebutuhan pokok',
          breakdown: {
            total_balance_text: money(cash),
            upcoming_bills_text: money(billsTotal),
            debts_due_text: money(debtsDue),
            goals_set_aside_text: money(goalsSaved),
            essentials_reserve_text: money(Math.max(0, essentials ?? 0)),
          },
        }
      : null,
    payday: { next_cycle_starts: nextStart, days_until: daysBetween(today, nextStart) },
    this_cycle: { started: thisStart, income_text: money(sums.this.income), expense_text: money(sums.this.expense) },
    previous_cycle: { started: prevStart, income_text: money(sums.prev.income), expense_text: money(sums.prev.expense) },
    top_expense_categories_this_cycle: topCategories,
    upcoming_bills_before_payday: bills.slice(0, MAX_ROWS).map((b) => ({ name: b.name, amount_text: money(b.amount), due: b.due })),
    debts_i_owe: openDebts
      .filter((d) => d.direction === 'I_OWE')
      .slice(0, MAX_ROWS)
      .map((d) => ({ person: d.person, remaining_text: money(d.remaining ?? 0), due: d.due_date })),
    receivables_to_collect: openDebts
      .filter((d) => d.direction === 'OWED_TO_ME')
      .slice(0, MAX_ROWS)
      .map((d) => ({ person: d.person, remaining_text: money(d.remaining ?? 0), due: d.due_date })),
    savings_goals: goalRows.slice(0, MAX_ROWS).map((g) => ({
      name: g.name,
      target_text: money(g.target_amount ?? 0),
      saved_text: money(g.saved ?? 0),
      percent: g.target_amount ? Math.round(((g.saved ?? 0) / g.target_amount) * 100) : 0,
      deadline: g.deadline,
    })),
    data_gaps: gaps,
  };
}
