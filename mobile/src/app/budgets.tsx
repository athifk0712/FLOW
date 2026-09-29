import { useFocusEffect } from 'expo-router';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DANGER_COLOR } from '@/constants/necessity';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Enums } from '@/lib/database.types';
import { formatDigits, toDigits } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';

type Period = Enums<'budget_period'>;
type Row = {
  categoryId: string;
  name: string;
  budgetId: string | null;
  digits: string;
  period: Period;
  // What is stored now, to skip unchanged rows on save.
  saved: { digits: string; period: Period };
};

const PERIODS: { value: Period; label: string }[] = [
  { value: 'WEEKLY', label: 'Mingguan' },
  { value: 'MONTHLY', label: 'Bulanan' },
];

// One optional limit per expense category, weekly or monthly. Empty = no budget.
export default function BudgetsScreen() {
  const theme = useTheme();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cats, buds] = await Promise.all([
      supabase.from('categories').select('id, name').eq('kind', 'EXPENSE').order('created_at'),
      supabase
        .from('budgets')
        .select('id, category_id, period, limit_amount')
        .eq('scope', 'CATEGORY')
        .is('active_to', null),
    ]);
    const failed = cats.error ?? buds.error;
    if (failed) return setError(failed.message);
    const byCategory = new Map((buds.data ?? []).map((b) => [b.category_id, b]));
    setRows(
      (cats.data ?? []).map((c) => {
        const b = byCategory.get(c.id);
        const digits = b ? String(b.limit_amount) : '';
        const period = b?.period ?? 'MONTHLY';
        return { categoryId: c.id, name: c.name, budgetId: b?.id ?? null, digits, period, saved: { digits, period } };
      }),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function update(categoryId: string, change: Partial<Pick<Row, 'digits' | 'period'>>) {
    setMessage(null);
    setRows((current) => current?.map((r) => (r.categoryId === categoryId ? { ...r, ...change } : r)) ?? null);
  }

  async function save() {
    if (!rows) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    for (const r of rows) {
      if (r.digits === r.saved.digits && r.period === r.saved.period) continue;
      const amount = Number(r.digits || '0');
      const { error } =
        amount > 0
          ? r.budgetId
            ? await supabase.from('budgets').update({ limit_amount: amount, period: r.period }).eq('id', r.budgetId)
            : await supabase
                .from('budgets')
                .insert({ scope: 'CATEGORY', category_id: r.categoryId, period: r.period, limit_amount: amount })
          : r.budgetId
            ? await supabase.from('budgets').delete().eq('id', r.budgetId)
            : { error: null };
      if (error) {
        setSaving(false);
        return setError(`${r.name}: ${error.message}`);
      }
    }
    await load();
    setSaving(false);
    setMessage('Budget kategori tersimpan');
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              BUDGET PER KATEGORI
            </ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Tutup
              </ThemedText>
            </Pressable>
          </View>

          {rows === null ? (
            error ? (
              <ThemedText style={styles.error}>{error}</ThemedText>
            ) : (
              <ActivityIndicator style={styles.flex} />
            )
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
                <ThemedText type="small" themeColor="textSecondary">
                  Isi batas untuk kategori yang mau dipantau, misal Kopi Rp150.000 per bulan. Kosongkan untuk
                  menghapus.
                </ThemedText>
                {rows.map((r) => (
                  <ThemedView key={r.categoryId} type="backgroundElement" style={styles.row}>
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
                              onPress={() => update(r.categoryId, { period: p.value })}
                              style={[
                                styles.period,
                                { backgroundColor: selected ? theme.text : theme.backgroundSelected },
                              ]}>
                              <ThemedText type="small" style={{ color: selected ? theme.background : theme.text }}>
                                {p.label}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View style={[styles.priceRow, { backgroundColor: theme.backgroundSelected }]}>
                      <ThemedText type="smallBold">Rp</ThemedText>
                      <TextInput
                        style={[styles.priceInput, { color: theme.text }]}
                        value={formatDigits(r.digits)}
                        onChangeText={(t) => update(r.categoryId, { digits: toDigits(t) })}
                        placeholder="Tanpa budget"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="number-pad"
                      />
                    </View>
                  </ThemedView>
                ))}
                {error && <ThemedText style={styles.error}>{error}</ThemedText>}
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
                  { backgroundColor: theme.text },
                  (pressed || saving) && styles.pressed,
                ]}>
                {saving ? (
                  <ActivityIndicator color={theme.background} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.background }}>
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
  save: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: DANGER_COLOR,
  },
});
