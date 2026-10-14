// Flowku Together: drafts a friendly reminder for a shared target. It only WRITES the text; the app shows it for the
// user to edit, copy or share themselves. Nothing is sent anywhere from here.
// Runs as the calling user, so RLS decides what they can read: a non-member gets "not found".
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GeminiError, generateJson } from '../_shared/gemini.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string', description: 'The reminder, casual polite Indonesian, 2-4 short sentences, max one emoji' },
  },
  required: ['message'],
  additionalProperties: false,
};

const ZERO_DECIMAL = new Set(['IDR', 'JPY', 'KRW', 'VND']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'AI belum aktif.' }, 503);

  const body = await req.json().catch(() => ({}));
  const targetId = typeof body.target_id === 'string' && UUID.test(body.target_id) ? body.target_id : null;
  const memberId = typeof body.member_id === 'string' && UUID.test(body.member_id) ? body.member_id : null;
  if (!targetId) return json({ error: 'target_id wajib diisi.' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const target = await supabase
    .from('group_targets')
    .select('id, name, target_amount, deadline, group_id, groups(name, currency)')
    .eq('id', targetId)
    .maybeSingle();
  if (target.error || !target.data) return json({ error: 'Target tidak ditemukan.' }, 404);
  const group = target.data.groups as unknown as { name: string; currency: string } | null;

  const [members, contributions] = await Promise.all([
    supabase.from('group_members').select('user_id, display_name').eq('group_id', target.data.group_id),
    supabase.from('group_contributions').select('user_id, amount, status').eq('target_id', targetId),
  ]);
  if (members.error || contributions.error) return json({ error: 'Data grup tidak bisa dibaca.' }, 500);

  const currency = group?.currency ?? 'IDR';
  const decimals = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const money = (minor: number) => fmt.format(minor / 10 ** decimals);

  const memberRows = members.data ?? [];
  const verified = (contributions.data ?? []).filter((c) => c.status === 'VERIFIED');
  const total = verified.reduce((s, c) => s + c.amount, 0);
  const remaining = Math.max(0, target.data.target_amount - total);
  const share = memberRows.length ? Math.ceil(target.data.target_amount / memberRows.length) : target.data.target_amount;
  const person = memberId ? memberRows.find((m) => m.user_id === memberId) : undefined;
  if (memberId && !person) return json({ error: 'Anggota tidak ditemukan di grup ini.' }, 404);
  const personPaid = person ? verified.filter((c) => c.user_id === person.user_id).reduce((s, c) => s + c.amount, 0) : 0;

  const facts = {
    group: group?.name ?? 'grup',
    target: target.data.name,
    target_text: money(target.data.target_amount),
    collected_text: money(total),
    remaining_text: money(remaining),
    deadline: target.data.deadline,
    today: new Date().toISOString().slice(0, 10),
    reminding: person
      ? { name: person.display_name, their_share_text: money(share), their_remaining_text: money(Math.max(0, share - personPaid)) }
      : 'the whole group',
  };

  try {
    const result = await generateJson<{ message: string }>({
      apiKey,
      schema: SCHEMA,
      system:
        'You write short, warm reminders for a group savings pot (patungan) among friends in Indonesia, to be ' +
        'pasted into a chat. Casual and polite Indonesian, never pushy, never shaming, no guilt. Use only the facts ' +
        'given, amounts exactly as written. For the whole group, do not single anyone out. When reminding one person, ' +
        'address them by name kindly and mention only their own remaining share. Ask people to confirm in Flowku ' +
        'after paying. No links, no hashtags.',
      contents: [{ role: 'user', parts: [{ text: `Facts (JSON): ${JSON.stringify(facts)}` }] }],
    });
    const message = typeof result.message === 'string' ? result.message.trim().slice(0, 600) : '';
    if (!message) return json({ error: 'AI tidak mengembalikan pesan.' }, 502);
    return json({ message });
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    return json({ error: error.message }, error.status);
  }
});
