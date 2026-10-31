import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  type Budget,
  type BudgetStatus,
  BudgetRow,
  budgetStatus,
  sortBudgets,
} from '@/components/dashboard/budget-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModalEdges } from '@/constants/safe-area';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { closeModal } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';

type Filter = BudgetStatus | 'ALL';

const STATUSES: { value: BudgetStatus; label: string }[] = [
  { value: 'OVER', label: 'Lewat batas' },
  { value: 'NEAR', label: 'Hampir habis' },
  { value: 'OK', label: 'Aman' },
];

const EMPTY_FILTER: Record<BudgetStatus, string> = {
  OVER: 'Tidak ada budget yang lewat batas. Mantap!',
  NEAR: 'Tidak ada budget yang hampir habis.',
  OK: 'Belum ada budget yang masih aman.',
};

// Every current budget with its bar, the ones that need attention first. Editing lives on /budget-edit so this page
// stays a calm read.
export default function BudgetsScreen() {
  const theme = useTheme();
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [categoryNames, setCategoryNames] = useState(new Map<string, string>());
  const [filter, setFilter] = useState<Filter>('ALL');
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([supabase.from('v_budget_remaining').select('*'), supabase.from('categories').select('id, name')]).then(
        ([bud, cats]) => {
          const failed = bud.error ?? cats.error;
          if (failed) return setError(failed.message);
          setCategoryNames(new Map((cats.data ?? []).map((c) => [c.id, c.name])));
          setBudgets(sortBudgets(bud.data ?? []));
        },
      );
    }, []),
  );

  const count = (s: BudgetStatus) => budgets?.filter((b) => budgetStatus(b) === s).length ?? 0;
  const shown = budgets?.filter((b) => filter === 'ALL' || budgetStatus(b) === filter) ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={ModalEdges}>
        <View style={styles.header}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            ANGGARAN
          </ThemedText>
          <Pressable onPress={closeModal} hitSlop={12}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Tutup
            </ThemedText>
          </Pressable>
        </View>

        {budgets === null ? (
          error ? (
            <ThemedText themeColor="danger">{error}</ThemedText>
          ) : (
            <ActivityIndicator style={styles.flex} />
          )
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {budgets.length > 0 && (
              <View style={styles.tiles}>
                {STATUSES.map((s) => {
                  const selected = filter === s.value;
                  return (
                    <Pressable
                      key={s.value}
                      onPress={() => setFilter(selected ? 'ALL' : s.value)}
                      style={[styles.tile, { backgroundColor: selected ? theme.primary : theme.backgroundElement }]}>
                      <ThemedText
                        type="subtitle"
                        style={{
                          color: selected ? theme.onPrimary : s.value !== 'OK' && count(s.value) > 0 ? theme.warning : theme.text,
                        }}>
                        {count(s.value)}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.textSecondary }}>
                        {s.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {budgets.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">Belum ada budget</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Mulai dari budget mingguan untuk keinginan dan kebutuhan, lalu tambah batas per kategori kalau perlu.
                </ThemedText>
              </ThemedView>
            ) : shown.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                {filter !== 'ALL' && EMPTY_FILTER[filter]}
              </ThemedText>
            ) : (
              <ThemedView type="backgroundElement" style={styles.card}>
                {shown.map((b) => (
                  <BudgetRow key={b.budget_id} budget={b} categoryNames={categoryNames} detailed />
                ))}
              </ThemedView>
            )}

            <View style={styles.actions}>
              <Pressable
                onPress={() => router.push('/budget-edit')}
                style={[styles.action, { backgroundColor: theme.primary }]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                  Atur budget
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
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
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    gap: Spacing.half,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  card: {
    gap: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  actions: {
    gap: Spacing.two,
  },
  action: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
});
