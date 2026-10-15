import { useEffect, useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';

// Profile photo: a file in the private "avatars" bucket (<user_id>/<file>), referenced by profiles.avatar_path and
// shown through a signed URL. One shared store, so Beranda and Pengaturan always show the same photo.

export const AVATAR_BUCKET = 'avatars';
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // the bucket's limit
const SIGNED_URL_SECONDS = 60 * 60 * 24;

type AvatarState = { loaded: boolean; path: string | null; url: string | null };

let state: AvatarState = { loaded: false, path: null, url: null };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: AvatarState) {
  state = next;
  listeners.forEach((l) => l());
}

/** Why a picked photo can't be used, or null. */
export function avatarFileProblem(file: { mimeType?: string | null; fileSize?: number | null }) {
  const type = file.mimeType ?? 'image/jpeg';
  if (!AVATAR_TYPES.includes(type)) return 'Pakai foto JPG, PNG, atau WebP.';
  if (file.fileSize && file.fileSize > AVATAR_MAX_BYTES) return 'Fotonya terlalu besar (maks. 2 MB). Coba potong lebih kecil.';
  return null;
}

async function signed(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  return error ? null : data.signedUrl;
}

/** Reads the photo from the profile (once per app start unless forced). */
export function loadAvatar(force = false) {
  if (loading && !force) return loading;
  loading = (async () => {
    const { data } = await supabase.from('profiles').select('avatar_path').maybeSingle();
    const path = data?.avatar_path ?? null;
    set({ loaded: true, path, url: await signed(path) });
  })().catch(() => set({ ...state, loaded: true }));
  return loading;
}

/** Uploads a new photo, points the profile at it, then removes the old file. */
export async function saveAvatar(userId: string, file: { uri: string; mimeType?: string | null }) {
  const contentType = file.mimeType ?? 'image/jpeg';
  const extension = contentType.split('/')[1] ?? 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  const body = await (await fetch(file.uri)).arrayBuffer();
  const upload = await supabase.storage.from(AVATAR_BUCKET).upload(path, body, { contentType });
  if (upload.error) throw new Error(upload.error.message);
  const updated = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
  if (updated.error) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    throw new Error(updated.error.message);
  }
  const old = state.path;
  set({ loaded: true, path, url: (await signed(path)) ?? file.uri });
  // Only after the profile points at the new file; a leftover old file is harmless.
  if (old && old !== path) await supabase.storage.from(AVATAR_BUCKET).remove([old]);
}

export async function removeAvatar(userId: string) {
  const old = state.path;
  const updated = await supabase.from('profiles').update({ avatar_path: null }).eq('id', userId);
  if (updated.error) throw new Error(updated.error.message);
  set({ loaded: true, path: null, url: null });
  if (old) await supabase.storage.from(AVATAR_BUCKET).remove([old]);
}

/** Forget the photo of a user who signed out or switched account. */
export function resetAvatar() {
  loading = null;
  set({ loaded: false, path: null, url: null });
}

/** The current photo URL (null = show initials), loaded on first use. */
export function useAvatar() {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  useEffect(() => {
    if (!current.loaded) loadAvatar();
  }, [current.loaded]);
  return current;
}
