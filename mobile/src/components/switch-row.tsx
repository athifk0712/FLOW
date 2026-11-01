import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** No surface of its own, for use inside a card. */
  flat?: boolean;
};

// A labelled on/off switch.
export function SwitchRow({ label, detail, value, onChange, flat = false }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      aria-checked={value}
      accessibilityLabel={label}
      style={[styles.row, !flat && [styles.surface, { backgroundColor: theme.backgroundElement }]]}>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: value ? theme.primary : theme.backgroundSelected }]}>
        <View style={[styles.thumb, { backgroundColor: theme.onPrimary }, value && styles.thumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  surface: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  track: {
    width: 44,
    height: 26,
    padding: 3,
    borderRadius: 13,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  thumbOn: {
    alignSelf: 'flex-end',
  },
});
