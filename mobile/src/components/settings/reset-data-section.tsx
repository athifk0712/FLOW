import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resetMyData } from '@/lib/data-reset';

const CONFIRM_WORD = 'RESET';

/** Empty the books but keep the account. Two steps, says what goes and what stays, offers a CSV, and asks for a word. */
export function ResetDataSection({ onExport, exporting }: { onExport: () => void; exporting: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState('');
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = word.trim().toUpperCase() === CONFIRM_WORD;

  function close() {
    setOpen(false);
    setWord('');
    setError(null);
  }

  async function confirm() {
    setResetting(true);
    setError(null);
    try {
      await resetMyData();
      close();
      setResetting(false);
      // Back to the Beranda already in the stack (replace would stack a second copy of the tabs, each refetching on
      // focus). With no wallets left, it runs the first-run setup again.
      router.dismissTo('/');
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Data belum bisa direset.');
    }
    setResetting(false);
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        MULAI ULANG PEMBUKUAN
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.card}>
        {!open ? (
          <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button">
            <ThemedText type="smallBold" themeColor="danger">
              Reset semua data
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Kosongkan catatan dan mulai dari nol, tanpa menghapus akun.
            </ThemedText>
          </Pressable>
        ) : (
          <>
            <ThemedText type="smallBold">Reset semua data keuanganmu?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Dihapus permanen: semua transaksi, dompet & kantong, kategori buatanmu, budget, target tabungan,
              utang-piutang, aset, transaksi rutin, riwayat Cek harian, dan foto struk. Kategori bawaan dipasang lagi.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Tetap ada: akun & login, nama, foto profil, streak, pengaturan, dan grup Together.
            </ThemedText>
            <Pressable
              onPress={onExport}
              disabled={exporting || resetting}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.backgroundSelected },
                (pressed || exporting) && styles.pressed,
              ]}>
              {exporting ? <ActivityIndicator color={theme.text} /> : <ThemedText type="smallBold">Ekspor CSV dulu</ThemedText>}
            </Pressable>
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">
                Ketik {CONFIRM_WORD} untuk melanjutkan
              </ThemedText>
              <TextInput
                value={word}
                onChangeText={setWord}
                editable={!resetting}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={CONFIRM_WORD}
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel={`Ketik ${CONFIRM_WORD} untuk melanjutkan`}
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              />
            </View>
            <View style={styles.row}>
              <Pressable
                onPress={close}
                disabled={resetting}
                style={[styles.button, styles.half, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold">Batal</ThemedText>
              </Pressable>
              <Pressable
                onPress={confirm}
                disabled={resetting || !confirmed}
                accessibilityLabel="Reset permanen"
                accessibilityState={{ disabled: resetting || !confirmed }}
                style={({ pressed }) => [
                  styles.button,
                  styles.half,
                  { backgroundColor: theme.danger },
                  !confirmed && styles.disabled,
                  (pressed || resetting) && styles.pressed,
                ]}>
                {resetting ? (
                  <ActivityIndicator color={theme.background} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.background }}>
                    Reset permanen
                  </ThemedText>
                )}
              </Pressable>
            </View>
            {error && (
              <ThemedText type="small" themeColor="danger">
                {error}
              </ThemedText>
            )}
          </>
        )}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    fontSize: 16,
    letterSpacing: 2,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  half: {
    flex: 1,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
