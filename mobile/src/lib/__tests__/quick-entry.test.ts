import { appendThousands, digitsToAmount, dropLastDigit, MAX_AMOUNT_DIGITS } from '@/lib/amount-input';
import { rankCategories } from '@/lib/category-rank';
import { formatDigits } from '@/lib/money';
import { scanToDraft } from '@/lib/receipt-scan';

describe('amount keys', () => {
  it('50 then 000 is 50000, shown as 50.000', () => {
    const digits = appendThousands('50');
    expect(digits).toBe('50000');
    expect(digitsToAmount(digits)).toBe(50000);
    expect(formatDigits(digits)).toBe('50.000');
  });

  it('000 does nothing on an empty amount', () => {
    expect(appendThousands('')).toBe('');
  });

  it('000 never grows past the limit', () => {
    const long = '9'.repeat(MAX_AMOUNT_DIGITS - 2);
    expect(appendThousands(long)).toBe(long);
  });

  it('backspace drops one digit at a time', () => {
    expect(dropLastDigit('50000')).toBe('5000');
    expect(dropLastDigit('5')).toBe('');
    expect(dropLastDigit('')).toBe('');
  });

  it('stores integers, never negative', () => {
    expect(digitsToAmount('')).toBe(0);
    expect(digitsToAmount('0012')).toBe(12);
  });
});

describe('rankCategories', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  const cats = [
    { id: 'makan', name: 'Makan' },
    { id: 'lain', name: 'Lainnya' },
    { id: 'kopi', name: 'Kopi' },
    { id: 'bensin', name: 'Bensin' },
  ];
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

  it('puts the most used first and keeps unused in creation order', () => {
    const uses = [
      { category_id: 'kopi', occurred_at: daysAgo(1) },
      { category_id: 'kopi', occurred_at: daysAgo(2) },
      { category_id: 'bensin', occurred_at: daysAgo(1) },
    ];
    expect(rankCategories(cats, uses, now).map((c) => c.id)).toEqual(['kopi', 'bensin', 'makan', 'lain']);
  });

  it('recent use beats a lot of old use', () => {
    const uses = [
      ...Array.from({ length: 4 }, () => ({ category_id: 'makan', occurred_at: daysAgo(120) })),
      { category_id: 'bensin', occurred_at: daysAgo(0) },
    ];
    expect(rankCategories(cats, uses, now)[0].id).toBe('bensin');
  });

  it('keeps Lainnya last even when used most', () => {
    const uses = Array.from({ length: 5 }, () => ({ category_id: 'lain', occurred_at: daysAgo(0) }));
    expect(rankCategories(cats, uses, now).at(-1)?.id).toBe('lain');
  });

  it('ignores uses without a category', () => {
    expect(rankCategories(cats, [{ category_id: null, occurred_at: daysAgo(0) }], now).map((c) => c.id)).toEqual([
      'makan',
      'kopi',
      'bensin',
      'lain',
    ]);
  });
});

describe('scanToDraft', () => {
  const now = new Date(2026, 9, 14, 12, 0);
  const cats = [
    { id: 'm', name: 'Makan', kind: 'EXPENSE' },
    { id: 'g', name: 'Gaji', kind: 'INCOME' },
  ];
  const base = { is_receipt: true, merchant: '', total: 0, date: '', time: '', category: '' };

  it('fills only what was read', () => {
    const d = scanToDraft({ ...base, total: 45600 }, cats, now);
    expect(d).toEqual({ amount: 45600, merchant: null, occurredAt: null, categoryId: null, suggestedCategoryId: null });
  });

  it('sure category is selected, unsure is only suggested', () => {
    expect(scanToDraft({ ...base, category: 'Makan', category_confidence: 'high' }, cats, now).categoryId).toBe('m');
    const unsure = scanToDraft({ ...base, category: 'Makan', category_confidence: 'low' }, cats, now);
    expect(unsure.categoryId).toBeNull();
    expect(unsure.suggestedCategoryId).toBe('m');
  });

  it('never picks a category of the wrong kind or one the user does not have', () => {
    expect(scanToDraft({ ...base, category: 'Gaji', category_confidence: 'high' }, cats, now).categoryId).toBeNull();
    expect(scanToDraft({ ...base, category: 'Hiburan', category_confidence: 'high' }, cats, now).suggestedCategoryId).toBeNull();
  });

  it('reads date and time, ignores future dates', () => {
    expect(scanToDraft({ ...base, date: '2026-10-13', time: '19:05' }, cats, now).occurredAt).toEqual(new Date(2026, 9, 13, 19, 5));
    expect(scanToDraft({ ...base, date: '2026-12-01' }, cats, now).occurredAt).toBeNull();
  });

  it('a photo that is not a receipt fills nothing', () => {
    expect(scanToDraft({ ...base, is_receipt: false, total: 5000 }, cats, now).amount).toBeNull();
  });
});
