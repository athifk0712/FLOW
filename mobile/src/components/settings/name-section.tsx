import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayName, initials, NAME_MAX, saveDisplayName } from '@/lib/display-name';
import { useSession } from '@/providers/session-provider';

/** The profile header: avatar, the name Flowku calls you, and an inline editor for it. */
export function NameSection() {
  const theme = useTheme();
  const { session } = useSession();
  const user = session?.user;
  const name = displayName(user);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function open() {
    setDraft(name === 'Tamu Flowku' ? '' : name);
    setError(null);
    setSaved(false);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveDisplayName(draft);
      setEditing(false);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan nama.');
    }
    setSaving(false);
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" style={[styles.avatarText, { color: theme.onPrimary }]}>
            {initials(editing && draft.trim() ? draft : name)}
          </ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            Nama panggilan
          </ThemedText>
          <ThemedText type="subtitle" style={styles.name} numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {!user || user.is_anonymous ? 'Mode tamu' : user.email}
          </ThemedText>
        </View>
      </View>

      {editing ? (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={save}
            placeholder="Mau dipanggil apa?"
            placeholderTextColor={theme.textSecondary}
            maxLength={NAME_MAX}
            autoFocus
            returnKeyType="done"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
          />
          <View style={styles.row}>
            <Pressable
              onPress={() => setEditing(false)}
              style={({ pressed }) => [styles.half, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}>
              <ThemedText type="smallBold">Batal</ThemedText>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={saving}
              style={({ pressed }) => [styles.half, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
              {saving ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                  Simpan
                </ThemedText>
              )}
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Kosongkan untuk kembali ke nama bawaan.
          </ThemedText>
        </>
      ) : (
        <Pressable onPress={open} hitSlop={8}>
          <ThemedText type="smallBold" themeColor="primary">
            Ubah nama
          </ThemedText>
        </Pressable>
      )}
      {saved && !editing && (
        <ThemedText type="small" themeColor="positive">
          Nama tersimpan.
        </ThemedText>
      )}
      {error && <ThemedText type="small" themeColor="danger">{error}</ThemedText>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    lineHeight: 26,
  },
  flex: {
    flex: 1,
  },
  name: {
    fontSize: 22,
    lineHeight: 28,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  half: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + 4,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
