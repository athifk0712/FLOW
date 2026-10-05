import { buildReport, monthRange, percentChange, type ReportTransaction } from '@/lib/report';

let id = 0;
function tx(month: number, day: number, extra: Partial<ReportTransaction>): ReportTransaction {
  return {
    id: String(++id),
    type: 'EXPENSE',
    amount: 0,
    necessity: null,
    merchant: null,
    occurred_at: new Date(2026, month, day, 12).toISOString(),
    category_id: null,
    categories: null,
    ...extra,
  };
}

const food = { category_id: 'food', categories: { name: 'Makan' } };
const fun = { category_id: 'fun', categories: { name: 'Hiburan' } };
const transport = { category_id: 'go', categories: { name: 'Transport' } };

describe('monthRange', () => {
  it('handles offsets across a year boundary', () => {
    expect(monthRange(new Date(2026, 0, 20), -1)).toEqual({ start: new Date(2025, 11, 1), end: new Date(2026, 0, 1) });
  });
});

describe('buildReport', () => {
  const rows = [
    tx(9, 2, { type: 'INCOME', amount: 5_000_000 }),
    tx(9, 3, { amount: 50_000, necessity: 'NEED', ...food }),
    tx(9, 4, { amount: 200_000, necessity: 'IMPULSE', ...fun }),
    tx(9, 5, { amount: 30_000, ...food }),
    tx(9, 6, { type: 'TRANSFER', amount: 1_000_000 }),
    tx(8, 10, { type: 'INCOME', amount: 4_000_000 }),
    tx(8, 11, { amount: 100_000, ...food }),
    tx(8, 12, { amount: 70_000, ...transport }),
  ];
  const report = buildReport(rows, new Date(2026, 9, 1));

  it('totals income and expense per month and ignores transfers', () => {
    expect(report).toMatchObject({
      income: 5_000_000,
      expense: 280_000,
      previousIncome: 4_000_000,
      previousExpense: 170_000,
    });
  });

  it('lists this month’s categories, largest first, with last month for comparison', () => {
    expect(report.categories).toEqual([
      { key: 'fun', name: 'Hiburan', total: 200_000, previous: 0 },
      { key: 'food', name: 'Makan', total: 80_000, previous: 100_000 },
    ]);
  });

  it('splits spending by necessity, unjudged as UNREVIEWED', () => {
    expect(report.mix).toHaveLength(3);
    expect(report.mix).toEqual(
      expect.arrayContaining([
        { necessity: 'NEED', total: 50_000 },
        { necessity: 'IMPULSE', total: 200_000 },
        { necessity: 'UNREVIEWED', total: 30_000 },
      ]),
    );
  });

  it('keeps the biggest expenses, at most five', () => {
    expect(report.biggest.map((t) => t.amount)).toEqual([200_000, 50_000, 30_000]);
  });
});

describe('percentChange', () => {
  it('rounds and signs the change', () => {
    expect(percentChange(112, 100)).toBe('+12%');
    expect(percentChange(92, 100)).toBe('-8%');
    expect(percentChange(100, 100)).toBe('0%');
  });

  it('is null without a previous amount', () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});
