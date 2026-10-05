import { type DueDebt, type DueRule, planDueReminders } from '@/lib/due-plan';

const now = new Date(2026, 9, 5, 10); // 5 Oct 2026, 10:00 (after today's 09.00)

const debt = (extra: Partial<DueDebt>): DueDebt => ({
  id: 'd1',
  person: 'Rina',
  direction: 'I_OWE',
  remaining: 250_000,
  due_date: '2026-10-10',
  settled: false,
  ...extra,
});

const rule = (extra: Partial<DueRule>): DueRule => ({
  id: 'r1',
  name: 'Kos',
  amount: 1_500_000,
  type: 'EXPENSE',
  active: true,
  next_due: '2026-10-25',
  ...extra,
});

describe('planDueReminders', () => {
  it('schedules debts and recurring expenses at 09.00 on their day, soonest first', () => {
    const plan = planDueReminders([debt({})], [rule({})], now);
    expect(plan.map((p) => [p.id, p.date])).toEqual([
      ['due-debt-d1', new Date(2026, 9, 10, 9)],
      ['due-rule-r1', new Date(2026, 9, 25, 9)],
    ]);
    expect(plan[0]).toMatchObject({ title: 'Utang jatuh tempo hari ini', body: 'Sisa Rp250.000 ke Rina.', url: '/debts' });
    expect(plan[1]).toMatchObject({ title: 'Hari ini: Kos', url: '/recurring' });
  });

  it('words receivables as a gentle nudge', () => {
    const [p] = planDueReminders([debt({ direction: 'OWED_TO_ME' })], [], now);
    expect(p.title).toBe('Piutang jatuh tempo hari ini');
    expect(p.body).toContain('Rina masih punya sisa Rp250.000');
  });

  it('skips settled, paid off, undated and past debts, including today after 09.00', () => {
    const plan = planDueReminders(
      [
        debt({ id: 'a', settled: true }),
        debt({ id: 'b', remaining: 0 }),
        debt({ id: 'c', due_date: null }),
        debt({ id: 'd', due_date: '2026-10-01' }),
        debt({ id: 'e', due_date: '2026-10-05' }),
        debt({ id: null }),
      ],
      [],
      now,
    );
    expect(plan).toEqual([]);
  });

  it('skips income rules, paused rules and anything beyond 60 days', () => {
    const plan = planDueReminders(
      [],
      [rule({ id: 'gaji', type: 'INCOME' }), rule({ id: 'off', active: false }), rule({ id: 'far', next_due: '2026-12-31' })],
      now,
    );
    expect(plan).toEqual([]);
  });

  it('caps the number of pending reminders', () => {
    const many = Array.from({ length: 40 }, (_, i) => rule({ id: String(i), next_due: '2026-10-20' }));
    expect(planDueReminders([], many, now)).toHaveLength(30);
  });
});
