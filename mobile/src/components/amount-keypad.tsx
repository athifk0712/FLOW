import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendDigit, appendThousands, dropLastDigit } from '@/lib/amount-input';

type Props = {
  /** The amount as digits (smallest currency unit); the keypad only ever produces digits. */
  digits: string;
  onChange: (digits: string) => void;
  /** What is being typed, e.g. "Nominal" or "Biaya admin". */
  label: string;
  onClose: () => void;
};

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['back', '0', '000'],
] as const;

// A phone-style number pad with 000 right next to 0. Android's own keyboard can't be given an extra key, so amounts
// in Catat use this instead of the system keyboard (which then never opens for them, so nothing is typed twice).
// Backspace removes one digit; holding it clears the amount.
export function AmountKeypad({ digits, onChange, label, onClose }: Props) {
  const theme = useTheme();

  function press(key: (typeof ROWS)[number][number]) {
    if (key === 'back') onChange(dropLastDigit(digits));
    else if (key === '000') onChange(appendThousands(digits));
    else onChange(appendDigit(digits, key));
  }

  return (
    <ThemedView type="backgroundElement" style={styles.pad}>
      <View style={styles.head}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Tutup keypad" style={styles.close}>
          <ThemedText type="smallBold" themeColor="primary">
            Selesai
          </ThemedText>
          <AppSymbol material="keyboard_arrow_down" sf="chevron.down" size={18} color={theme.primary} />
        </Pressable>
      </View>
      {ROWS.map((row) => (
        <View key={row.join()} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={() => press(key)}
              onLongPress={key === 'back' ? () => onChange('') : undefined}
              accessibilityRole="button"
              accessibilityLabel={key === 'back' ? 'Hapus satu angka' : key === '000' ? 'Tiga nol' : key}
              accessibilityHint={key === 'back' ? 'Tahan untuk mengosongkan nominal' : undefined}
              style={({ pressed }) => [
                styles.key,
                { backgroundColor: key === '000' ? theme.backgroundSelected : theme.background },
                pressed && { backgroundColor: theme.backgroundSelected },
              ]}>
              {key === 'back' ? (
                <AppSymbol material="backspace" sf="delete.left" size={22} color={theme.text} />
              ) : (
                <ThemedText style={[styles.keyText, key === '000' && { color: theme.primary }]}>{key}</ThemedText>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  pad: {
    gap: Spacing.one + 2,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  close: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.one + 2,
  },
  // 46pt tall: easy to hit, and four rows still leave room for the categories on a small phone.
  key: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two + 2,
  },
  keyText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 600,
  },
});
