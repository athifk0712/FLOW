import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useChartColors } from '@/constants/chart-colors';
import { useTheme } from '@/hooks/use-theme';
import { compactAmount, type MonthFlow, niceMax } from '@/lib/charts';
import { getCurrency } from '@/lib/money';

type Props = {
  flows: MonthFlow[];
  labels: string[];
  selected: number;
  onSelect: (index: number) => void;
};

const HEIGHT = 180;
const AXIS_W = 44; // left gutter for the value labels
const LABEL_H = 22; // bottom gutter for month labels
const TOP = 8;
const BAR_W = 10;
const PAIR_GAP = 2; // surface gap between the income and expense bar
const RADIUS = 4;

/** A bar with a 4px rounded top and a square foot on the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(RADIUS, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

// Money in (blue) and out (orange) per month on one axis. Tapping a month selects it for the rest of the screen.
export function FlowBars({ flows, labels, selected, onSelect }: Props) {
  const theme = useTheme();
  const colors = useChartColors();
  const [width, setWidth] = useState(0);
  const scale = 10 ** getCurrency().decimals;
  const max = niceMax(Math.max(...flows.flatMap((f) => [f.income, f.expense]), 0) / scale) * scale;
  const plotW = Math.max(width - AXIS_W, 0);
  const plotH = HEIGHT - TOP - LABEL_H;
  const slot = flows.length > 0 ? plotW / flows.length : 0;
  const y = (v: number) => TOP + plotH - (v / max) * plotH;
  const ticks = [0, 0.5, 1].map((t) => t * max);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.wrap}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {ticks.map((v) => (
            <Line
              key={v}
              x1={AXIS_W}
              x2={width}
              y1={y(v)}
              y2={y(v)}
              stroke={theme.backgroundSelected}
              strokeWidth={v === 0 ? 1.5 : 1}
            />
          ))}
          {ticks.map((v) => (
            <SvgText key={`l${v}`} x={AXIS_W - 6} y={y(v) + 4} fontSize={11} fontFamily="sans-serif" fill={theme.textSecondary} textAnchor="end">
              {compactAmount(v / scale)}
            </SvgText>
          ))}
          {flows.map((f, i) => {
            const cx = AXIS_W + slot * i + slot / 2;
            const isSelected = i === selected;
            const dim = isSelected ? 1 : 0.45;
            const incomeH = (f.income / max) * plotH;
            const expenseH = (f.expense / max) * plotH;
            return (
              <G key={f.start.toISOString()}>
                {isSelected && (
                  <Rect
                    x={cx - slot / 2 + 2}
                    y={TOP}
                    width={slot - 4}
                    height={plotH}
                    rx={6}
                    fill={theme.backgroundSelected}
                    opacity={0.6}
                  />
                )}
                {incomeH > 0 && (
                  <Path d={barPath(cx - BAR_W - PAIR_GAP / 2, y(f.income), BAR_W, incomeH)} fill={colors.income} opacity={dim} />
                )}
                {expenseH > 0 && (
                  <Path d={barPath(cx + PAIR_GAP / 2, y(f.expense), BAR_W, expenseH)} fill={colors.expense} opacity={dim} />
                )}
                <SvgText
                  x={cx}
                  y={HEIGHT - 6}
                  fontSize={11}
                  fontFamily="sans-serif"
                  fontWeight={isSelected ? '700' : '400'}
                  fill={isSelected ? theme.text : theme.textSecondary}
                  textAnchor="middle">
                  {labels[i]}
                </SvgText>
                {/* Hit target: the whole column, bigger than the bars. */}
                <Rect x={cx - slot / 2} y={0} width={slot} height={HEIGHT} fill="transparent" onPress={() => onSelect(i)} />
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: HEIGHT,
  },
});
