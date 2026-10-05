import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CurrencyList } from '@/components/currency-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { saveCurrency } from '@/hooks/use-currency-sync';
import { useCurrency } from '@/lib/money';
import { closeModal } from '@/lib/navigation';

// The currency every amount is shown in. Old amounts keep their numbers; nothing is converted.
export default function CurrencyScreen() {
  const currency = useCurrency();
  const [error, setError] = useState<string | null>(null);

  async function pick(code: string) {
    if (code === currency.code) return closeModal();
    setError(null);
    try {
      await saveCurrency(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan mata uang.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              MATA UANG
            </ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Tutup
              </ThemedText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="small" themeColor="textSecondary">
              Semua nominal ditampilkan dalam mata uang ini. Catatan lama tidak dikonversi kurs, jadi pilih mata uang
              yang memang kamu pakai sehari-hari.
            </ThemedText>
            {error && <ThemedText themeColor="danger">{error}</ThemedText>}
            <CurrencyList selected={currency.code} onSelect={pick} />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
});
