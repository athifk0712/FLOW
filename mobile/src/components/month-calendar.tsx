import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addMonths, dateKey, type DayTotals, monthGrid, sameDay, shortAmount, WEEKDAYS } from '@/lib/calendar';
import { getCurrency } from '@/lib/money';

const monthFormat = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });

type Props = {
  month: Date;
  onMonthChange: (month: Date) => void;
  selected?: Date | null;
  onSelect?: (day: Date) => void;
  /** Per-day income/spending; when given, each day shows its spending in red and a green dot when money came in. */
  totals?: Map<string, DayTotals>;
  /** Days after this can't be picked, and months after it can't be opened. */
  maxDate?: Date;
  /** False when the screen draws its own month switcher. */
  showHeader?: boolean;
};

/** Month grid, Monday first. Used as the Kalender tab's main view and as a compact date picker. */
export function MonthCalendar({ month, onMonthChange, selected, onSelect, totals, maxDate, showHeader = true }: Props) {
  const theme = useTheme();
  const today = new Date();
  const decimals = getCurrency().decimals;
  const canGoNext = !maxDate || addMonths(month, 1) <= maxDate;

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <Pressable
            onPress={() => onMonthChange(addMonths(month, -1))}
            hitSlop={12}
            style={styles.arrow}
            accessibilityLabel="Bulan sebelumnya"
          >
            <AppSymbol material="chevron_left" sf="chevron.left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="smallBold" style={styles.title}>
            {monthFormat.format(month)}
          </ThemedText>
          <Pressable
            onPress={() => onMonthChange(addMonths(month, 1))}
            disabled={!canGoNext}
            hitSlop={12}
            style={[styles.arrow, !canGoNext && styles.disabled]}
            accessibilityLabel="Bulan berikutnya"
          >
            <AppSymbol material="chevron_right" sf="chevron.right" size={24} color={theme.text} />
          </Pressable>
        </View>
      )}

      <View style={styles.week}>
        {WEEKDAYS.map((d) => (
          <ThemedText key={d} type="small" themeColor="textSecondary" style={styles.weekday}>
            {d}
          </ThemedText>
        ))}
      </View>

      {monthGrid(month).map((week, i) => (
        <View key={i} style={styles.week}>
          {week.map((day, j) => {
            if (!day) return <View key={j} style={styles.cell} />;
            const t = totals?.get(dateKey(day));
            const isSelected = !!selected && sameDay(day, selected);
            const isToday = sameDay(day, today);
            const disabled = !!maxDate && day > maxDate;
            return (
              <Pressable
                key={j}
                disabled={disabled || !onSelect}
                onPress={() => onSelect?.(day)}
                style={({ pressed }) => [
                  styles.cell,
                  styles.day,
                  totals ? styles.tall : styles.short,
                  { backgroundColor: isSelected ? theme.primary : totals ? theme.background : theme.backgroundElement },
                  isToday && !isSelected && { borderColor: theme.primary, borderWidth: 1.5 },
                  disabled && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText
                  type={isToday || isSelected ? 'smallBold' : 'small'}
                  style={{ color: isSelected ? theme.onPrimary : theme.text }}
                >
                  {day.getDate()}
                </ThemedText>
                {totals && (
                  <>
                    <ThemedText
                      type="smallBold"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[styles.value, { color: isSelected ? theme.onPrimary : theme.danger }]}
                    >
                      {t && t.out > 0 ? shortAmount(t.out / 10 ** decimals).slice(1) : ' '}
                    </ThemedText>
                    <View
                      style={[
                        styles.incomeDot,
                        {
                          backgroundColor:
                            t && t.in > 0 ? (isSelected ? theme.onPrimary : theme.positive) : 'transparent',
                        },
                      ]}
                    />
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one + Spacing.half,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  arrow: {
    padding: Spacing.one,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
  },
  week: {
    flexDirection: 'row',
    gap: Spacing.one + Spacing.half,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  cell: {
    flex: 1,
  },
  day: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two + Spacing.one,
  },
  short: {
    paddingVertical: Spacing.two,
  },
  tall: {
    minHeight: 56,
    paddingVertical: Spacing.one,
    gap: Spacing.half,
  },
  incomeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Sized so "127rb" fits a 360px-wide phone's cell (adjustsFontSizeToFit does nothing on web).
  value: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: -0.2,
  },
  disabled: {
    opacity: 0.3,
  },
  pressed: {
    opacity: 0.7,
  },
});
