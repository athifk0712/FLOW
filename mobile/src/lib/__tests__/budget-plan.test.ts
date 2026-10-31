import { buildPlan, changedRows, saveAction } from '@/lib/budget-plan';

const cats = [
  { id: 'kopi', name: 'Kopi' },
  { id: 'makan', name: 'Makan' },
];
const stored = [
  { id: 'w', scope: 'DISCRETIONARY' as const, category_id: null, period: 'WEEKLY' as const, limit_amount: 100_000 },
  { id: 'c', scope: 'CATEGORY' as const, category_id: 'kopi', period: 'WEEKLY' as const, limit_amount: 50_000 },
];

describe('buildPlan', () => {
  it('always offers both weekly limits, filled in where they exist', () => {
    const { weekly } = buildPlan(cats, stored);
    expect(weekly.map((r) => [r.scope, r.digits])).toEqual([
      ['DISCRETIONARY', '100000'],
      ['ESSENTIAL', ''],
    ]);
    expect(weekly.every((r) => r.period === 'WEEKLY')).toBe(true);
  });

  it('gives every category a row, monthly unless it says otherwise', () => {
    const { perCategory } = buildPlan(cats, stored);
    expect(perCategory.map((r) => [r.name, r.digits, r.period])).toEqual([
      ['Kopi', '50000', 'WEEKLY'],
      ['Makan', '', 'MONTHLY'],
    ]);
  });
});

describe('saving', () => {
  const { weekly, perCategory } = buildPlan(cats, stored);
  const rows = [...weekly, ...perCategory];

  it('nothing changed, nothing to save', () => {
    expect(changedRows(rows)).toEqual([]);
  });

  it('finds changed amounts and periods', () => {
    const edited = rows.map((r) => (r.key === 'makan' ? { ...r, digits: '500' } : r.key === 'kopi' ? { ...r, period: 'MONTHLY' as const } : r));
    expect(changedRows(edited).map((r) => r.key)).toEqual(['kopi', 'makan']);
  });

  it('writes a limit, removes an emptied one, ignores an empty new one', () => {
    expect(saveAction({ ...perCategory[0], digits: '60000' })).toBe('update');
    expect(saveAction({ ...perCategory[0], digits: '' })).toBe('delete');
    expect(saveAction({ ...perCategory[1], digits: '1000' })).toBe('insert');
    expect(saveAction(perCategory[1])).toBe('none');
  });
});
