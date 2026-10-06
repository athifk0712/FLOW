// Flowku's AI companion. Two modes: "chat" (the companion on Beranda: answers whatever the user asks about their
// money, e.g. finding which category an expense went to, and moves it when asked) and "check" (the daily
// "Cek harian" that labels today's expenses). Each call gets the transcript so far, re-reads the user's data (as the
// calling user, so RLS applies), and returns the next turn: a message, a few tap-to-answer options, and any
// necessity labels or category moves the user has confirmed, which are saved.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { type GeminiContent, GeminiError, generateJson } from '../_shared/gemini.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NECESSITY = ['NEED', 'IMPORTANT', 'WANT', 'IMPULSE'] as const;
type Necessity = (typeof NECESSITY)[number];

const TURN_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string', description: 'What Flowku says now, in casual, friendly Indonesian. Usually 1-3 short sentences.' },
    options: {
      type: 'array',
      items: { type: 'string' },
      description: '2-4 short tap-to-answer replies (max ~4 words each) for the question you just asked. [] when done.',
    },
    category_changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          transaction_id: { type: 'string' },
          category_id: { type: 'string' },
        },
        required: ['transaction_id', 'category_id'],
        additionalProperties: false,
      },
      description: 'Category moves the user has just asked for or agreed to in their latest answer. [] if none.',
    },
    tags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          transaction_id: { type: 'string' },
          necessity: { type: 'string', enum: [...NECESSITY] },
        },
        required: ['transaction_id', 'necessity'],
        additionalProperties: false,
      },
      description: 'Necessity labels the user has just made clear in their latest answer. [] if none.',
    },
    done: { type: 'boolean', description: 'true only on the closing turn' },
    summary: {
      type: 'string',
      description: 'On the closing turn: 1-3 sentences for the record (what happened today, one tip). Otherwise "".',
    },
  },
  required: ['message', 'options', 'category_changes', 'tags', 'done', 'summary'],
  additionalProperties: false,
};

type Turn = {
  message: string;
  options: string[];
  category_changes: { transaction_id: string; category_id: string }[];
  tags: { transaction_id: string; necessity: Necessity }[];
  done: boolean;
  summary: string;
};
type ChatMessage = { role: 'user' | 'assistant'; text: string };

const ZERO_DECIMAL = new Set(['IDR', 'JPY', 'KRW', 'VND']);

const PERSONA = `You are Flowku, the friendly companion inside a personal-finance app used mostly in Indonesia. You
talk like a warm, relaxed friend who is good with money: casual Indonesian ("kamu", "aku"), natural and a bit playful,
never stiff or robotic, never preachy. Call the user by their name now and then if you know it.

Ground rules:
- Answer what the user actually asks first. Follow their lead; don't steer every reply back to labeling.
- Only use amounts and facts from the data you are given; quote amounts exactly as given in amount_text. If something
  isn't in the data, say so honestly instead of guessing.
- You can see the user's categories (with ids) and their recent transactions with their category. Use them to help:
  e.g. if the user forgot where they put an expense, find the matching transaction(s) by amount, date, merchant or
  note and tell them which category it is in.
- When the user asks to move an expense to another category (or clearly agrees when you suggest it), put it in
  "category_changes" with the exact transaction_id and category_id from the data, and confirm it in your message.
  If the right category doesn't exist yet, suggest they create it in Catat > "Kategori baru" (you can't create one).
  If it is ambiguous which transaction they mean, ask a short question with tap options instead of guessing.
- Necessity labels: NEED (kebutuhan pokok), IMPORTANT (penting tapi bisa ditunda), WANT (keinginan), IMPULSE
  (impulsif). Show them in Indonesian only: "Butuh", "Penting", "Ingin", "Impulsif". Put a label in "tags" only when
  the user's latest answer makes it clear, with the exact transaction ids given.
- Keep messages short: usually 1-3 sentences. Use options for easy tap replies (2-4, max ~4 words each), or [] when a
  free answer fits better.
- This is not professional financial advice; don't recommend specific investments or loans. If the user wants to
  stop, close warmly right away.`;

const MODE_RULES = {
  chat: `Mode: chat (the user tapped you on the home screen). Open with one short, friendly line that fits the time
of day and maybe one interesting thing from their data; then just help with whatever they bring up. If there are
unlabeled expenses you may mention it once, lightly, as an offer — never push. Keep done=false while chatting; set
done=true (options=[], a 1-2 sentence summary) only when the user says goodbye or wants to stop.`,
  check: `Mode: daily check ("Cek harian"). Help the user label today's unlabeled expenses, grouping small similar ones
into one question. For a WANT or IMPULSE you may ask at most one light question about what triggered it (with tap
options). If the user asks something else along the way (like where an expense went), help with that first, then
continue. Close with one short takeaway grounded in their numbers and one small thing to try tomorrow. Aim to finish
within about 2-6 of your turns. If there is nothing to label, say so in one friendly line and close right away.
Set done=true only on the closing turn, with options=[] and a summary.`,
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'AI belum aktif: GEMINI_API_KEY belum diisi di Supabase.' }, 503);

  const body = await req.json().catch(() => ({}));
  const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
  const mode: keyof typeof MODE_RULES = body.mode === 'chat' ? 'chat' : 'check';
  const userName = typeof body.user_name === 'string' ? body.user_name.slice(0, 40) : null;
  const dayStart = new Date(body.day_start);
  const dayEnd = new Date(body.day_end);
  if (isNaN(dayStart.getTime()) || isNaN(dayEnd.getTime())) return json({ error: 'day_start dan day_end wajib diisi.' }, 400);
  if (messages.length > 40) return json({ error: 'Obrolan terlalu panjang.' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const weekAgo = new Date(dayStart.getTime() - 7 * 86_400_000).toISOString();
  const monthAgo = new Date(dayStart.getTime() - 35 * 86_400_000).toISOString();
  const [profile, today, older, budgets, history, categories, recent] = await Promise.all([
    supabase.from('profiles').select('currency, cycle_start_day').maybeSingle(),
    supabase
      .from('transactions')
      .select('id, type, amount, occurred_at, merchant, description, necessity, categories(name)')
      .gte('occurred_at', dayStart.toISOString())
      .lt('occurred_at', dayEnd.toISOString())
      .order('occurred_at'),
    supabase
      .from('transactions')
      .select('id, amount, occurred_at, merchant, categories(name)')
      .eq('needs_review', true)
      .gte('occurred_at', weekAgo)
      .lt('occurred_at', dayStart.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(15),
    supabase.from('v_budget_remaining').select('scope, period, limit_amount, remaining, categories(name)'),
    supabase.from('coach_sessions').select('day, summary').not('summary', 'is', null).order('day', { ascending: false }).limit(3),
    supabase.from('categories').select('id, name, kind'),
    supabase
      .from('transactions')
      .select('id, type, amount, occurred_at, merchant, description, category_id')
      .in('type', ['EXPENSE', 'INCOME'])
      .gte('occurred_at', monthAgo)
      .lt('occurred_at', dayEnd.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(80),
  ]);
  const failed = profile.error ?? today.error ?? older.error ?? budgets.error ?? categories.error ?? recent.error;
  if (failed) return json({ error: failed.message }, 500);

  const currency = profile.data?.currency ?? 'IDR';
  // Same rule as the app (lib/currencies.ts): these are stored as whole units, everything else in cents.
  const decimals = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const money = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const amountText = (minor: number) => money.format(minor / 10 ** decimals);
  const clock = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: body.time_zone || 'Asia/Jakarta' });

  const todayRows = (today.data ?? []).map((t) => ({
    id: t.id,
    type: t.type,
    amount_text: amountText(t.amount),
    time: clock.format(new Date(t.occurred_at)),
    what: t.merchant ?? (t.categories as { name: string } | null)?.name ?? null,
    note: t.description,
    necessity: t.necessity ?? (t.type === 'EXPENSE' ? 'UNLABELED' : null),
  }));
  const olderRows = (older.data ?? []).map((t) => ({
    id: t.id,
    amount_text: amountText(t.amount),
    date: t.occurred_at.slice(0, 10),
    what: t.merchant ?? (t.categories as { name: string } | null)?.name ?? null,
  }));
  const budgetRows = (budgets.data ?? []).map((b) => ({
    scope: b.scope,
    category: (b.categories as { name: string } | null)?.name ?? null,
    period: b.period,
    limit_text: amountText(b.limit_amount ?? 0),
    remaining_text: amountText(b.remaining ?? 0),
  }));

  const categoryRows = categories.data ?? [];
  const categoryName = new Map(categoryRows.map((c) => [c.id, c.name]));
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: body.time_zone || 'Asia/Jakarta' });
  const recentRows = (recent.data ?? []).map((t) => ({
    id: t.id,
    type: t.type,
    amount_text: amountText(t.amount),
    date: day.format(new Date(t.occurred_at)),
    time: clock.format(new Date(t.occurred_at)),
    category: t.category_id ? (categoryName.get(t.category_id) ?? null) : null,
    merchant: t.merchant,
    note: t.description,
  }));

  // The data block comes first and stays identical for the whole conversation.
  const context = JSON.stringify({
    user_name: userName,
    now_local: `${day.format(new Date())} ${clock.format(new Date())}`,
    currency,
    categories: categoryRows,
    recent_transactions_last_35_days: recentRows,
    today_transactions: todayRows,
    unlabeled_from_last_7_days: olderRows,
    budgets_this_period: budgetRows,
    safe_to_spend_today_text: typeof body.safe_daily === 'number' ? amountText(body.safe_daily) : null,
    previous_chat_summaries: history.data ?? [],
  });
  const recentIds = new Set((recent.data ?? []).map((t) => t.id));
  const allowedIds = new Set([
    ...(today.data ?? []).filter((t) => t.type === 'EXPENSE').map((t) => t.id),
    ...(older.data ?? []).map((t) => t.id),
  ]);

  const contents: GeminiContent[] = [
    {
      role: 'user',
      parts: [
        { text: `User data (JSON):\n${context}` },
        { text: mode === 'chat' ? 'Pengguna baru saja membuka obrolan.' : 'Mulai cek harian.' },
      ],
    },
    ...messages.map((m): GeminiContent => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.text).slice(0, 2000) }],
    })),
  ];
  if (contents[contents.length - 1].role !== 'user') return json({ error: 'Pesan terakhir harus dari pengguna.' }, 400);

  let turn: Turn;
  try {
    turn = await generateJson<Turn>({ apiKey, system: `${PERSONA}\n\n${MODE_RULES[mode]}`, contents, schema: TURN_SCHEMA });
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    if (error.status === 422) {
      return json({ message: 'Maaf, aku tidak bisa membahas itu. Ada hal lain soal uangmu yang bisa aku bantu?', options: [], category_changes: [], tags: [], done: false, summary: '' });
    }
    return json({ error: error.message }, error.status);
  }

  // Only label expenses that were in the data, with a valid label; RLS keeps it to the user's own rows anyway.
  const tags = (turn.tags ?? []).filter((t) => allowedIds.has(t.transaction_id) && NECESSITY.includes(t.necessity));
  for (const t of tags) {
    await supabase.from('transactions').update({ necessity: t.necessity }).eq('id', t.transaction_id).eq('type', 'EXPENSE');
  }

  // Category moves: only transactions from the data, into a category of the same kind.
  const kindOf = new Map(categoryRows.map((c) => [c.id, c.kind]));
  const typeOf = new Map((recent.data ?? []).map((t) => [t.id, t.type]));
  const moves = (turn.category_changes ?? []).filter(
    (c) => recentIds.has(c.transaction_id) && kindOf.get(c.category_id) === typeOf.get(c.transaction_id),
  );
  for (const c of moves) {
    await supabase.from('transactions').update({ category_id: c.category_id }).eq('id', c.transaction_id);
  }

  return json({ ...turn, options: (turn.options ?? []).slice(0, 4), category_changes: moves, tags });
});
