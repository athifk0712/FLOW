import { RECEIPT_BUCKET } from '@/lib/receipts';
import { syncDueReminders } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';

// Device flags that belong to the old books: without it, the first-run setup (first wallet, budget) shows again.
const DEVICE_KEYS = ['flowku.onboarded'];

/**
 * Empties the signed-in account's books and keeps the account: the server (RPC reset_my_data) deletes every
 * transaction, wallet, pocket, category, budget, goal, debt, asset, recurring rule and Cek harian, then puts the
 * default categories back. Sign-in, profile, photo, streak and Together groups stay.
 * Throws with a readable message on failure.
 */
export async function resetMyData() {
  const { data, error } = await supabase.rpc('reset_my_data');
  if (error) throw new Error('Data belum bisa direset. Periksa koneksi lalu coba lagi.');

  // The rows are gone already; a receipt photo left behind is invisible and harmless, so this is best effort.
  const paths = (data ?? []).filter(Boolean);
  if (paths.length) await supabase.storage.from(RECEIPT_BUCKET).remove(paths).catch(() => {});

  // Reminders for debts and recurring bills that no longer exist.
  await syncDueReminders().catch(() => {});
  for (const key of DEVICE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
