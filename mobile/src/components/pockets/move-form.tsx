import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCurrency, formatMoney } from '@/lib/money';
import { movePocketMoney } from '@/lib/pocket-data';
import { moveProblem, type Pocket } from '@/lib/pockets';
import { newRequestId } from '@/lib/request-id';

type Props = {
  accountId: string;
  main: number;
  pockets: Pocket[];
  from: string | null;
  to: string | null;
  onDone: () => void;
  onCancel: () => void;
};

// Moves money between Utama and the pockets of one account. The account's balance doesn't change.
export function MoveForm({ accountId, main, pockets, from: initialFrom, to: initialTo, onDone, onCancel }: Props) {
  const theme = useTheme();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [digits, setDigits] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId] = useState(newRequestId);

  const places = [{ id: null as string | null, name: 'Utama', balance: main }, ...pockets];
  const available = places.find((p) => p.id === from)?.balance ?? 0;
  const amount = Number(digits || '0');
  const problem = moveProblem(from, to, amount, available);
  const canSave = amount > 0 && !problem && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await movePocketMoney(accountId, from, to, amount, requestId);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memindahkan.');
      setSaving(false);
    }
  }

  const chips = (current: string | null, onPick: (id: string | null) => void) => (
    <View style={styles.chips}>
      {places.map((p) => {
        const on = p.id === current;
        return (
          <Pressable
            key={p.id ?? 'main'}
            onPress={() => onPick(p.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.chip, { backgroundColor: on ? theme.primary : theme.backgroundSelected }]}>
            <ThemedText type="small" style={{ color: on ? theme.onPrimary : theme.text }}>
              {p.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Pindahkan uang</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Dari · tersedia {formatMoney(available)}
      </ThemedText>
      {chips(from, setFrom)}
      <ThemedText type="small" themeColor="textSecondary">
        Ke
      </ThemedText>
      {chips(to, setTo)}
      <View style={[styles.amount, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">{getCurrency().symbol.trim()}</ThemedText>
        <AmountInput digits={digits} onChange={setDigits} label="Nominal yang dipindahkan" style={styles.amountInput} />
      </View>
      {problem && (
        <ThemedText type="small" themeColor="warning">
          {problem}
        </ThemedText>
      )}
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
      <View style={styles.actions}>
        <Pressable onPress={onCancel} hitSlop={8}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Batal
          </ThemedText>
        </Pressable>
        <Pressable
          disabled={!canSave}
          onPress={save}
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: theme.primary },
            !canSave && !saving && styles.disabled,
            (pressed || saving) && styles.pressed,
          ]}>
          {saving ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              Pindahkan
            </ThemedText>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  amount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  amountInput: {
    flex: 1,
    paddingVertical: Spacing.two + 2,
    fontSize: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  save: {
    minWidth: 110,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
