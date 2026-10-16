import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { MonthCalendar } from '@/components/month-calendar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const dayFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

type Props = {
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** Shown when there is no date, e.g. "Tidak ingat". */
  placeholder: string;
  /** Lets the user go back to "no date". */
  clearable?: boolean;
  maxDate?: Date;
  accessibilityLabel?: string;
};

/** A day (no time): tap to open a month calendar. Plain components, so it works the same on phones and web. */
export function DateField({ value, onChange, placeholder, clearable, maxDate, accessibilityLabel }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = value ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={[styles.box, { backgroundColor: theme.backgroundElement }]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}>
        <AppSymbol material="calendar_month" sf="calendar" size={18} color={theme.primary} />
        <ThemedText type="small" style={styles.flex} themeColor={value ? undefined : 'textSecondary'}>
          {value ? dayFormat.format(value) : placeholder}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="primary">
          {open ? 'Tutup' : 'Pilih'}
        </ThemedText>
      </Pressable>
      {open && (
        <View style={[styles.calendar, { backgroundColor: theme.backgroundElement }]}>
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selected={value}
            maxDate={maxDate}
            onSelect={(day) => {
              onChange(new Date(day.getFullYear(), day.getMonth(), day.getDate()));
              setOpen(false);
            }}
          />
          {clearable && value && (
            <Pressable
              onPress={() => {
                onChange(null);
                setOpen(false);
              }}
              hitSlop={8}
              style={styles.clear}>
              <ThemedText type="small" themeColor="textSecondary">
                {placeholder}
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  calendar: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  clear: {
    alignSelf: 'center',
    padding: Spacing.one,
  },
});
