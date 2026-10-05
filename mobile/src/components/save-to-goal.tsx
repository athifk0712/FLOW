import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Goal } from '@/lib/goals';
import { formatMoney } from '@/lib/money';
import { supabase } from '@/lib/supabase';

type Props = { intentId: string; itemName: string; amount: number; onClose: () => void };

/** After a buy intent is cancelled: offer to set the money held back aside for a savings goal. */
export function SaveToGoal({ intentId, itemName, amount, onClose }: Props) {
  const theme = useTheme();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('v_goal_progress')
      .select('*')
      .order('created_at')
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        // Goals that are already reached don't need more money.
        setGoals((data ?? []).filter((g) => (g.saved ?? 0) < (g.target_amount ?? 0)));
      });
  }, []);

  async function save(goal: Goal) {
    if (!goal.id || saving) return;
    setSaving(goal.id);
    setError(null);
    const { error } = await supabase.from('goal_contributions').insert({ goal_id: goal.id, amount, intent_id: intentId });
    setSaving(null);
    // 23505: this intent was already set aside (e.g. a second tap on another device).
    if (error) return setError(error.code === '23505' ? 'Uang ini sudah disisihkan sebelumnya.' : error.message);
    setSavedTo(goal.name);
  }

  const text = { color: theme.onAccent };

  return (
    <ThemedView style={[styles.card, { backgroundColor: theme.accent }]}>
      {savedTo ? (
        <>
          <ThemedText type="smallBold" style={text}>
            {formatMoney(amount)} masuk ke &quot;{savedTo}&quot;.
          </ThemedText>
          <ThemedText type="small" style={text}>
            Keinginan yang ditahan jadi langkah menuju yang lebih kamu mau.
          </ThemedText>
          <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
            <ThemedText type="smallBold" style={text}>
              Oke
            </ThemedText>
          </Pressable>
        </>
      ) : (
        <>
          <ThemedText type="smallBold" style={text}>
            Kamu menahan {formatMoney(amount)} untuk {itemName}.
          </ThemedText>
          <ThemedText type="small" style={text}>
            Sisihkan ke target tabungan? Saldo akunmu tidak berubah, ini penanda saja.
          </ThemedText>
          {goals === null && !error ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <View style={styles.chips}>
              {(goals ?? []).map((g) => (
                <Pressable
                  key={g.id}
                  disabled={!!saving}
                  onPress={() => save(g)}
                  style={({ pressed }) => [
                    styles.chip,
                    { backgroundColor: theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}>
                  {saving === g.id ? (
                    <ActivityIndicator color={theme.text} />
                  ) : (
                    <ThemedText type="small">{g.name}</ThemedText>
                  )}
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/goals');
                }}
                style={({ pressed }) => [styles.chip, styles.newChip, { borderColor: theme.onAccent }, pressed && styles.pressed]}>
                <ThemedText type="small" style={text}>
                  + Target baru
                </ThemedText>
              </Pressable>
            </View>
          )}
          {error && (
            <ThemedText type="smallBold" style={text}>
              {error}
            </ThemedText>
          )}
          <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
            <ThemedText type="small" style={text}>
              Tidak usah
            </ThemedText>
          </Pressable>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  newChip: {
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  close: {
    alignSelf: 'flex-end',
  },
  pressed: {
    opacity: 0.7,
  },
});
