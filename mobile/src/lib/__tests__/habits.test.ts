import { computeHabits, type HabitInput, type HabitTransaction } from '@/lib/habits';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const now = new Date(2026, 9, 7, 20); // Wednesday 7 Oct 2026, 20:00

function on(daysAgo: number, extra: Partial<HabitTransaction> = {}): HabitTransaction {
  return {
    occurred_at: new Date(2026, 9, 7 - daysAgo, 12).toISOString(),
    type: 'EXPENSE',
    necessity: 'NEED',
    ...extra,
  };
}

const input = (transactions: HabitTransaction[], extra: Partial<HabitInput> = {}): HabitInput => ({
  transactions,
  chatCount: 0,
  goalReached: false,
  ...extra,
});

const done = (h: ReturnType<typeof computeHabits>) => h.milestones.filter((m) => m.done).map((m) => m.key);

describe('computeHabits', () => {
  it('starts empty', () => {
    const h = computeHabits(input([]), now);
    expect(h).toMatchObject({ streak: 0, loggedToday: false, reviewedShare: null });
    expect(h.lastSeven).toEqual(Array(7).fill(false));
    expect(done(h)).toEqual([]);
  });

  it('counts the streak through today', () => {
    const h = computeHabits(input([on(0), on(1), on(2), on(4)]), now);
    expect(h.streak).toBe(3);
    expect(h.loggedToday).toBe(true);
    expect(h.lastSeven).toEqual([false, false, true, false, true, true, true]);
  });

  it('keeps yesterday’s streak alive while today is still empty', () => {
    const h = computeHabits(input([on(1), on(2)]), now);
    expect(h.streak).toBe(2);
    expect(h.loggedToday).toBe(false);
  });

  it('breaks the streak after a missed day', () => {
    expect(computeHabits(input([on(2), on(3)]), now).streak).toBe(0);
  });

  it('shares judged expenses over the last 7 days, ignoring income', () => {
    const h = computeHabits(
      input([
        on(0),
        on(1, { necessity: null }),
        on(2, { type: 'INCOME', necessity: null }),
        on(10, { necessity: null }),
      ]),
      now,
    );
    expect(h.reviewedShare).toBe(0.5);
  });

  it('awards a 7-day streak even when it is not the current one', () => {
    const week = Array.from({ length: 7 }, (_, i) => on(20 + i));
    expect(done(computeHabits(input(week), now))).toContain('streak-7');
  });

  it('awards a calm week only for the last full Monday–Sunday week without impulse buys', () => {
    // Last full week: Mon 28 Sep – Sun 4 Oct 2026, i.e. 9 to 3 days before now.
    const calm = [on(9), on(6), on(3)];
    expect(done(computeHabits(input(calm), now))).toContain('calm-week');
    expect(done(computeHabits(input([...calm, on(5, { necessity: 'IMPULSE' })]), now))).not.toContain('calm-week');
    // An impulse buy this week does not count against last week.
    expect(done(computeHabits(input([...calm, on(1, { necessity: 'IMPULSE' })]), now))).toContain('calm-week');
  });

  it('awards chat and goal milestones from their inputs', () => {
    const h = computeHabits(input([], { chatCount: 7, goalReached: true }), now);
    expect(done(h)).toEqual(['first-chat', 'chat-7', 'goal']);
  });
});
