import { useEffect, useEffectEvent, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, type StyleProp, StyleSheet, type TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountKeypad } from '@/components/amount-keypad';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendDigit, dropLastDigit } from '@/lib/amount-input';
import type { Currency } from '@/lib/currencies';
import { formatDigits, getCurrency } from '@/lib/money';

type Props = {
  /** The amount as digits in the currency's smallest unit. */
  digits: string;
  onChange: (digits: string) => void;
  /** Names the amount on the keypad and for screen readers, e.g. "Jumlah setoran". */
  label: string;
  placeholder?: string;
  /** Text style of the shown amount, the same one the field's input used. */
  style?: StyleProp<TextStyle>;
  currency?: Currency;
  disabled?: boolean;
  /** Opens the keypad when the field appears. */
  autoOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const SHEET_WIDTH = 520;

// Every amount in the app is typed on Flowku's keypad, with 000 next to 0: tapping the field opens it as a sheet at the
// bottom, showing the amount as it grows. A laptop keyboard works too (digits, Backspace, Enter, Escape).
export function AmountInput({ digits, onChange, label, placeholder = '0', style, currency, disabled, autoOpen, onOpenChange }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(!!autoOpen);
  const money = currency ?? getCurrency();

  function toggle(next: boolean) {
    if (next) Keyboard.dismiss();
    setOpen(next);
    onOpenChange?.(next);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') toggle(false);
    else if (/^\d$/.test(e.key)) onChange(appendDigit(digits, e.key));
    else if (e.key === 'Backspace') onChange(dropLastDigit(digits));
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const listener = (e: KeyboardEvent) => onKey(e);
    // Capture phase: Enter must not also press whichever keypad button has focus.
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, [open]);

  return (
    <>
      <Pressable
        onPress={() => toggle(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${digits ? formatDigits(digits, money) : 'kosong'}`}
        style={styles.field}>
        <ThemedText numberOfLines={1} style={[style, !digits && { color: theme.textSecondary }]}>
          {digits ? formatDigits(digits, money) : placeholder}
        </ThemedText>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => toggle(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.dismiss} onPress={() => toggle(false)} accessibilityLabel="Tutup keypad" />
          <View
            style={[
              styles.sheet,
              { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, Spacing.two) },
            ]}>
            <View style={styles.preview}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {money.symbol.trim()}
              </ThemedText>
              <ThemedText
                testID="keypad-amount"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.amount, !digits && { color: theme.textSecondary }]}>
                {digits ? formatDigits(digits, money) : '0'}
              </ThemedText>
            </View>
            <AmountKeypad digits={digits} onChange={onChange} label={label} onClose={() => toggle(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // The field fills the row its input used to fill.
  field: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dismiss: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    width: '100%',
    maxWidth: SHEET_WIDTH,
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.three,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  amount: {
    flex: 1,
    minWidth: 0,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: 700,
  },
});
