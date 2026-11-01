import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { SHARE_BASE_WIDTH, ShareFrame, ShareText } from '@/components/charts/share-frame';
import { useTheme } from '@/hooks/use-theme';
import type { Currency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import type { TargetProgress } from '@/lib/together';

type Props = {
  width: number;
  groupName: string;
  targetName: string;
  targetAmount: number;
  currency: Currency;
  progress: TargetProgress;
  /** Both off by default: the amounts and names belong to the whole group, not only to whoever shares. */
  showAmounts: boolean;
  showNames: boolean;
};

const MAX_ROWS = 4;
const MAX_DOTS = 12;

function Ring({ size, percent, track, color }: { size: number; percent: number; track: string; color: string }) {
  const thickness = size * 0.12;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle cx={center} cy={center} r={r} stroke={track} strokeWidth={thickness} fill="none" />
      {percent > 0 && (
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      )}
    </Svg>
  );
}

// A status picture of a shared target: how far the group got, and how many members are done. Never shows the invite
// code, since a status is seen by people outside the group, and only counts deposits the owner confirmed.
export const GroupShareCard = forwardRef<View, Props>(function GroupShareCard(
  { width, groupName, targetName, targetAmount, currency, progress, showAmounts, showNames },
  ref,
) {
  const theme = useTheme();
  const s = width / SHARE_BASE_WIDTH;
  const money = (n: number) => formatMoney(n, currency);
  const paid = progress.members.filter((m) => m.status === 'LUNAS').length;
  const total = progress.members.length;
  const rows = progress.members.slice(0, MAX_ROWS);
  const onCard = { color: theme.onPrimary };
  const ringSize = (showNames ? 130 : 180) * s;

  return (
    <ShareFrame ref={ref} width={width} footer="Patungan bareng pakai Flowku · flowku.expo.app">
      <View style={{ gap: 2 * s }}>
        <ShareText type="small" numberOfLines={1} style={[onCard, { fontSize: 14 * s, lineHeight: 20 * s }]}>
          Patungan {groupName}
        </ShareText>
        <ShareText numberOfLines={2} style={[onCard, styles.bold, { fontSize: 22 * s, lineHeight: 28 * s }]}>
          {targetName}
        </ShareText>
      </View>

      <View style={[styles.panel, { padding: 18 * s, gap: 14 * s, borderRadius: 22 * s, backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.ring, { width: ringSize, height: ringSize }]}>
          <Ring size={ringSize} percent={progress.percent} track={theme.backgroundSelected} color={theme.primary} />
          <ShareText style={[styles.bold, { fontSize: ringSize * 0.25, lineHeight: ringSize * 0.31 }]}>{progress.percent}%</ShareText>
          <ShareText type="small" style={{ fontSize: 12 * s, lineHeight: 16 * s }}>
            {progress.reached ? 'tercapai 🎉' : 'terkumpul'}
          </ShareText>
        </View>

        <View style={[styles.summary, { gap: 2 * s }]}>
          {showAmounts && (
            <ShareText type="smallBold" style={[styles.middle, { fontSize: 14 * s, lineHeight: 20 * s }]}>
              {money(progress.verified)} dari {money(targetAmount)}
            </ShareText>
          )}
          <ShareText type="smallBold" style={[styles.middle, { fontSize: 14 * s, lineHeight: 20 * s }]}>
            {paid} dari {total} anggota lunas
          </ShareText>
          {progress.deadlineText && !progress.reached && (
            <ShareText type="small" themeColor="textSecondary" style={[styles.middle, { fontSize: 13 * s, lineHeight: 18 * s }]}>
              {progress.deadlineText}
            </ShareText>
          )}
        </View>

        {showNames ? (
          <View style={{ gap: 7 * s }}>
            {rows.map((m) => (
              <View key={m.user_id} style={[styles.row, { gap: 8 * s }]}>
                <View style={{ width: 10 * s, height: 10 * s, borderRadius: 5 * s, backgroundColor: m.status === 'LUNAS' ? theme.primary : theme.backgroundSelected }} />
                <ShareText type="small" numberOfLines={1} style={[styles.flex, { fontSize: 14 * s, lineHeight: 20 * s }]}>
                  {m.name}
                </ShareText>
                {showAmounts && (
                  <ShareText type="smallBold" style={{ fontSize: 13 * s, lineHeight: 18 * s }}>
                    {money(m.verified)}
                  </ShareText>
                )}
              </View>
            ))}
            {total > MAX_ROWS && (
              <ShareText type="small" themeColor="textSecondary" style={{ fontSize: 13 * s, lineHeight: 18 * s }}>
                dan {total - MAX_ROWS} anggota lainnya
              </ShareText>
            )}
          </View>
        ) : (
          <View style={[styles.dots, { gap: 6 * s }]}>
            {progress.members.slice(0, MAX_DOTS).map((m) => (
              <View
                key={m.user_id}
                style={{
                  width: 18 * s,
                  height: 18 * s,
                  borderRadius: 9 * s,
                  backgroundColor: m.status === 'LUNAS' ? theme.primary : theme.backgroundSelected,
                }}
              />
            ))}
          </View>
        )}
      </View>
    </ShareFrame>
  );
});

const styles = StyleSheet.create({
  bold: {
    fontWeight: 700,
  },
  panel: {
    flex: 1,
    justifyContent: 'center',
  },
  ring: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    alignItems: 'center',
  },
  middle: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
});
