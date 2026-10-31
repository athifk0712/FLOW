import { useColorScheme } from '@/hooks/use-color-scheme';

// Categorical slots in Flowku's own colors, in fixed order, validated (dataviz scripts/validate_palette.js) against the
// card surfaces: light #FFFCF6, dark #22332F. Orange sits under 3:1 on the light card, so every chart that uses it also
// lists the values as text (category rows with amounts, labels on the selected month).
const SERIES = {
  light: ['#0F8F7E', '#E9823B', '#3D7FC1', '#D4507F', '#8A6BD1'],
  dark: ['#14A08D', '#D9702A', '#4A8FD6', '#D65C8A', '#9478DC'],
};

// "Lainnya" and other neutral marks: gray, never a series hue.
const OTHER = { light: '#A8A29A', dark: '#5E6B69' };

// Money in vs out: teal and orange (slots 1–2), a validated adjacent pair in both modes.
export function useChartColors() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const series = SERIES[scheme];
  return {
    series,
    other: OTHER[scheme],
    income: series[0],
    expense: series[1],
    slot: (slot: number | null) => (slot === null ? OTHER[scheme] : (series[slot] ?? OTHER[scheme])),
  };
}
