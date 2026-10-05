import { useColorScheme } from '@/hooks/use-color-scheme';

// Categorical slots from the dataviz reference palette, in fixed order, validated (scripts/validate_palette.js)
// against Flowku's card surfaces: light #FFFCF6, dark #182624. Light slots 3–5 sit under 3:1 on the card,
// so every chart that uses them also lists the values as text (legend rows with amounts).
const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
};

// "Lainnya" and other neutral marks: gray, never a series hue.
const OTHER = { light: '#A8A29A', dark: '#5E6B69' };

// Money in vs out: blue and orange (slots 1–2), a validated adjacent pair in both modes.
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
