// Daily AI quota (table ai_usage): take one unit before calling Gemini, give it back when the call fails.
// Uses the service role because users may read their usage but never change it.
import { createClient } from 'npm:@supabase/supabase-js@2';

export type AiFeature = 'chat' | 'scan' | 'group_remind';

// Per day (WIB). Guests get less: a new guest account is one tap away, so their quota is the easiest to farm.
const LIMITS: Record<AiFeature, { account: number; guest: number }> = {
  chat: { account: 30, guest: 10 },
  scan: { account: 15, guest: 5 },
  group_remind: { account: 10, guest: 10 },
};

const EXHAUSTED: Record<AiFeature, string> = {
  chat: 'Kuota ngobrol dengan Flowku AI hari ini sudah habis. Besok bisa lagi ya.',
  scan: 'Kuota scan struk hari ini sudah habis. Besok bisa lagi, atau isi manual dulu ya.',
  group_remind: 'Kuota draf pengingat hari ini sudah habis. Besok bisa lagi ya.',
};

export class QuotaExhausted extends Error {
  code = 'KUOTA_HABIS';
}

function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

/**
 * Runs `call` with one unit of the user's daily quota. Throws QuotaExhausted (before calling) when it is used up;
 * when `call` throws, the unit is given back and the error passes through.
 */
export async function withQuota<T>(
  user: { id: string; is_anonymous?: boolean },
  feature: AiFeature,
  call: () => Promise<T>,
): Promise<T> {
  const db = admin();
  const limit = user.is_anonymous ? LIMITS[feature].guest : LIMITS[feature].account;
  const { data: left, error } = await db.rpc('consume_ai_quota', { p_user_id: user.id, p_feature: feature, p_limit: limit });
  if (error) throw new Error(`quota: ${error.message}`);
  if (left < 0) throw new QuotaExhausted(EXHAUSTED[feature]);
  try {
    return await call();
  } catch (e) {
    await db.rpc('refund_ai_quota', { p_user_id: user.id, p_feature: feature }).then(
      ({ error: refundError }) => refundError && console.error('quota refund', refundError.message),
    );
    throw e;
  }
}

/** The 429 answer the app shows as is. */
export function quotaResponse(e: QuotaExhausted, headers: Record<string, string>) {
  return new Response(JSON.stringify({ error: e.message, code: e.code }), {
    status: 429,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
