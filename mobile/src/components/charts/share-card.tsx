import { forwardRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Donut } from '@/components/charts/donut';
import { ThemedText } from '@/components/themed-text';
import { useChartColors } from '@/constants/chart-colors';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type Slice, savingsRate } from '@/lib/charts';
import { formatMoney, formatMoneyShort } from '@/lib/money';

type Props = {
  /** Width on screen; the height follows the 9:16 of a status. */
  width: number;
  period: string;
  income: number;
  expense: number;
  slices: Slice[];
  /** Show amounts. Off by default on the share screen: a status is seen by many people. */
  showAmounts: boolean;
};

const ROWS = 4;
const BASE_WIDTH = 320;

// The picture for a WhatsApp or Instagram status: the period's headline, where the money went, and the Flowku name.
// Without amounts it speaks only in percentages.
export const ShareCard = forwardRef<View, Props>(function ShareCard({ width, period, income, expense, slices, showAmounts }, ref) {
  const theme = useTheme();
  const colors = useChartColors();
  const s = width / BASE_WIDTH;
  const net = income - expense;
  const rate = savingsRate(income, expense);
  const top = slices[0];

  const headline = showAmounts
    ? { value: formatMoney(net), caption: net >= 0 ? 'sisa di periode ini' : 'selisih di periode ini' }
    : rate !== null
      ? { value: `${rate}%`, caption: 'pemasukan berhasil disisihkan' }
      : top
        ? { value: `${Math.round(top.share * 100)}%`, caption: `pengeluaran untuk ${top.name}` }
        : { value: '—', caption: 'belum ada catatan' };

  const onCard = { color: theme.onPrimary };
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { width, height: (width * 16) / 9, padding: 20 * s, gap: 14 * s, backgroundColor: theme.primary }]}>
      <View style={[styles.bubble, { width: 220 * s, height: 220 * s, top: -70 * s, right: -60 * s, backgroundColor: theme.accent }]} />
      <View style={[styles.bubble, { width: 150 * s, height: 150 * s, top: 90 * s, left: -70 * s, backgroundColor: theme.onPrimary }]} />

      <View style={[styles.brand, { gap: 8 * s }]}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={{ width: 32 * s, height: 32 * s, borderRadius: 9 * s }}
          accessibilityIgnoresInvertColors
        />
        <ThemedText type="smallBold" style={[onCard, { fontSize: 16 * s, lineHeight: 22 * s }]}>
          Flowku
        </ThemedText>
      </View>

      <View style={{ gap: 2 * s }}>
        <ThemedText type="small" style={[onCard, { fontSize: 14 * s, lineHeight: 20 * s }]}>
          Rekap {period}
        </ThemedText>
        <ThemedText numberOfLines={1} adjustsFontSizeToFit style={[onCard, styles.headline, { fontSize: 46 * s, lineHeight: 56 * s }]}>
          {headline.value}
        </ThemedText>
        <ThemedText type="small" style={[onCard, { fontSize: 14 * s, lineHeight: 20 * s }]}>
          {headline.caption}
        </ThemedText>
      </View>

      <View style={[styles.panel, { padding: 16 * s, gap: 12 * s, borderRadius: 22 * s, backgroundColor: theme.backgroundElement }]}>
        <View style={styles.center}>
          <Donut
            slices={slices}
            total={expense}
            label="Pengeluaran"
            size={150 * s}
            centerValue={showAmounts ? formatMoneyShort(expense) : `${slices.length} pos`}
          />
        </View>
        <View style={{ gap: 8 * s }}>
          {slices.slice(0, ROWS).map((slice) => (
            <View key={slice.key} style={[styles.row, { gap: 8 * s }]}>
              <View style={{ width: 10 * s, height: 10 * s, borderRadius: 3 * s, backgroundColor: colors.slot(slice.slot) }} />
              <ThemedText type="small" numberOfLines={1} style={[styles.flex, { fontSize: 14 * s, lineHeight: 20 * s }]}>
                {slice.name}
              </ThemedText>
              <ThemedText type="smallBold" style={{ fontSize: 14 * s, lineHeight: 20 * s }}>
                {showAmounts ? formatMoney(slice.total) : `${Math.round(slice.share * 100)}%`}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      <ThemedText type="small" style={[onCard, styles.footer, { fontSize: 12 * s, lineHeight: 16 * s }]}>
        Dicatat pakai Flowku · flowku.expo.app
      </ThemedText>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: Spacing.three,
  },
  bubble: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headline: {
    fontWeight: 700,
  },
  panel: {
    flex: 1,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  footer: {
    textAlign: 'center',
    opacity: 0.85,
  },
});
