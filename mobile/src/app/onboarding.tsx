import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
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

import { CurrencyList } from '@/components/currency-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { saveCurrency } from '@/hooks/use-currency-sync';
import { useTheme } from '@/hooks/use-theme';
import type { Enums } from '@/lib/database.types';
import { formatDigits, formatMoney, toDigits, useCurrency } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { markOnboarded } from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';

type Step = 'welcome' | 'currency' | 'accounts' | 'budget' | 'done';
type AccountType = Enums<'account_type'>;
type Picked = { name: string; type: AccountType; digits: string };

const STEPS: Step[] = ['welcome', 'currency', 'accounts', 'budget', 'done'];

const PRESETS: { name: string; type: AccountType }[] = [
  { name: 'BCA', type: 'BANK' },
  { name: 'Mandiri', type: 'BANK' },
  { name: 'BRI', type: 'BANK' },
  { name: 'BNI', type: 'BANK' },
  { name: 'GoPay', type: 'EWALLET' },
  { name: 'OVO', type: 'EWALLET' },
  { name: 'DANA', type: 'EWALLET' },
  { name: 'ShopeePay', type: 'EWALLET' },
  { name: 'Tunai', type: 'CASH' },
];

// Rupiah only; other currencies type their own amount.
const BUDGET_SUGGESTIONS = [200_000, 350_000, 500_000];

const VALUES = [
  { title: 'Catat dalam dua ketukan', body: 'Nominal, kategori, selesai. Tidak perlu mikir panjang saat belanja.' },
  { title: 'Nilai dengan jujur tiap malam', body: 'Butuh, penting, ingin, atau impulsif? Tanpa menghakimi.' },
  { title: 'Tarik napas sebelum beli', body: 'Barang yang lumayan mahal diberi jeda dulu. Sering kali, keinginannya lewat.' },
];

// First run for a guest with no accounts: what Flowku is, the first accounts, and a weekly "wants" budget.
// Every step can be skipped; the dashboard's empty states still guide the user afterwards.
export default function OnboardingScreen() {
  const theme = useTheme();
  const currency = useCurrency();
  const [step, setStep] = useState<Step>('welcome');
  const [picked, setPicked] = useState<Picked[]>([]);
  const [customName, setCustomName] = useState('');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function finish(next: '/' | '/quick-log') {
    markOnboarded();
    closeModal();
    if (next === '/quick-log') router.push('/quick-log');
  }

  function toggle(preset: { name: string; type: AccountType }) {
    setPicked((list) =>
      list.some((p) => p.name === preset.name)
        ? list.filter((p) => p.name !== preset.name)
        : [...list, { ...preset, digits: '' }],
    );
  }

  function addCustom() {
    const name = customName.trim();
    if (!name || picked.some((p) => p.name.toLowerCase() === name.toLowerCase())) return;
    setPicked((list) => [...list, { name, type: 'BANK', digits: '' }]);
    setCustomName('');
  }

  async function saveAccounts() {
    if (picked.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('accounts')
      .insert(picked.map((p) => ({ name: p.name, type: p.type, opening_balance: Number(p.digits || '0') })));
    setSaving(false);
    if (error) return setError(error.message);
    setStep('budget');
  }

  async function pickCurrency(code: string) {
    setError(null);
    try {
      await saveCurrency(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan mata uang.');
    }
  }

  async function saveBudget() {
    const amount = Number(budget || '0');
    if (amount <= 0 || saving) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('budgets')
      .insert({ scope: 'DISCRETIONARY', period: 'WEEKLY', limit_amount: amount });
    setSaving(false);
    if (error) return setError(error.message);
    setStep('done');
  }

  const chip = (selected: boolean) => [
    styles.chip,
    { backgroundColor: selected ? theme.primary : theme.backgroundElement },
  ];
  const chipText = (selected: boolean) => ({ color: selected ? theme.onPrimary : theme.text });
  const primaryButton = (label: string, onPress: () => void, enabled = true) => (
    <Pressable
      disabled={!enabled || saving}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.primary },
        !enabled && !saving && styles.disabled,
        (pressed || saving) && styles.pressed,
      ]}>
      {saving ? (
        <ActivityIndicator color={theme.onPrimary} />
      ) : (
        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.dots}>
              {STEPS.map((s) => (
                <View
                  key={s}
                  style={[
                    styles.dot,
                    { backgroundColor: s === step ? theme.primary : theme.backgroundSelected },
                    s === step && styles.dotActive,
                  ]}
                />
              ))}
            </View>
            {step !== 'done' && (
              <Pressable onPress={() => finish('/')} hitSlop={12}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Lewati
                </ThemedText>
              </Pressable>
            )}
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {step === 'welcome' && (
              <>
                <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
                <View style={styles.titleBlock}>
                  <ThemedText style={[styles.brand, { color: theme.primary }]}>Flowku</ThemedText>
                  <ThemedText type="subtitle">Uangmu mengalir tenang.</ThemedText>
                </View>
                {VALUES.map((v, i) => (
                  <View key={v.title} style={styles.value}>
                    <View style={[styles.number, { backgroundColor: theme.accent }]}>
                      <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                        {i + 1}
                      </ThemedText>
                    </View>
                    <View style={styles.flex}>
                      <ThemedText type="smallBold">{v.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {v.body}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </>
            )}

            {step === 'currency' && (
              <>
                <View style={styles.titleBlock}>
                  <ThemedText type="subtitle">Pakai mata uang apa?</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    Semua nominal di Flowku ditampilkan dalam mata uang ini. Bisa diganti nanti di Pengaturan.
                  </ThemedText>
                </View>
                <CurrencyList selected={currency.code} onSelect={pickCurrency} />
              </>
            )}

            {step === 'accounts' && (
              <>
                <View style={styles.titleBlock}>
                  <ThemedText type="subtitle">Uangmu ada di mana saja?</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    Pilih rekening, e-wallet, atau tunai. Isi saldonya sekarang; kira-kira juga tidak apa-apa.
                  </ThemedText>
                </View>
                <View style={styles.chips}>
                  {PRESETS.map((p) => {
                    const selected = picked.some((x) => x.name === p.name);
                    return (
                      <Pressable key={p.name} onPress={() => toggle(p)} style={chip(selected)}>
                        <ThemedText type="small" style={chipText(selected)}>
                          {p.name}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.inline}>
                  <TextInput
                    style={[styles.input, styles.flex, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                    value={customName}
                    onChangeText={setCustomName}
                    onSubmitEditing={addCustom}
                    placeholder="Nama lain, mis. Jenius"
                    placeholderTextColor={theme.textSecondary}
                    maxLength={50}
                  />
                  <Pressable onPress={addCustom} hitSlop={8} style={styles.addLink}>
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>
                      + Tambah
                    </ThemedText>
                  </Pressable>
                </View>
                {picked.map((p) => (
                  <ThemedView key={p.name} type="backgroundElement" style={styles.balanceRow}>
                    <ThemedText type="smallBold" style={styles.balanceName} numberOfLines={1}>
                      {p.name}
                    </ThemedText>
                    <View style={[styles.priceRow, { backgroundColor: theme.backgroundSelected }]}>
                      <ThemedText type="small">{currency.symbol.trim()}</ThemedText>
                      <TextInput
                        style={[styles.priceInput, { color: theme.text }]}
                        value={formatDigits(p.digits)}
                        onChangeText={(t) =>
                          setPicked((list) => list.map((x) => (x.name === p.name ? { ...x, digits: toDigits(t) } : x)))
                        }
                        placeholder="Saldo"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="number-pad"
                      />
                    </View>
                  </ThemedView>
                ))}
              </>
            )}

            {step === 'budget' && (
              <>
                <View style={styles.titleBlock}>
                  <ThemedText type="subtitle">Berapa batas jajan keinginanmu per minggu?</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    Untuk hal yang bukan kebutuhan: nongkrong, belanja iseng, hiburan. Flowku memakai angka ini untuk
                    memberi jeda sebelum kamu beli barang yang lumayan mahal.
                  </ThemedText>
                </View>
                <View style={[styles.priceRow, styles.bigPrice, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">{currency.symbol.trim()}</ThemedText>
                  <TextInput
                    style={[styles.priceInput, styles.bigInput, { color: theme.text }]}
                    value={formatDigits(budget)}
                    onChangeText={(t) => setBudget(toDigits(t))}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.chips}>
                  {currency.code === 'IDR' && BUDGET_SUGGESTIONS.map((value) => {
                    const selected = Number(budget) === value;
                    return (
                      <Pressable key={value} onPress={() => setBudget(String(value))} style={chip(selected)}>
                        <ThemedText type="small" style={chipText(selected)}>
                          {formatMoney(value)}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Bisa diubah kapan saja di Pengaturan.
                </ThemedText>
              </>
            )}

            {step === 'done' && (
              <>
                <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
                <View style={styles.titleBlock}>
                  <ThemedText type="subtitle">Siap. Pelan-pelan saja.</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    Setiap kali keluar uang, tekan &quot;+ Catat&quot;. Malamnya, Flowku akan mengajakmu menilai
                    pengeluaran hari itu dengan jujur.
                  </ThemedText>
                </View>
              </>
            )}

            {error && <ThemedText themeColor="danger">{error}</ThemedText>}
          </ScrollView>

          <View style={styles.footer}>
            {step === 'welcome' && primaryButton('Mulai', () => setStep('currency'))}
            {step === 'currency' && primaryButton(`Lanjut dengan ${currency.code}`, () => setStep('accounts'))}
            {step === 'accounts' && primaryButton('Simpan akun', saveAccounts, picked.length > 0)}
            {step === 'budget' && (
              <>
                {primaryButton('Simpan budget', saveBudget, Number(budget) > 0)}
                <Pressable onPress={() => setStep('done')} hitSlop={8} style={styles.secondary}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Nanti saja
                  </ThemedText>
                </Pressable>
              </>
            )}
            {step === 'done' && (
              <>
                {primaryButton('Catat pengeluaran pertama', () => finish('/quick-log'))}
                <Pressable onPress={() => finish('/')} hitSlop={8} style={styles.secondary}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Ke Beranda
                  </ThemedText>
                </Pressable>
              </>
            )}
          </View>
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
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
  },
  content: {
    gap: Spacing.four,
    paddingVertical: Spacing.three,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 24,
  },
  titleBlock: {
    gap: Spacing.two,
  },
  brand: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: 800,
    letterSpacing: -0.5,
  },
  value: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  addLink: {
    padding: Spacing.two,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    paddingLeft: Spacing.three,
    borderRadius: Spacing.three,
  },
  balanceName: {
    width: 90,
  },
  priceRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: 600,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  bigPrice: {
    flex: 0,
    borderRadius: Spacing.three,
  },
  bigInput: {
    fontSize: 28,
    fontWeight: 700,
    paddingVertical: Spacing.three,
  },
  footer: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  secondary: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
