import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import { deletePocket, loadPocketActivity, renamePocket } from '@/lib/pocket-data';
import { type Pocket, type PocketActivity, pocketActivity, pocketNameProblem } from '@/lib/pockets';

const SHOWN = 10;

type Props = {
  pocket: Pocket;
  siblings: Pocket[];
  onFill: () => void;
  onTake: () => void;
  onChanged: () => void;
};

// What opens under a tapped pocket: fill it, take from it, its recent history, rename or delete.
export function PocketDetail({ pocket, siblings, onFill, onTake, onChanged }: Props) {
  const theme = useTheme();
  const [activity, setActivity] = useState<PocketActivity[] | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(pocket.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = siblings.filter((p) => p.id !== pocket.id);
  const nameIssue = pocketNameProblem(name, others);

  useEffect(() => {
    const nameOf = (id: string | null) => (id === null ? 'Utama' : (siblings.find((p) => p.id === id)?.name ?? 'kantong terhapus'));
    loadPocketActivity(pocket.id).then(
      ({ moves, spends }) => setActivity(pocketActivity(pocket.id, moves, spends, nameOf).slice(0, SHOWN)),
      (e: Error) => setError(e.message),
    );
    // Reloaded through `key` when the balance changes; `siblings` is a new array on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pocket.id]);

  async function saveName() {
    if (nameIssue) return;
    try {
      await renamePocket(pocket.id, name);
      setRenaming(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengganti nama.');
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await deletePocket(pocket.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus.');
    }
  }

  const action = (label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}>
      <ThemedText type="smallBold" themeColor="primary">
        {label}
      </ThemedText>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {action('Isi', onFill)}
        {action('Ambil', onTake)}
      </View>

      {activity === null && !error && <ActivityIndicator />}
      {activity?.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Belum ada catatan di kantong ini.
        </ThemedText>
      )}
      {activity?.map((a) => (
        <View key={a.id} style={styles.line}>
          <ThemedText type="small" numberOfLines={1} style={styles.flex}>
            {a.title}
          </ThemedText>
          <ThemedText type="small" themeColor={a.amount < 0 ? 'text' : 'primary'}>
            {a.amount < 0 ? '−' : '+'}
            {formatMoney(Math.abs(a.amount))}
          </ThemedText>
        </View>
      ))}

      {renaming ? (
        <View style={styles.row}>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={50}
            autoFocus
            accessibilityLabel="Nama kantong"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
          />
          <Pressable onPress={saveName} disabled={!!nameIssue} hitSlop={8} style={!!nameIssue && styles.disabled}>
            <ThemedText type="smallBold" themeColor="primary">
              Simpan
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.footer}>
          <Pressable onPress={() => setRenaming(true)} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Ganti nama
            </ThemedText>
          </Pressable>
          <Pressable onPress={remove} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="danger">
              {confirmDelete ? 'Ketuk lagi untuk hapus' : 'Hapus'}
            </ThemedText>
          </Pressable>
        </View>
      )}
      {confirmDelete && (
        <ThemedText type="small" themeColor="textSecondary">
          Saldonya kembali ke Utama. Transaksinya tetap ada, hanya tidak lagi punya kantong.
        </ThemedText>
      )}
      {renaming && nameIssue && (
        <ThemedText type="small" themeColor="warning">
          {nameIssue}
        </ThemedText>
      )}
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    fontSize: 16,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
