// Today's exchange rates against the rupiah, shown in the currency picker. Only for information: Flowku never converts
// saved amounts. These are mid-market estimates, not a bank's buy or sell price.

// A USD base keeps the precision: an IDR base rounds 1 rupiah in USD to six decimals, which moves the dollar by hundreds of rupiah.
const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_KEY = 'flowku.exchangeRates';
const FRESH_FOR = 12 * 60 * 60 * 1000;
const TIMEOUT = 8000;

export const RATES_ATTRIBUTION_URL = 'https://www.exchangerate-api.com';

export type ExchangeRates = {
  /** Rupiah for one unit of each currency. */
  rupiah: Record<string, number>;
  /** When the provider last updated them, in ms. */
  updatedAt: number;
  /** When this device fetched them, in ms. */
  fetchedAt: number;
};

/** The provider's reply -> rupiah per unit, or null when it isn't usable. */
export function parseRates(body: unknown, fetchedAt: number): ExchangeRates | null {
  const reply = body as { result?: string; time_last_update_unix?: number; rates?: Record<string, number> } | null;
  const perUsd = reply?.rates?.IDR;
  if (reply?.result !== 'success' || !reply.rates || !perUsd || !reply.time_last_update_unix) return null;
  const rupiah: Record<string, number> = {};
  for (const [code, rate] of Object.entries(reply.rates)) if (rate > 0) rupiah[code] = perUsd / rate;
  return { rupiah, updatedAt: reply.time_last_update_unix * 1000, fetchedAt };
}

/** 18131.95 -> "Rp18.132"; small rates keep their decimals, or the yen, won and dong would all look alike. */
export function formatRupiahRate(rupiah: number) {
  if (rupiah < 100) return `Rp${rupiah.toFixed(2).replace('.', ',')}`;
  return `Rp${String(Math.round(rupiah)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** "1 USD ≈ Rp18.132", or null when that currency's rate isn't known. */
export function rateLine(code: string, rates: ExchangeRates | null) {
  const rupiah = rates?.rupiah[code];
  return rupiah ? `1 ${code} ≈ ${formatRupiahRate(rupiah)}` : null;
}

function readCache(): ExchangeRates | null {
  try {
    const text = localStorage.getItem(CACHE_KEY);
    return text ? (JSON.parse(text) as ExchangeRates) : null;
  } catch {
    return null;
  }
}

/** Fetched at most twice a day. Offline, the last known rates still show, with their date. */
export async function loadExchangeRates(now = Date.now()): Promise<ExchangeRates | null> {
  const cached = readCache();
  if (cached && now - cached.fetchedAt < FRESH_FOR) return cached;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT);
  try {
    const response = await fetch(RATES_URL, { signal: abort.signal });
    const rates = response.ok ? parseRates(await response.json(), now) : null;
    if (!rates) return cached;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
    } catch {
      // Fetched again next time; harmless.
    }
    return rates;
  } catch {
    return cached;
  } finally {
    clearTimeout(timer);
  }
}
