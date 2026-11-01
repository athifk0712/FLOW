import {
  computeSafeToSpend,
  occurrences,
  reservedInPockets,
  type SafeInput,
  type SafeRule,
  spentFromAllowance,
} from '@/lib/safe-to-spend';

const now = new Date(2026, 9, 20, 10); // Tuesday 20 Oct 2026
const cycleEnd = new Date(2026, 10, 1); // 1 Nov -> 12 days left including today

const rule = (extra: Partial<SafeRule>): SafeRule => ({
  name: 'Kos',
  amount: 1_000_000,
  type: 'EXPENSE',
  active: true,
  next_due: '2026-10-25',
  day_of_month: 25,
  ...extra,
});

const input = (extra: Partial<SafeInput>): SafeInput => ({
  cash: 3_000_000,
  rules: [],
  debts: [],
  goalsSaved: 0,
  pocketsReserved: 0,
  essential: null,
  spentToday: 0,
  cycleEnd,
  ...extra,
});

describe('occurrences', () => {
  it('repeats monthly and clamps to short months', () => {
    const r = rule({ next_due: '2026-10-31', day_of_month: 31 });
    expect(occurrences(r, new Date(2027, 2, 1))).toEqual([
      new Date(2026, 9, 31),
      new Date(2026, 10, 30),
      new Date(2026, 11, 31),
      new Date(2027, 0, 31),
      new Date(2027, 1, 28),
    ]);
  });
});

describe('computeSafeToSpend', () => {
  it('is all cash when nothing is promised', () => {
    const s = computeSafeToSpend(input({}), now);
    expect(s).toMatchObject({ safe: 3_000_000, daysLeft: 12, dailyLimit: 250_000, leftToday: 250_000 });
  });

  it('subtracts bills due before the cycle ends, but not income or paused rules', () => {
    const s = computeSafeToSpend(
      input({
        rules: [
          rule({}),
          rule({ name: 'Gaji', type: 'INCOME', amount: 5_000_000 }),
          rule({ name: 'Gym', active: false }),
          rule({ name: 'Netflix', next_due: '2026-11-05', day_of_month: 5 }),
        ],
      }),
      now,
    );
    expect(s.bills).toEqual([{ name: 'Kos', amount: 1_000_000, date: new Date(2026, 9, 25) }]);
    expect(s.safe).toBe(2_000_000);
  });

  it('subtracts my debts due this cycle, including overdue ones', () => {
    const s = computeSafeToSpend(
      input({
        debts: [
          { direction: 'I_OWE', remaining: 300_000, due_date: '2026-10-28', settled: false },
          { direction: 'I_OWE', remaining: 100_000, due_date: '2026-10-01', settled: false },
          { direction: 'I_OWE', remaining: 999_000, due_date: '2026-12-01', settled: false },
          { direction: 'I_OWE', remaining: 999_000, due_date: null, settled: false },
          { direction: 'OWED_TO_ME', remaining: 999_000, due_date: '2026-10-28', settled: false },
        ],
      }),
      now,
    );
    expect(s.debtsDue).toBe(400_000);
  });

  it('reserves essentials: this week’s remainder plus the weekly rate after it', () => {
    // Tuesday: 6 days left this week (Tue–Sun), then 6 more days to 1 Nov.
    const s = computeSafeToSpend(input({ essential: { limit_amount: 700_000, remaining: 400_000 } }), now);
    expect(s.essentials).toBe(400_000 + 600_000);
    expect(s.hasEssentialBudget).toBe(true);
  });

  it('keeps the daily limit steady through the day', () => {
    const morning = computeSafeToSpend(input({}), now);
    const afterLunch = computeSafeToSpend(input({ cash: 2_900_000, spentToday: 100_000 }), now);
    expect(afterLunch.dailyLimit).toBe(morning.dailyLimit);
    expect(afterLunch.leftToday).toBe(150_000);
  });

  it('can go negative, with no daily allowance', () => {
    const s = computeSafeToSpend(input({ cash: 500_000, rules: [rule({})], goalsSaved: 200_000 }), now);
    expect(s.safe).toBe(-700_000);
    expect(s.dailyLimit).toBe(0);
  });

  it('takes reserved pockets off the safe amount, alongside goals', () => {
    const s = computeSafeToSpend(input({ pocketsReserved: 1_000_000, goalsSaved: 200_000 }), now);
    expect(s.safe).toBe(1_800_000);
    expect(s.pocketsReserved).toBe(1_000_000);
  });

  it('is not moved by spending out of a reserved pocket', () => {
    const morning = computeSafeToSpend(input({ pocketsReserved: 1_000_000 }), now);
    const spent = spentFromAllowance([{ amount: 500_000, pocket_id: 'tabungan' }], new Set(['tabungan']));
    const after = computeSafeToSpend(input({ cash: 2_500_000, pocketsReserved: 500_000, spentToday: spent }), now);
    expect(after.safe).toBe(morning.safe);
    expect(after.dailyLimit).toBe(morning.dailyLimit);
    expect(after.leftToday).toBe(morning.leftToday);
  });
});

describe('reservedInPockets', () => {
  const active = new Set<string | null>(['bca']);
  const pocket = (extra: object) => ({ account_id: 'bca', balance: 100_000, reserved: true, ...extra });

  it('counts only reserved pockets', () => {
    expect(reservedInPockets([pocket({}), pocket({ reserved: false, balance: 999_000 })], active)).toBe(100_000);
  });

  it('ignores pockets of accounts that are not in the cash', () => {
    expect(reservedInPockets([pocket({ account_id: 'arsip' })], active)).toBe(0);
  });

  it('does not let an overdrawn pocket cancel another', () => {
    expect(reservedInPockets([pocket({ balance: -50_000 }), pocket({})], active)).toBe(100_000);
  });
});

describe('spentFromAllowance', () => {
  it('counts everything except reserved pockets', () => {
    const rows = [
      { amount: 10_000, pocket_id: null },
      { amount: 20_000, pocket_id: 'jajan' },
      { amount: 40_000, pocket_id: 'tabungan' },
    ];
    expect(spentFromAllowance(rows, new Set(['tabungan']))).toBe(30_000);
  });
});
