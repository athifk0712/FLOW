import { mainBalance, moveProblem, pocketActivity, pocketNameProblem } from '@/lib/pockets';

describe('mainBalance', () => {
  it('is what is left of the account after its pockets', () => {
    expect(mainBalance(1_000_000, [{ balance: 300_000 }, { balance: 200_000 }])).toBe(500_000);
  });

  it('is the whole balance without pockets', () => {
    expect(mainBalance(1_000_000, [])).toBe(1_000_000);
  });

  it('keeps the total right when a pocket is overdrawn', () => {
    expect(mainBalance(100_000, [{ balance: -50_000 }])).toBe(150_000);
  });

  it('can be negative when pockets hold more than the account', () => {
    expect(mainBalance(100_000, [{ balance: 150_000 }])).toBe(-50_000);
  });
});

describe('pocketNameProblem', () => {
  const others = [{ name: 'Jajan' }];

  it('accepts a new name', () => {
    expect(pocketNameProblem('Cicilan', others)).toBeNull();
  });

  it('refuses an empty name, Utama and a repeat in any case', () => {
    expect(pocketNameProblem('   ', others)).not.toBeNull();
    expect(pocketNameProblem('utama', others)).not.toBeNull();
    expect(pocketNameProblem(' JAJAN ', others)).not.toBeNull();
  });
});

describe('moveProblem', () => {
  it('needs two different places', () => {
    expect(moveProblem(null, null, 1000, 5000)).not.toBeNull();
    expect(moveProblem('a', 'a', 1000, 5000)).not.toBeNull();
  });

  it('allows up to what the source holds', () => {
    expect(moveProblem(null, 'a', 5000, 5000)).toBeNull();
    expect(moveProblem(null, 'a', 5001, 5000)).not.toBeNull();
  });

  it('refuses any amount from an overdrawn source', () => {
    expect(moveProblem('a', null, 1, -100)).not.toBeNull();
  });

  it('says nothing about the source before an amount is typed', () => {
    expect(moveProblem('a', null, 0, -100)).toBeNull();
  });
});

describe('pocketActivity', () => {
  const nameOf = (id: string | null) => (id === null ? 'Utama' : id === 'b' ? 'Tabungan' : 'Jajan');

  it('signs amounts from the pocket and sorts newest first', () => {
    const rows = pocketActivity(
      'a',
      [
        { id: 'm1', from_pocket_id: null, to_pocket_id: 'a', amount: 500, created_at: '2026-10-01T00:00:00Z' },
        { id: 'm2', from_pocket_id: 'a', to_pocket_id: 'b', amount: 100, created_at: '2026-10-03T00:00:00Z' },
      ],
      [{ id: 't1', type: 'EXPENSE', amount: 50, occurred_at: '2026-10-02T00:00:00Z', title: 'Kopi' }],
      nameOf,
    );
    expect(rows.map((r) => [r.title, r.amount])).toEqual([
      ['Ke Tabungan', -100],
      ['Kopi', -50],
      ['Dari Utama', 500],
    ]);
  });
});
