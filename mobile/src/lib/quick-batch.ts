// "Catat cepat": several expenses typed as one line, e.g. "kopi 25rb, makan siang 30k bensin 50.000". Everything runs on
// the device, so it works offline and never waits for the AI. The user sees the result before anything is saved.

export type BatchEntry = { label: string; amount: number };
export type BatchCategory = { id: string; name: string };
export type BatchUse = { merchant: string | null; category_id: string | null };

// A number with an optional rp and rb/k/jt. "k" followed by a letter is the start of a word ("25 kopi"), not a thousand.
const AMOUNT = /(rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(ribu|rb|juta|jt|k)?(?![a-z0-9])/gi;
const MULTIPLIER: Record<string, number> = { ribu: 1_000, rb: 1_000, k: 1_000, juta: 1_000_000, jt: 1_000_000 };
const MAX_UNITS = 1_000_000_000_000;

// Everyday words that point at the categories every new user starts with.
const ALIASES: Record<string, string[]> = {
  makan: ['sarapan', 'nasi', 'ayam', 'bakso', 'soto', 'mie', 'warteg', 'padang', 'lunch', 'dinner', 'lauk', 'seblak'],
  kopi: ['coffee', 'latte', 'kopken', 'americano'],
  transport: ['bensin', 'grab', 'gojek', 'ojek', 'ojol', 'parkir', 'tol', 'krl', 'mrt', 'busway', 'angkot', 'taksi'],
  jajan: ['snack', 'cilok', 'boba', 'es', 'gorengan', 'cemilan', 'martabak', 'donat'],
  belanja: ['shopee', 'tokopedia', 'tokped', 'baju', 'sepatu', 'indomaret', 'alfamart', 'skincare', 'sabun'],
  tagihan: ['listrik', 'pulsa', 'wifi', 'internet', 'kuota', 'pdam', 'token', 'bpjs', 'kos', 'sewa'],
  kesehatan: ['obat', 'dokter', 'klinik', 'apotek', 'vitamin'],
  hiburan: ['netflix', 'spotify', 'bioskop', 'game', 'nonton', 'topup', 'karaoke'],
};

function clean(text: string) {
  return text.replace(/^[\s\-:=@+]+|[\s\-:=@+.]+$/g, '').replace(/\s+/g, ' ');
}

/** The written number in whole currency units: "25.000" -> 25000, "1,5" with a suffix -> 1.5, "12.50" in USD -> 12.5. */
function toUnits(raw: string, suffix: string | undefined, decimals: number) {
  if (suffix) return Number(raw.replace(/[.,](?=.*[.,])/g, '').replace(',', '.')) * MULTIPLIER[suffix.toLowerCase()];
  if (decimals > 0 && /[.,]\d{1,2}$/.test(raw)) return Number(raw.replace(/[.,](?=.*[.,])/g, '').replace(',', '.'));
  return Number(raw.replace(/[.,]/g, ''));
}

type Token = { start: number; end: number; units: number; strong: boolean };

function findAmounts(segment: string, decimals: number) {
  const tokens: Token[] = [];
  for (const m of segment.matchAll(AMOUNT)) {
    const start = m.index;
    // Part of a word such as "indomaret2".
    if (start > 0 && /[a-z0-9.,]/i.test(segment[start - 1])) continue;
    const units = toUnits(m[2], m[3], decimals);
    if (!(units > 0) || units > MAX_UNITS) continue;
    tokens.push({ start, end: start + m[0].length, units, strong: !!m[1] || !!m[3] || units >= 1000 });
  }
  return tokens;
}

function parseSegment(segment: string, decimals: number, scale: number): BatchEntry[] {
  const found = findAmounts(segment, decimals);
  // "2 ayam goreng 30rb": once a clear amount exists, a small bare number is part of the name.
  const tokens = found.some((t) => t.strong) ? found.filter((t) => t.strong) : found;
  if (tokens.length === 0) return [];

  // Writing "kopi 25" for 25 ribu is how people type in rupiah.
  const minor = (t: Token) => Math.round((!t.strong && decimals === 0 ? t.units * 1000 : t.units) * scale);

  if (tokens.length === 1) {
    const [t] = tokens;
    return [{ label: clean(`${segment.slice(0, t.start)} ${segment.slice(t.end)}`), amount: minor(t) }];
  }
  // Several amounts in one line: the name sits on the same side of each. Nothing before the first means it follows.
  const leading = clean(segment.slice(0, tokens[0].start)) !== '';
  return tokens.map((t, i) => {
    const label = leading
      ? segment.slice(i === 0 ? 0 : tokens[i - 1].end, t.start) + (i === tokens.length - 1 ? ` ${segment.slice(t.end)}` : '')
      : segment.slice(t.end, tokens[i + 1]?.start ?? segment.length);
    return { label: clean(label), amount: minor(t) };
  });
}

/** Entries found in the text, and the parts without any amount (shown so nothing silently disappears). */
export function parseBatch(text: string, decimals = 0) {
  const scale = 10 ** decimals;
  const entries: BatchEntry[] = [];
  const skipped: string[] = [];
  // A comma followed by a digit belongs to a number ("1,5jt").
  for (const part of text.split(/[\n;]+|,(?!\d)/)) {
    const segment = part.trim();
    if (!segment) continue;
    const found = parseSegment(segment, decimals, scale);
    if (found.length === 0) skipped.push(segment);
    else entries.push(...found);
  }
  return { entries, skipped };
}

function hasWord(text: string, word: string) {
  return ` ${text} `.includes(` ${word} `);
}

/** The label's category: what it was filed under before, its name, an everyday word for it, else "Lainnya". */
export function matchCategory<T extends BatchCategory>(label: string, categories: T[], history: BatchUse[] = []): T | null {
  const text = label.toLowerCase().trim();
  const byName = (name: string) => categories.find((c) => c.name.toLowerCase() === name);
  const other = byName('lainnya') ?? null;
  if (!text) return other;

  const used = history.find((h) => h.category_id && h.merchant?.toLowerCase().trim() === text);
  const before = categories.find((c) => c.id === used?.category_id);
  if (before) return before;

  const named = categories.find((c) => c.name.toLowerCase() !== 'lainnya' && hasWord(text, c.name.toLowerCase()));
  if (named) return named;

  for (const [name, words] of Object.entries(ALIASES)) {
    const category = byName(name);
    if (category && words.some((w) => hasWord(text, w))) return category;
  }
  return other;
}

/** The name kept on the transaction; empty when it would only repeat the category. */
export function batchTitle(label: string, categoryName: string | undefined) {
  const text = label.trim();
  if (!text || text.toLowerCase() === categoryName?.toLowerCase()) return null;
  return (text[0].toUpperCase() + text.slice(1)).slice(0, 100);
}
