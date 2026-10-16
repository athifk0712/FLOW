import { Fragment, type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SearchField } from '@/components/search-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { searchCurrencies } from '@/lib/currencies';
import { formatSample } from '@/lib/money';

type Props = {
  selected: string;
  onSelect: (code: string) => void;
  /** Shown right under the selected row, e.g. a confirmation. */
  footer?: ReactNode;
};

// Searchable list of currencies; rupiah first, then the ones Indonesians meet most often.
export function CurrencyList({ selected, onSelect, footer }: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const results = searchCurrencies(query);

  return (
    <View style={styles.wrap}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Cari: rupiah, dolar, USD, $…" />
      <ThemedText type="small" themeColor="textSecondary">
        Angka di bawah hanya contoh format penulisan, bukan kurs.
      </ThemedText>
      <View style={[styles.list, { backgroundColor: theme.backgroundElement }]}>
        {results.map((c, i) => {
          const isSelected = c.code === selected;
          return (
            <Fragment key={c.code}>
              <Pressable
                onPress={() => onSelect(c.code)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${c.name}, ${c.code}`}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
                  isSelected && { backgroundColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <View
                  style={[styles.badge, { backgroundColor: isSelected ? theme.primary : theme.backgroundSelected }]}>
                  <ThemedText type="smallBold" style={{ color: isSelected ? theme.onPrimary : theme.text }}>
                    {c.code}
                  </ThemedText>
                </View>
                <View style={styles.flex}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {c.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatSample(c)}
                  </ThemedText>
                </View>
                {isSelected && (
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    ✓
                  </ThemedText>
                )}
              </Pressable>
              {isSelected && footer}
            </Fragment>
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
