import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables } from '@/lib/database.types';
import { formatRupiah } from '@/lib/money';
import { supabase } from '@/lib/supabase';

type Category = Pick<Tables<'categories'>, 'id' | 'name'>;
type Account = Pick<Tables<'accounts'>, 'id' | 'name'>;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as const;
const MAX_DIGITS = 12;

// Two-tap quick log: amount -> category -> save. Necessity is left NULL for the nightly review.
export default function QuickLogScreen() {
  const theme = useTheme();
  const [digits, setDigits] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [guessed, setGuessed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('id, name').eq('kind', 'EXPENSE').order('created_at'),
      supabase.from('accounts').select('id, name').is('archived_at', null).order('created_at'),
      supabase
        .from('transactions')
        .select('category_id, from_account_id, occurred_at')
        .eq('type', 'EXPENSE')
        .order('occurred_at', { ascending: false })
        .limit(100),
    ]).then(([cats, accs, recent]) => {
      const failed = cats.error ?? accs.error ?? recent.error;
      if (failed) return setError(failed.message);

      const accountRows = accs.data ?? [];
      const recentRows = recent.data ?? [];
      setCategories(cats.data ?? []);
      setAccounts(accountRows);

      // Default account: the one used last, else the first one.
      setAccountId(recentRows[0]?.from_account_id ?? accountRows[0]?.id ?? null);

      // Smart guess: the category logged most often around this hour.
      const hour = new Date().getHours();
      const counts = new Map<string, number>();
      for (const t of recentRows) {
        if (!t.category_id) continue;
        const diff = Math.abs(new Date(t.occurred_at).getHours() - hour);
        if (Math.min(diff, 24 - diff) <= 1) counts.set(t.category_id, (counts.get(t.category_id) ?? 0) + 1);
      }
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best) {
        setCategoryId(best[0]);
        setGuessed(true);
      }
    });
  }, []);

  const amount = Number(digits || '0');
  const canSave = amount > 0 && !!accountId && !saving;

  function press(key: (typeof KEYS)[number]) {
    if (key === 'del') return setDigits((d) => d.slice(0, -1));
    setDigits((d) => {
      const next = (d + key).replace(/^0+/, '');
      return next.length > MAX_DIGITS ? d : next;
    });
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('transactions').insert({
      type: 'EXPENSE',
      amount,
      from_account_id: accountId,
      category_id: categoryId,
    });
    setSaving(false);
    if (error) return setError(error.message);
    router.back();
  }

  const chip = (selected: boolean) => [
    styles.chip,
    { backgroundColor: selected ? theme.text : theme.backgroundElement },
  ];
  const chipText = (selected: boolean) => ({ color: selected ? theme.background : theme.text });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            QUICK LOG
          </ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Batal
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          {formatRupiah(amount)}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          Akun bayar{accounts.length > 1 ? ' (otomatis: terakhir dipakai)' : ''}
        </ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {accounts.map((a) => (
            <Pressable key={a.id} onPress={() => setAccountId(a.id)} style={chip(a.id === accountId)}>
              <ThemedText type="small" style={chipText(a.id === accountId)}>
                {a.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        <ThemedText type="small" themeColor="textSecondary">
          Kategori{guessed ? ' (tebakan dari jam ini)' : ''}
        </ThemedText>
        <View style={styles.chipsWrap}>
          {categories.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                setCategoryId(c.id === categoryId ? null : c.id);
                setGuessed(false);
              }}
              style={chip(c.id === categoryId)}>
              <ThemedText type="small" style={chipText(c.id === categoryId)}>
                {c.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <View style={styles.keypad}>
          {KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => press(key)}
              onLongPress={key === 'del' ? () => setDigits('') : undefined}
              style={({ pressed }) => [
                styles.key,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={styles.keyText}>{key === 'del' ? '⌫' : key}</ThemedText>
            </Pressable>
          ))}
        </View>

        <Pressable
          disabled={!canSave}
          onPress={save}
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: theme.text },
            !canSave && !saving && styles.disabled,
            (pressed || saving) && styles.pressed,
          ]}>
          {saving ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              SIMPAN (review nanti malam)
            </ThemedText>
          )}
        </Pressable>
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
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amount: {
    fontSize: 44,
    lineHeight: 56,
    fontWeight: 700,
    paddingVertical: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 'auto',
  },
  key: {
    width: '31.5%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  keyText: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 600,
  },
  save: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: '#e5484d',
  },
});
