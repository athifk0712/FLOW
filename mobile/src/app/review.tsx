import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DANGER_COLOR, NECESSITY, NECESSITY_ORDER, type Necessity } from '@/constants/necessity';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables } from '@/lib/database.types';
import { formatRupiah } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';

type Item = Pick<Tables<'transactions'>, 'id' | 'amount' | 'occurred_at' | 'merchant' | 'description'> & {
  categories: { name: string } | null;
  accounts: { name: string } | null;
};

const OPTIONS = NECESSITY_ORDER.map((value) => ({ value, ...NECESSITY[value] }));

const dateTimeFormat = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

// Nightly review: one card per unreviewed expense, one tap to tag it and move on.
// Regret ("would you buy this again?") is asked later, in the weekly review.
export default function ReviewScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [tally, setTally] = useState<Partial<Record<Necessity, number>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('transactions')
      .select(
        'id, amount, occurred_at, merchant, description, categories(name), accounts!transactions_from_account_id_user_id_fkey(name)',
      )
      .eq('needs_review', true)
      .order('occurred_at')
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        setItems(data ?? []);
      });
  }, []);

  async function tag(necessity: Necessity) {
    const item = items?.[index];
    if (!item || saving) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('transactions').update({ necessity }).eq('id', item.id);
    setSaving(false);
    if (error) return setError(error.message);
    setTally((t) => ({ ...t, [necessity]: (t[necessity] ?? 0) + 1 }));
    setIndex((i) => i + 1);
  }

  const item = items?.[index];
  const done = items !== null && !item;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            REVIEW MALAM{items && !done ? ` · ${index + 1} DARI ${items.length}` : ''}
          </ThemedText>
          <Pressable onPress={closeModal} hitSlop={12}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {done ? 'Tutup' : 'Nanti'}
            </ThemedText>
          </Pressable>
        </View>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        {items === null && !error && <ActivityIndicator style={styles.center} />}

        {item && (
          <>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {dateTimeFormat.format(new Date(item.occurred_at))} · {item.accounts?.name ?? '-'}
              </ThemedText>
              <ThemedText style={styles.amount}>{formatRupiah(item.amount)}</ThemedText>
              <ThemedText>{item.merchant ?? item.categories?.name ?? 'Tanpa kategori'}</ThemedText>
              {item.description && (
                <ThemedText type="small" themeColor="textSecondary">
                  {item.description}
                </ThemedText>
              )}
            </ThemedView>

            <ThemedText type="subtitle" style={styles.question}>
              Jujur, ini sebenarnya apa?
            </ThemedText>

            <View style={styles.options}>
              {OPTIONS.map((o) => (
                <Pressable
                  key={o.value}
                  disabled={saving}
                  onPress={() => tag(o.value)}
                  style={({ pressed }) => [
                    styles.option,
                    { borderColor: o.color, backgroundColor: theme.backgroundElement },
                    (pressed || saving) && styles.pressed,
                  ]}>
                  <View style={[styles.dot, { backgroundColor: o.color }]} />
                  <View style={styles.optionText}>
                    <ThemedText type="smallBold">{o.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {o.hint}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={() => setIndex((i) => i + 1)} style={styles.skip} hitSlop={8}>
              <ThemedText type="small" themeColor="textSecondary">
                Lewati dulu
              </ThemedText>
            </Pressable>
          </>
        )}

        {done && (
          <View style={styles.center}>
            <ThemedText type="subtitle">
              {items.length === 0 ? 'Tidak ada yang perlu direview' : 'Review selesai'}
            </ThemedText>
            {OPTIONS.filter((o) => tally[o.value]).map((o) => (
              <View key={o.value} style={styles.tallyRow}>
                <View style={[styles.dot, { backgroundColor: o.color }]} />
                <ThemedText>
                  {o.label}: {tally[o.value]}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  amount: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 700,
  },
  question: {
    fontSize: 22,
    lineHeight: 28,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  optionText: {
    flex: 1,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  skip: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  error: {
    color: DANGER_COLOR,
  },
});
