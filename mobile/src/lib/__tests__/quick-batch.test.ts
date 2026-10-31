import { batchTitle, matchCategory, parseBatch } from '@/lib/quick-batch';

describe('parseBatch', () => {
  const entries = (text: string, decimals = 0) => parseBatch(text, decimals).entries;

  it('reads a comma separated list with rb, k and plain thousands', () => {
    expect(entries('kopi 25rb, makan siang 30k, bensin 50.000')).toEqual([
      { label: 'kopi', amount: 25_000 },
      { label: 'makan siang', amount: 30_000 },
      { label: 'bensin', amount: 50_000 },
    ]);
  });

  it('reads one line without separators', () => {
    expect(entries('kopi 25rb makan 30rb bensin 50rb').map((e) => e.label)).toEqual(['kopi', 'makan', 'bensin']);
  });

  it('reads the amount in front of the name', () => {
    expect(entries('25rb kopi 30rb makan')).toEqual([
      { label: 'kopi', amount: 25_000 },
      { label: 'makan', amount: 30_000 },
    ]);
  });

  it('reads line breaks, semicolons and juta with a decimal comma', () => {
    expect(entries('sewa kos 1,5jt\nlistrik 200 ribu; pulsa rp 50.000')).toEqual([
      { label: 'sewa kos', amount: 1_500_000 },
      { label: 'listrik', amount: 200_000 },
      { label: 'pulsa', amount: 50_000 },
    ]);
  });

  it('treats a small bare number as thousands in rupiah', () => {
    expect(entries('kopi 25')).toEqual([{ label: 'kopi', amount: 25_000 }]);
  });

  it('keeps a small number in the name when a clear amount exists', () => {
    expect(entries('2 ayam goreng 30rb')).toEqual([{ label: '2 ayam goreng', amount: 30_000 }]);
  });

  it('does not take k from the start of a word', () => {
    expect(entries('25 kopi')).toEqual([{ label: 'kopi', amount: 25_000 }]);
  });

  it('ignores digits inside a word', () => {
    expect(entries('3in1 15rb')).toEqual([{ label: '3in1', amount: 15_000 }]);
  });

  it('uses the currency decimals', () => {
    expect(entries('coffee 4.50, lunch 12', 2)).toEqual([
      { label: 'coffee', amount: 450 },
      { label: 'lunch', amount: 1200 },
    ]);
  });

  it('reports parts without an amount instead of dropping them', () => {
    expect(parseBatch('kopi 25rb, makan')).toEqual({ entries: [{ label: 'kopi', amount: 25_000 }], skipped: ['makan'] });
  });

  it('nothing typed, nothing found', () => {
    expect(parseBatch('  ')).toEqual({ entries: [], skipped: [] });
  });
});

describe('matchCategory', () => {
  const cats = [
    { id: 'm', name: 'Makan' },
    { id: 'k', name: 'Kopi' },
    { id: 't', name: 'Transport' },
    { id: 'o', name: 'Lainnya' },
  ];

  it('matches the category name as a word', () => {
    expect(matchCategory('makan siang', cats)?.id).toBe('m');
    expect(matchCategory('kopiah', cats)?.id).toBe('o');
  });

  it('knows everyday words', () => {
    expect(matchCategory('bensin', cats)?.id).toBe('t');
    expect(matchCategory('nasi padang', cats)?.id).toBe('m');
  });

  it('what the user filed it under before wins', () => {
    expect(matchCategory('Bensin', cats, [{ merchant: 'bensin', category_id: 'k' }])?.id).toBe('k');
  });

  it('falls back to Lainnya, and to nothing when there is none', () => {
    expect(matchCategory('asdf', cats)?.id).toBe('o');
    expect(matchCategory('asdf', cats.slice(0, 3))).toBeNull();
  });
});

describe('batchTitle', () => {
  it('capitalises the name, and drops one that only repeats the category', () => {
    expect(batchTitle('makan siang', 'Makan')).toBe('Makan siang');
    expect(batchTitle('kopi', 'Kopi')).toBeNull();
    expect(batchTitle('', 'Kopi')).toBeNull();
  });
});
