import { FunctionsHttpError } from '@supabase/supabase-js';

import type { CoachExpense, Necessity } from '@/lib/coach-local';
import { supabase } from '@/lib/supabase';

// The daily check ("Cek harian"): the AI coach (edge function daily-coach) when it is available,
// otherwise the scripted local fallback in lib/coach-local.

export type ChatMessage = { role: 'user' | 'assistant'; text: string };

export type CoachMode = 'chat' | 'check';

export type CoachTurn = {
  message: string;
  options: string[];
  category_changes?: { transaction_id: string; category_id: string }[];
  done: boolean;
  summary: string;
  tags: { transaction_id: string; necessity: Necessity }[];
};

/** Local [start, end) of today, as the device sees it. */
export function todayRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end };
}

/** "2026-10-05": the session key for a local day. */
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class CoachUnavailable extends Error {}

const LOCAL_LIMIT = 10;

/**
 * Asks the AI coach for its next turn. Throws CoachUnavailable when the AI can't be used right now
 * (not configured yet, offline), so the caller can switch to the local script.
 */
export async function askCoach(
  messages: ChatMessage[],
  safeDaily: number | null,
  mode: CoachMode = 'check',
  userName: string | null = null,
): Promise<CoachTurn> {
  const { start, end } = todayRange();
  const { data, error } = await supabase.functions.invoke<CoachTurn & { error?: string }>('daily-coach', {
    body: {
      messages,
      day_start: start.toISOString(),
      day_end: end.toISOString(),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      safe_daily: safeDaily,
      mode,
      user_name: userName,
    },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = error.context.status as number;
      const body = await error.context.json().catch(() => ({}));
      // 503: no API key yet; 404: function not deployed. Both mean "use the local script".
      if (status === 503 || status === 404) throw new CoachUnavailable(body.error ?? 'AI belum aktif.');
      throw new Error(body.error ?? `Gagal (${status}).`);
    }
    throw new CoachUnavailable(error.message);
  }
  if (!data || typeof data.message !== 'string') throw new Error('Jawaban AI kosong.');
  return data;
}

/** The most recent unlabeled expenses of the last week (at most LOCAL_LIMIT, so the chat stays short), oldest first. */
export async function loadUnlabeled(): Promise<CoachExpense[]> {
  const { end } = todayRange();
  const since = new Date(end.getTime() - 8 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('transactions')
    .select('id, amount, occurred_at, merchant, categories(name)')
    .eq('needs_review', true)
    .gte('occurred_at', since)
    .lt('occurred_at', end.toISOString())
    .order('occurred_at', { ascending: false })
    .limit(LOCAL_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []).reverse().map((t) => ({
    id: t.id,
    amount: t.amount,
    occurred_at: t.occurred_at,
    merchant: t.merchant,
    category: t.categories?.name ?? null,
  }));
}

export async function applyTags(tags: { transaction_id: string; necessity: Necessity }[]) {
  for (const t of tags) {
    const { error } = await supabase.from('transactions').update({ necessity: t.necessity }).eq('id', t.transaction_id);
    if (error) throw new Error(error.message);
  }
}

/** Saves (or replaces) today's conversation. */
export async function saveSession(mode: 'ai' | 'local', messages: ChatMessage[], summary: string | null) {
  const { error } = await supabase
    .from('coach_sessions')
    .upsert({ day: dayKey(new Date()), mode, messages, summary }, { onConflict: 'user_id,day' });
  if (error) throw new Error(error.message);
}

/** Today's finished chat, if there is one. */
export async function loadTodaySession() {
  const { data } = await supabase
    .from('coach_sessions')
    .select('mode, messages, summary')
    .eq('day', dayKey(new Date()))
    .maybeSingle();
  return data as { mode: 'ai' | 'local'; messages: ChatMessage[]; summary: string | null } | null;
}
