import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NECESSITY, NECESSITY_ORDER, type Necessity } from '@/constants/necessity';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables } from '@/lib/database.types';
import { formatDigits, formatMoney, getCurrency, toDigits } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { cooldownHours, describeCooldown } from '@/lib/cooldown';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';

type Category = Pick<Tables<'categories'>, 'id' | 'name'>;

export default function NewIntentScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [necessity, setNecessity] = useState<Necessity | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const userId = useSession().session?.user.id;

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name')
      .eq('kind', 'EXPENSE')
      .order('created_at')
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  // The same daily limit the server uses for the pause, so the preview matches what will happen.
  useEffect(() => {
    if (!userId) return;
    supabase.rpc('safe_to_spend', { p_user_id: userId }).then(({ data }) => setDailyLimit(data?.[0]?.daily_limit ?? null));
  }, [userId]);

  const cost = Number(digits);
  const previewHours = dailyLimit !== null && cost > 0 ? cooldownHours(cost, dailyLimit) : null;

  const canSave = name.trim().length > 0 && Number(digits) > 0 && necessity !== null && !saving;

  async function save() {
    if (!canSave || !necessity) return;
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from('buy_intents')
      .insert({ item_name: name.trim(), estimated_cost: Number(digits), necessity, category_id: categoryId })
      .select('created_at, cooldown_until')
      .single();
    setSaving(false);
    if (error) return setError(error.message);
    const hours = Math.round((new Date(data.cooldown_until).getTime() - new Date(data.created_at).getTime()) / 3_600_000);
    setResult(describeCooldown(hours, dailyLimit));
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  if (result) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safeArea, styles.center]}>
          <ThemedText type="subtitle" style={styles.centerText}>
            Tercatat
          </ThemedText>
          <ThemedText style={styles.centerText}>{name.trim()}</ThemedText>
          <ThemedText type="smallBold" style={styles.centerText}>
            {formatMoney(Number(digits))}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            {result}
          </ThemedText>
          <Pressable
            onPress={closeModal}
            style={({ pressed }) => [styles.save, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              Oke
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              NIAT BELI
            </ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Batal
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <ThemedText type="small" themeColor="textSecondary">
              Mau beli apa?
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={name}
              onChangeText={setName}
              placeholder="Mis. Keyboard mechanical"
              placeholderTextColor={theme.textSecondary}
              maxLength={100}
              autoFocus
            />

            <ThemedText type="small" themeColor="textSecondary">
              Perkiraan harga
            </ThemedText>
            <View style={[styles.priceRow, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.prefix}>{getCurrency().symbol.trim()}</ThemedText>
              <TextInput
                style={[styles.priceInput, { color: theme.text }]}
                value={formatDigits(digits)}
                onChangeText={(t) => setDigits(toDigits(t))}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
              />
            </View>
            {previewHours !== null && (
              <ThemedText type="small" themeColor={previewHours === 0 ? 'textSecondary' : 'warning'}>
                {describeCooldown(previewHours, dailyLimit)}
              </ThemedText>
            )}

            <ThemedText type="small" themeColor="textSecondary">
              Jujur, ini sebenarnya apa?
            </ThemedText>
            <View style={styles.options}>
              {NECESSITY_ORDER.map((n) => {
                const selected = n === necessity;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setNecessity(n)}
                    style={[
                      styles.option,
                      { borderColor: NECESSITY[n].color },
                      selected && { backgroundColor: NECESSITY[n].color },
                    ]}>
                    <ThemedText type="smallBold" style={selected ? styles.white : undefined}>
                      {NECESSITY[n].label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              Kategori (opsional)
            </ThemedText>
            <View style={styles.chips}>
              {categories.map((c) => {
                const selected = c.id === categoryId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategoryId(selected ? null : c.id)}
                    style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.backgroundElement }]}>
                    <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
                      {c.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {error && <ThemedText themeColor="danger">{error}</ThemedText>}
          </ScrollView>

          <Pressable
            disabled={!canSave}
            onPress={save}
            style={({ pressed }) => [
              styles.save,
              { backgroundColor: theme.primary },
              !canSave && !saving && styles.disabled,
              (pressed || saving) && styles.pressed,
            ]}>
            {saving ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {previewHours === 0 ? 'Simpan' : 'Simpan & mulai jeda'}
              </ThemedText>
            )}
          </Pressable>
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
  center: {
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  centerText: {
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  form: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  input: {
    fontSize: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  prefix: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
  },
  priceInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 700,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    flexGrow: 1,
    width: '45%',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  white: {
    color: '#ffffff',
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
});
