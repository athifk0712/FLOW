import { CURRENCIES, findCurrency, searchCurrencies } from '@/lib/currencies';
import { formatMoney, formatMoneyShort, formatSample } from '@/lib/money';

const c = (code: string) => findCurrency(code);

describe('currency formats (amounts in minor units)', () => {
  it('writes each currency its own way', () => {
    expect(formatMoney(125_000, c('IDR'))).toBe('Rp125.000');
    expect(formatMoney(12_500_000, c('USD'))).toBe('$125,000.00');
    expect(formatMoney(12_500_000, c('EUR'))).toBe('€125.000,00');
    expect(formatMoney(12_500_000, c('SGD'))).toBe('S$125,000.00');
    expect(formatMoney(12_500_000, c('MYR'))).toBe('RM125,000.00');
    expect(formatMoney(125_000, c('JPY'))).toBe('¥125,000');
    expect(formatMoney(125_000, c('KRW'))).toBe('₩125,000');
    expect(formatMoney(12_500_000, c('CNY'))).toBe('CN¥125,000.00');
    expect(formatMoney(12_500_000, c('SAR'))).toBe('SAR 125,000.00');
  });

  it('never writes a symbol twice', () => {
    for (const cur of CURRENCIES) {
      const text = formatMoney(12_345_678, cur);
      const symbol = cur.symbol.trim();
      expect(text.split(symbol).length - 1).toBe(1);
      expect(text.startsWith(cur.symbol)).toBe(true);
      // Nothing of the symbol is repeated right after it, e.g. "S$S1".
      expect(text.slice(cur.symbol.length)).toMatch(/^\d/);
    }
  });

  it('zero, negative, large and fractional amounts', () => {
    expect(formatMoney(0, c('USD'))).toBe('$0.00');
    expect(formatMoney(0, c('JPY'))).toBe('¥0');
    expect(formatMoney(-12_345, c('SGD'))).toBe('-S$123.45');
    expect(formatMoney(-125_000, c('IDR'))).toBe('-Rp125.000');
    expect(formatMoney(999_999_999_999, c('IDR'))).toBe('Rp999.999.999.999');
    expect(formatMoney(999_999_999_999, c('USD'))).toBe('$9,999,999,999.99');
    expect(formatMoney(1, c('EUR'))).toBe('€0,01');
    expect(formatMoney(5, c('MYR'))).toBe('RM0.05');
  });

  it('does not round a stored amount away (minor units are exact)', () => {
    for (const cur of CURRENCIES) {
      const digits = formatMoney(123_456_789, cur).replace(/\D/g, '');
      expect(digits).toBe('123456789');
    }
  });

  it('short form keeps the symbol once', () => {
    expect(formatMoneyShort(250_000_000, c('USD'))).toBe('$2.5 jt');
    expect(formatMoneyShort(1_250, c('SGD'))).toBe('S$12.50');
    expect(formatMoneyShort(250_000_000, c('EUR'))).toBe('€2,5 jt');
    expect(formatMoneyShort(2_500_000, c('IDR'))).toBe('Rp2,5 jt');
  });

  it('picker sample shows the format, not a conversion', () => {
    expect(formatSample(c('IDR'))).toBe('Rp1.234.567');
    expect(formatSample(c('USD'))).toBe('$1,234,567.89');
    expect(formatSample(c('EUR'))).toBe('€1.234.567,89');
    expect(formatSample(c('JPY'))).toBe('¥1,234,567');
  });

  it('finds currencies by name, code or symbol', () => {
    expect(searchCurrencies('singapura').map((x) => x.code)).toEqual(['SGD']);
    expect(searchCurrencies('myr')[0].code).toBe('MYR');
    expect(searchCurrencies('S$').map((x) => x.code)).toEqual(['SGD']);
  });
});

describe('switching the account currency', () => {
  it('keeps every stored number; only the way it is written changes', () => {
    const stored = [35_000, -1_250_000, 0];
    const before = stored.map((a) => formatMoney(a, c('IDR')));
    const after = stored.map((a) => formatMoney(a, c('USD')));
    expect(before).toEqual(['Rp35.000', '-Rp1.250.000', 'Rp0']);
    expect(after).toEqual(['$350.00', '-$12,500.00', '$0.00']);
    expect(stored).toEqual([35_000, -1_250_000, 0]);
  });
});
