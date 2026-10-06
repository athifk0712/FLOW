import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountBadge } from '@/components/account-badge';
import { AccountPicker } from '@/components/account-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type CatalogEntry, GROUP_TYPE } from '@/lib/account-catalog';
import type { Enums, Tables } from '@/lib/database.types';
import { formatDigits, formatMoney, getCurrency, toDigits } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';

type AccountType = Enums<'account_type'>;
type Account = Pick<Tables<'accounts'>, 'id' | 'name' | 'type' | 'opening_balance' | 'archived_at'> & {
  balance: number;
};
// 'new' = the add form; an id = editing that account.
type Editing = 'new' | string | null;

const TYPES: { value: AccountType; label: string }[] = [
  { value: 'BANK', label: 'Bank' },
  { value: 'EWALLET', label: 'E-wallet' },
  { value: 'CASH', label: 'Tunai' },
];

const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label])) as Record<AccountType, string>;

// Where money lives (bank, e-wallet, cash). Balances are computed from the opening balance plus transactions.
export default function AccountsScreen() {
  const theme = useTheme();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('BANK');
  const [opening, setOpening] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // A new account starts at the bank / e-wallet picker; the form follows once one is chosen.
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown above the list after an action that also changed something elsewhere.
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [accs, bals] = await Promise.all([
      supabase.from('accounts').select('id, name, type, opening_balance, archived_at').order('created_at'),
      supabase.from('v_account_balances').select('account_id, current_balance'),
    ]);
    const failed = accs.error ?? bals.error;
    if (failed) return setError(failed.message);
    const balance = new Map((bals.data ?? []).map((b) => [b.account_id, b.current_balance ?? 0]));
    const rows = accs.data ?? [];
    setAccounts(rows.map((a) => ({ ...a, balance: balance.get(a.id) ?? a.opening_balance })));
    // Open the add form straight away when there is nothing to list yet.
    if (rows.length === 0) {
      setEditing('new');
      setPicking(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openForm(target: Editing) {
    const account = accounts?.find((a) => a.id === target);
    setEditing(target);
    setName(account?.name ?? '');
    setType(account?.type ?? 'BANK');
    setOpening(account ? String(account.opening_balance) : '');
    setConfirmDelete(false);
    setPicking(target === 'new');
    setError(null);
  }

  function pickEntry(entry: CatalogEntry) {
    setName(entry.name);
    setType(GROUP_TYPE[entry.group]);
    setPicking(false);
  }

  function pickCustom(typed: string) {
    setName(typed.slice(0, 50));
    setPicking(false);
  }

  async function run(action: () => PromiseLike<{ error: { message: string; code?: string } | null }>) {
    setSaving(true);
    setError(null);
    setNotice(null);
    const { error } = await action();
    setSaving(false);
    if (error) {
      // 23503 = still referenced by transactions (FK on delete restrict).
      return setError(
        error.code === '23503' ? 'Akun ini sudah punya transaksi, jadi tidak bisa dihapus. Arsipkan saja.' : error.message,
      );
    }
    setEditing(null);
    await load();
  }

  function save() {
    const values = { name: name.trim(), type, opening_balance: Number(opening || '0') };
    run(() =>
      editing === 'new'
        ? supabase.from('accounts').insert(values)
        : supabase.from('accounts').update(values).eq('id', editing!),
    );
  }

  function toggleArchive(account: Account) {
    const archiving = !account.archived_at;
    run(async () => {
      const result = await supabase
        .from('accounts')
        .update({ archived_at: archiving ? new Date().toISOString() : null })
        .eq('id', account.id);
      if (result.error || !archiving) return result;
      // An archived account is left out of the totals, so recurring bills or income must not keep landing in it.
      const paused = await supabase
        .from('recurring_transactions')
        .update({ active: false })
        .eq('account_id', account.id)
        .eq('active', true)
        .select('id');
      if (paused.error) return paused;
      const count = paused.data?.length ?? 0;
      if (count > 0) {
        setNotice(`${count} transaksi rutin yang memakai ${account.name} dijeda. Pindahkan ke akun lain di Transaksi rutin.`);
      }
      return { error: null };
    });
  }

  function remove(account: Account) {
    if (!confirmDelete) return setConfirmDelete(true);
    run(() => supabase.from('accounts').delete().eq('id', account.id));
  }

  const editingAccount = accounts?.find((a) => a.id === editing);
  const canSave = name.trim().length > 0 && !saving;
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }];
  const active = accounts?.filter((a) => !a.archived_at) ?? [];
  const archived = accounts?.filter((a) => a.archived_at) ?? [];

  const picker = (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.actions}>
        <ThemedText type="smallBold">Uangnya di mana?</ThemedText>
        {accounts && accounts.length > 0 && (
          <Pressable onPress={() => setEditing(null)} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Batal
            </ThemedText>
          </Pressable>
        )}
      </View>
      <AccountPicker selected={accounts?.map((a) => a.name) ?? []} onPick={pickEntry} onCustom={pickCustom} />
    </ThemedView>
  );

  const form = picking ? (
    picker
  ) : (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.actions}>
        <ThemedText type="smallBold">{editing === 'new' ? 'Akun baru' : 'Edit akun'}</ThemedText>
        {editing === 'new' && (
          <Pressable onPress={() => setPicking(true)} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              Pilih dari daftar
            </ThemedText>
          </Pressable>
        )}
      </View>
      <TextInput
        style={inputStyle}
        value={name}
        onChangeText={setName}
        placeholder="Nama, mis. BCA atau GoPay"
        placeholderTextColor={theme.textSecondary}
        maxLength={50}
        autoFocus={editing === 'new'}
      />
      <View style={styles.chips}>
        {TYPES.map((t) => {
          const selected = t.value === type;
          return (
            <Pressable
              key={t.value}
              onPress={() => setType(t.value)}
              style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.backgroundSelected }]}>
              <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
                {t.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          Saldo awal (saat mulai pakai Flowku)
        </ThemedText>
        <View style={[styles.priceRow, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">{getCurrency().symbol.trim()}</ThemedText>
          <TextInput
            style={[styles.priceInput, { color: theme.text }]}
            value={formatDigits(opening)}
            onChangeText={(t) => setOpening(toDigits(t))}
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {error && <ThemedText themeColor="danger">{error}</ThemedText>}

      <View style={styles.actions}>
        {accounts && accounts.length > 0 && (
          <Pressable onPress={() => setEditing(null)} style={styles.secondary} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Batal
            </ThemedText>
          </Pressable>
        )}
        <Pressable
          disabled={!canSave}
          onPress={save}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary },
            !canSave && !saving && styles.disabled,
            (pressed || saving) && styles.pressed,
          ]}>
          {saving ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              Simpan
            </ThemedText>
          )}
        </Pressable>
      </View>

      {editingAccount && (
        <View style={styles.actions}>
          <Pressable onPress={() => toggleArchive(editingAccount)} disabled={saving} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {editingAccount.archived_at ? 'Aktifkan lagi' : 'Arsipkan'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => remove(editingAccount)} disabled={saving} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="danger">
              {confirmDelete ? 'Ketuk lagi untuk hapus' : 'Hapus'}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </ThemedView>
  );

  function renderAccount(account: Account) {
    if (editing === account.id) return <View key={account.id}>{form}</View>;
    return (
      <Pressable
        key={account.id}
        onPress={() => openForm(account.id)}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.row}>
          <AccountBadge name={account.name} type={account.type} />
          <View style={styles.flex}>
            <ThemedText>{account.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {TYPE_LABEL[account.type]}
            </ThemedText>
          </View>
          <ThemedText type="smallBold">{formatMoney(account.balance)}</ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              AKUN & DOMPET
            </ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Tutup
              </ThemedText>
            </Pressable>
          </View>

          {notice && (
            <ThemedText type="small" themeColor="warning">
              {notice}
            </ThemedText>
          )}

          {accounts === null ? (
            error ? (
              <ThemedText themeColor="danger">{error}</ThemedText>
            ) : (
              <ActivityIndicator style={styles.flex} />
            )
          ) : (
            <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              {accounts.length === 0 && (
                <ThemedText themeColor="textSecondary">
                  Tambahkan tempat uangmu disimpan: rekening bank, e-wallet, atau uang tunai.
                </ThemedText>
              )}

              {active.map(renderAccount)}

              {editing === 'new' ? (
                form
              ) : (
                <Pressable
                  onPress={() => openForm('new')}
                  style={({ pressed }) => [styles.add, { borderColor: theme.textSecondary }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">+ Tambah akun</ThemedText>
                </Pressable>
              )}

              {archived.length > 0 && (
                <>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.archivedTitle}>
                    DIARSIPKAN
                  </ThemedText>
                  {archived.map(renderAccount)}
                </>
              )}
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
    maxWidth: MaxContentWidth,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  input: {
    fontSize: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
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
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.one,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 600,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  secondary: {
    padding: Spacing.two,
  },
  add: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  archivedTitle: {
    paddingTop: Spacing.three,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
