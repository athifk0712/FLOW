// "Ngobrol malam": a short evening chat about the day's money with Gemini. Each call gets the transcript so
// far, re-reads the user's data (as the calling user, so RLS applies), and returns the coach's next turn:
// a message, a few tap-to-answer options, and any necessity tags the user has confirmed, which are saved.
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
    message: { type: 'string', description: 'What Flowku says now, in casual Indonesian. 1-4 short sentences.' },
    options: {
      type: 'array',
      items: { type: 'string' },
      description: '2-4 short tap-to-answer replies (max ~4 words each) for the question you just asked. [] when done.',
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
  required: ['message', 'options', 'tags', 'done', 'summary'],
  additionalProperties: false,
};

type Turn = { message: string; options: string[]; tags: { transaction_id: string; necessity: Necessity }[]; done: boolean; summary: string };
type ChatMessage = { role: 'user' | 'assistant'; text: string };

const ZERO_DECIMAL = new Set(['IDR', 'JPY', 'KRW', 'VND']);

const SYSTEM = `You are Flowku, a calm, warm money companion inside a personal-finance app used mostly in Indonesia.
Every evening you have a short chat with the user about the money that moved today. Your goals, in order:
1. Help the user label each of today's unlabeled expenses honestly: NEED (kebutuhan pokok), IMPORTANT (penting tapi
   bisa ditunda), WANT (keinginan), or IMPULSE (impulsif, tidak direncanakan).
2. Understand why: when something was a want or an impulse, ask one gentle follow-up about the trigger (lapar, bosan,
   stres, promo, ikut teman, ...) or the feeling, and branch from the answer.
3. Close with a short, specific takeaway grounded in their numbers (budget left, safe-to-spend, patterns) and one
   small, concrete thing to try tomorrow.

How to talk:
- Casual, kind Indonesian ("kamu"), never judgmental, never preachy. Short messages; this is a phone chat at night.
- Ask exactly one question per turn and give 2-4 short answer options that fit it. The user can also type freely.
- Group small similar expenses (e.g. several coffees) into one question instead of asking about each.
- Only use amounts and facts from the data you are given; quote amounts exactly as given in amount_text.
- Put a label in "tags" only when the user's latest answer makes it clear; use the exact transaction ids given.
- Aim to finish within about 4-8 of your turns. If there is nothing to discuss, ask how the day went money-wise and
  close warmly. Set done=true only on the closing turn, with options=[] and a summary.
- If the user wants to stop, close immediately and kindly.
- This is not professional financial advice; don't recommend specific investments or loans.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'AI belum aktif: GEMINI_API_KEY belum diisi di Supabase.' }, 503);

  const body = await req.json().catch(() => ({}));
  const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
  const dayStart = new Date(body.day_start);
  const dayEnd = new Date(body.day_end);
  if (isNaN(dayStart.getTime()) || isNaN(dayEnd.getTime())) return json({ error: 'day_start dan day_end wajib diisi.' }, 400);
  if (messages.length > 40) return json({ error: 'Obrolan terlalu panjang.' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const weekAgo = new Date(dayStart.getTime() - 7 * 86_400_000).toISOString();
  const [profile, today, older, budgets, history] = await Promise.all([
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
  ]);
  const failed = profile.error ?? today.error ?? older.error ?? budgets.error;
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

  // The data block comes first and stays identical for the whole chat.
  const context = JSON.stringify({
    currency,
    today_transactions: todayRows,
    unlabeled_from_last_7_days: olderRows,
    budgets_this_period: budgetRows,
    safe_to_spend_today_text: typeof body.safe_daily === 'number' ? amountText(body.safe_daily) : null,
    previous_chat_summaries: history.data ?? [],
  });
  const allowedIds = new Set([
    ...(today.data ?? []).filter((t) => t.type === 'EXPENSE').map((t) => t.id),
    ...(older.data ?? []).map((t) => t.id),
  ]);

  const contents: GeminiContent[] = [
    {
      role: 'user',
      parts: [{ text: `Data for tonight's chat (JSON):\n${context}` }, { text: 'Mulai obrolan malam ini.' }],
    },
    ...messages.map((m): GeminiContent => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.text).slice(0, 2000) }],
    })),
  ];
  if (contents[contents.length - 1].role !== 'user') return json({ error: 'Pesan terakhir harus dari pengguna.' }, 400);

  let turn: Turn;
  try {
    turn = await generateJson<Turn>({ apiKey, system: SYSTEM, contents, schema: TURN_SCHEMA });
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    if (error.status === 422) {
      return json({ message: 'Maaf, aku tidak bisa membahas itu. Mau lanjut bahas pengeluaran hari ini?', options: ['Lanjut', 'Sudahi saja'], tags: [], done: false, summary: '' });
    }
    return json({ error: error.message }, error.status);
  }

  // Only label expenses that were in the data, with a valid label; RLS keeps it to the user's own rows anyway.
  const tags = (turn.tags ?? []).filter((t) => allowedIds.has(t.transaction_id) && NECESSITY.includes(t.necessity));
  for (const t of tags) {
    await supabase.from('transactions').update({ necessity: t.necessity }).eq('id', t.transaction_id).eq('type', 'EXPENSE');
  }

  return json({ ...turn, options: (turn.options ?? []).slice(0, 4), tags });
});
