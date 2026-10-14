import { formatQuantity, netWorth, parseQuantity, plPercent, previewSale, realizedBetween, summarizeAssets } from '@/lib/assets';

describe('parseQuantity', () => {
  it('reads Indonesian and plain decimals', () => {
    expect(parseQuantity('2,5')).toBe(2.5);
    expect(parseQuantity('2.5')).toBe(2.5);
    expect(parseQuantity('0,0035')).toBe(0.0035);
    expect(parseQuantity('1.000,5')).toBe(1000.5);
    expect(parseQuantity(' 10 ')).toBe(10);
  });

  it('rejects zero, negatives, junk and too many decimals', () => {
    for (const bad of ['', '0', '-1', 'abc', '1,2,3', '0,123456789']) expect(parseQuantity(bad)).toBeNull();
  });
});

describe('formatQuantity', () => {
  it('formats with the unit', () => {
    expect(formatQuantity(0.0035, 'BTC')).toBe('0,0035 BTC');
    expect(formatQuantity(1000, 'lembar')).toBe('1.000 lembar');
    expect(formatQuantity(1)).toBe('1');
  });
});

describe('previewSale', () => {
  const ff = { held: 1, costBasis: 10_100_000, divisible: false };

  it('profit: Free Fire account bought for 10jt + 100rb fee, sold 15jt with 100rb fee', () => {
    expect(previewSale({ ...ff, quantity: 1, gross: 15_000_000, fee: 100_000, tax: 0 })).toEqual({
      net: 14_900_000,
      costOfSold: 10_100_000,
      realized: 4_800_000,
      problem: null,
    });
  });

  it('a loss is allowed and shown as negative', () => {
    const p = previewSale({ held: 1, costBasis: 10_000_000, divisible: false, quantity: 1, gross: 8_000_000, fee: 0, tax: 0 });
    expect(p.realized).toBe(-2_000_000);
    expect(p.problem).toBeNull();
  });

  it('partial sale uses the weighted average cost', () => {
    const p = previewSale({ held: 20, costBasis: 30_000_000, divisible: true, quantity: 5, gross: 10_000_000, fee: 50_000, tax: 10_000 });
    expect(p).toEqual({ net: 9_940_000, costOfSold: 7_500_000, realized: 2_440_000, problem: null });
  });

  it('selling everything takes all of the remaining cost (no rounding left behind)', () => {
    expect(previewSale({ held: 3, costBasis: 100, divisible: true, quantity: 3, gross: 0, fee: 0, tax: 0 }).costOfSold).toBe(100);
  });

  it('explains what is wrong', () => {
    expect(previewSale({ ...ff, quantity: 2, gross: 1, fee: 0, tax: 0 }).problem).toMatch(/melebihi/);
    expect(previewSale({ held: 2, costBasis: 1, divisible: false, quantity: 1, gross: 1, fee: 0, tax: 0 }).problem).toMatch(/utuh/);
    expect(previewSale({ ...ff, quantity: 1, gross: 100, fee: 200, tax: 0 }).problem).toMatch(/Biaya/);
    expect(previewSale({ ...ff, held: 0, quantity: 1, gross: 1, fee: 0, tax: 0 }).problem).toMatch(/terjual/);
  });
});

describe('summaries', () => {
  it('only active holdings count towards value', () => {
    const s = summarizeAssets([
      { status: 'ACTIVE', current_value: 15_000_000, cost_basis: 10_100_000, unrealized_pl: 4_900_000, realized_pl: 0 },
      { status: 'SOLD', current_value: 0, cost_basis: 0, unrealized_pl: 0, realized_pl: -2_000_000 },
    ]);
    expect(s).toEqual({ value: 15_000_000, cost: 10_100_000, unrealized: 4_900_000, realized: -2_000_000, active: 1 });
  });

  it('realized P/L in a period', () => {
    const events = [
      { kind: 'SELL', occurred_at: '2026-10-10T10:00:00Z', amount: 15_000_000, fee: 100_000, tax: 0, cost_allocated: 10_100_000 },
      { kind: 'SELL', occurred_at: '2026-09-10T10:00:00Z', amount: 1, fee: 0, tax: 0, cost_allocated: 0 },
      { kind: 'VALUATION', occurred_at: '2026-10-11T10:00:00Z', amount: null, fee: 0, tax: 0, cost_allocated: null },
    ];
    expect(realizedBetween(events, new Date('2026-10-01'), new Date('2026-11-01'))).toBe(4_800_000);
  });

  it('net worth: buying an asset with cash leaves it unchanged except for fees', () => {
    const before = netWorth({ cash: 20_000_000, assets: 0, receivables: 0, debts: 0 });
    const after = netWorth({ cash: 9_900_000, assets: 10_000_000, receivables: 0, debts: 0 });
    expect(before.total - after.total).toBe(100_000);
    expect(netWorth({ cash: 1, assets: 2, receivables: 3, debts: 4 }).total).toBe(2);
  });

  it('percent', () => {
    expect(plPercent(5_000_000, 10_000_000)).toBe(50);
    expect(plPercent(1, 0)).toBeNull();
  });
});
