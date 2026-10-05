import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TimeInsight } from '@/lib/time-insight';

/** "When do I slip?": one observation, the baseline that makes it meaningful, and one gentle suggestion. */
export function TimeInsightCard({ insight }: { insight: TimeInsight }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={[styles.accent, { backgroundColor: theme.accent }]} />
      <View style={styles.body}>
        <ThemedText type="smallBold">{insight.headline}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {insight.detail}
        </ThemedText>
        <ThemedView type="backgroundSelected" style={styles.tip}>
          <ThemedText type="small">{insight.tip}</ThemedText>
        </ThemedView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  accent: {
    width: 4,
    borderRadius: 2,
  },
  body: {
    flex: 1,
    gap: Spacing.two,
  },
  tip: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
});
