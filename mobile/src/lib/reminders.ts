import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Local reminders for the nightly and weekly reviews. Preferences live on the device only.

const NIGHTLY_ID = 'nightly-review';
const WEEKLY_ID = 'weekly-review';
const CHANNEL_ID = 'reminders';
const STORAGE_KEY = 'flow.reminder';

export const REVIEW_ROUTE = '/review';
export const WEEKLY_REVIEW_ROUTE = '/weekly-review';
export const REMINDER_ROUTES = [REVIEW_ROUTE, WEEKLY_REVIEW_ROUTE] as const;
export const REMINDER_HOURS = [20, 21, 22] as const;

// Weekly reflection: Sunday 19.00, before the nightly reminder so the two never stack.
const WEEKLY_WEEKDAY = 1; // expo-notifications: 1 = Sunday
const WEEKLY_HOUR = 19;
export const WEEKLY_LABEL = 'Minggu, 19.00';

export type ReminderSettings = { enabled: boolean; hour: number; weeklyEnabled: boolean };

const DEFAULT_SETTINGS: ReminderSettings = { enabled: false, hour: 21, weeklyEnabled: false };

/** Scheduled local notifications are not supported in the browser. */
export const REMINDERS_SUPPORTED = Platform.OS !== 'web';

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
  await Promise.all(
    [NIGHTLY_ID, WEEKLY_ID].map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})),
  );

  if (settings.enabled || settings.weeklyEnabled) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Pengingat',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, enabled: false, weeklyEnabled: false }));
      return false;
    }
  }

  if (settings.enabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: NIGHTLY_ID,
      content: {
        title: 'Review malam',
        body: 'Nilai pengeluaran hari ini. Cukup satu menit.',
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
  return true;
}
