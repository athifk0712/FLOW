import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoveForm } from '@/components/pockets/move-form';
import { PocketDetail } from '@/components/pockets/pocket-detail';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModalEdges } from '@/constants/safe-area';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { createPocket, loadPockets } from '@/lib/pocket-data';
import { mainBalance, type Pocket, POCKET_SUGGESTIONS, pocketNameProblem } from '@/lib/pockets';
import { supabase } from '@/lib/supabase';

type Account = { id: string; name: string; balance: number };
type Move = { from: string | null; to: string | null };

// Kantong: one account's balance divided by purpose (BCA -> Jajan, Cicilan, Tabungan). The money stays in the account,
// so the total never changes here; whatever isn't in a pocket is Utama.
export default function PocketsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ account?: string }>();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [accountId, setAccountId] = useState<string | null>(params.account ?? null);
  const [open, setOpen] = useState<string | null>(null);
  const [move, setMove] = useState<Move | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a change, so an open pocket's history reloads too.
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    const [balances, loaded] = await Promise.all([
      supabase.from('v_account_balances').select('account_id, name, current_balance').is('archived_at', null),
      loadPockets().catch((e: Error) => e),
    ]);
    if (balances.error) return setError(balances.error.message);
    if (loaded instanceof Error) return setError(loaded.message);
    setError(null);
    setPockets(loaded);
    setAccounts(
      (balances.data ?? [])
        .map((b) => ({ id: b.account_id!, name: b.name!, balance: b.current_balance ?? 0 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setVersion((v) => v + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const account = accounts?.find((a) => a.id === accountId) ?? accounts?.[0] ?? null;
  const own = pockets.filter((p) => p.account_id === account?.id);
  const main = account ? mainBalance(account.balance, own) : 0;
  const nameIssue = newName ? pocketNameProblem(newName, own) : null;
  const canCreate = !!newName.trim() && !nameIssue && !saving;
  const suggestions = POCKET_SUGGESTIONS.filter((s) => !own.some((p) => p.name.toLowerCase() === s.toLowerCase()));

  function pickAccount(id: string) {
    setAccountId(id);
    setOpen(null);
    setMove(null);
    setAdding(false);
  }

  async function create() {
    if (!canCreate || !account) return;
    setSaving(true);
    setError(null);
    try {
      await createPocket(account.id, newName);
      setNewName('');
      setAdding(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat kantong.');
    }
    setSaving(false);
  }

  function finishMove() {
    setMove(null);
    load();
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={ModalEdges}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              KANTONG
            </ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Tutup
              </ThemedText>
            </Pressable>
          </View>

          {accounts === null ? (
            error ? (
              <ThemedText themeColor="danger">{error}</ThemedText>
            ) : (
              <ActivityIndicator style={styles.flex} />
            )
          ) : !account ? (
            <ThemedText themeColor="textSecondary">Tambahkan akun dulu di Dompet, lalu bagi saldonya ke kantong.</ThemedText>
          ) : (
            <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {accounts.map((a) => {
                  const on = a.id === account.id;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => pickAccount(a.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.chip, { backgroundColor: on ? theme.primary : theme.backgroundElement }]}>
                      <ThemedText type="small" style={{ color: on ? theme.onPrimary : theme.text }}>
                        {a.name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={[styles.hero, { backgroundColor: theme.primary }]}>
                <ThemedText type="small" style={{ color: theme.onPrimary }}>
                  Saldo {account.name}
                </ThemedText>
                <ThemedText numberOfLines={1} adjustsFontSizeToFit style={[styles.heroValue, { color: theme.onPrimary }]}>
                  {formatMoney(account.balance)}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.onPrimary }}>
                  {own.length === 0 ? 'Belum dibagi ke kantong' : `Dibagi ke ${own.length} kantong dan Utama`}
                </ThemedText>
              </View>

              {own.length === 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  Pisahkan uang untuk jajan, cicilan, atau tabungan. Uangnya tetap di {account.name}, jadi saldonya tetap
                  cocok dengan rekeningmu. Flowku hanya mencatat pembagiannya, bukan memindahkan uang di bank.
                </ThemedText>
              )}

              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <ThemedText>Utama</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Saldo yang belum masuk kantong
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" themeColor={main < 0 ? 'danger' : 'text'} testID="pocket-main">
                    {formatMoney(main)}
                  </ThemedText>
                </View>
                {main < 0 && (
                  <ThemedText type="small" themeColor="warning">
                    Kantongmu berisi lebih banyak dari saldo {account.name}. Ambil dari kantong untuk merapikannya.
                  </ThemedText>
                )}
              </ThemedView>

              {own.map((pocket) => (
                <ThemedView key={pocket.id} type="backgroundElement" style={styles.card}>
                  <Pressable
                    onPress={() => setOpen(open === pocket.id ? null : pocket.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open === pocket.id }}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <ThemedText style={styles.flex} numberOfLines={1}>
                      {pocket.name}
                    </ThemedText>
                    <ThemedText type="smallBold" themeColor={pocket.balance < 0 ? 'danger' : 'text'}>
                      {formatMoney(pocket.balance)}
                    </ThemedText>
                  </Pressable>
                  {open === pocket.id && (
                    <PocketDetail
                      key={`${pocket.id}-${version}`}
                      pocket={pocket}
                      siblings={own}
                      onFill={() => setMove({ from: null, to: pocket.id })}
                      onTake={() => setMove({ from: pocket.id, to: null })}
                      onChanged={load}
                    />
                  )}
                </ThemedView>
              ))}

              {move ? (
                <MoveForm
                  key={`${move.from}-${move.to}`}
                  accountId={account.id}
                  main={main}
                  pockets={own}
                  from={move.from}
                  to={move.to}
                  onDone={finishMove}
                  onCancel={() => setMove(null)}
                />
              ) : (
                own.length > 0 && (
                  <Pressable
                    onPress={() => setMove({ from: null, to: own[0].id })}
                    style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
                    <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                      Pindahkan uang
                    </ThemedText>
                  </Pressable>
                )
              )}

              {adding ? (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">Kantong baru di {account.name}</ThemedText>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Nama, mis. Jajan"
                    placeholderTextColor={theme.textSecondary}
                    maxLength={50}
                    autoFocus
                    accessibilityLabel="Nama kantong baru"
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                  />
                  <View style={styles.wrapChips}>
                    {suggestions.map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setNewName(s)}
                        style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
                        <ThemedText type="small">{s}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                  {nameIssue && (
                    <ThemedText type="small" themeColor="warning">
                      {nameIssue}
                    </ThemedText>
                  )}
                  <View style={styles.actions}>
                    <Pressable onPress={() => setAdding(false)} hitSlop={8}>
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        Batal
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      disabled={!canCreate}
                      onPress={create}
                      style={({ pressed }) => [
                        styles.save,
                        { backgroundColor: theme.primary },
                        !canCreate && styles.disabled,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                        Buat kantong
                      </ThemedText>
                    </Pressable>
                  </View>
                </ThemedView>
              ) : (
                <Pressable
                  onPress={() => setAdding(true)}
                  style={({ pressed }) => [styles.add, { borderColor: theme.textSecondary }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">+ Kantong baru</ThemedText>
                </Pressable>
              )}

              {error && <ThemedText themeColor="danger">{error}</ThemedText>}
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
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
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  wrapChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  hero: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  heroValue: {
    fontSize: 32,
    lineHeight: 42,
    fontWeight: 700,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  primary: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  add: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.two,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  save: {
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
