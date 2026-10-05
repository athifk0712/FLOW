import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { DeleteAccountSection } from '@/components/settings/delete-account-section';
import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { exportTransactionsCsv } from '@/lib/export';

export default function BackupScreen() {
  const theme = useTheme();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function exportCsv() {
    setExporting(true);
    setMessage(null);
    try {
      const count = await exportTransactionsCsv();
      setMessage(count > 0 ? `${count} transaksi diekspor.` : 'Belum ada transaksi untuk diekspor.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ekspor gagal.');
    }
    setExporting(false);
  }

  return (
    <SubScreen title="Data & cadangan">
      <ThemedView type="backgroundElement" style={styles.card}>
        <View>
          <ThemedText type="smallBold">Ekspor transaksi (CSV)</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Semua catatanmu dalam satu file. Bisa dibuka di Excel atau Google Sheets.
          </ThemedText>
        </View>
        <Pressable
          disabled={exporting}
          onPress={exportCsv}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.backgroundSelected },
            (pressed || exporting) && styles.pressed,
          ]}>
          {exporting ? <ActivityIndicator color={theme.text} /> : <ThemedText type="smallBold">Ekspor CSV</ThemedText>}
        </Pressable>
        {message && (
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>
        )}
      </ThemedView>
      <DeleteAccountSection onExport={exportCsv} exporting={exporting} />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
