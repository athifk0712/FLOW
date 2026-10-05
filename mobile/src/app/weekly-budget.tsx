import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NECESSITY } from '@/constants/necessity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Enums } from '@/lib/database.types';
import { formatDigits, getCurrency, toDigits } from '@/lib/money';
import { supabase } from '@/lib/supabase';

type Scope = Extract<Enums<'budget_scope'>, 'DISCRETIONARY' | 'ESSENTIAL'>;

const BUDGETS: { scope: Scope; label: string; hint: string; color: string }[] = [
  {
    scope: 'DISCRETIONARY',
    label: 'Ingin & Impulsif',
    hint: 'Batas belanja keinginan per minggu.',
    color: NECESSITY.WANT.color,
  },
  {
    scope: 'ESSENTIAL',
    label: 'Butuh & Penting',
    hint: 'Opsional. Untuk memantau kebutuhan pokok per minggu, dan dicadangkan di Aman dibelanjakan.',
    color: NECESSITY.NEED.color,
  },
];

/** This user's open-ended weekly DISCRETIONARY / ESSENTIAL budgets. */
function activeWeekly() {
  return supabase
    .from('budgets')
    .select('id, scope, limit_amount')
    .eq('period', 'WEEKLY')
    .in('scope', ['DISCRETIONARY', 'ESSENTIAL'])
    .is('active_to', null);
}

export default function WeeklyBudgetScreen() {
  const theme = useTheme();
  const [ids, setIds] = useState<Partial<Record<Scope, string>>>({});
  const [limits, setLimits] = useState<Record<Scope, string>>({ DISCRETIONARY: '', ESSENTIAL: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      activeWeekly().then(({ data, error }) => {
        if (error) return setMessage(error.message);
        const nextIds: Partial<Record<Scope, string>> = {};
        const values: Record<Scope, string> = { DISCRETIONARY: '', ESSENTIAL: '' };
        for (const b of data ?? []) {
          const scope = b.scope as Scope;
          nextIds[scope] = b.id;
          values[scope] = String(b.limit_amount);
        }
        setIds(nextIds);
        setLimits(values);
      });
    }, []),
  );

  async function save() {
    setSaving(true);
    setMessage(null);
    for (const { scope } of BUDGETS) {
      const amount = Number(limits[scope] || '0');
      const id = ids[scope];
      const { error } =
        amount > 0
          ? id
            ? await supabase.from('budgets').update({ limit_amount: amount }).eq('id', id)
            : await supabase.from('budgets').insert({ scope, period: 'WEEKLY', limit_amount: amount })
          : id
            ? await supabase.from('budgets').delete().eq('id', id)
            : { error: null };
      if (error) {
        setSaving(false);
        return setMessage(error.message);
      }
    }
    // Reload ids so a newly inserted budget is updated (not duplicated) on the next save.
    const { data } = await activeWeekly();
    setIds(Object.fromEntries((data ?? []).map((b) => [b.scope, b.id])));
    setSaving(false);
    setMessage('Budget tersimpan');
  }

  return (
    <SubScreen title="Budget mingguan">
      <ThemedView type="backgroundElement" style={styles.card}>
        {BUDGETS.map((b) => (
          <View key={b.scope} style={styles.field}>
            <View style={styles.label}>
              <View style={[styles.dot, { backgroundColor: b.color }]} />
              <ThemedText type="smallBold">{b.label}</ThemedText>
            </View>
            <View style={[styles.priceRow, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">{getCurrency().symbol.trim()}</ThemedText>
              <TextInput
                style={[styles.priceInput, { color: theme.text }]}
                value={formatDigits(limits[b.scope])}
                onChangeText={(t) => setLimits((l) => ({ ...l, [b.scope]: toDigits(t) }))}
                placeholder="Belum diatur"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {b.hint}
            </ThemedText>
          </View>
        ))}

        <Pressable
          disabled={saving}
          onPress={save}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.primary }, (pressed || saving) && styles.pressed]}>
          {saving ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              Simpan budget
            </ThemedText>
          )}
        </Pressable>
        {message && (
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>
        )}
      </ThemedView>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
