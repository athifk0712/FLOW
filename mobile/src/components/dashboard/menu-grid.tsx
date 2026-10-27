import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Feature } from '@/components/dashboard/features';
import { FeatureIcon } from '@/components/feature-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Colourful round icons with a label under each, four to a row, like the service grid of Gojek. */
export function MenuGrid({ items, columns = 4 }: { items: Feature[]; columns?: number }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={() => router.push(item.href)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          style={({ pressed }) => [styles.item, { width: `${100 / columns}%` }, pressed && styles.pressed]}>
          <FeatureIcon name={item.icon} />
          <ThemedText type="smallBold" style={styles.label} numberOfLines={1}>
            {item.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.three,
  },
  item: {
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.half,
  },
  label: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
});
