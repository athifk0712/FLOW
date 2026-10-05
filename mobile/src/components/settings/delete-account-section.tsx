import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteMyAccount } from '@/lib/account-deletion';
import { useSession } from '@/providers/session-provider';

/** Delete the account and everything in it. Two steps, says exactly what goes, and offers a CSV first. */
export function DeleteAccountSection({ onExport, exporting }: { onExport: () => void; exporting: boolean }) {
  const theme = useTheme();
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = session?.user.email;

  async function confirm() {
    setDeleting(true);
    setError(null);
    try {
      await deleteMyAccount();
      // The session switches to a fresh guest; this screen re-renders for the new account.
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus akun.');
    }
    setDeleting(false);
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        HAPUS AKUN
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.card}>
        {!open ? (
          <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button">
            <ThemedText type="smallBold" themeColor="danger">
              Hapus akun & semua data
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Untuk mulai dari nol, atau berhenti memakai Flowku.
            </ThemedText>
          </Pressable>
        ) : (
          <>
            <ThemedText type="smallBold">Yakin ingin menghapus {email ? `akun ${email}` : 'akun tamu ini'}?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Semua transaksi, akun & dompet, kategori, budget, target tabungan, utang-piutang, niat beli, dan foto struk
              akan dihapus permanen{email ? ' dari semua perangkat' : ''}. Ini tidak bisa dibatalkan.
            </ThemedText>
            <Pressable
              onPress={onExport}
              disabled={exporting || deleting}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.backgroundSelected },
                (pressed || exporting) && styles.pressed,
              ]}>
              {exporting ? <ActivityIndicator color={theme.text} /> : <ThemedText type="smallBold">Ekspor CSV dulu</ThemedText>}
            </Pressable>
            <View style={styles.row}>
              <Pressable
                onPress={() => setOpen(false)}
                disabled={deleting}
                style={[styles.button, styles.half, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold">Batal</ThemedText>
              </Pressable>
              <Pressable
                onPress={confirm}
                disabled={deleting}
                accessibilityLabel="Hapus permanen"
                style={({ pressed }) => [
                  styles.button,
                  styles.half,
                  { backgroundColor: theme.danger },
                  (pressed || deleting) && styles.pressed,
                ]}>
                {deleting ? (
                  <ActivityIndicator color={theme.background} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.background }}>
                    Hapus permanen
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
  pressed: {
    opacity: 0.7,
  },
});
