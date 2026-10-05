import { activeFilterCount, EMPTY_FILTERS, logicFilter, periodRange } from '@/lib/history-filters';

const now = new Date(2026, 0, 15, 10); // 15 Jan 2026

describe('periodRange', () => {
  it('returns null for all time', () => {
    expect(periodRange('ALL', now)).toBeNull();
  });

  it('covers this month and last month, across a year boundary', () => {
    expect(periodRange('THIS_MONTH', now)).toEqual({ from: new Date(2026, 0, 1), to: new Date(2026, 1, 1) });
    expect(periodRange('LAST_MONTH', now)).toEqual({ from: new Date(2025, 11, 1), to: new Date(2026, 0, 1) });
  });

  it('counts today as one of the last 30 days', () => {
    expect(periodRange('LAST_30', now)).toEqual({ from: new Date(2025, 11, 17), to: null });
  });
});

describe('logicFilter', () => {
  it('is null without search or account', () => {
    expect(logicFilter(EMPTY_FILTERS, [])).toBeNull();
    expect(logicFilter({ ...EMPTY_FILTERS, search: '   ' }, ['c1'])).toBeNull();
  });

  it('searches merchant, note and matching categories', () => {
    expect(logicFilter({ ...EMPTY_FILTERS, search: ' kopi ' }, ['c1', 'c2'])).toBe(
      'and(or(merchant.ilike."*kopi*",description.ilike."*kopi*",category_id.in.(c1,c2)))',
    );
  });

  it('quotes user text so commas, parentheses and quotes cannot break the filter', () => {
    const pattern = String.raw`"*a,b) \"c\"\\*"`;
    expect(logicFilter({ ...EMPTY_FILTERS, search: String.raw`a,b) "c"\ ` }, [])).toBe(
      `and(or(merchant.ilike.${pattern},description.ilike.${pattern}))`,
    );
  });

  it('matches either side of a transfer for the account filter', () => {
    expect(logicFilter({ ...EMPTY_FILTERS, accountId: 'a1' }, [])).toBe(
      'and(or(from_account_id.eq.a1,to_account_id.eq.a1))',
    );
  });
});

describe('activeFilterCount', () => {
  it('counts category, account and period but not type or search', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, type: 'EXPENSE', search: 'x' })).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, categoryId: 'c', accountId: 'a', period: 'LAST_30' })).toBe(3);
  });
});
