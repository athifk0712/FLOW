import { router, useFocusEffect } from 'expo-router';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DANGER_COLOR } from '@/constants/necessity';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Enums, Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type Kind = Enums<'category_kind'>;
type Category = Pick<Tables<'categories'>, 'id' | 'name' | 'kind'>;
// Adding to a kind, or editing a category by id.
type Editing = { kind: Kind; id?: string } | null;

const KINDS: { value: Kind; label: string }[] = [
  { value: 'EXPENSE', label: 'PENGELUARAN' },
  { value: 'INCOME', label: 'PEMASUKAN' },
];

// Rename, add, or delete categories. Deleting keeps the transactions, just without a category.
export default function CategoriesScreen() {
  const theme = useTheme();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('categories').select('id, name, kind').order('created_at');
    if (error) return setError(error.message);
    setCategories(data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openForm(target: Editing) {
    setEditing(target);
    setName(categories?.find((c) => c.id === target?.id)?.name ?? '');
    setConfirmDelete(false);
    setError(null);
  }

  async function run(action: () => PromiseLike<{ error: { message: string; code?: string } | null }>) {
    setSaving(true);
    setError(null);
    const { error } = await action();
    setSaving(false);
    // 23505 = unique (user, kind, name).
    if (error) return setError(error.code === '23505' ? 'Nama kategori ini sudah ada.' : error.message);
    setEditing(null);
    await load();
  }

  function save() {
    if (!editing) return;
    const trimmed = name.trim();
    run(() =>
      editing.id
        ? supabase.from('categories').update({ name: trimmed }).eq('id', editing.id)
        : supabase.from('categories').insert({ name: trimmed, kind: editing.kind }),
    );
  }

  function remove(id: string) {
    if (!confirmDelete) return setConfirmDelete(true);
    run(() => supabase.from('categories').delete().eq('id', id));
  }

  const canSave = name.trim().length > 0 && !saving;

  function form(target: NonNullable<Editing>) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
          value={name}
          onChangeText={setName}
          onSubmitEditing={save}
          placeholder="Nama kategori"
          placeholderTextColor={theme.textSecondary}
          maxLength={50}
          autoFocus
        />
        {target.id && (
          <ThemedText type="small" themeColor="textSecondary">
            Menghapus kategori tidak menghapus transaksinya; transaksi itu jadi tanpa kategori.
          </ThemedText>
        )}
        {error && <ThemedText style={styles.error}>{error}</ThemedText>}
        <View style={styles.actions}>
          {target.id ? (
            <Pressable onPress={() => remove(target.id!)} disabled={saving} hitSlop={8}>
              <ThemedText type="smallBold" style={{ color: DANGER_COLOR }}>
                {confirmDelete ? 'Ketuk lagi untuk hapus' : 'Hapus'}
              </ThemedText>
            </Pressable>
          ) : (
            <View />
          )}
          <View style={styles.actionsRight}>
            <Pressable onPress={() => setEditing(null)} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Batal
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={!canSave}
              onPress={save}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.text },
                !canSave && !saving && styles.disabled,
                (pressed || saving) && styles.pressed,
              ]}>
              {saving ? (
                <ActivityIndicator color={theme.background} />
              ) : (
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  Simpan
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              KATEGORI
            </ThemedText>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Tutup
              </ThemedText>
            </Pressable>
          </View>

          {categories === null ? (
            error ? (
              <ThemedText style={styles.error}>{error}</ThemedText>
            ) : (
              <ActivityIndicator style={styles.flex} />
            )
          ) : (
            <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              {KINDS.map((kind) => (
                <View key={kind.value} style={styles.section}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {kind.label}
                  </ThemedText>
                  <View style={styles.chips}>
                    {categories
                      .filter((c) => c.kind === kind.value && c.id !== editing?.id)
                      .map((c) => (
                        <Pressable
                          key={c.id}
                          onPress={() => openForm({ kind: c.kind, id: c.id })}
                          style={({ pressed }) => [
                            styles.chip,
                            { backgroundColor: theme.backgroundElement },
                            pressed && styles.pressed,
                          ]}>
                          <ThemedText type="small">{c.name}</ThemedText>
                        </Pressable>
                      ))}
                    {editing?.kind !== kind.value && (
                      <Pressable
                        onPress={() => openForm({ kind: kind.value })}
                        style={({ pressed }) => [
                          styles.chip,
                          styles.addChip,
                          { borderColor: theme.textSecondary },
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText type="small">+ Tambah</ThemedText>
                      </Pressable>
                    )}
                  </View>
                  {editing?.kind === kind.value && form(editing)}
                </View>
              ))}
              <ThemedText type="small" themeColor="textSecondary">
                Ketuk kategori untuk mengganti nama atau menghapusnya.
              </ThemedText>
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
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  section: {
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
    borderRadius: Spacing.five,
  },
  addChip: {
    borderWidth: 1,
    borderStyle: 'dashed',
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: DANGER_COLOR,
  },
});
