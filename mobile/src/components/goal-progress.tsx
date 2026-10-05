import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { NECESSITY } from '@/constants/necessity';
import { Spacing } from '@/constants/theme';
import { deadlineLabel, type Goal, goalStatus } from '@/lib/goals';
import { formatMoney } from '@/lib/money';

const GOAL_COLOR = NECESSITY.NEED.color;

/** Name, saved / target, a progress bar and one status line for a savings goal. */
export function GoalProgress({ goal }: { goal: Goal }) {
  const target = goal.target_amount ?? 0;
  const saved = goal.saved ?? 0;
  const status = goalStatus(goal);
  const percent = target > 0 ? Math.min(100, Math.floor((saved / target) * 100)) : 0;

  const line = status.done
    ? 'Tercapai!'
    : status.overdue
      ? `Lewat tenggat · kurang ${formatMoney(status.left)}`
      : status.perMonth
        ? `Sisihkan ${formatMoney(status.perMonth)}/bulan sampai ${deadlineLabel(goal.deadline!)}`
        : `Kurang ${formatMoney(status.left)}`;

  return (
    <View style={styles.goal}>
      <View style={styles.row}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
          {goal.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatMoney(saved)} / {formatMoney(target)}
        </ThemedText>
      </View>
      <ProgressBar total={target} segments={[{ value: saved, color: GOAL_COLOR }]} />
      <ThemedText type="small" themeColor={status.overdue ? 'danger' : 'textSecondary'}>
        {percent}% · {line}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  goal: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
  },
});
