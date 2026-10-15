import { FunctionsHttpError } from '@supabase/supabase-js';

import { disableLock, LOCK_SUPPORTED } from '@/lib/app-lock';
import { resetAvatar } from '@/lib/avatar';
import { applyReminderSettings, getReminderSettings, REMINDERS_SUPPORTED } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';

// Device-only preferences that belong to the deleted account's habits.
const DEVICE_KEYS = ['flowku.onboarded'];

/**
 * Permanently deletes the signed-in account. The server (edge function delete-account) removes the receipt and profile
 * photos, then every row; the app then wipes the device's own traces. Afterwards it starts over as a fresh guest.
 * Throws with a readable message on failure.
 */
export async function deleteMyAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(body?.error ?? 'Gagal menghapus akun. Periksa koneksi lalu coba lagi.');
  }
  resetAvatar();

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
