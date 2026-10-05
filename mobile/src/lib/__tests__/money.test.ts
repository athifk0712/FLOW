import { currentMonthKey, formatDigits, formatRupiah, toDigits } from '@/lib/money';

describe('money', () => {
  it('formats rupiah with dot thousands and a leading minus', () => {
    expect(formatRupiah(35000)).toBe('Rp35.000');
    expect(formatRupiah(0)).toBe('Rp0');
    expect(formatRupiah(-1250000)).toBe('-Rp1.250.000');
  });

  it('formats typed digits for display', () => {
    expect(formatDigits('1200000')).toBe('1.200.000');
    expect(formatDigits('')).toBe('');
  });

  it('keeps only digits, drops leading zeros, and caps the length', () => {
    expect(toDigits('Rp 0012.500,-')).toBe('12500');
    expect(toDigits('000')).toBe('');
    expect(toDigits('1234567890123456')).toBe('123456789012');
    expect(toDigits('98765', 3)).toBe('987');
  });

  it('builds the month key in local time', () => {
    expect(currentMonthKey(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-01');
    expect(currentMonthKey(new Date(2026, 9, 5))).toBe('2026-10-01');
  });
});
