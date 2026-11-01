import { Fragment, type ReactNode, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { SearchField } from '@/components/search-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type Currency, searchCurrencies } from '@/lib/currencies';
import { type ExchangeRates, loadExchangeRates, RATES_ATTRIBUTION_URL, rateLine } from '@/lib/exchange-rates';

type Props = {
  selected: string;
  onSelect: (code: string) => void;
  /** Shown right under the selected row, e.g. a confirmation. */
  footer?: ReactNode;
};

function rowDetail(c: Currency, rates: ExchangeRates | null) {
  if (c.code === 'IDR') return 'Acuan kurs di daftar ini';
  return rateLine(c.code, rates) ?? `Simbol ${c.symbol.trim()}`;
}

function formatDay(ms: number) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(ms);
}

// Searchable list of currencies; rupiah first, then the ones Indonesians meet most often. Each row shows today's rate
// to the rupiah; without a connection and without saved rates it shows just the symbol.
export function CurrencyList({ selected, onSelect, footer }: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const results = searchCurrencies(query);

  useEffect(() => {
    let alive = true;
    loadExchangeRates().then((loaded) => {
      if (!alive) return;
      setRates(loaded);
      setRatesLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={styles.wrap}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Cari: rupiah, dolar, USD, $…" />
      {rates ? (
        <ThemedText type="small" themeColor="textSecondary">
          {`Kurs perkiraan per ${formatDay(rates.updatedAt)}, bukan harga beli atau jual bank. `}
          <ThemedText
            type="small"
            themeColor="primary"
            accessibilityRole="link"
            onPress={() => Linking.openURL(RATES_ATTRIBUTION_URL).catch(() => {})}>
            Rates By Exchange Rate API
          </ThemedText>
        </ThemedText>
      ) : (
        ratesLoaded && (
          <ThemedText type="small" themeColor="textSecondary">
            Kurs belum bisa dimuat. Periksa koneksimu.
          </ThemedText>
        )
      )}
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
                    {rowDetail(c, rates)}
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
