import {
  addSaved,
  customLabel,
  customProblem,
  inRange,
  loadSavedPeriods,
  normalizeCustom,
  parseDay,
  periodRange,
} from '@/lib/asset-periods';
import { salesIn } from '@/lib/assets';

const now = new Date(2026, 9, 16, 12, 0); // 16 Oct 2026, local time

describe('periodRange', () => {
  it('this and last cycle follow the payday', () => {
    expect(periodRange('cycle', now, 1)).toEqual({ start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) });
    expect(periodRange('prev_cycle', now, 1)).toEqual({ start: new Date(2026, 8, 1), end: new Date(2026, 9, 1) });
    expect(periodRange('cycle', now, 28)).toEqual({ start: new Date(2026, 8, 28), end: new Date(2026, 9, 28) });
    expect(periodRange('prev_cycle', now, 28).start).toEqual(new Date(2026, 7, 28));
  });

  it('calendar years', () => {
    expect(periodRange('year', now, 1)).toEqual({ start: new Date(2026, 0, 1), end: new Date(2027, 0, 1) });
    expect(periodRange('prev_year', now, 1)).toEqual({ start: new Date(2025, 0, 1), end: new Date(2026, 0, 1) });
  });

  it('all time has no limits', () => {
    expect(periodRange('all', now, 1)).toEqual({ start: null, end: null });
  });

  it('a custom range includes the whole last day', () => {
    const r = periodRange('custom', now, 1, { name: 'Trading Akun FF', from: '2026-10-01', to: '2026-10-31' });
    expect(inRange(new Date(2026, 9, 31, 23, 59, 59), r)).toBe(true);
    expect(inRange(new Date(2026, 9, 1, 0, 0), r)).toBe(true);
    expect(inRange(new Date(2026, 10, 1, 0, 0), r)).toBe(false);
    expect(inRange(new Date(2026, 8, 30, 23, 59), r)).toBe(false);
  });
});

describe('custom periods', () => {
  it('validates the dates', () => {
    expect(customProblem({ name: '', from: '', to: '2026-10-31' })).toMatch(/mulai/);
    expect(customProblem({ name: '', from: '2026-10-01', to: '' })).toMatch(/akhir/);
    expect(customProblem({ name: '', from: '2026-11-01', to: '2026-10-31' })).toMatch(/tidak boleh/);
    expect(customProblem({ name: '', from: '2026-10-31', to: '2026-10-31' })).toBeNull();
    expect(customProblem({ name: 'x'.repeat(41), from: '2026-10-01', to: '2026-10-31' })).toMatch(/maksimal/);
  });

  it('rejects impossible dates', () => {
    expect(parseDay('2026-02-30')).toBeNull();
    expect(parseDay('26-1-1')).toBeNull();
    expect(parseDay('2026-02-28')).toEqual(new Date(2026, 1, 28));
  });

  it('names, labels and saved presets', () => {
    expect(normalizeCustom({ name: '  ', from: '2026-10-01', to: '2026-10-31' }).name).toBe('Periode khusus');
    expect(customLabel({ name: 'x', from: '2026-10-01', to: '2026-10-31' })).toMatch(/1 Okt 2026.*31 Okt 2026/);
    const a = { name: 'Trading Akun FF', from: '2026-10-01', to: '2026-10-31' };
    const list = addSaved(addSaved([], a), { ...a, name: 'trading akun ff', to: '2026-10-15' });
    expect(list).toHaveLength(1);
    expect(list[0].to).toBe('2026-10-15');
  });

  it('no stored presets (or no storage at all) means an empty list', () => {
    expect(loadSavedPeriods()).toEqual([]);
  });
});

describe('a period only filters', () => {
  const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min).toISOString();
  const sales = [
    { kind: 'SELL', occurred_at: at(2026, 9, 31, 23, 30), amount: 4_200_000, fee: 100_000, tax: 0, cost_allocated: 3_610_000, cost_known: true },
    { kind: 'SELL', occurred_at: at(2026, 8, 10), amount: 1_000_000, fee: 0, tax: 0, cost_allocated: 1_200_000, cost_known: true },
    { kind: 'SELL', occurred_at: at(2026, 9, 5), amount: 3_200_000, fee: 0, tax: 0, cost_allocated: 0, cost_known: false },
  ];

  it('sums realized P/L inside the range and leaves the events untouched', () => {
    const before = JSON.stringify(sales);
    const oct = periodRange('custom', now, 1, { name: 'Okt', from: '2026-10-01', to: '2026-10-31' });
    expect(salesIn(sales, oct)).toEqual({ realized: 490_000, sales: 2, unknownCost: 1 });
    expect(salesIn(sales, periodRange('all', now, 1))).toEqual({ realized: 290_000, sales: 3, unknownCost: 1 });
    expect(salesIn(sales, periodRange('prev_cycle', now, 1)).realized).toBe(-200_000);
    expect(JSON.stringify(sales)).toBe(before);
  });
});
