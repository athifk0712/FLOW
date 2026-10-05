import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountSection } from '@/components/settings/account-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NECESSITY } from '@/constants/necessity';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { APPEARANCE_OPTIONS, setAppearance, useAppearance } from '@/lib/appearance';
import type { Enums } from '@/lib/database.types';
import { exportTransactionsCsv } from '@/lib/export';
import { formatDigits, toDigits } from '@/lib/money';
import {
  applyReminderSettings,
  getReminderSettings,
  REMINDER_HOURS,
  REMINDERS_SUPPORTED,
  REMINDERS_UNAVAILABLE_NOTE,
  type ReminderSettings,
  WEEKLY_LABEL,
} from '@/lib/reminders';
import { supabase } from '@/lib/supabase';

type Scope = Extract<Enums<'budget_scope'>, 'DISCRETIONARY' | 'ESSENTIAL'>;

const BUDGETS: { scope: Scope; label: string; hint: string; color: string }[] = [
  {
    scope: 'DISCRETIONARY',
    label: 'Ingin & Impulsif',
    hint: 'Batas belanja keinginan per minggu. Dipakai juga untuk menghitung jeda Sebelum Beli.',
    color: NECESSITY.WANT.color,
  },
  {
    scope: 'ESSENTIAL',
    label: 'Butuh & Penting',
    hint: 'Opsional. Untuk memantau kebutuhan pokok per minggu.',
    color: NECESSITY.NEED.color,
  },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const appearance = useAppearance();
  const [budgetIds, setBudgetIds] = useState<Partial<Record<Scope, string>>>({});
  const [limits, setLimits] = useState<Record<Scope, string>>({ DISCRETIONARY: '', ESSENTIAL: '' });
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState<string | null>(null);
  const [reminder, setReminder] = useState<ReminderSettings>(getReminderSettings);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('budgets')
        .select('id, scope, limit_amount')
        .eq('period', 'WEEKLY')
        .in('scope', ['DISCRETIONARY', 'ESSENTIAL'])
        .is('active_to', null)
        .then(({ data, error }) => {
          if (error) return setBudgetMessage(error.message);
          const ids: Partial<Record<Scope, string>> = {};
          const values: Record<Scope, string> = { DISCRETIONARY: '', ESSENTIAL: '' };
          for (const b of data ?? []) {
            const scope = b.scope as Scope;
            ids[scope] = b.id;
            values[scope] = String(b.limit_amount);
          }
          setBudgetIds(ids);
          setLimits(values);
        });
    }, []),
  );

  async function saveBudgets() {
    setSavingBudget(true);
    setBudgetMessage(null);
    for (const { scope } of BUDGETS) {
      const amount = Number(limits[scope] || '0');
      const id = budgetIds[scope];
      const { error } =
        amount > 0
          ? id
            ? await supabase.from('budgets').update({ limit_amount: amount }).eq('id', id)
            : await supabase.from('budgets').insert({ scope, period: 'WEEKLY', limit_amount: amount })
          : id
            ? await supabase.from('budgets').delete().eq('id', id)
            : { error: null };
      if (error) {
        setSavingBudget(false);
        return setBudgetMessage(error.message);
      }
    }
    // Reload ids so a newly inserted budget is updated (not duplicated) on the next save.
    const { data } = await supabase
      .from('budgets')
      .select('id, scope')
      .eq('period', 'WEEKLY')
      .in('scope', ['DISCRETIONARY', 'ESSENTIAL'])
      .is('active_to', null);
    setBudgetIds(Object.fromEntries((data ?? []).map((b) => [b.scope, b.id])));
    setSavingBudget(false);
    setBudgetMessage('Budget tersimpan');
  }

  async function exportCsv() {
    setExporting(true);
    setExportMessage(null);
    try {
      const count = await exportTransactionsCsv();
      setExportMessage(count > 0 ? `${count} transaksi diekspor.` : 'Belum ada transaksi untuk diekspor.');
    } catch (e) {
      setExportMessage(e instanceof Error ? e.message : 'Ekspor gagal.');
    }
    setExporting(false);
  }

  async function updateReminder(next: ReminderSettings) {
    setReminder(next);
    setReminderMessage(null);
    const ok = await applyReminderSettings(next);
    if (!ok) {
      setReminder({ ...next, enabled: false, weeklyEnabled: false });
      setReminderMessage('Izin notifikasi ditolak. Aktifkan dari pengaturan HP.');
      return;
    }
    const active = [
      next.enabled && `review malam setiap hari jam ${String(next.hour).padStart(2, '0')}.00`,
      next.weeklyEnabled && `refleksi mingguan setiap ${WEEKLY_LABEL}`,
    ].filter(Boolean);
    setReminderMessage(active.length > 0 ? `Pengingat aktif: ${active.join(' dan ')}.` : null);
  }

  const inputRow = [styles.priceRow, { backgroundColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="smallBold" themeColor="textSecondary">
              PENGATURAN
            </ThemedText>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                AKUN
              </ThemedText>
              <AccountSection />
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                DATA
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                <LinkRow title="Akun & dompet" hint="Bank, e-wallet, tunai, dan saldo awalnya" href="/accounts" />
                <LinkRow title="Kategori" hint="Tambah, ganti nama, atau hapus kategori" href="/categories" />
                <LinkRow title="Budget per kategori" hint="Batas mingguan atau bulanan per kategori" href="/budgets" />
                <LinkRow title="Transaksi rutin" hint="Kos, langganan, gaji: dicatat otomatis tiap bulan" href="/recurring" />
                <LinkRow title="Target tabungan" hint="Sisihkan uang untuk sesuatu yang kamu mau" href="/goals" />
                <LinkRow title="Utang & piutang" hint="Siapa pinjam ke siapa, dan sudah dibayar berapa" href="/debts" />
              </ThemedView>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                TAMPILAN
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={styles.hours}>
                  {APPEARANCE_OPTIONS.map(({ value, label }) => {
                    const selected = value === appearance;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setAppearance(value)}
                        style={[styles.hour, { backgroundColor: selected ? theme.primary : theme.backgroundSelected }]}>
                        <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                          {label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </ThemedView>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                CADANGAN
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">Ekspor transaksi (CSV)</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Semua catatanmu dalam satu file. Bisa dibuka di Excel atau Google Sheets.
                  </ThemedText>
                </View>
                <Pressable
                  disabled={exporting}
                  onPress={exportCsv}
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: theme.backgroundSelected },
                    (pressed || exporting) && styles.pressed,
                  ]}>
                  {exporting ? (
                    <ActivityIndicator color={theme.text} />
                  ) : (
                    <ThemedText type="smallBold">Ekspor CSV</ThemedText>
                  )}
                </Pressable>
                {exportMessage && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {exportMessage}
                  </ThemedText>
                )}
              </ThemedView>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                BUDGET MINGGUAN
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                {BUDGETS.map((b) => (
                  <View key={b.scope} style={styles.field}>
                    <View style={styles.label}>
                      <View style={[styles.dot, { backgroundColor: b.color }]} />
                      <ThemedText type="smallBold">{b.label}</ThemedText>
                    </View>
                    <View style={inputRow}>
                      <ThemedText type="smallBold">Rp</ThemedText>
                      <TextInput
                        style={[styles.priceInput, { color: theme.text }]}
                        value={formatDigits(limits[b.scope])}
                        onChangeText={(t) => setLimits((l) => ({ ...l, [b.scope]: toDigits(t) }))}
                        placeholder="Belum diatur"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="number-pad"
                      />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {b.hint}
                    </ThemedText>
                  </View>
                ))}

                <Pressable
                  disabled={savingBudget}
                  onPress={saveBudgets}
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: theme.primary },
                    (pressed || savingBudget) && styles.pressed,
                  ]}>
                  {savingBudget ? (
                    <ActivityIndicator color={theme.onPrimary} />
                  ) : (
                    <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                      Simpan budget
                    </ThemedText>
                  )}
                </Pressable>
                {budgetMessage && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {budgetMessage}
                  </ThemedText>
                )}
              </ThemedView>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                PENGINGAT
              </ThemedText>
              {!REMINDERS_SUPPORTED ? (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {REMINDERS_UNAVAILABLE_NOTE}
                  </ThemedText>
                </ThemedView>
              ) : (
              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">Review malam</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Setiap hari, untuk menilai pengeluaran hari itu.
                    </ThemedText>
                  </View>
                  <Switch value={reminder.enabled} onValueChange={(enabled) => updateReminder({ ...reminder, enabled })} />
                </View>
                {reminder.enabled && (
                  <View style={styles.hours}>
                    {REMINDER_HOURS.map((hour) => {
                      const selected = hour === reminder.hour;
                      return (
                        <Pressable
                          key={hour}
                          onPress={() => updateReminder({ ...reminder, hour })}
                          style={[
                            styles.hour,
                            { backgroundColor: selected ? theme.primary : theme.backgroundSelected },
                          ]}>
                          <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                            {hour}.00
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">Refleksi mingguan</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {WEEKLY_LABEL}: masih puas dengan belanja minggu lalu, atau menyesal?
                    </ThemedText>
                  </View>
                  <Switch
                    value={reminder.weeklyEnabled}
                    onValueChange={(weeklyEnabled) => updateReminder({ ...reminder, weeklyEnabled })}
                  />
                </View>
                {reminderMessage && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {reminderMessage}
                  </ThemedText>
                )}
              </ThemedView>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function LinkRow({ title, hint, href }: { title: string; hint: string; href: Href }) {
  return (
    <Pressable onPress={() => router.push(href)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      </View>
      <ThemedText type="smallBold">→</ThemedText>
    </Pressable>
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
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  hours: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  hour: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
