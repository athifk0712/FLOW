import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Daily local reminder for the nightly review. Preference lives on the device only.

const NOTIFICATION_ID = 'nightly-review';
const CHANNEL_ID = 'reminders';
const STORAGE_KEY = 'flow.reminder';

export const REVIEW_ROUTE = '/review';
export const REMINDER_HOURS = [20, 21, 22] as const;

export type ReminderSettings = { enabled: boolean; hour: number };

const DEFAULT_SETTINGS: ReminderSettings = { enabled: false, hour: 21 };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {});

  if (settings.enabled) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Pengingat',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, enabled: false }));
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
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

  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return true;
}
