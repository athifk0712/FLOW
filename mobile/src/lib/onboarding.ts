// Whether this device has finished or skipped onboarding. Device-only, like the reminder settings.
const STORAGE_KEY = 'flowku.onboarded';

export function isOnboarded() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true; // storage unavailable: never trap the user in onboarding
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Nothing to do; the dashboard's empty states still guide the user.
  }
}
