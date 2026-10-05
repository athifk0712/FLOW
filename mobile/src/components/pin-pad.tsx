import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PIN_LENGTH } from '@/lib/app-lock';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'extra', '0', 'back'] as const;

/**
 * Four dots and a big on-screen keypad: no system keyboard, thumb-sized keys. `extra` is the bottom-left key
 * (e.g. fingerprint); `shake` turns the dots to the warning color after a wrong PIN.
 */
export function PinPad({
  value,
  onChange,
  disabled,
  error,
  extra,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  error?: boolean;
  extra?: { label: string; onPress: () => void } | null;
}) {
  const theme = useTheme();

  function press(key: (typeof KEYS)[number]) {
    if (disabled) return;
    if (key === 'back') return onChange(value.slice(0, -1));
    if (key === 'extra') return extra?.onPress();
    if (value.length < PIN_LENGTH) onChange(value + key);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.dots} accessibilityLabel={`${value.length} dari ${PIN_LENGTH} angka`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { borderColor: error ? theme.warning : theme.primary },
              i < value.length && { backgroundColor: error ? theme.warning : theme.primary },
            ]}
          />
        ))}
      </View>

      <View style={styles.grid}>
        {KEYS.map((key) => {
          if (key === 'extra' && !extra) return <View key={key} style={styles.key} />;
          const label = key === 'back' ? '⌫' : key === 'extra' ? extra!.label : key;
          const digit = key !== 'back' && key !== 'extra';
          return (
            <Pressable
              key={key}
              onPress={() => press(key)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={key === 'back' ? 'Hapus' : label}
              style={({ pressed }) => [
                styles.key,
                digit && { backgroundColor: theme.backgroundElement },
                pressed && { backgroundColor: theme.backgroundSelected },
                disabled && styles.disabled,
              ]}>
              <ThemedText style={digit ? styles.digit : undefined} type={digit ? 'default' : 'smallBold'}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const KEY_SIZE = 72;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.five,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  grid: {
    width: KEY_SIZE * 3 + Spacing.four * 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
    rowGap: Spacing.three,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 600,
  },
  disabled: {
    opacity: 0.4,
  },
});
