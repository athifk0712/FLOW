import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { useChartColors } from '@/constants/chart-colors';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Slice } from '@/lib/charts';
import { formatMoney } from '@/lib/money';

type Props = {
  slices: Slice[];
  selected: string | null;
  onSelect: (key: string | null) => void;
};

// The donut's legend and its numbers in one list: each category with its share as a bar in the donut's color.
export function CategoryRows({ slices, selected, onSelect }: Props) {
  const theme = useTheme();
  const colors = useChartColors();
  return (
    <View style={styles.list}>
      {slices.map((s) => {
        const isSelected = s.key === selected;
        return (
          <Pressable
            key={s.key}
            onPress={() => onSelect(isSelected ? null : s.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${s.name}, ${Math.round(s.share * 100)} persen, ${formatMoney(s.total)}`}
            style={({ pressed }) => [
              styles.row,
              isSelected && { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <CategoryIcon icon={s.icon} size={38} />
            <View style={styles.body}>
              <View style={styles.line}>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
                  {s.name}
                </ThemedText>
                <ThemedText type="smallBold">{formatMoney(s.total)}</ThemedText>
              </View>
              <View style={styles.line}>
                <View style={styles.bar}>
                  <ProgressBar total={1} segments={[{ value: s.share, color: colors.slot(s.slot) }]} height={6} />
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.share}>
                  {Math.round(s.share * 100)}%
                </ThemedText>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
  },
  body: {
    flex: 1,
    gap: Spacing.one,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    flex: 1,
  },
  bar: {
    flex: 1,
  },
  share: {
    minWidth: 34,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.7,
  },
});
