import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/progress-bar';
import { SaveToGoal } from '@/components/save-to-goal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NECESSITY } from '@/constants/necessity';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables } from '@/lib/database.types';
import { currentMonthKey, formatRupiah } from '@/lib/money';
import { supabase } from '@/lib/supabase';

type Intent = Tables<'buy_intents'>;
type Account = Pick<Tables<'accounts'>, 'id' | 'name'>;
type Phase = 'COOLING' | 'READY' | 'EXPIRED';

const EXPIRE_AFTER_MS = 14 * 24 * 60 * 60 * 1000; // matches v_buy_intents
const dateFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });

function phaseOf(intent: Intent, now: number): Phase {
  const until = new Date(intent.cooldown_until).getTime();
  if (now < until) return 'COOLING';
  return now >= until + EXPIRE_AFTER_MS ? 'EXPIRED' : 'READY';
}

function formatDuration(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}h ${hours}j`;
  if (hours > 0) return `${hours}j ${mins}m`;
  return `${mins}m`;
}

// "Before You Buy": park a purchase, wait out a proportional cooldown, then decide.
export default function IntentsScreen() {
  const theme = useTheme();
  const [intents, setIntents] = useState<Intent[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [heldBack, setHeldBack] = useState({ total: 0, count: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  // Cancelled intents whose money is already set aside for a goal, and the one being offered now.
  const [savedIntentIds, setSavedIntentIds] = useState(new Set<string>());
  const [offer, setOffer] = useState<Intent | null>(null);

  const load = useCallback(() => {
    Promise.all([
      supabase.from('buy_intents').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('accounts').select('id, name').is('archived_at', null).order('created_at'),
      supabase
        .from('v_saved_money_monthly')
        .select('total_held_back, items_held_back')
        .eq('month', currentMonthKey())
        .maybeSingle(),
      supabase.from('goal_contributions').select('intent_id').not('intent_id', 'is', null),
    ]).then(([int, acc, held, saved]) => {
      const failed = int.error ?? acc.error ?? held.error ?? saved.error;
      if (failed) return setError(failed.message);
      setError(null);
      setIntents(int.data ?? []);
      setAccounts(acc.data ?? []);
      setHeldBack({ total: held.data?.total_held_back ?? 0, count: held.data?.items_held_back ?? 0 });
      setSavedIntentIds(new Set((saved.data ?? []).map((c) => c.intent_id!)));
      setNow(Date.now());
    });
  }, []);

  useFocusEffect(load);

  // Keep countdowns live.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const pending = intents?.filter((i) => i.status === 'PENDING') ?? [];
  const decided = intents?.filter((i) => i.status !== 'PENDING').slice(0, 10) ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            TUNDA BELI
          </ThemedText>
          <ThemedText type="subtitle">Tarik napas dulu.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Mau beli sesuatu yang lumayan? Catat di sini. Flowku memberi jeda sesuai besarnya harga dibanding sisa
            budget keinginanmu, lalu kamu putuskan dengan kepala dingin.
          </ThemedText>

          <ThemedView style={[styles.card, styles.heldBack, { backgroundColor: theme.accent }]}>
            <ThemedText type="small" style={{ color: theme.onAccent }}>
              Ditahan bulan ini
            </ThemedText>
            <ThemedText type="subtitle" style={[{ color: theme.onAccent }, styles.heldAmount]}>
              {formatRupiah(heldBack.total)}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.onAccent }}>
              {heldBack.count} barang tidak jadi dibeli
            </ThemedText>
          </ThemedView>

          <Pressable
            onPress={() => router.push('/intent-new')}
            style={({ pressed }) => [styles.addButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              + Tambah niat beli
            </ThemedText>
          </Pressable>

          {offer && (
            <SaveToGoal
              key={offer.id}
              intentId={offer.id}
              itemName={offer.item_name}
              amount={offer.estimated_cost}
              onClose={() => {
                setOffer(null);
                load();
              }}
            />
          )}

          {error && <ThemedText themeColor="danger">{error}</ThemedText>}
          {intents === null && !error && <ActivityIndicator />}

          {pending.map((intent) => (
            <IntentCard
              key={intent.id}
              intent={intent}
              accounts={accounts}
              now={now}
              onChanged={load}
              onCancelled={() => setOffer(intent)}
            />
          ))}

          {decided.length > 0 && (
            <View style={styles.history}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                RIWAYAT
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                {decided.map((i) => (
                  <View key={i.id} style={styles.row}>
                    <View style={styles.flex}>
                      <ThemedText type="small">{i.item_name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {i.status === 'CANCELLED' ? 'Ditahan' : 'Dibeli'} · {dateFormat.format(new Date(i.decided_at ?? i.created_at))}
                      </ThemedText>
                    </View>
                    <View style={styles.amountColumn}>
                      <ThemedText type="small" style={i.status === 'CANCELLED' ? styles.saved : undefined}>
                        {formatRupiah(i.estimated_cost)}
                      </ThemedText>
                      {i.status === 'CANCELLED' && !savedIntentIds.has(i.id) && offer?.id !== i.id && (
                        <Pressable onPress={() => setOffer(i)} hitSlop={8}>
                          <ThemedText type="small" style={{ color: theme.primary }}>
                            Sisihkan ke tabungan →
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </ThemedView>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function IntentCard({
  intent,
  accounts,
  now,
  onChanged,
  onCancelled,
}: {
  intent: Intent;
  accounts: Account[];
  now: number;
  onChanged: () => void;
  onCancelled: () => void;
}) {
  const theme = useTheme();
  const [buying, setBuying] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phase = phaseOf(intent, now);
  const created = new Date(intent.created_at).getTime();
  const until = new Date(intent.cooldown_until).getTime();
  const necessity = NECESSITY[intent.necessity];

  async function cancel() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('buy_intents').update({ status: 'CANCELLED' }).eq('id', intent.id);
    setBusy(false);
    if (error) return setError(error.message);
    onCancelled();
    onChanged();
  }

  async function purchase() {
    const account = accountId ?? accounts[0]?.id;
    if (!account) return setError('Belum ada akun bayar');
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('purchase_intent', { p_intent_id: intent.id, p_account_id: account });
    setBusy(false);
    if (error) return setError(error.message);
    onChanged();
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">{intent.item_name}</ThemedText>
          <View style={styles.tag}>
            <View style={[styles.dot, { backgroundColor: necessity.color }]} />
            <ThemedText type="small" themeColor="textSecondary">
              {necessity.label}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="smallBold">{formatRupiah(intent.estimated_cost)}</ThemedText>
      </View>

      {phase === 'COOLING' ? (
        <>
          <ProgressBar total={until - created} segments={[{ value: now - created, color: necessity.color }]} />
          <ThemedText type="small" themeColor="textSecondary">
            Masih jeda. Bisa diputuskan dalam {formatDuration(until - now)}.
          </ThemedText>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {phase === 'EXPIRED'
            ? 'Sudah lebih dari 2 minggu tanpa keputusan. Masih mau?'
            : 'Jeda selesai. Kalau masih mau, silakan. Kalau tidak, tahan uangnya.'}
        </ThemedText>
      )}

      {buying && phase !== 'COOLING' && (
        <View style={styles.chips}>
          {accounts.map((a) => {
            const selected = a.id === accountId;
            return (
              <Pressable
                key={a.id}
                onPress={() => setAccountId(a.id)}
                style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.backgroundSelected }]}>
                <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
                  {a.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}

      {error && <ThemedText themeColor="danger">{error}</ThemedText>}

      <View style={styles.actions}>
        <Pressable
          disabled={busy}
          onPress={buying ? () => setBuying(false) : cancel}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: buying ? theme.backgroundSelected : theme.primary },
            (pressed || busy) && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={buying ? undefined : { color: theme.onPrimary }}>
            {buying ? 'Kembali' : 'Tahan uangnya'}
          </ThemedText>
        </Pressable>
        {phase !== 'COOLING' && (
          <Pressable
            disabled={busy}
            onPress={buying ? purchase : () => setBuying(true)}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: theme.backgroundSelected },
              (pressed || busy) && styles.pressed,
            ]}>
            {busy && buying ? (
              <ActivityIndicator />
            ) : (
              <ThemedText type="smallBold">{buying ? 'Catat pembelian' : 'Tetap beli'}</ThemedText>
            )}
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  amountColumn: {
    alignItems: 'flex-end',
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  heldBack: {
    gap: 0,
  },
  heldAmount: {
    fontSize: 28,
    lineHeight: 36,
  },
  white: {
    color: '#ffffff',
  },
  addButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Spacing.three,
  },
  history: {
    gap: Spacing.two,
  },
  saved: {
    color: NECESSITY.NEED.color,
  },
  pressed: {
    opacity: 0.7,
  },
});
