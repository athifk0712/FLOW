import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DANGER_COLOR, NECESSITY } from '@/constants/necessity';
import { Spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatRupiah } from '@/lib/money';

type Budget = Tables<'v_budget_remaining'>;

const SCOPE_LABEL = {
  DISCRETIONARY: 'Ingin & Impulsif',
  ESSENTIAL: 'Butuh & Penting',
  CATEGORY: 'Kategori',
} as const;

const SCOPE_COLOR = {
  DISCRETIONARY: NECESSITY.WANT.color,
  ESSENTIAL: NECESSITY.NEED.color,
  CATEGORY: NECESSITY.IMPORTANT.color,
} as const;

/** This week's budgets. Discretionary first: it is the one the app is really about. */
export function BudgetCard({ budgets }: { budgets: Budget[] }) {
  const weekly = budgets
    .filter((b) => b.period === 'WEEKLY' && b.scope !== 'CATEGORY')
    .sort((a, b) => Number(a.scope !== 'DISCRETIONARY') - Number(b.scope !== 'DISCRETIONARY'));

  if (weekly.length === 0) {
    return (
      <Link href="/settings" asChild>
        <Pressable>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Belum ada budget mingguan</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Atur budget untuk pengeluaran keinginan supaya FLOW bisa memberi jeda sebelum kamu belanja besar. Atur →
            </ThemedText>
          </ThemedView>
        </Pressable>
      </Link>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {weekly.map((b) => {
        const limit = b.limit_amount ?? 0;
        const spent = b.spent ?? 0;
        const remaining = b.remaining ?? 0;
        const over = remaining < 0;
        const scope = b.scope ?? 'DISCRETIONARY';
        return (
          <View key={b.budget_id} style={styles.budget}>
            <View style={styles.row}>
              <ThemedText type="smallBold">{SCOPE_LABEL[scope]}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatRupiah(spent)} / {formatRupiah(limit)}
              </ThemedText>
            </View>
            <ProgressBar total={limit} segments={[{ value: spent, color: over ? DANGER_COLOR : SCOPE_COLOR[scope] }]} />
            <ThemedText type="small" style={over ? styles.danger : undefined} themeColor="textSecondary">
              {over ? `Lewat ${formatRupiah(-remaining)} minggu ini` : `Sisa ${formatRupiah(remaining)} minggu ini`}
            </ThemedText>
            {(b.unreviewed_amount ?? 0) > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                + {formatRupiah(b.unreviewed_amount ?? 0)} belum dinilai, belum dihitung di sini
              </ThemedText>
            )}
          </View>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  budget: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  danger: {
    color: DANGER_COLOR,
  },
});
