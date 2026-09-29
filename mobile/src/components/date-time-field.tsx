import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const dayFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const pad = (n: number) => String(n).padStart(2, '0');
const timeText = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysAgo(d: Date) {
  return Math.round((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86_400_000);
}

/** Keeps the time of `d` but moves it to `days` days before today. */
function onDay(d: Date, days: number) {
  const today = startOfDay(new Date());
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - days, d.getHours(), d.getMinutes());
}

type Props = { value: Date; onChange: (value: Date) => void };

/** Day stepper plus a HH:MM field. Plain components, so it works the same on phones and web. Never goes past today. */
export function DateTimeField({ value, onChange }: Props) {
  const theme = useTheme();
  const [time, setTime] = useState(timeText(value));
  const ago = daysAgo(value);

  function commitTime() {
    const match = /^(\d{1,2})[:.]?(\d{2})$/.exec(time.trim());
    const hours = match ? Number(match[1]) : NaN;
    const minutes = match ? Number(match[2]) : NaN;
    if (!(hours <= 23 && minutes <= 59)) return setTime(timeText(value));
    const next = new Date(value.getFullYear(), value.getMonth(), value.getDate(), hours, minutes);
    setTime(timeText(next));
    onChange(next);
  }

  const box = { backgroundColor: theme.backgroundElement };
  const chip = (selected: boolean) => [styles.chip, { backgroundColor: selected ? theme.text : theme.backgroundElement }];
  const chipText = (selected: boolean) => ({ color: selected ? theme.background : theme.text });

  return (
    <View style={styles.container}>
      <View style={[styles.stepper, box]}>
        <Pressable onPress={() => onChange(onDay(value, ago + 1))} hitSlop={8} style={styles.arrow}>
          <ThemedText type="smallBold">‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold" style={styles.day}>
          {dayFormat.format(value)}
        </ThemedText>
        <Pressable
          disabled={ago <= 0}
          onPress={() => onChange(onDay(value, ago - 1))}
          hitSlop={8}
          style={[styles.arrow, ago <= 0 && styles.disabled]}>
          <ThemedText type="smallBold">›</ThemedText>
        </Pressable>
      </View>

      <View style={styles.row}>
        {[
          { label: 'Hari ini', days: 0 },
          { label: 'Kemarin', days: 1 },
        ].map((c) => (
          <Pressable key={c.days} onPress={() => onChange(onDay(value, c.days))} style={chip(ago === c.days)}>
            <ThemedText type="small" style={chipText(ago === c.days)}>
              {c.label}
            </ThemedText>
          </Pressable>
        ))}
        <View style={[styles.time, box]}>
          <ThemedText type="small" themeColor="textSecondary">
            Jam
          </ThemedText>
          <TextInput
            style={[styles.timeInput, { color: theme.text }]}
            value={time}
            onChangeText={setTime}
            onBlur={commitTime}
            onSubmitEditing={commitTime}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            selectTextOnFocus
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
  },
  arrow: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  day: {
    flex: 1,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginLeft: 'auto',
    paddingLeft: Spacing.three,
    borderRadius: Spacing.five,
  },
  timeInput: {
    width: 64,
    fontSize: 16,
    fontWeight: 600,
    paddingVertical: Spacing.two,
  },
  disabled: {
    opacity: 0.3,
  },
});
