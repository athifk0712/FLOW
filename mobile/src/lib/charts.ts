import type { Tables } from '@/lib/database.types';

// Data for the Diagram tab: where the month's money went (donut) and money in vs out per month (bars).

export type ChartTransaction = Pick<Tables<'transactions'>, 'type' | 'amount' | 'occurred_at' | 'category_id'> & {
  categories: { name: string; icon: string | null } | null;
};

export type Kind = 'EXPENSE' | 'INCOME';

/** Donut slots are capped so the chart stays readable; the rest fold into "Lainnya". */
export const MAX_SLICES = 5;

export type Slice = {
  key: string;
  name: string;
  icon: string | null;
  total: number;
  /** 0..1 of the month's total. */
  share: number;
  /** Categorical color slot 0..MAX_SLICES-1, or null for "Lainnya". */
  slot: number | null;
};

const keyOf = (t: ChartTransaction) => t.category_id ?? 'none';

/**
 * Color slots by total over the whole loaded window, not per month, so a category keeps its color when
 * the user steps between months. Only the top MAX_SLICES categories get a slot.
 */
export function assignSlots(rows: ChartTransaction[], kind: Kind): Map<string, number> {
  const totals = new Map<string, number>();
  for (const t of rows) if (t.type === kind) totals.set(keyOf(t), (totals.get(keyOf(t)) ?? 0) + t.amount);
  return new Map(
    [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SLICES)
      .map(([key], i) => [key, i]),
  );
}

/** Slices for [start, end): slotted categories largest first, then one "Lainnya" slice for the rest. */
export function monthSlices(
  rows: ChartTransaction[],
  kind: Kind,
  start: Date,
  end: Date,
  slots: Map<string, number>,
): { total: number; slices: Slice[] } {
  const inMonth = rows.filter((t) => {
    const at = new Date(t.occurred_at);
    return t.type === kind && at >= start && at < end;
  });
  const total = inMonth.reduce((sum, t) => sum + t.amount, 0);
  const byKey = new Map<string, Slice>();
  let other = 0;
  for (const t of inMonth) {
    const key = keyOf(t);
    const slot = slots.get(key);
    if (slot === undefined) {
      other += t.amount;
      continue;
    }
    const slice = byKey.get(key) ?? {
      key,
      name: t.categories?.name ?? 'Tanpa kategori',
      icon: t.categories?.icon ?? null,
      total: 0,
      share: 0,
      slot,
    };
    slice.total += t.amount;
    byKey.set(key, slice);
  }
  const slices = [...byKey.values()].sort((a, b) => b.total - a.total);
  if (other > 0) slices.push({ key: 'other', name: 'Lainnya', icon: 'dots', total: other, share: 0, slot: null });
  for (const s of slices) s.share = total > 0 ? s.total / total : 0;
  return { total, slices };
}

export type MonthFlow = { start: Date; income: number; expense: number };

/** Money in and out per period. `starts` are ascending period starts; the last period ends at `end`. */
export function monthlyFlow(rows: ChartTransaction[], starts: Date[], end: Date): MonthFlow[] {
  const flows = starts.map((start) => ({ start, income: 0, expense: 0 }));
  for (const t of rows) {
    if (t.type !== 'INCOME' && t.type !== 'EXPENSE') continue;
    const at = new Date(t.occurred_at);
    if (at >= end) continue;
    let i = flows.length - 1;
    while (i >= 0 && at < flows[i].start) i--;
    if (i < 0) continue;
    if (t.type === 'INCOME') flows[i].income += t.amount;
    else flows[i].expense += t.amount;
  }
  return flows;
}

/** A "nice" axis maximum (1, 2, 2.5 or 5 × 10^n) at or above `value`, so gridlines land on round numbers. */
export function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value)!;
  return step * magnitude;
}

/** 1_250_000 -> "1,3 jt"; 950_000 -> "950 rb": short labels for the bar axis. Amounts in whole units. */
export function compactAmount(value: number) {
  const fmt = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');
  if (value >= 1e9) return `${fmt(value / 1e9)} M`;
  if (value >= 1e6) return `${fmt(value / 1e6)} jt`;
  if (value >= 1e3) return `${fmt(value / 1e3)} rb`;
  return String(Math.round(value));
}
