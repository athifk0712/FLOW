import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';

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

const HEIGHT = 190;
const LABEL_H = 24; // bottom gutter for month labels
const TOP = 20; // room for the selected month's value labels
const MAX_BAR_W = 16;
const PAIR_GAP = 2; // surface gap between the income and expense bar
const RADIUS = 4;

/** A bar with a 4px rounded top and a square foot on the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(RADIUS, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

// Money in and out per month on one axis, with only a baseline behind them: the selected month carries its own numbers
// and the others stay quiet. Tapping a month selects it for the rest of the screen.
export function FlowBars({ flows, labels, selected, onSelect }: Props) {
  const theme = useTheme();
  const colors = useChartColors();
  const [width, setWidth] = useState(0);
  const scale = 10 ** getCurrency().decimals;
  const max = niceMax(Math.max(...flows.flatMap((f) => [f.income, f.expense]), 0) / scale) * scale;
  const plotH = HEIGHT - TOP - LABEL_H;
  const slot = flows.length > 0 ? width / flows.length : 0;
  const barW = Math.min(MAX_BAR_W, Math.max((slot - PAIR_GAP - 16) / 2, 6));
  const y = (v: number) => TOP + plotH - (v / max) * plotH;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.wrap}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          <Line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={theme.backgroundSelected} strokeWidth={1.5} />
          {flows.map((f, i) => {
            const cx = slot * i + slot / 2;
            const isSelected = i === selected;
            const dim = isSelected ? 1 : 0.35;
            const incomeH = (f.income / max) * plotH;
            const expenseH = (f.expense / max) * plotH;
            const incomeX = cx - barW - PAIR_GAP / 2;
            const expenseX = cx + PAIR_GAP / 2;
            return (
              <G key={f.start.toISOString()}>
                {incomeH > 0 && <Path d={barPath(incomeX, y(f.income), barW, incomeH)} fill={colors.income} opacity={dim} />}
                {expenseH > 0 && <Path d={barPath(expenseX, y(f.expense), barW, expenseH)} fill={colors.expense} opacity={dim} />}
                {isSelected && incomeH > 0 && (
                  <SvgText
                    x={incomeX + barW}
                    y={y(f.income) - 6}
                    fontSize={11}
                    fontWeight="700"
                    fontFamily="sans-serif"
                    fill={theme.text}
                    textAnchor="end">
                    {compactAmount(f.income / scale)}
                  </SvgText>
                )}
                {isSelected && expenseH > 0 && (
                  <SvgText
                    x={expenseX}
                    y={y(f.expense) - 6}
                    fontSize={11}
                    fontWeight="700"
                    fontFamily="sans-serif"
                    fill={theme.text}
                    textAnchor="start">
                    {compactAmount(f.expense / scale)}
                  </SvgText>
                )}
                <SvgText
                  x={cx}
                  y={HEIGHT - 6}
                  fontSize={12}
                  fontFamily="sans-serif"
                  fontWeight={isSelected ? '700' : '400'}
                  fill={isSelected ? theme.text : theme.textSecondary}
                  textAnchor="middle">
                  {labels[i]}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      )}
      {/* Hit targets: the whole column, bigger than the bars. */}
      <View style={styles.targets}>
        {flows.map((f, i) => (
          <Pressable
            key={f.start.toISOString()}
            onPress={() => onSelect(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: i === selected }}
            accessibilityLabel={`Pilih ${labels[i]}`}
            style={styles.flex}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: HEIGHT,
  },
  targets: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
  },
  flex: {
    flex: 1,
  },
});
