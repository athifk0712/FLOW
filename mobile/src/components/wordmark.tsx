import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The Flowku mark (sun over calm water) with the name beside it. */
export function Wordmark({ size = 28 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Image
        source={require('@/assets/images/icon.png')}
        style={{ width: size, height: size, borderRadius: size * 0.28 }}
        accessibilityIgnoresInvertColors
      />
      <ThemedText style={[styles.name, { color: theme.primary, fontSize: size * 0.8, lineHeight: size }]}>
        Flowku
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    fontWeight: 800,
    letterSpacing: -0.3,
  },
});
