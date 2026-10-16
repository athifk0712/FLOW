import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { Field, PrimaryButton, TextField } from '@/components/form-fields';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addSaved,
  type CustomPeriod,
  customProblem,
  dayKey,
  normalizeCustom,
  parseDay,
  PERIOD_OPTIONS,
  type PeriodKey,
  storeSavedPeriods,
} from '@/lib/asset-periods';

type Props = {
  period: PeriodKey;
  custom: CustomPeriod | null;
  saved: CustomPeriod[];
  onChange: (period: PeriodKey, custom: CustomPeriod | null) => void;
  onSavedChange: (saved: CustomPeriod[]) => void;
};

// Which sales the realized P/L covers. Only filters what is shown; no sale, wallet or asset changes.
export function SalePeriodPicker({ period, custom, saved, onChange, onSavedChange }: Props) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const draft = { name, from: from ? dayKey(from) : '', to: to ? dayKey(to) : '' };
  const problem = customProblem(draft);

  const chip = (on: boolean) => [styles.chip, { backgroundColor: on ? theme.primary : theme.backgroundSelected }];
  const chipText = (on: boolean) => ({ color: on ? theme.onPrimary : theme.text });

  function apply() {
    if (problem) return;
    const next = normalizeCustom(draft);
    // Named periods are kept on this device to reuse later.
    if (name.trim()) {
      const list = addSaved(saved, next);
      storeSavedPeriods(list);
      onSavedChange(list);
    }
    onChange('custom', next);
    setEditing(false);
  }

  function edit(p: CustomPeriod | null) {
    setName(p?.name ?? '');
    setFrom(p ? parseDay(p.from) : null);
    setTo(p ? parseDay(p.to) : null);
    setEditing(true);
  }

  function forget(p: CustomPeriod) {
    const list = saved.filter((x) => x.name !== p.name);
    storeSavedPeriods(list);
    onSavedChange(list);
    if (period === 'custom' && custom?.name === p.name) onChange('cycle', null);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {PERIOD_OPTIONS.map((o) => {
          const on = period === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => {
                setEditing(false);
                onChange(o.key, null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={chip(on)}>
              <ThemedText type="small" style={chipText(on)}>
                {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
        {saved.map((p) => {
          const on = period === 'custom' && custom?.name === p.name;
          return (
            <Pressable
              key={p.name}
              onPress={() => {
                setEditing(false);
                onChange('custom', p);
              }}
              onLongPress={() => edit(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityHint="Tekan lama untuk mengubah"
              style={chip(on)}>
              <ThemedText type="small" style={chipText(on)} numberOfLines={1}>
                {p.name}
              </ThemedText>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => (editing ? setEditing(false) : edit(period === 'custom' ? custom : null))}
          accessibilityRole="button"
          accessibilityState={{ expanded: editing }}
          style={chip(editing || (period === 'custom' && !saved.some((p) => p.name === custom?.name)))}>
          <ThemedText type="small" style={chipText(editing || (period === 'custom' && !saved.some((p) => p.name === custom?.name)))}>
            Lainnya…
          </ThemedText>
        </Pressable>
      </View>

      {editing && (
        <ThemedView type="backgroundSelected" style={styles.editor}>
          <Field label="Nama periode (opsional)" hint="Diberi nama? Periodenya disimpan untuk dipakai lagi.">
            <TextField value={name} onChangeText={setName} placeholder="mis. Trading Akun FF" maxLength={40} />
          </Field>
          <Field label="Tanggal mulai">
            <DateField value={from} onChange={setFrom} placeholder="Pilih tanggal" accessibilityLabel="Tanggal mulai" />
          </Field>
          <Field label="Tanggal akhir">
            <DateField value={to} onChange={setTo} placeholder="Pilih tanggal" accessibilityLabel="Tanggal akhir" />
          </Field>
          {problem && (from || to) && (
            <ThemedText type="small" themeColor="warning">
              {problem}
            </ThemedText>
          )}
          <PrimaryButton label="Terapkan" onPress={apply} disabled={!!problem} />
          {saved.some((p) => p.name === name.trim()) && (
            <Pressable
              onPress={() => {
                const p = saved.find((x) => x.name === name.trim());
                if (p) forget(p);
                setEditing(false);
              }}
              hitSlop={8}
              style={styles.center}>
              <ThemedText type="small" themeColor="danger">
                Hapus periode &quot;{name.trim()}&quot;
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 34,
    maxWidth: 180,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  editor: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  center: {
    alignSelf: 'center',
    padding: Spacing.one,
  },
});
