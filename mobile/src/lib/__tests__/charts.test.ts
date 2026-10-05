import { assignSlots, type ChartTransaction, compactAmount, monthlyFlow, monthSlices, niceMax } from '@/lib/charts';

const tx = (type: 'INCOME' | 'EXPENSE', amount: number, day: number, cat: string | null, month = 9): ChartTransaction => ({
  type,
  amount,
  occurred_at: new Date(2026, month, day, 12).toISOString(),
  category_id: cat,
  categories: cat ? { name: cat, icon: null } : null,
});

describe('charts', () => {
  const start = new Date(2026, 9, 1);
  const end = new Date(2026, 10, 1);

  it('gives color slots to the biggest categories over the whole window', () => {
    const rows = [tx('EXPENSE', 100, 1, 'a'), tx('EXPENSE', 300, 2, 'b'), tx('EXPENSE', 200, 3, 'a', 8)];
    expect([...assignSlots(rows, 'EXPENSE').entries()]).toEqual([
      ['a', 0],
      ['b', 1],
    ]);
  });

  it('folds categories without a slot into Lainnya and computes shares', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((c, i) => tx('EXPENSE', (7 - i) * 100, 5, c));
    const slots = assignSlots(rows, 'EXPENSE');
    const { total, slices } = monthSlices(rows, 'EXPENSE', start, end, slots);
    expect(total).toBe(2800);
    expect(slices).toHaveLength(6);
    expect(slices[5]).toMatchObject({ key: 'other', total: 300, slot: null });
    expect(slices.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
  });

  it('keeps a category color when it is small this month', () => {
    const rows = [tx('EXPENSE', 1000, 1, 'rent', 8), tx('EXPENSE', 10, 2, 'rent'), tx('EXPENSE', 500, 3, 'food')];
    const slots = assignSlots(rows, 'EXPENSE');
    const { slices } = monthSlices(rows, 'EXPENSE', start, end, slots);
    expect(slices.find((s) => s.key === 'rent')?.slot).toBe(0);
  });

  it('only counts the requested kind and month', () => {
    const rows = [tx('INCOME', 900, 1, 'gaji'), tx('EXPENSE', 50, 1, 'a', 8)];
    expect(monthSlices(rows, 'EXPENSE', start, end, assignSlots(rows, 'EXPENSE')).total).toBe(0);
  });

  it('sums money in and out per period', () => {
    const rows = [tx('INCOME', 500, 1, 'g', 8), tx('EXPENSE', 200, 9, 'a', 8), tx('EXPENSE', 70, 2, 'a'), tx('EXPENSE', 1, 1, 'a', 10)];
    const flows = monthlyFlow(rows, [new Date(2026, 8, 1), start], end);
    expect(flows.map((f) => [f.income, f.expense])).toEqual([
      [500, 200],
      [0, 70],
    ]);
  });

  it('rounds the axis up to a nice number', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(730_000)).toBe(1_000_000);
    expect(niceMax(1_800_000)).toBe(2_000_000);
    expect(niceMax(2_100_000)).toBe(2_500_000);
  });

  it('shortens axis labels', () => {
    expect(compactAmount(0)).toBe('0');
    expect(compactAmount(950_000)).toBe('950 rb');
    expect(compactAmount(1_250_000)).toBe('1,3 jt');
    expect(compactAmount(2_000_000_000)).toBe('2 M');
  });
});
