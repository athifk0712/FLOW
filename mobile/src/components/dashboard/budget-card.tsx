import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NECESSITY } from '@/constants/necessity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables } from '@/lib/database.types';
import { formatMoney } from '@/lib/money';

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

const PERIOD_LABEL = { WEEKLY: 'minggu ini', MONTHLY: 'bulan ini' } as const;

/** Current budgets. Discretionary first: it is the one the app is really about.
 * Category budgets follow, the closest to their limit first. */
export function BudgetCard({ budgets, categoryNames }: { budgets: Budget[]; categoryNames: Map<string, string> }) {
  const theme = useTheme();
  const weekly = budgets
    .filter((b) => b.period === 'WEEKLY' && b.scope !== 'CATEGORY')
    .sort((a, b) => Number(a.scope !== 'DISCRETIONARY') - Number(b.scope !== 'DISCRETIONARY'));
  const usedShare = (b: Budget) => (b.spent ?? 0) / (b.limit_amount || 1);
  const perCategory = budgets.filter((b) => b.scope === 'CATEGORY').sort((a, b) => usedShare(b) - usedShare(a));

  if (weekly.length === 0 && perCategory.length === 0) {
    return (
      <Link href="/settings" asChild>
        <Pressable>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Belum ada budget mingguan</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Atur budget keinginan dan kebutuhan supaya kamu tahu kapan perlu mengerem. Atur →
            </ThemedText>
          </ThemedView>
        </Pressable>
      </Link>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {[...weekly, ...perCategory].map((b) => {
        const limit = b.limit_amount ?? 0;
        const spent = b.spent ?? 0;
        const remaining = b.remaining ?? 0;
        const over = remaining < 0;
        const scope = b.scope ?? 'DISCRETIONARY';
        const label =
          scope === 'CATEGORY' ? (categoryNames.get(b.category_id ?? '') ?? SCOPE_LABEL.CATEGORY) : SCOPE_LABEL[scope];
        const period = PERIOD_LABEL[b.period ?? 'WEEKLY'];
        return (
          <View key={b.budget_id} style={styles.budget}>
            <View style={styles.row}>
              <ThemedText type="smallBold">{label}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatMoney(spent)} / {formatMoney(limit)}
              </ThemedText>
            </View>
            <ProgressBar total={limit} segments={[{ value: spent, color: over ? theme.danger : SCOPE_COLOR[scope] }]} />
            <ThemedText type="small" themeColor={over ? 'danger' : 'textSecondary'}>
              {over ? `Lewat ${formatMoney(-remaining)} ${period}` : `Sisa ${formatMoney(remaining)} ${period}`}
            </ThemedText>
            {(b.unreviewed_amount ?? 0) > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                + {formatMoney(b.unreviewed_amount ?? 0)} belum dinilai, belum dihitung di sini
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
});
