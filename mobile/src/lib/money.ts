import { useSyncExternalStore } from 'react';

import { type Currency, DEFAULT_CURRENCY_CODE, findCurrency } from '@/lib/currencies';

// The user's currency (profiles.currency), mirrored on the device so the first frame already formats
// correctly. Amounts are integers in the currency's smallest unit (whole rupiah, cents).

const STORAGE_KEY = 'flowku.currency';
const listeners = new Set<() => void>();

function readStored() {
  try {
    return findCurrency(localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CURRENCY_CODE);
  } catch {
    return findCurrency(DEFAULT_CURRENCY_CODE);
  }
}

// Read lazily: localStorage is installed by lib/appearance at startup, and is absent in unit tests.
let stored: Currency | null = null;

export function getCurrency(): Currency {
  stored ??= readStored();
  return stored;
}

/** Applies a currency on this device. Saving it to the profile is up to the caller. */
export function setCurrency(code: string) {
  const next = findCurrency(code);
  if (next.code === getCurrency().code) return;
  stored = next;
  try {
    localStorage.setItem(STORAGE_KEY, next.code);
  } catch {
    // Still applies for this session.
  }
  listeners.forEach((l) => l());
}

export function useCurrency() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getCurrency,
    getCurrency,
  );
}

const SEPARATORS = {
  dot: { group: '.', decimal: ',' },
  comma: { group: ',', decimal: '.' },
  space: { group: ' ', decimal: ',' },
} as const;

/** 1250050 (minor units) -> "1.250.050" for IDR, "12,500.50" for USD. No symbol, no sign. */
export function formatNumber(minor: number, currency: Currency = getCurrency()) {
  const { group, decimal } = SEPARATORS[currency.grouping];
  const abs = Math.abs(Math.round(minor));
  const scale = 10 ** currency.decimals;
  const whole = String(Math.floor(abs / scale)).replace(/\B(?=(\d{3})+(?!\d))/g, group);
  if (currency.decimals === 0) return whole;
  return `${whole}${decimal}${String(abs % scale).padStart(currency.decimals, '0')}`;
}

/** 35000 -> "Rp35.000"; 1250 in USD -> "$12.50". The symbol comes only from the currency, never twice. */
export function formatMoney(amount: number, currency: Currency = getCurrency()) {
  return `${amount < 0 ? '-' : ''}${currency.symbol}${formatNumber(amount, currency)}`;
}

/** Digits typed into an amount field -> "1.200.000" (IDR) or "12.00" (USD, typed as 1200). */
export function formatDigits(digits: string, currency: Currency = getCurrency()) {
  return digits ? formatNumber(Number(digits), currency) : '';
}

/** Any text typed into an amount field -> digits only, without leading zeros. */
export function toDigits(text: string, maxDigits = 12) {
  return text.replace(/\D/g, '').replace(/^0+/, '').slice(0, maxDigits);
}

/** Whole units -> stored minor units, for constants like suggested budgets. */
export function fromWhole(units: number, currency: Currency = getCurrency()) {
  return units * 10 ** currency.decimals;
}

/** Short form for tight spots: 37737435 -> "Rp37,7 jt", 950000 -> "Rp950 rb"; small amounts stay exact. */
export function formatMoneyShort(amount: number, currency: Currency = getCurrency()) {
  const units = Math.abs(amount) / 10 ** currency.decimals;
  if (units < 100_000) return formatMoney(amount, currency);
  const text = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(units);
  // id-ID writes "2,5 jt"; use the currency's own decimal mark ("$2.5 jt") so it matches its full amounts.
  const local = text.replace(/\s/g, ' ').replace(',', SEPARATORS[currency.grouping].decimal);
  return `${amount < 0 ? '-' : ''}${currency.symbol}${local}`;
}

/**
 * The same digits written the way `currency` writes them, to show its format in a picker: "Rp1.234.567",
 * "$1,234,567.89", "¥1,234,567". Only an illustration: equal digits across currencies are not equal amounts.
 */
export function formatSample(currency: Currency) {
  const minor = 1_234_567 * 10 ** currency.decimals + (currency.decimals > 0 ? 89 : 0);
  return formatMoney(minor, currency);
}
