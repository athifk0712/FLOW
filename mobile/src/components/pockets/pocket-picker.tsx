import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import { usePockets } from '@/lib/pocket-data';

type Props = {
  accountId: string | null;
  value: string | null;
  onChange: (pocketId: string | null) => void;
  direction: 'out' | 'in';
  amount: number;
};

// Which pocket of the chosen account a transaction belongs to. Nothing shows for an account without pockets, so people
// who don't use them never see an extra step. Utama is the default.
export function PocketPicker({ accountId, value, onChange, direction, amount }: Props) {
  const theme = useTheme();
  const pockets = usePockets().filter((p) => p.account_id === accountId);
  if (pockets.length === 0) return null;

  const selected = pockets.find((p) => p.id === value);
  const overdrawn = direction === 'out' && !!selected && amount > selected.balance;
  const options = [{ id: null, label: 'Utama' }, ...pockets.map((p) => ({ id: p.id, label: `${p.name} · ${formatMoney(p.balance)}` }))];

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        {direction === 'out' ? 'Dari kantong' : 'Masuk ke kantong'}
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
        {options.map((o) => {
          const on = o.id === (selected?.id ?? null);
          return (
            <Pressable
              key={o.id ?? 'main'}
              onPress={() => onChange(o.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, { backgroundColor: on ? theme.primary : theme.backgroundElement }]}>
              <ThemedText type="small" style={{ color: on ? theme.onPrimary : theme.text }}>
                {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      {overdrawn && (
        <ThemedText type="small" themeColor="warning">
          Kantong {selected.name} akan minus. Tetap bisa disimpan; nanti bisa kamu isi lagi.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
});
