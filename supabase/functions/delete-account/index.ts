// Permanently deletes the calling user's account on the server: their files in storage (receipts, avatars), then every
// row they own and the auth user. Doing it here instead of in the app means a crash or a lost connection halfway can
// not leave files behind: every step can be retried, and storage is cleaned by folder, not by what the app remembers.
// Storage files can only be removed through the Storage API (not SQL), hence a function with the service role.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Buckets where each user owns the folder "<user_id>/".
const USER_BUCKETS = ['receipts', 'avatars'];
const PAGE = 100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Gunakan POST.' }, 405);

  // Who is asking comes only from their own token, never from the request body.
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth.user) return json({ error: 'Sesi tidak valid. Buka ulang aplikasinya.' }, 401);
  const uid = auth.user.id;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  for (const bucket of USER_BUCKETS) {
    // Remove page by page; the listing always restarts at the top because removed files drop out of it.
    for (;;) {
      const { data: files, error } = await admin.storage.from(bucket).list(uid, { limit: PAGE });
      if (error) {
        console.error('list', bucket, error.message);
        return json({ error: 'Foto belum bisa dihapus. Coba lagi sebentar.' }, 500);
      }
      const paths = (files ?? []).filter((f) => f.id).map((f) => `${uid}/${f.name}`);
      if (!paths.length) break;
      const removed = await admin.storage.from(bucket).remove(paths);
      if (removed.error) {
        console.error('remove', bucket, removed.error.message);
        return json({ error: 'Foto belum bisa dihapus. Coba lagi sebentar.' }, 500);
      }
    }
  }

  // The same RPC the app used before: it runs as the user (auth.uid()) and clears the rows that block the cascade.
  const { error } = await asUser.rpc('delete_my_account');
  if (error) {
    console.error('delete_my_account', error.message);
    return json({ error: 'Akun belum bisa dihapus. Coba lagi sebentar.' }, 500);
  }

  return json({ ok: true });
});
