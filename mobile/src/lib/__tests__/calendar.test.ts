import { dateKey, monthGrid, shortAmount, sumTotals, totalsByDay, totalsByMonth } from '@/lib/calendar';

describe('calendar', () => {
  it('lays out a month Monday-first with blanks around it', () => {
    // October 2026 starts on a Thursday and has 31 days.
    const weeks = monthGrid(new Date(2026, 9, 15));
    expect(weeks).toHaveLength(5);
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0][3]).toEqual(new Date(2026, 9, 1));
    expect(weeks[4][5]).toEqual(new Date(2026, 9, 31));
    expect(weeks[4][6]).toBeNull();
  });

  it('handles a month that starts on Monday and one that starts on Sunday', () => {
    expect(monthGrid(new Date(2026, 5, 1))[0][0]).toEqual(new Date(2026, 5, 1)); // June 2026: Monday
    expect(monthGrid(new Date(2026, 1, 1))[0][6]).toEqual(new Date(2026, 1, 1)); // February 2026: Sunday
  });

  it('sums income and spending per day and month, ignoring transfers', () => {
    const rows = [
      { type: 'EXPENSE', amount: 20_000, occurred_at: new Date(2026, 9, 5, 8).toISOString() },
      { type: 'EXPENSE', amount: 5_000, occurred_at: new Date(2026, 9, 5, 21).toISOString() },
      { type: 'INCOME', amount: 100_000, occurred_at: new Date(2026, 9, 6, 9).toISOString() },
      { type: 'TRANSFER', amount: 50_000, occurred_at: new Date(2026, 9, 6, 10).toISOString() },
    ];
    const byDay = totalsByDay(rows);
    expect(byDay.get(dateKey(new Date(2026, 9, 5)))).toEqual({ in: 0, out: 25_000 });
    expect(byDay.get(dateKey(new Date(2026, 9, 6)))).toEqual({ in: 100_000, out: 0 });
    expect(totalsByMonth(rows).get('2026-10')).toEqual({ in: 100_000, out: 25_000 });
    expect(sumTotals(byDay)).toEqual({ in: 100_000, out: 25_000 });
  });

  it('shortens amounts for small cells', () => {
    expect(shortAmount(-45_000)).toBe('−45rb');
    expect(shortAmount(1_250_000)).toBe('+1,3jt');
    expect(shortAmount(800)).toBe('+800');
    expect(shortAmount(-126_800)).toBe('−127rb');
    expect(shortAmount(-2_500)).toBe('−2,5rb');
  });
});
