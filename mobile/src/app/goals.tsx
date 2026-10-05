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

import { GoalProgress } from '@/components/goal-progress';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deadlineFromOffset, deadlineLabel, type Goal, offsetFromDeadline } from '@/lib/goals';
import { formatDigits, formatMoney, getCurrency, toDigits } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';

// 'new' = the add form; an id = that goal is open (deposit / edit).
type Open = 'new' | string | null;

// Savings goals: set money aside for something, see how much per month it takes.
// Deposits are earmarks only; account balances do not change.
export default function GoalsScreen() {
  const theme = useTheme();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadlineOffset, setDeadlineOffset] = useState<number | null>(null);
  const [deposit, setDeposit] = useState('');

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('v_goal_progress').select('*').order('created_at');
    if (error) return setError(error.message);
    setGoals(data ?? []);
    // Nothing to list yet: start with the add form open.
    if (!data?.length) {
      setOpen('new');
      setEditing(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openGoal(target: Open) {
    const goal = goals?.find((g) => g.id === target);
    setOpen(target);
    setEditing(target === 'new');
    setName(goal?.name ?? '');
    setTarget(goal?.target_amount ? String(goal.target_amount) : '');
    setDeadlineOffset(goal?.deadline ? Math.max(0, offsetFromDeadline(goal.deadline)) : null);
    setDeposit('');
    setConfirmDelete(false);
    setError(null);
  }

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, close = true) {
    setSaving(true);
    setError(null);
    const { error } = await action();
    setSaving(false);
    if (error) return setError(error.message);
    if (close) setOpen(null);
    setDeposit('');
    await load();
  }

  const canSaveGoal = name.trim().length > 0 && Number(target) > 0 && !saving;

  function saveGoal() {
    if (!canSaveGoal) return;
    const values = {
      name: name.trim(),
      target_amount: Number(target),
      deadline: deadlineOffset === null ? null : deadlineFromOffset(deadlineOffset),
    };
    run(() =>
      open === 'new'
        ? supabase.from('savings_goals').insert(values)
        : supabase.from('savings_goals').update(values).eq('id', open!),
    );
  }

  function move(goal: Goal, direction: 1 | -1) {
    const amount = Number(deposit || '0');
    if (!goal.id || amount <= 0 || saving) return;
    if (direction === -1 && amount > (goal.saved ?? 0)) return setError('Tidak bisa mengambil lebih dari yang terkumpul.');
    run(() => supabase.from('goal_contributions').insert({ goal_id: goal.id!, amount: amount * direction }), false);
  }

  function remove(id: string) {
    if (!confirmDelete) return setConfirmDelete(true);
    run(() => supabase.from('savings_goals').delete().eq('id', id));
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }];
  const priceRow = [styles.priceRow, { backgroundColor: theme.backgroundSelected }];

  const goalForm = (
    <View style={styles.form}>
      <TextInput
        style={inputStyle}
        value={name}
        onChangeText={setName}
        placeholder="Nama target, mis. HP baru atau Dana darurat"
        placeholderTextColor={theme.textSecondary}
        maxLength={100}
        autoFocus={open === 'new'}
      />
      <View style={priceRow}>
        <ThemedText type="smallBold">{getCurrency().symbol.trim()}</ThemedText>
        <TextInput
          style={[styles.priceInput, { color: theme.text }]}
          value={formatDigits(target)}
          onChangeText={(t) => setTarget(toDigits(t))}
          placeholder="Target"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
        />
      </View>
      <View style={styles.inline}>
        <ThemedText type="small" themeColor="textSecondary">
          Tenggat
        </ThemedText>
        {deadlineOffset === null ? (
          <Pressable onPress={() => setDeadlineOffset(5)} hitSlop={8}>
            <ThemedText type="smallBold">Tanpa tenggat · atur →</ThemedText>
          </Pressable>
        ) : (
          <View style={styles.stepper}>
            <Pressable
              disabled={deadlineOffset <= 0}
              onPress={() => setDeadlineOffset(deadlineOffset - 1)}
              hitSlop={8}
              style={deadlineOffset <= 0 && styles.disabled}>
              <ThemedText type="smallBold">‹</ThemedText>
            </Pressable>
            <ThemedText type="smallBold">{deadlineLabel(deadlineFromOffset(deadlineOffset))}</ThemedText>
            <Pressable onPress={() => setDeadlineOffset(deadlineOffset + 1)} hitSlop={8}>
              <ThemedText type="smallBold">›</ThemedText>
            </Pressable>
            <Pressable onPress={() => setDeadlineOffset(null)} hitSlop={8}>
              <ThemedText type="small" themeColor="textSecondary">
                Hapus
              </ThemedText>
            </Pressable>
          </View>
        )}
      </View>
      <View style={styles.inline}>
        {open !== 'new' ? (
          <Pressable onPress={() => remove(open!)} disabled={saving} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="danger">
              {confirmDelete ? 'Ketuk lagi untuk hapus' : 'Hapus target'}
            </ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={[styles.inline, styles.right]}>
          <Pressable onPress={() => (open === 'new' ? setOpen(null) : setEditing(false))} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Batal
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={!canSaveGoal}
            onPress={saveGoal}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary },
              !canSaveGoal && !saving && styles.disabled,
              (pressed || saving) && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              Simpan
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );

  function renderGoal(goal: Goal) {
    const isOpen = open === goal.id;
    return (
      <ThemedView key={goal.id} type="backgroundElement" style={styles.card}>
        <Pressable onPress={() => (isOpen ? setOpen(null) : openGoal(goal.id))}>
          <GoalProgress goal={goal} />
        </Pressable>
        {isOpen &&
          (editing ? (
            goalForm
          ) : (
            <View style={styles.form}>
              <View style={styles.inline}>
                <View style={[...priceRow, styles.flex]}>
                  <ThemedText type="smallBold">{getCurrency().symbol.trim()}</ThemedText>
                  <TextInput
                    style={[styles.priceInput, { color: theme.text }]}
                    value={formatDigits(deposit)}
                    onChangeText={(t) => setDeposit(toDigits(t))}
                    placeholder="Jumlah"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    autoFocus
                  />
                </View>
                <Pressable
                  disabled={saving || !deposit}
                  onPress={() => move(goal, 1)}
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: theme.primary },
                    (!deposit || saving) && styles.disabled,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                    Sisihkan
                  </ThemedText>
                </Pressable>
              </View>
              {error && <ThemedText themeColor="danger">{error}</ThemedText>}
              <View style={styles.inline}>
                <Pressable onPress={() => move(goal, -1)} disabled={saving || !deposit} hitSlop={8}>
                  <ThemedText type="small" themeColor="textSecondary" style={!deposit && styles.disabled}>
                    Ambil dari target
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => setEditing(true)} hitSlop={8}>
                  <ThemedText type="smallBold">Edit target</ThemedText>
                </Pressable>
              </View>
            </View>
          ))}
      </ThemedView>
    );
  }

  const totalSaved = (goals ?? []).reduce((sum, g) => sum + (g.saved ?? 0), 0);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              TARGET TABUNGAN
            </ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Tutup
              </ThemedText>
            </Pressable>
          </View>

          {goals === null ? (
            error ? (
              <ThemedText themeColor="danger">{error}</ThemedText>
            ) : (
              <ActivityIndicator style={styles.flex} />
            )
          ) : (
            <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              <ThemedText type="small" themeColor="textSecondary">
                Sisihkan uang untuk sesuatu yang kamu mau. Ini penanda saja: saldo akunmu tidak berubah.
              </ThemedText>
              {totalSaved > 0 && <ThemedText type="smallBold">Total disisihkan: {formatMoney(totalSaved)}</ThemedText>}

              {goals.map(renderGoal)}

              {open === 'new' ? (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">Target baru</ThemedText>
                  {goalForm}
                  {error && <ThemedText themeColor="danger">{error}</ThemedText>}
                </ThemedView>
              ) : (
                <Pressable
                  onPress={() => openGoal('new')}
                  style={({ pressed }) => [styles.add, { borderColor: theme.textSecondary }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">+ Tambah target</ThemedText>
                </Pressable>
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
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 600,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  right: {
    gap: Spacing.three,
  },
  stepper: {
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
  add: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
