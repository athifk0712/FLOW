import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SearchField } from '@/components/search-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { searchCurrencies } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';

type Props = {
  selected: string;
  onSelect: (code: string) => void;
};

// Searchable list of currencies; rupiah first, then the ones Indonesians meet most often.
export function CurrencyList({ selected, onSelect }: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const results = searchCurrencies(query);

  return (
    <View style={styles.wrap}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Cari: rupiah, dolar, USD…" />
      <View style={[styles.list, { backgroundColor: theme.backgroundElement }]}>
        {results.map((c, i) => {
          const isSelected = c.code === selected;
          return (
            <Pressable
              key={c.code}
              onPress={() => onSelect(c.code)}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
                isSelected && { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <View style={[styles.badge, { backgroundColor: isSelected ? theme.primary : theme.backgroundSelected }]}>
                <ThemedText type="smallBold" style={{ color: isSelected ? theme.onPrimary : theme.text }}>
                  {c.code}
                </ThemedText>
              </View>
              <View style={styles.flex}>
                <ThemedText type="smallBold">{c.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatMoney(125000 * 10 ** c.decimals, c)}
                </ThemedText>
              </View>
              {isSelected && (
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  ✓
                </ThemedText>
              )}
            </Pressable>
          );
        })}
        {results.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            Mata uang tidak ditemukan.
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  list: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  badge: {
    width: 48,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  empty: {
    padding: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
