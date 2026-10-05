import { disableLock, LOCK_SUPPORTED } from '@/lib/app-lock';
import { applyReminderSettings, getReminderSettings, REMINDERS_SUPPORTED } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';

const BUCKET = 'receipts';
// Device-only preferences that belong to the deleted account's habits.
const DEVICE_KEYS = ['flowku.onboarded'];

/**
 * Permanently deletes the signed-in account: receipt photos, then every row (server side), then the device's
 * own traces. Afterwards the app starts over as a fresh guest. Throws with a readable message on failure.
 */
export async function deleteMyAccount() {
  // Storage files are not covered by the database cascade, so remove them first.
  const { data: receipts, error: listError } = await supabase.from('receipts').select('storage_path');
  if (listError) throw new Error(listError.message);
  const paths = (receipts ?? []).map((r) => r.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error(error.message);
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);

  // Local clean-up: reminders, lock, onboarding flag. Failures here must not block starting over.
  if (REMINDERS_SUPPORTED) {
    await applyReminderSettings({ ...getReminderSettings(), enabled: false, weeklyEnabled: false, dueEnabled: false }).catch(
      () => {},
    );
  }
  if (LOCK_SUPPORTED) await disableLock().catch(() => {});
  for (const key of DEVICE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  // The session's user no longer exists: drop it locally, then begin again as a new guest.
  await supabase.auth.signOut({ scope: 'local' });
  await supabase.auth.signInAnonymously();
}
