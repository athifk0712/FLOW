import { PixelRatio, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import { useChartColors } from '@/constants/chart-colors';
import { iconFor } from '@/constants/category-icons';
import { useTheme } from '@/hooks/use-theme';
import { type Slice, sliceBadges } from '@/lib/charts';
import { formatMoney } from '@/lib/money';

type Props = {
  slices: Slice[];
  total: number;
  label: string;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  size?: number;
  /** What the center says instead of the total, e.g. on a shared picture that hides amounts. */
  centerValue?: string;
  /** Scales the center text with the chart, on a picture drawn at its own size. */
  textScale?: number;
};

// Android draws these icons as text, which would grow with the phone's text size and leave its circle.
const iconFontScale = () => (Platform.OS === 'android' ? PixelRatio.getFontScale() : 1);

// Part-to-whole for one month, at most six segments, with each large enough segment's icon on the ring. The center
// shows the total, or the tapped segment.
export function Donut({ slices, total, label, selected = null, onSelect, size = 200, centerValue, textScale }: Props) {
  const theme = useTheme();
  const colors = useChartColors();
  const thickness = Math.round(size * 0.085);
  const badge = Math.round(size * 0.155);
  const r = (size - badge) / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const active = slices.find((s) => s.key === selected) ?? null;
  const gap = slices.length > 1 ? Math.max(size * 0.012, 1.5) : 0; // card surface between segments
  const inset = badge + Math.round(size * 0.02);
  const toggle = (key: string) => onSelect?.(key === selected ? null : key);

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
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.backgroundSelected} strokeWidth={thickness} fill="none" />
          ) : (
            arcs.map(({ slice, length, offset: start }) => (
              <Circle
                key={slice.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={colors.slot(slice.slot)}
                strokeWidth={slice.key === selected ? thickness + 4 : thickness}
                strokeOpacity={active && slice.key !== selected ? 0.3 : 1}
                strokeDasharray={`${length} ${circumference}`}
                strokeDashoffset={-start}
                // Browsers can't press an SVG shape here; the icons and the category rows select on every platform.
                onPress={onSelect && Platform.OS !== 'web' ? () => toggle(slice.key) : undefined}
              />
            ))
          )}
        </G>
      </Svg>
      <View style={[styles.center, { paddingHorizontal: inset }]} pointerEvents="none">
        <ThemedText
          type="small"
          themeColor="textSecondary"
          numberOfLines={1}
          allowFontScaling={!textScale}
          style={textScale ? { fontSize: 14 * textScale, lineHeight: 18 * textScale } : undefined}>
          {active ? active.name : label}
        </ThemedText>
        <ThemedText
          type="smallBold"
          allowFontScaling={!textScale}
          style={[styles.total, textScale ? { fontSize: 22 * textScale, lineHeight: 28 * textScale } : undefined]}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {centerValue ?? formatMoney(active ? active.total : total)}
        </ThemedText>
        {active && (
          <ThemedText type="small" themeColor="textSecondary">
            {Math.round(active.share * 100)}%
          </ThemedText>
        )}
      </View>
      {total > 0 &&
        sliceBadges(slices).map(({ slice, angle }) => {
          const def = iconFor(slice.icon);
          const place = {
            left: size / 2 + r * Math.sin(angle) - badge / 2,
            top: size / 2 - r * Math.cos(angle) - badge / 2,
            width: badge,
            height: badge,
            borderRadius: badge / 2,
            borderWidth: Math.max(size * 0.006, 1),
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
            opacity: active && slice.key !== selected ? 0.45 : 1,
          };
          const icon = (
            <AppSymbol material={def.material} sf={def.sf} size={(badge * 0.58) / iconFontScale()} color={colors.slot(slice.slot)} />
          );
          return onSelect ? (
            <Pressable
              key={slice.key}
              onPress={() => toggle(slice.key)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityState={{ selected: slice.key === selected }}
              accessibilityLabel={`${slice.name}, ${Math.round(slice.share * 100)} persen`}
              style={[styles.badge, place]}>
              {icon}
            </Pressable>
          ) : (
            <View key={slice.key} style={[styles.badge, place]}>
              {icon}
            </View>
          );
        })}
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
  },
  total: {
    fontSize: 22,
    lineHeight: 28,
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
