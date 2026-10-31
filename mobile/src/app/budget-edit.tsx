import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalEdges } from '@/constants/safe-area';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NECESSITY } from '@/constants/necessity';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadBudgetPlan, saveBudgetRow } from '@/lib/budget-data';
import { type BudgetPeriod, changedRows, type PlanRow } from '@/lib/budget-plan';
import { formatDigits, getCurrency, toDigits } from '@/lib/money';
import { closeModal } from '@/lib/navigation';

type Plan = { weekly: PlanRow[]; perCategory: PlanRow[] };

const PERIODS: { value: BudgetPeriod; label: string }[] = [
  { value: 'WEEKLY', label: 'Mingguan' },
  { value: 'MONTHLY', label: 'Bulanan' },
];

const WEEKLY_DOT: Record<string, string> = {
  DISCRETIONARY: NECESSITY.WANT.color,
  ESSENTIAL: NECESSITY.NEED.color,
};

// Every budget in one place: the two weekly limits, then one optional limit per expense category. Empty = no budget.
// Categories that already have a budget come first; the rest wait behind one tap so the form stays short.
export default function BudgetEditScreen() {
  const theme = useTheme();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await loadBudgetPlan();
      setPlan(next);
      // Nothing budgeted yet: there is nothing to hide the other categories behind.
      if (next.perCategory.every((r) => !r.budgetId)) setShowOthers(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat budget.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function update(key: string, change: Partial<Pick<PlanRow, 'digits' | 'period'>>) {
    setMessage(null);
    const apply = (rows: PlanRow[]) => rows.map((r) => (r.key === key ? { ...r, ...change } : r));
    setPlan((current) => current && { weekly: apply(current.weekly), perCategory: apply(current.perCategory) });
  }

  async function save() {
    if (!plan) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      for (const r of changedRows([...plan.weekly, ...plan.perCategory])) await saveBudgetRow(r);
      await load();
      setMessage('Budget tersimpan');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  }

  const amountField = (r: PlanRow) => (
    <View style={[styles.priceRow, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold">{getCurrency().symbol.trim()}</ThemedText>
      <TextInput
        style={[styles.priceInput, { color: theme.text }]}
        value={formatDigits(r.digits)}
        onChangeText={(t) => update(r.key, { digits: toDigits(t) })}
        placeholder="Tanpa budget"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        accessibilityLabel={`Budget ${r.name}`}
      />
    </View>
  );

  const unbudgeted = plan?.perCategory.filter((r) => r.saved.digits === '') ?? [];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={ModalEdges}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              ATUR BUDGET
            </ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Tutup
              </ThemedText>
            </Pressable>
          </View>

          {plan === null ? (
            error ? (
              <ThemedText themeColor="danger">{error}</ThemedText>
            ) : (
              <ActivityIndicator style={styles.flex} />
            )
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
                <ThemedText type="smallBold">Batas mingguan</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Semua pengeluaran langsung terhitung sesuai sifat kategorinya, tanpa perlu dinilai satu per satu.
                </ThemedText>
                <Pressable onPress={() => router.push('/categories')} hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="primary">
                    Ubah sifat kategori →
                  </ThemedText>
                </Pressable>
                {plan.weekly.map((r) => (
                  <ThemedView key={r.key} type="backgroundElement" style={styles.row}>
                    <View style={styles.rowTop}>
                      <View style={[styles.dot, { backgroundColor: WEEKLY_DOT[r.scope] }]} />
                      <ThemedText type="smallBold" style={styles.flex}>
                        {r.name}
                      </ThemedText>
                    </View>
                    {amountField(r)}
                  </ThemedView>
                ))}

                <ThemedText type="smallBold" style={styles.section}>
                  Per kategori
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Isi batas untuk kategori yang mau dipantau, misal Kopi Rp150.000 per bulan. Kosongkan untuk menghapus.
                </ThemedText>
                {plan.perCategory
                  .filter((r) => r.saved.digits !== '')
                  .concat(showOthers ? unbudgeted : [])
                  .map((r) => (
                    <ThemedView key={r.key} type="backgroundElement" style={styles.row}>
                      <View style={styles.rowTop}>
                        <ThemedText type="smallBold" style={styles.flex}>
                          {r.name}
                        </ThemedText>
                        <View style={styles.periods}>
                          {PERIODS.map((p) => {
                            const selected = p.value === r.period;
                            return (
                              <Pressable
                                key={p.value}
                                onPress={() => update(r.key, { period: p.value })}
                                style={[
                                  styles.period,
                                  { backgroundColor: selected ? theme.primary : theme.backgroundSelected },
                                ]}>
                                <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
                                  {p.label}
                                </ThemedText>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                      {amountField(r)}
                    </ThemedView>
                  ))}
                {!showOthers && unbudgeted.length > 0 && (
                  <Pressable onPress={() => setShowOthers(true)} hitSlop={8} style={styles.more}>
                    <ThemedText type="smallBold" themeColor="primary">
                      + Tambah budget kategori lain ({unbudgeted.length})
                    </ThemedText>
                  </Pressable>
                )}
                {error && <ThemedText themeColor="danger">{error}</ThemedText>}
                {message && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {message}
                  </ThemedText>
                )}
              </ScrollView>

              <Pressable
                disabled={saving}
                onPress={save}
                style={({ pressed }) => [
                  styles.save,
                  { backgroundColor: theme.primary },
                  (pressed || saving) && styles.pressed,
                ]}>
                {saving ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                    Simpan budget
                  </ThemedText>
                )}
              </Pressable>
            </>
          )}
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
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  section: {
    marginTop: Spacing.three,
  },
  row: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  periods: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  period: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 600,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  more: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  save: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
