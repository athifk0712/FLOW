import { isRunningInExpoGo } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { planDueReminders } from '@/lib/due-plan';
import { supabase } from '@/lib/supabase';

// Local reminders for the nightly chat, the weekly review and for due dates. Preferences live on the device only.

const NIGHTLY_ID = 'nightly-review';
const WEEKLY_ID = 'weekly-review';
const DUE_PREFIX = 'due-';
const CHANNEL_ID = 'reminders';
const STORAGE_KEY = 'flow.reminder';

export const REVIEW_ROUTE = '/coach';
export const WEEKLY_REVIEW_ROUTE = '/weekly-review';
export const REMINDER_ROUTES = [REVIEW_ROUTE, WEEKLY_REVIEW_ROUTE, '/debts', '/recurring'] as const;
export const REMINDER_HOURS = [20, 21, 22] as const;

// Weekly reflection: Sunday 19.00, before the nightly reminder so the two never stack.
const WEEKLY_WEEKDAY = 1; // expo-notifications: 1 = Sunday
const WEEKLY_HOUR = 19;
export const WEEKLY_LABEL = 'Minggu, 19.00';

export type ReminderSettings = { enabled: boolean; hour: number; weeklyEnabled: boolean; dueEnabled: boolean };

const DEFAULT_SETTINGS: ReminderSettings = { enabled: false, hour: 21, weeklyEnabled: false, dueEnabled: false };

// Expo Go on Android throws as soon as expo-notifications is imported (push support was removed),
// so reminders there need a development build.
const EXPO_GO_ANDROID = Platform.OS === 'android' && isRunningInExpoGo();

/** Scheduled local notifications are not supported in the browser or in Expo Go on Android. */
export const REMINDERS_SUPPORTED = Platform.OS !== 'web' && !EXPO_GO_ANDROID;

export const REMINDERS_UNAVAILABLE_NOTE = EXPO_GO_ANDROID
  ? 'Pengingat belum bisa dipakai di Expo Go. Nanti aktif di versi aplikasi yang di-install.'
  : 'Pengingat hanya tersedia di aplikasi HP. Aktifkan dari sana; obrolan malamnya tetap bisa dibuka di sini.';

/** Loaded lazily so unsupported platforms never evaluate the module. Only use when REMINDERS_SUPPORTED. */
export const Notifications: typeof NotificationsModule = REMINDERS_SUPPORTED
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- must not load in Expo Go on Android
    require('expo-notifications')
  : (null as unknown as typeof NotificationsModule);

if (REMINDERS_SUPPORTED) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function getReminderSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Applies the settings (schedules or cancels) and persists them. Returns false if permission was denied. */
export async function applyReminderSettings(settings: ReminderSettings): Promise<boolean> {
  if (!REMINDERS_SUPPORTED) return false;
  await Promise.all(
    [NIGHTLY_ID, WEEKLY_ID].map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})),
  );

  if (settings.enabled || settings.weeklyEnabled || settings.dueEnabled) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Pengingat',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, enabled: false, weeklyEnabled: false, dueEnabled: false }));
      return false;
    }
  }

  if (settings.enabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: NIGHTLY_ID,
      content: {
        title: 'Cek harian',
        body: 'Tandai pengeluaran hari ini. Cuma semenit.',
        data: { url: REVIEW_ROUTE },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.hour,
        minute: 0,
        channelId: CHANNEL_ID,
      },
    });
  }

  if (settings.weeklyEnabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY_ID,
      content: {
        title: 'Refleksi mingguan',
        body: 'Pengeluaran minggu lalu: masih puas, atau menyesal?',
        data: { url: WEEKLY_REVIEW_ROUTE },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: WEEKLY_WEEKDAY,
        hour: WEEKLY_HOUR,
        minute: 0,
        channelId: CHANNEL_ID,
      },
    });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  await syncDueReminders(settings);
  return true;
}

/**
 * Reschedules the due-date reminders from the latest debts and recurring expenses. Call after they may have
 * changed (dashboard focus, saving a debt or rule). Errors are swallowed: a missed reminder must not break a screen.
 */
export async function syncDueReminders(settings = getReminderSettings()) {
  if (!REMINDERS_SUPPORTED) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(DUE_PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    if (!settings.dueEnabled) return;

    const [debts, rules] = await Promise.all([
      supabase.from('v_debts').select('id, person, direction, remaining, due_date, settled').eq('settled', false),
      supabase.from('recurring_transactions').select('id, name, amount, type, active, next_due').eq('active', true),
    ]);
    if (debts.error || rules.error) return;

    for (const reminder of planDueReminders(debts.data ?? [], rules.data ?? [])) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: { title: reminder.title, body: reminder.body, data: { url: reminder.url } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.date, channelId: CHANNEL_ID },
      });
    }
  } catch {
    // Keep the screen working; the next sync tries again.
  }
}
