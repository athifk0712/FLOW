import { findCurrency } from '@/lib/currencies';
import { formatDigits, formatMoney, fromWhole, toDigits } from '@/lib/money';

const USD = findCurrency('USD');
const EUR = findCurrency('EUR');

describe('money', () => {
  it('formats rupiah with dot thousands and a leading minus', () => {
    expect(formatMoney(35000)).toBe('Rp35.000');
    expect(formatMoney(0)).toBe('Rp0');
    expect(formatMoney(-1250000)).toBe('-Rp1.250.000');
  });

  it('formats currencies with cents from minor units', () => {
    expect(formatMoney(125050, USD)).toBe('$1,250.50');
    expect(formatMoney(5, USD)).toBe('$0.05');
    expect(formatMoney(-100, USD)).toBe('-$1.00');
    expect(formatMoney(123456789, EUR)).toBe('€1.234.567,89');
  });

  it('formats typed digits for display', () => {
    expect(formatDigits('1200000')).toBe('1.200.000');
    expect(formatDigits('')).toBe('');
    expect(formatDigits('1200', USD)).toBe('12.00');
  });

  it('keeps only digits, drops leading zeros, and caps the length', () => {
    expect(toDigits('Rp 0012.500,-')).toBe('12500');
    expect(toDigits('000')).toBe('');
    expect(toDigits('1234567890123456')).toBe('123456789012');
    expect(toDigits('98765', 3)).toBe('987');
  });

  it('converts whole units to minor units', () => {
    expect(fromWhole(50)).toBe(50);
    expect(fromWhole(50, USD)).toBe(5000);
  });

  it('falls back to rupiah for an unknown code', () => {
    expect(findCurrency('XXX').code).toBe('IDR');
  });
});
