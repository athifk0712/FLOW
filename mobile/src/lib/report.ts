import type { Enums, Tables } from '@/lib/database.types';

export type ReportTransaction = Pick<Tables<'transactions'>, 'id' | 'type' | 'amount' | 'necessity' | 'merchant' | 'occurred_at'> & {
  category_id: string | null;
  categories: { name: string } | null;
};

export type CategoryLine = { key: string; name: string; total: number; previous: number };

export type MonthReport = {
  income: number;
  expense: number;
  previousIncome: number;
  previousExpense: number;
  categories: CategoryLine[];
  /** Shaped like v_spending_mix_monthly rows so SpendingMix can render them. */
  mix: { necessity: Enums<'necessity_level'> | 'UNREVIEWED'; total: number }[];
  biggest: ReportTransaction[];
};

/** Local-time [start, end) of the month `offset` months from `base`. */
export function monthRange(base: Date, offset = 0) {
  const start = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const end = new Date(base.getFullYear(), base.getMonth() + offset + 1, 1);
  return { start, end };
}

/** Totals for the month starting at `start`, compared with the month before. Transfers are ignored. */
export function buildReport(rows: ReportTransaction[], start: Date): MonthReport {
  const inMonth = (t: ReportTransaction) => new Date(t.occurred_at) >= start;
  const current = rows.filter(inMonth);
  const previous = rows.filter((t) => !inMonth(t));
  const sum = (list: ReportTransaction[], type: ReportTransaction['type']) =>
    list.filter((t) => t.type === type).reduce((total, t) => total + t.amount, 0);

  const lines = new Map<string, CategoryLine>();
  const line = (t: ReportTransaction) => {
    const key = t.category_id ?? 'none';
    let entry = lines.get(key);
    if (!entry) {
      entry = { key, name: t.categories?.name ?? 'Tanpa kategori', total: 0, previous: 0 };
      lines.set(key, entry);
    }
    return entry;
  };
  for (const t of current) if (t.type === 'EXPENSE') line(t).total += t.amount;
  // Last month only matters for categories that also appear this month.
  for (const t of previous) if (t.type === 'EXPENSE' && lines.has(t.category_id ?? 'none')) line(t).previous += t.amount;

  const mix = new Map<string, number>();
  for (const t of current) {
    if (t.type !== 'EXPENSE') continue;
    const key = t.necessity ?? 'UNREVIEWED';
    mix.set(key, (mix.get(key) ?? 0) + t.amount);
  }

  return {
    income: sum(current, 'INCOME'),
    expense: sum(current, 'EXPENSE'),
    previousIncome: sum(previous, 'INCOME'),
    previousExpense: sum(previous, 'EXPENSE'),
    categories: [...lines.values()].sort((a, b) => b.total - a.total),
    mix: [...mix.entries()].map(([necessity, total]) => ({
      necessity: necessity as MonthReport['mix'][number]['necessity'],
      total,
    })),
    biggest: current
      .filter((t) => t.type === 'EXPENSE')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
  };
}

/** "+12%" / "-8%" change from `previous` to `current`, or null when there is nothing to compare with. */
export function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? '+' : ''}${change}%`;
}
