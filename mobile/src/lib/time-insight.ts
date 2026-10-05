import type { Enums } from '@/lib/database.types';

// One sentence about *when* the user tends to spend on wants or impulses, shown only when the pattern
// clearly stands out from their spending overall (progressive disclosure: no pattern, no card).

export type InsightRow = { occurred_at: string; amount: number; necessity: Enums<'necessity_level'> | null };

export type TimeInsight = { headline: string; detail: string; tip: string };

const MIN_JUDGED = 10; // judged expenses before any pattern is believable
const MIN_SUBJECT = 5; // impulse (or want) purchases to look at
const MIN_SHARE = 0.35; // the slot holds at least this much of the subject spending...
const MIN_LIFT = 0.15; // ...and this much more than its share of all spending

type Slot = { key: string; phrase: string; tip: string; has: (d: Date) => boolean };

const SLOTS: Slot[] = [
  { key: 'morning', phrase: 'pagi hari (05.00–11.00)', tip: 'Pagi biasanya terburu-buru. Siapkan dulu yang rutin dari malam sebelumnya.', has: (d) => d.getHours() >= 5 && d.getHours() < 11 },
  { key: 'midday', phrase: 'siang hari (11.00–15.00)', tip: 'Jam istirahat sering jadi jam jajan. Bawa bekal atau tentukan batas makan siang.', has: (d) => d.getHours() >= 11 && d.getHours() < 15 },
  { key: 'afternoon', phrase: 'sore hari (15.00–18.00)', tip: 'Sore saat lelah, godaan lebih kuat. Tarik napas dulu sebelum checkout.', has: (d) => d.getHours() >= 15 && d.getHours() < 18 },
  { key: 'evening', phrase: 'malam hari (18.00–22.00)', tip: 'Malam hari, simpan dulu di keranjang dan putuskan besok pagi.', has: (d) => d.getHours() >= 18 && d.getHours() < 22 },
  { key: 'late', phrase: 'larut malam (22.00–05.00)', tip: 'Larut malam bukan waktu terbaik memutuskan. Tidur dulu, putuskan besok.', has: (d) => d.getHours() >= 22 || d.getHours() < 5 },
  { key: 'weekend', phrase: 'akhir pekan', tip: 'Rencanakan anggaran akhir pekan sejak Jumat supaya tidak kebablasan.', has: (d) => d.getDay() === 0 || d.getDay() === 6 },
];

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function computeTimeInsight(rows: InsightRow[]): TimeInsight | null {
  const judged = rows.filter((r) => r.necessity);
  if (judged.length < MIN_JUDGED) return null;

  const impulse = judged.filter((r) => r.necessity === 'IMPULSE');
  const wants = judged.filter((r) => r.necessity === 'IMPULSE' || r.necessity === 'WANT');
  const [subject, label] =
    impulse.length >= MIN_SUBJECT ? [impulse, 'belanja impulsifmu'] : wants.length >= MIN_SUBJECT ? [wants, 'belanja keinginanmu'] : [null, ''];
  if (!subject) return null;

  const total = (list: InsightRow[]) => list.reduce((s, r) => s + r.amount, 0);
  const subjectTotal = total(subject);
  const allTotal = total(judged);
  if (subjectTotal <= 0 || allTotal <= 0) return null;

  let best: { slot: Slot; share: number; base: number } | null = null;
  for (const slot of SLOTS) {
    const inSlot = (r: InsightRow) => slot.has(new Date(r.occurred_at));
    const share = total(subject.filter(inSlot)) / subjectTotal;
    const base = total(judged.filter(inSlot)) / allTotal;
    if (share < MIN_SHARE || share - base < MIN_LIFT) continue;
    if (!best || share - base > best.share - best.base) best = { slot, share, base };
  }
  if (!best) return null;

  return {
    headline: `${best.share >= 0.95 ? 'Hampir semua' : pct(best.share)} ${label} terjadi ${best.slot.phrase}.`,
    detail: `Padahal waktu itu hanya ${pct(best.base)} dari semua pengeluaran yang sudah kamu nilai.`,
    tip: best.slot.tip,
  };
}
