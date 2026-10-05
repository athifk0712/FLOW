import type { Enums } from '@/lib/database.types';
import { formatMoney } from '@/lib/money';

// The nightly chat without AI: a fixed but branching script over today's expenses. Used when the AI
// coach is unavailable (no API key yet, offline), so the evening check-in always works.

export type Necessity = Enums<'necessity_level'>;

export type CoachExpense = {
  id: string;
  amount: number;
  occurred_at: string;
  merchant: string | null;
  category: string | null;
};

export type LocalTag = { transaction_id: string; necessity: Necessity; trigger?: string };

export type LocalState = {
  expenses: CoachExpense[];
  index: number;
  /** 'necessity' asks what the expense was; 'trigger' asks why, after a want or impulse. */
  step: 'opening' | 'necessity' | 'trigger' | 'mood' | 'done';
  tags: LocalTag[];
  mood?: string;
};

export type LocalTurn = { message: string; options: string[]; done: boolean; summary?: string };

const NECESSITY_OPTIONS: { label: string; value: Necessity }[] = [
  { label: 'Butuh banget', value: 'NEED' },
  { label: 'Penting', value: 'IMPORTANT' },
  { label: 'Ingin aja', value: 'WANT' },
  { label: 'Impulsif', value: 'IMPULSE' },
];

export const TRIGGERS = ['Lapar atau haus', 'Bosan atau stres', 'Lihat promo', 'Ikut teman', 'Sudah direncanakan'];

const TRIGGER_TIP: Record<string, string> = {
  'Lapar atau haus': 'Bawa bekal atau camilan kecil besok, supaya rasa lapar tidak yang memutuskan.',
  'Bosan atau stres': 'Kalau bosan atau penat, coba jeda 10 menit dulu (jalan sebentar, minum air) sebelum membuka aplikasi belanja.',
  'Lihat promo': 'Promo terasa hemat, tapi tetap uang keluar. Coba matikan notifikasi promo dari aplikasi belanja minggu ini.',
  'Ikut teman': 'Tidak apa-apa ikut teman. Lain kali, tentukan batas sebelum berangkat, misalnya satu minuman saja.',
  'Sudah direncanakan': 'Belanja yang direncanakan itu bagus. Pertahankan kebiasaan memutuskan dulu sebelum membeli.',
};

const MOODS = ['Tenang', 'Biasa saja', 'Agak menyesal', 'Khawatir soal uang'];

const time = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

function describe(e: CoachExpense) {
  const what = e.merchant ?? e.category ?? 'pengeluaran tanpa kategori';
  return `${what} ${formatMoney(e.amount)} (jam ${time.format(new Date(e.occurred_at))})`;
}

export function startLocal(expenses: CoachExpense[]): { state: LocalState; turn: LocalTurn } {
  const state: LocalState = { expenses, index: 0, step: 'opening', tags: [] };
  if (expenses.length === 0) {
    return {
      state,
      turn: {
        message: 'Malam! Hari ini belum ada pengeluaran yang tercatat. Benar tidak ada uang yang keluar?',
        options: ['Iya, hari ini aman', 'Ada, tapi lupa dicatat'],
        done: false,
      },
    };
  }
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  return {
    state: { ...state, step: 'necessity' },
    turn: {
      message:
        `Malam! Ada ${expenses.length} pengeluaran yang belum dibahas, totalnya ${formatMoney(total)}. ` +
        `Kita bahas satu per satu ya, santai saja.\n\nPertama: ${describe(expenses[0])}. Jujur, ini sebenarnya apa?`,
      options: NECESSITY_OPTIONS.map((o) => o.label),
      done: false,
    },
  };
}

function askNext(state: LocalState, prefix: string): { state: LocalState; turn: LocalTurn } {
  const next = state.index + 1;
  if (next < state.expenses.length) {
    return {
      state: { ...state, index: next, step: 'necessity' },
      turn: {
        message: `${prefix}Berikutnya: ${describe(state.expenses[next])}. Ini termasuk apa?`,
        options: NECESSITY_OPTIONS.map((o) => o.label),
        done: false,
      },
    };
  }
  return {
    state: { ...state, index: next, step: 'mood' },
    turn: {
      message: `${prefix}Sudah semua. Satu lagi: setelah melihat pengeluaran hari ini, perasaanmu bagaimana?`,
      options: MOODS,
      done: false,
    },
  };
}

/** Advances the script with the option the user tapped. */
export function answerLocal(state: LocalState, answer: string): { state: LocalState; turn: LocalTurn } {
  if (state.step === 'opening') {
    const forgot = answer.startsWith('Ada');
    return {
      state: { ...state, step: 'done' },
      turn: {
        message: forgot
          ? 'Tidak apa-apa, sering terjadi. Catat sekarang selagi masih ingat, nanti kita bahas besok malam.'
          : 'Hari tanpa pengeluaran itu kecil tapi berarti. Istirahat yang nyenyak!',
        options: [],
        done: true,
        summary: forgot ? 'Ada pengeluaran yang belum dicatat.' : 'Tidak ada pengeluaran hari ini.',
      },
    };
  }

  if (state.step === 'necessity') {
    const necessity = NECESSITY_OPTIONS.find((o) => o.label === answer)?.value;
    if (!necessity) return { state, turn: { message: 'Pilih salah satu ya.', options: NECESSITY_OPTIONS.map((o) => o.label), done: false } };
    const expense = state.expenses[state.index];
    const tags = [...state.tags, { transaction_id: expense.id, necessity }];
    if (necessity === 'WANT' || necessity === 'IMPULSE') {
      return {
        state: { ...state, tags, step: 'trigger' },
        turn: {
          message:
            necessity === 'IMPULSE'
              ? 'Makasih sudah jujur, itu langkah paling penting. Kira-kira apa yang bikin tiba-tiba beli?'
              : 'Oke, keinginan juga wajar. Apa yang mendorongmu membelinya?',
          options: TRIGGERS,
          done: false,
        },
      };
    }
    return askNext({ ...state, tags }, necessity === 'NEED' ? 'Sip, itu memang perlu. ' : 'Oke, tercatat penting. ');
  }

  if (state.step === 'trigger') {
    const tags = state.tags.map((t, i) => (i === state.tags.length - 1 ? { ...t, trigger: answer } : t));
    return askNext({ ...state, tags }, 'Tercatat. ');
  }

  if (state.step === 'mood') {
    const done = { ...state, mood: answer, step: 'done' as const };
    const summary = summarizeLocal(done);
    return { state: done, turn: { message: summary, options: [], done: true, summary } };
  }

  return { state, turn: { message: 'Obrolan malam ini sudah selesai.', options: [], done: true } };
}

/** The closing message: what was judged, how much went to wants, and one tip for the most common trigger. */
export function summarizeLocal(state: LocalState): string {
  const amountOf = (id: string) => state.expenses.find((e) => e.id === id)?.amount ?? 0;
  const wants = state.tags.filter((t) => t.necessity === 'WANT' || t.necessity === 'IMPULSE');
  const wantTotal = wants.reduce((s, t) => s + amountOf(t.transaction_id), 0);
  const total = state.expenses.reduce((s, e) => s + e.amount, 0);
  const counts = new Map<string, number>();
  for (const t of wants) if (t.trigger) counts.set(t.trigger, (counts.get(t.trigger) ?? 0) + 1);
  const topTrigger = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const lines = [
    wants.length === 0
      ? `Semua pengeluaran yang kita bahas (${formatMoney(total)}) untuk kebutuhan. Mantap!`
      : `Dari ${formatMoney(total)} yang kita bahas, ${formatMoney(wantTotal)} untuk keinginan (${Math.round((wantTotal / Math.max(total, 1)) * 100)}%).`,
  ];
  if (topTrigger) lines.push(`Tips untuk besok: ${TRIGGER_TIP[topTrigger] ?? ''}`);
  if (state.mood === 'Khawatir soal uang') lines.push('Kalau sedang khawatir, lihat kartu Aman dibelanjakan di Beranda: itu batas harian yang masih aman.');
  else if (state.mood === 'Agak menyesal') lines.push('Menyesal itu tanda kamu peduli. Besok kita coba lagi, pelan-pelan.');
  lines.push('Selamat istirahat!');
  return lines.join('\n\n');
}
