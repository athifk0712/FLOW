import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { avatarFileProblem, removeAvatar, saveAvatar, useAvatar } from '@/lib/avatar';
import { displayName } from '@/lib/display-name';
import { useSession } from '@/providers/session-provider';

type Picked = { uri: string; mimeType?: string | null };

// Profile photo: pick from the gallery (cropped square), preview, then save. Saved privately; only you see it.
export function AvatarSection() {
  const theme = useTheme();
  const { session } = useSession();
  const { url } = useAvatar();
  const [preview, setPreview] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user.id;
  const name = displayName(session?.user);

  async function pick() {
    setError(null);
    setConfirmRemove(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const problem = avatarFileProblem(asset);
    if (problem) return setError(problem);
    setPreview({ uri: asset.uri, mimeType: asset.mimeType });
  }

  async function save() {
    if (!preview || !userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveAvatar(userId, preview);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? `Gagal menyimpan foto: ${e.message}` : 'Gagal menyimpan foto. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!userId || busy) return;
    if (!confirmRemove) return setConfirmRemove(true);
    setBusy(true);
    setError(null);
    try {
      await removeAvatar(userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus foto.');
    } finally {
      setBusy(false);
      setConfirmRemove(false);
    }
  }

  const button = (primary: boolean) => [
    styles.button,
    { backgroundColor: primary ? theme.primary : theme.backgroundSelected },
  ];

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        FOTO PROFIL
      </ThemedText>
      <View style={styles.row}>
        <Avatar name={name} size={80} previewUri={preview?.uri} />
        <View style={styles.actions}>
          {preview ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Begini hasilnya. Simpan?
              </ThemedText>
              <View style={styles.buttons}>
                <Pressable onPress={save} disabled={busy} style={({ pressed }) => [button(true), pressed && styles.pressed]}>
                  {busy ? (
                    <ActivityIndicator color={theme.onPrimary} />
                  ) : (
                    <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                      Simpan foto
                    </ThemedText>
                  )}
                </Pressable>
                <Pressable onPress={() => setPreview(null)} disabled={busy} hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Batal
                  </ThemedText>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Pressable onPress={pick} disabled={busy} style={({ pressed }) => [button(false), pressed && styles.pressed]}>
                <ThemedText type="smallBold">{url ? 'Ganti foto' : 'Pilih foto'}</ThemedText>
              </Pressable>
              {url && (
                <Pressable onPress={remove} disabled={busy} hitSlop={8}>
                  <ThemedText type="small" themeColor="danger">
                    {confirmRemove ? 'Ketuk lagi untuk hapus foto' : 'Hapus foto'}
                  </ThemedText>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>
      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        Foto disimpan privat; hanya kamu yang bisa melihatnya.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  actions: {
    flex: 1,
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
