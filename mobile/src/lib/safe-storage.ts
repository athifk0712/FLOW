import 'expo-sqlite/localStorage/install';

// Some browsers (Safari with "Block All Cookies", some in-app browsers) refuse localStorage or silently drop what is
// written to it. The login session then vanishes right after sign-up and every request goes out without a user
// token. This wrapper keeps a copy in memory, so the session at least lasts while the app stays open.
const memory = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    // What this run wrote wins; storage only fills in values saved by an earlier launch.
    if (memory.has(key)) return memory.get(key) ?? null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      // Memory copy only.
    }
  },
  removeItem(key: string) {
    memory.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      // Memory copy only.
    }
  },
};

const PROBE_KEY = 'flowku.storage-probe';

/** False when this browser doesn't keep what is saved (data and login are lost when the page closes). */
export function storagePersists() {
  try {
    const value = String(Date.now());
    localStorage.setItem(PROBE_KEY, value);
    const ok = localStorage.getItem(PROBE_KEY) === value;
    localStorage.removeItem(PROBE_KEY);
    return ok;
  } catch {
    return false;
  }
}
