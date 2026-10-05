import type { Enums } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type HabitTransaction = {
  occurred_at: string;
  type: Enums<'transaction_type'>;
  necessity: Enums<'necessity_level'> | null;
};

export type HabitInput = {
  transactions: HabitTransaction[]; // the last HISTORY_DAYS days
  chatCount: number; // finished nightly chats
  goalReached: boolean;
};

export type Milestone = { key: string; title: string; hint: string; done: boolean };

export type Habits = {
  streak: number; // consecutive days with a log, ending today (or yesterday if today is still empty)
  loggedToday: boolean;
  lastSeven: boolean[]; // oldest first, today last
  reviewedShare: number | null; // share of the last 7 days' expenses that are judged, null if none
  milestones: Milestone[];
};

export const HISTORY_DAYS = 90;

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function daysAgo(n: number, now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
}

/** Longest run of consecutive logged days within the window. */
function bestStreak(logged: Set<string>, now: Date) {
  let best = 0;
  let run = 0;
  for (let i = HISTORY_DAYS; i >= 0; i--) {
    run = logged.has(dayKey(daysAgo(i, now))) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Monday of the last fully finished week (local time). */
function lastFullWeek(now: Date) {
  const mondayOffset = (now.getDay() + 6) % 7; // days since this week's Monday
  const start = daysAgo(mondayOffset + 7, now);
  return { start, end: daysAgo(mondayOffset, now) };
}

export function computeHabits(input: HabitInput, now = new Date()): Habits {
  const logged = new Set(input.transactions.map((t) => dayKey(new Date(t.occurred_at))));
  const loggedToday = logged.has(dayKey(now));

  // Today not logged yet does not break the streak; it just hasn't grown today.
  let streak = 0;
  for (let i = loggedToday ? 0 : 1; logged.has(dayKey(daysAgo(i, now))); i++) streak++;

  const lastSeven = Array.from({ length: 7 }, (_, i) => logged.has(dayKey(daysAgo(6 - i, now))));

  const weekStart = daysAgo(6, now);
  const recentExpenses = input.transactions.filter((t) => t.type === 'EXPENSE' && new Date(t.occurred_at) >= weekStart);
  const reviewedShare = recentExpenses.length
    ? recentExpenses.filter((t) => t.necessity).length / recentExpenses.length
    : null;

  const expenses = input.transactions.filter((t) => t.type === 'EXPENSE');
  const judged = expenses.filter((t) => t.necessity);
  const week = lastFullWeek(now);
  const lastWeek = expenses.filter((t) => {
    const at = new Date(t.occurred_at);
    return at >= week.start && at < week.end;
  });
  const best = bestStreak(logged, now);

  const milestones: Milestone[] = [
    { key: 'first-log', title: 'Catatan pertama', hint: 'Mencatat satu transaksi.', done: input.transactions.length > 0 },
    { key: 'streak-7', title: 'Seminggu konsisten', hint: 'Mencatat 7 hari berturut-turut.', done: best >= 7 },
    { key: 'streak-30', title: 'Sebulan konsisten', hint: 'Mencatat 30 hari berturut-turut.', done: best >= 30 },
    {
      key: 'all-judged',
      title: 'Jujur pada diri sendiri',
      hint: 'Menilai 10 pengeluaran dan tidak ada yang tertunda.',
      done: judged.length >= 10 && judged.length === expenses.length,
    },
    {
      key: 'calm-week',
      title: 'Minggu tanpa impulsif',
      hint: 'Seminggu penuh (Senin–Minggu) dengan minimal 3 pengeluaran dinilai, tanpa satu pun impulsif.',
      done: lastWeek.filter((t) => t.necessity).length >= 3 && !lastWeek.some((t) => t.necessity === 'IMPULSE'),
    },
    { key: 'first-chat', title: 'Obrolan pertama', hint: 'Menyelesaikan satu ngobrol malam dengan Flowku.', done: input.chatCount > 0 },
    { key: 'chat-7', title: 'Seminggu bercerita', hint: 'Tujuh kali ngobrol malam sampai selesai.', done: input.chatCount >= 7 },
    { key: 'goal', title: 'Target tercapai', hint: 'Satu target tabungan terkumpul penuh.', done: input.goalReached },
  ];

  return { streak, loggedToday, lastSeven, reviewedShare, milestones };
}

/** Loads what computeHabits needs: 90 days of transactions, finished nightly chats, and whether any goal is reached. */
export async function fetchHabits(now = new Date()) {
  const since = daysAgo(HISTORY_DAYS, now).toISOString();
  const [tx, chats, goals] = await Promise.all([
    supabase.from('transactions').select('occurred_at, type, necessity').gte('occurred_at', since),
    supabase.from('coach_sessions').select('id', { count: 'exact', head: true }).not('summary', 'is', null),
    supabase.from('v_goal_progress').select('saved, target_amount'),
  ]);
  const failed = tx.error ?? chats.error ?? goals.error;
  if (failed) throw failed;
  return computeHabits(
    {
      transactions: tx.data ?? [],
      chatCount: chats.count ?? 0,
      goalReached: (goals.data ?? []).some((g) => (g.saved ?? 0) >= (g.target_amount ?? 1)),
    },
    now,
  );
}
