// Currencies the user can keep their books in. Amounts are stored as integers in the currency's
// smallest unit: whole rupiah for IDR (0 decimals), cents for USD (2 decimals).
export type Currency = {
  code: string;
  name: string;
  symbol: string;
  decimals: 0 | 2;
  /** dot: 1.250.000,50 · comma: 1,250,000.50 · space: 1 250 000,50 */
  grouping: 'dot' | 'comma' | 'space';
};

export const DEFAULT_CURRENCY_CODE = 'IDR';

export const CURRENCIES: Currency[] = [
  { code: 'IDR', name: 'Rupiah Indonesia', symbol: 'Rp', decimals: 0, grouping: 'dot' },
  { code: 'USD', name: 'Dolar Amerika', symbol: '$', decimals: 2, grouping: 'comma' },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, grouping: 'dot' },
  { code: 'SGD', name: 'Dolar Singapura', symbol: 'S$', decimals: 2, grouping: 'comma' },
  { code: 'MYR', name: 'Ringgit Malaysia', symbol: 'RM', decimals: 2, grouping: 'comma' },
  { code: 'JPY', name: 'Yen Jepang', symbol: '¥', decimals: 0, grouping: 'comma' },
  { code: 'KRW', name: 'Won Korea Selatan', symbol: '₩', decimals: 0, grouping: 'comma' },
  { code: 'CNY', name: 'Yuan Tiongkok', symbol: 'CN¥', decimals: 2, grouping: 'comma' },
  { code: 'SAR', name: 'Riyal Arab Saudi', symbol: 'SAR ', decimals: 2, grouping: 'comma' },
  { code: 'AED', name: 'Dirham Uni Emirat Arab', symbol: 'AED ', decimals: 2, grouping: 'comma' },
  { code: 'AUD', name: 'Dolar Australia', symbol: 'A$', decimals: 2, grouping: 'comma' },
  { code: 'GBP', name: 'Pound Sterling Inggris', symbol: '£', decimals: 2, grouping: 'comma' },
  { code: 'THB', name: 'Baht Thailand', symbol: '฿', decimals: 2, grouping: 'comma' },
  { code: 'PHP', name: 'Peso Filipina', symbol: '₱', decimals: 2, grouping: 'comma' },
  { code: 'VND', name: 'Dong Vietnam', symbol: '₫', decimals: 0, grouping: 'dot' },
  { code: 'BND', name: 'Dolar Brunei', symbol: 'B$', decimals: 2, grouping: 'comma' },
  { code: 'HKD', name: 'Dolar Hong Kong', symbol: 'HK$', decimals: 2, grouping: 'comma' },
  { code: 'TWD', name: 'Dolar Taiwan', symbol: 'NT$', decimals: 2, grouping: 'comma' },
  { code: 'INR', name: 'Rupee India', symbol: '₹', decimals: 2, grouping: 'comma' },
  { code: 'PKR', name: 'Rupee Pakistan', symbol: 'Rs', decimals: 2, grouping: 'comma' },
  { code: 'BDT', name: 'Taka Bangladesh', symbol: '৳', decimals: 2, grouping: 'comma' },
  { code: 'NZD', name: 'Dolar Selandia Baru', symbol: 'NZ$', decimals: 2, grouping: 'comma' },
  { code: 'CAD', name: 'Dolar Kanada', symbol: 'C$', decimals: 2, grouping: 'comma' },
  { code: 'CHF', name: 'Franc Swiss', symbol: 'CHF ', decimals: 2, grouping: 'space' },
  { code: 'SEK', name: 'Krona Swedia', symbol: 'kr ', decimals: 2, grouping: 'space' },
  { code: 'NOK', name: 'Krone Norwegia', symbol: 'kr ', decimals: 2, grouping: 'space' },
  { code: 'DKK', name: 'Krone Denmark', symbol: 'kr ', decimals: 2, grouping: 'dot' },
  { code: 'TRY', name: 'Lira Turki', symbol: '₺', decimals: 2, grouping: 'dot' },
  { code: 'EGP', name: 'Pound Mesir', symbol: 'E£', decimals: 2, grouping: 'comma' },
  { code: 'QAR', name: 'Riyal Qatar', symbol: 'QAR ', decimals: 2, grouping: 'comma' },
  { code: 'KWD', name: 'Dinar Kuwait', symbol: 'KWD ', decimals: 2, grouping: 'comma' },
  { code: 'ZAR', name: 'Rand Afrika Selatan', symbol: 'R', decimals: 2, grouping: 'comma' },
  { code: 'BRL', name: 'Real Brasil', symbol: 'R$', decimals: 2, grouping: 'dot' },
  { code: 'MXN', name: 'Peso Meksiko', symbol: 'MX$', decimals: 2, grouping: 'comma' },
  { code: 'RUB', name: 'Rubel Rusia', symbol: '₽', decimals: 2, grouping: 'space' },
];

export function findCurrency(code: string | null | undefined): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

/** Case-insensitive match on code, name, or symbol: "dolar", "usd", "$". */
export function searchCurrencies(query: string): Currency[] {
  const q = query.trim().toLowerCase();
  if (!q) return CURRENCIES;
  return CURRENCIES.filter(
    (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.symbol.trim().toLowerCase() === q,
  );
}
