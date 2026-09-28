import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RegretInsight } from '@/components/dashboard/regret-insight';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DANGER_COLOR, NECESSITY } from '@/constants/necessity';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables } from '@/lib/database.types';
import { formatRupiah } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { weeklyReviewWindow } from '@/lib/weekly-review';

type Item = Pick<Tables<'transactions'>, 'id' | 'amount' | 'occurred_at' | 'merchant' | 'description'> & {
  necessity: NonNullable<Tables<'transactions'>['necessity']>;
  categories: { name: string } | null;
};
type RegretRow = Tables<'v_regret_by_necessity'>;

const dateFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

// Weekly reflection: days after a purchase, ask whether it was worth it.
// The gap between the nightly tag and this answer is FLOW's most honest signal.
export default function WeeklyReviewScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [regretted, setRegretted] = useState({ count: 0, amount: 0 });
  const [summary, setSummary] = useState<RegretRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { from, to } = weeklyReviewWindow();
    supabase
      .from('transactions')
      .select('id, amount, occurred_at, merchant, description, necessity, categories(name)')
      .eq('type', 'EXPENSE')
      .not('necessity', 'is', null)
      .is('regret', null)
      .gte('occurred_at', from)
      .lte('occurred_at', to)
      .order('occurred_at')
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        // The query excludes NULL necessity; narrow the type to match.
        setItems((data ?? []).filter((t): t is Item => t.necessity !== null));
      });
  }, []);

  const item = items?.[index];
  const done = items !== null && !item;

  useEffect(() => {
    if (!done) return;
    supabase
      .from('v_regret_by_necessity')
      .select('*')
      .then(({ data }) => setSummary(data ?? []));
  }, [done]);

  async function answer(regret: boolean) {
    if (!item || saving) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('transactions')
      .update({ regret, regret_reviewed_at: new Date().toISOString() })
      .eq('id', item.id);
    setSaving(false);
    if (error) return setError(error.message);
    if (regret) setRegretted((r) => ({ count: r.count + 1, amount: r.amount + item.amount }));
    setIndex((i) => i + 1);
  }

  const tag = item ? NECESSITY[item.necessity] : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            REFLEKSI MINGGUAN{items && !done ? ` · ${index + 1} DARI ${items.length}` : ''}
          </ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {done ? 'Tutup' : 'Nanti'}
            </ThemedText>
          </Pressable>
        </View>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}
        {items === null && !error && <ActivityIndicator style={styles.center} />}

        {item && tag && (
          <>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {dateFormat.format(new Date(item.occurred_at))}
              </ThemedText>
              <ThemedText style={styles.amount}>{formatRupiah(item.amount)}</ThemedText>
              <ThemedText>{item.merchant ?? item.categories?.name ?? 'Tanpa kategori'}</ThemedText>
              {item.description && (
                <ThemedText type="small" themeColor="textSecondary">
                  {item.description}
                </ThemedText>
              )}
              <View style={styles.tag}>
                <View style={[styles.dot, { backgroundColor: tag.color }]} />
                <ThemedText type="small" themeColor="textSecondary">
                  Waktu itu kamu bilang: {tag.label}
                </ThemedText>
              </View>
            </ThemedView>

            <ThemedText type="subtitle" style={styles.question}>
              Kalau bisa diulang, kamu masih mau beli ini?
            </ThemedText>

            <View style={styles.answers}>
              <Pressable
                disabled={saving}
                onPress={() => answer(false)}
                style={({ pressed }) => [
                  styles.answer,
                  { backgroundColor: NECESSITY.NEED.color },
                  (pressed || saving) && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={styles.white}>
                  Ya, puas
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={() => answer(true)}
                style={({ pressed }) => [
                  styles.answer,
                  { backgroundColor: DANGER_COLOR },
                  (pressed || saving) && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={styles.white}>
                  Menyesal
                </ThemedText>
              </Pressable>
            </View>

            <Pressable onPress={() => setIndex((i) => i + 1)} style={styles.skip} hitSlop={8}>
              <ThemedText type="small" themeColor="textSecondary">
                Lewati dulu
              </ThemedText>
            </Pressable>
          </>
        )}

        {done && (
          <ScrollView contentContainerStyle={styles.summary}>
            <ThemedText type="subtitle" style={styles.question}>
              {items.length === 0 ? 'Belum ada yang perlu direfleksikan' : 'Refleksi selesai'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {items.length === 0
                ? 'Pengeluaran muncul di sini 3 hari setelah dinilai di review malam.'
                : regretted.count === 0
                  ? 'Tidak ada yang disesali minggu ini.'
                  : `${regretted.count} pengeluaran disesali, total ${formatRupiah(regretted.amount)}.`}
            </ThemedText>
            {summary && summary.length > 0 && (
              <>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  PENYESALAN PER LABEL
                </ThemedText>
                <RegretInsight rows={summary} />
              </>
            )}
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.close, { backgroundColor: theme.text }, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                Selesai
              </ThemedText>
            </Pressable>
          </ScrollView>
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
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  question: {
    fontSize: 22,
    lineHeight: 28,
  },
  answers: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  answer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.four,
    borderRadius: Spacing.three,
  },
  white: {
    color: '#ffffff',
  },
  skip: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  center: {
    flex: 1,
  },
  summary: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  close: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  error: {
    color: DANGER_COLOR,
  },
});
