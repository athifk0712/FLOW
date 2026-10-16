import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CurrencyList } from '@/components/currency-list';
import { PrimaryButton } from '@/components/form-fields';
import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { saveCurrency } from '@/hooks/use-currency-sync';
import { type Currency, findCurrency } from '@/lib/currencies';
import { formatMoney, useCurrency } from '@/lib/money';
import { closeModal } from '@/lib/navigation';

// The one currency the whole account is kept in. Amounts are stored as plain numbers without a currency of their
// own, so switching changes how every saved number is written; nothing is converted.
export default function CurrencyScreen() {
  const currency = useCurrency();
  const [pending, setPending] = useState<Currency | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(code: string) {
    setError(null);
    setPending(code === currency.code ? null : findCurrency(code));
  }

  async function confirm() {
    if (!pending || saving) return;
    setSaving(true);
    try {
      await saveCurrency(pending.code);
      closeModal();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan mata uang.');
      setSaving(false);
    }
  }

  // A typical amount already saved, written in the current and the new currency.
  const sample = 35_000 * 10 ** currency.decimals;

  return (
    <SubScreen
      title="Mata uang utama"
      intro="Pilih mata uang yang kamu pakai sehari-hari. Catatan lama tidak otomatis dikonversi.">
      <ThemedText type="small" themeColor="textSecondary">
        Sekarang: <ThemedText type="smallBold">{`${currency.name} (${currency.code})`}</ThemedText>
      </ThemedText>

      {error && <ThemedText themeColor="danger">{error}</ThemedText>}

      <CurrencyList
        selected={pending?.code ?? currency.code}
        onSelect={pick}
        footer={
          pending && (
            <ThemedView type="backgroundSelected" style={styles.confirm}>
              <ThemedText type="smallBold">{`Ganti ke ${pending.name} (${pending.code})?`}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {`Angka yang sudah tercatat tidak dikonversi kurs, hanya cara penulisannya yang berubah. Contoh: ${formatMoney(sample, currency)} akan tampil sebagai ${formatMoney(sample, pending)}.`}
              </ThemedText>
              <View style={styles.buttons}>
                <Pressable
                  onPress={() => setPending(null)}
                  hitSlop={8}
                  style={styles.cancel}
                  accessibilityRole="button">
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Batal
                  </ThemedText>
                </Pressable>
                <View style={styles.flex}>
                  <PrimaryButton label={`Ganti ke ${pending.code}`} onPress={confirm} busy={saving} />
                </View>
              </View>
            </ThemedView>
          )
        }
      />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  confirm: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cancel: {
    paddingHorizontal: Spacing.three,
  },
  flex: {
    flex: 1,
  },
});
