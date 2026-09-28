import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Segment = { value: number; color: string };

/** Horizontal bar split into proportional segments. Values are relative to `total`. */
export function ProgressBar({ segments, total, height = 10 }: { segments: Segment[]; total: number; height?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.backgroundSelected }]}>
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <View key={i} style={{ flex: Math.min(s.value, total) / total, backgroundColor: s.color }} />
          ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
});
