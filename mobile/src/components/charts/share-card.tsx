import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Donut } from '@/components/charts/donut';
import { SHARE_BASE_WIDTH, ShareFrame, ShareText } from '@/components/charts/share-frame';
import { useChartColors } from '@/constants/chart-colors';
import { useTheme } from '@/hooks/use-theme';
import { MAX_SLICES, type Slice, savingsRate } from '@/lib/charts';
import { formatMoney, formatMoneyShort } from '@/lib/money';

type Props = {
  /** Width the card is drawn at; the height follows the 9:16 of a status. */
  width: number;
  period: string;
  income: number;
  expense: number;
  slices: Slice[];
  /** Show amounts. Off by default on the share screen: a status is seen by many people. */
  showAmounts: boolean;
  /** Days in a row; shown next to the headline when there is a streak to show off. */
  streakDays: number;
};

// Every slice has a row, "Lainnya" included, so the percentages add up to the whole donut.
const ROWS = MAX_SLICES + 1;

// The picture for a WhatsApp or Instagram status: the period's headline, the streak, where the money went, and the
// Flowku name. Without amounts it speaks only in percentages.
export const ShareCard = forwardRef<View, Props>(function ShareCard({ width, period, income, expense, slices, showAmounts, streakDays }, ref) {
  const theme = useTheme();
  const colors = useChartColors();
  const s = width / SHARE_BASE_WIDTH;
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
  // A long amount shrinks so it stays beside the streak; a browser doesn't honor adjustsFontSizeToFit.
  const headlineSize = (headline.value.length <= 6 ? 46 : headline.value.length <= 10 ? 32 : 26) * s;

  const onCard = { color: theme.onPrimary };
  return (
    <ShareFrame ref={ref} width={width} footer="Dicatat pakai Flowku · flowku.expo.app">
      <View style={[styles.top, { gap: 12 * s }]}>
        <View style={[styles.flex, { gap: 2 * s }]}>
          <ShareText type="small" style={[onCard, { fontSize: 14 * s, lineHeight: 20 * s }]}>
            Rekap {period}
          </ShareText>
          <ShareText
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[onCard, styles.headline, { fontSize: headlineSize, lineHeight: 56 * s }]}>
            {headline.value}
          </ShareText>
          <ShareText type="small" style={[onCard, { fontSize: 14 * s, lineHeight: 20 * s }]}>
            {headline.caption}
          </ShareText>
        </View>
        {streakDays > 0 && (
          <View style={[styles.streak, { width: 88 * s, paddingVertical: 7 * s, borderRadius: 18 * s, backgroundColor: theme.backgroundElement }]}>
            <Text allowFontScaling={false} style={{ fontSize: 26 * s, lineHeight: 32 * s }}>🔥</Text>
            <ShareText style={[styles.headline, { fontSize: 24 * s, lineHeight: 30 * s }]}>{streakDays}</ShareText>
            <ShareText type="small" style={[styles.streakCaption, { fontSize: 11 * s, lineHeight: 14 * s }]}>
              hari beruntun
            </ShareText>
          </View>
        )}
      </View>

      <View style={[styles.panel, { padding: 14 * s, gap: 8 * s, borderRadius: 22 * s, backgroundColor: theme.backgroundElement }]}>
        <View style={styles.center}>
          <Donut
            slices={slices}
            total={expense}
            label="Pengeluaran"
            size={150 * s}
            textScale={0.8 * s}
            centerValue={showAmounts ? formatMoneyShort(expense) : `${slices.length} pos`}
          />
        </View>
        <View style={{ gap: 7 * s }}>
          {slices.slice(0, ROWS).map((slice) => (
            <View key={slice.key} style={[styles.row, { gap: 8 * s }]}>
              <View style={{ width: 10 * s, height: 10 * s, borderRadius: 3 * s, backgroundColor: colors.slot(slice.slot) }} />
              <ShareText type="small" numberOfLines={1} style={[styles.flex, { fontSize: 14 * s, lineHeight: 20 * s }]}>
                {slice.name}
              </ShareText>
              <ShareText type="smallBold" style={{ fontSize: 14 * s, lineHeight: 20 * s }}>
                {showAmounts ? formatMoney(slice.total) : `${Math.round(slice.share * 100)}%`}
              </ShareText>
            </View>
          ))}
        </View>
      </View>
    </ShareFrame>
  );
});

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headline: {
    fontWeight: 700,
  },
  streak: {
    alignItems: 'center',
  },
  streakCaption: {
    textAlign: 'center',
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
});
