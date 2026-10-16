import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import { type AssetCategory, ASSET_CATEGORIES } from '@/constants/asset-categories';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Chips for the kind of asset (game account, gold, stocks, ...). */
export function AssetCategoryPicker({ value, onChange }: { value: AssetCategory; onChange: (next: AssetCategory) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.categories}>
      {ASSET_CATEGORIES.map((c) => {
        const on = c.value === value;
        return (
          <Pressable
            key={c.value}
            onPress={() => onChange(c.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.category, { backgroundColor: on ? theme.primary : theme.backgroundElement }]}>
            <AppSymbol material={c.material} sf={c.sf} size={20} color={on ? theme.onPrimary : c.color} />
            <ThemedText type="small" style={{ color: on ? theme.onPrimary : theme.text }}>
              {c.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
});
