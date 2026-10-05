import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useChartColors } from '@/constants/chart-colors';
import { useTheme } from '@/hooks/use-theme';
import type { Slice } from '@/lib/charts';
import { formatMoney } from '@/lib/money';

type Props = {
  slices: Slice[];
  total: number;
  label: string;
  selected: string | null;
  onSelect: (key: string | null) => void;
  size?: number;
};

const THICKNESS = 22;
const GAP = 2; // px of card surface between segments

// Part-to-whole for one month, at most six segments. The center shows the total, or the tapped segment.
export function Donut({ slices, total, label, selected, onSelect, size = 200 }: Props) {
  const theme = useTheme();
  const colors = useChartColors();
  const r = (size - THICKNESS) / 2;
  const circumference = 2 * Math.PI * r;
  const active = slices.find((s) => s.key === selected) ?? null;
  const gap = slices.length > 1 ? GAP : 0;

  let offset = 0;
  const arcs = slices.map((s) => {
    const length = s.share * circumference;
    const arc = { slice: s, length: Math.max(length - gap, 0.5), offset };
    offset += length;
    return arc;
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {total === 0 ? (
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.backgroundSelected} strokeWidth={THICKNESS} fill="none" />
          ) : (
            arcs.map(({ slice, length, offset: start }) => (
              <Circle
                key={slice.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={colors.slot(slice.slot)}
                strokeWidth={slice.key === selected ? THICKNESS + 6 : THICKNESS}
                strokeOpacity={active && slice.key !== selected ? 0.35 : 1}
                strokeDasharray={`${length} ${circumference}`}
                strokeDashoffset={-start}
                onPress={() => onSelect(slice.key === selected ? null : slice.key)}
              />
            ))
          )}
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {active ? active.name : label}
        </ThemedText>
        <ThemedText type="smallBold" style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(active ? active.total : total)}
        </ThemedText>
        {active && (
          <ThemedText type="small" themeColor="textSecondary">
            {Math.round(active.share * 100)}%
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THICKNESS + 12,
  },
  total: {
    fontSize: 20,
    lineHeight: 26,
  },
});
