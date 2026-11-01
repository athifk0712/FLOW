import { formatRupiahRate, loadExchangeRates, parseRates, rateLine } from '@/lib/exchange-rates';

const reply = {
  result: 'success',
  time_last_update_unix: 1_793_491_351,
  rates: { USD: 1, IDR: 18_000, JPY: 150, VND: 25_000, SGD: 1.25 },
};

describe('exchange rates', () => {
  it('turns a USD-based reply into rupiah per unit', () => {
    const rates = parseRates(reply, 5)!;
    expect(rates.rupiah.USD).toBe(18_000);
    expect(rates.rupiah.SGD).toBe(14_400);
    expect(rates.rupiah.JPY).toBe(120);
    expect(rates.rupiah.IDR).toBe(1);
    expect(rates.updatedAt).toBe(1_793_491_351_000);
    expect(rates.fetchedAt).toBe(5);
  });

  it('rejects an unusable reply', () => {
    expect(parseRates(null, 0)).toBeNull();
    expect(parseRates({ result: 'error' }, 0)).toBeNull();
    expect(parseRates({ ...reply, rates: { USD: 1 } }, 0)).toBeNull();
  });

  it('writes rates so that each currency has its own number', () => {
    expect(formatRupiahRate(18_131.95)).toBe('Rp18.132');
    expect(formatRupiahRate(115.13)).toBe('Rp115');
    expect(formatRupiahRate(13.584)).toBe('Rp13,58');
    expect(formatRupiahRate(0.7029)).toBe('Rp0,70');
  });

  it('has no line for a currency without a rate', () => {
    const rates = parseRates(reply, 0);
    expect(rateLine('USD', rates)).toBe('1 USD ≈ Rp18.000');
    expect(rateLine('KWD', rates)).toBeNull();
    expect(rateLine('USD', null)).toBeNull();
  });

  describe('loading', () => {
    const store = new Map<string, string>();
    const realFetch = globalThis.fetch;

    beforeEach(() => {
      store.clear();
      (globalThis as any).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      };
    });

    afterEach(() => {
      globalThis.fetch = realFetch;
      delete (globalThis as any).localStorage;
    });

    it('fetches once, then uses the saved rates while they are fresh', async () => {
      const fetchMock = jest.fn(async () => ({ ok: true, json: async () => reply }));
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      expect((await loadExchangeRates(1000))?.rupiah.USD).toBe(18_000);
      expect((await loadExchangeRates(2000))?.fetchedAt).toBe(1000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('falls back to the last known rates when offline, and to nothing without any', async () => {
      globalThis.fetch = jest.fn(async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch;
      expect(await loadExchangeRates(1000)).toBeNull();
      store.set('flowku.exchangeRates', JSON.stringify(parseRates(reply, 0)));
      expect((await loadExchangeRates(24 * 60 * 60 * 1000))?.rupiah.USD).toBe(18_000);
    });
  });
});
