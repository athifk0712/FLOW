import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DUE_LABEL } from '@/lib/due-plan';
import {
  applyReminderSettings,
  getReminderSettings,
  REMINDER_HOURS,
  REMINDERS_SUPPORTED,
  REMINDERS_UNAVAILABLE_NOTE,
  type ReminderSettings,
  WEEKLY_LABEL,
} from '@/lib/reminders';

export default function RemindersScreen() {
  const theme = useTheme();
  const [reminder, setReminder] = useState<ReminderSettings>(getReminderSettings);
  const [message, setMessage] = useState<string | null>(null);

  async function update(next: ReminderSettings) {
    setReminder(next);
    setMessage(null);
    const ok = await applyReminderSettings(next);
    if (!ok) {
      setReminder({ ...next, enabled: false, weeklyEnabled: false, dueEnabled: false });
      setMessage('Izin notifikasi ditolak. Aktifkan dari pengaturan HP.');
      return;
    }
    const active = [
      next.enabled && `cek harian setiap hari jam ${String(next.hour).padStart(2, '0')}.00`,
      next.weeklyEnabled && `refleksi mingguan setiap ${WEEKLY_LABEL}`,
      next.dueEnabled && `jatuh tempo jam ${DUE_LABEL}`,
    ].filter(Boolean);
    setMessage(active.length > 0 ? `Pengingat aktif: ${active.join(' dan ')}.` : null);
  }

  if (!REMINDERS_SUPPORTED) {
    return (
      <SubScreen title="Pengingat">
        <ThemedText type="small" themeColor="textSecondary">
          {REMINDERS_UNAVAILABLE_NOTE}
        </ThemedText>
      </SubScreen>
    );
  }

  return (
    <SubScreen title="Pengingat">
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="smallBold">Cek harian</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Pengingat tiap malam untuk menandai pengeluaran hari itu.
            </ThemedText>
          </View>
          <Switch value={reminder.enabled} onValueChange={(enabled) => update({ ...reminder, enabled })} />
        </View>
        {reminder.enabled && (
          <View style={styles.hours}>
            {REMINDER_HOURS.map((hour) => {
              const selected = hour === reminder.hour;
              return (
                <Pressable
                  key={hour}
                  onPress={() => update({ ...reminder, hour })}
                  style={[styles.hour, { backgroundColor: selected ? theme.primary : theme.backgroundSelected }]}>
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
            onValueChange={(weeklyEnabled) => update({ ...reminder, weeklyEnabled })}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="smallBold">Jatuh tempo</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Utang, piutang, dan tagihan rutin: jam {DUE_LABEL} di harinya.
            </ThemedText>
          </View>
          <Switch value={reminder.dueEnabled} onValueChange={(dueEnabled) => update({ ...reminder, dueEnabled })} />
        </View>
        {message && (
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>
        )}
      </ThemedView>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
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
});
