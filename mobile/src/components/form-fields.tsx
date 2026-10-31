import { ActivityIndicator, Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrency } from '@/lib/money';

// Small form pieces shared by the Aset forms: a labelled field, an amount field (digits in, formatted out),
// a row of wallet chips, and the primary button.

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
      {hint && (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      )}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }, props.style]}
    />
  );
}

/** Amount in the currency's smallest unit, kept as a string of digits; shown with thousands separators. */
export function MoneyField({
  digits,
  onChange,
  placeholder = '0',
  accessibilityLabel,
}: {
  digits: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const currency = useCurrency();
  return (
    <View style={[styles.money, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {currency.symbol.trim()}
      </ThemedText>
      <AmountInput
        digits={digits}
        onChange={onChange}
        label={accessibilityLabel ?? 'Nominal'}
        placeholder={placeholder}
        style={styles.moneyInput}
      />
    </View>
  );
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityState={{ selected: on }}
            style={[styles.chip, { backgroundColor: on ? theme.primary : theme.backgroundElement }]}>
            <ThemedText type="small" style={{ color: on ? theme.onPrimary : theme.text }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'primary' | 'danger';
}) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.danger : theme.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.button, { backgroundColor: color }, (disabled || busy) && styles.disabled, pressed && styles.pressed]}>
      {busy ? (
        <ActivityIndicator color={theme.onPrimary} />
      ) : (
        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
  money: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  moneyInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: 600,
    paddingVertical: Spacing.two + 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
