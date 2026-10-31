// Win streak display. The count itself is kept by the server (profiles.streak_count / last_active_date, moved only
// by a successful transaction or a finished daily check, on the server's clock); the app only reads it.
// Missing one day doesn't end a streak while a save is left: the next activity uses one and the streak carries on.

export const STREAK_SAVES_PER_MONTH = 2;
export const STREAK_COLUMNS = 'streak_count, last_active_date, streak_saves_used, streak_saves_month, streak_saved_on' as const;

export type StreakProfile = {
  streak_count: number;
  last_active_date: string | null;
  streak_saves_used: number;
  streak_saves_month: string | null;
  streak_saved_on: string | null;
};

/** Local "YYYY-MM-DD". */
export function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function previousDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return localDayKey(new Date(y, m - 1, d - 1));
}

export type StreakView = {
  days: number; // still alive (today or yesterday active, or one day missed with a save left), else 0
  activeToday: boolean;
  /** One day was missed: logging today uses a save and keeps the streak. */
  atRisk?: boolean;
};

/** A streak whose last day is further back than a save can reach has ended, even if the stored count isn't reset yet. */
export function streakView(count: number, lastActive: string | null, today = localDayKey(), saves = 0): StreakView {
  if (!lastActive || count <= 0) return { days: 0, activeToday: false };
  if (lastActive === today) return { days: count, activeToday: true };
  const yesterday = previousDay(today);
  if (lastActive === yesterday) return { days: count, activeToday: false };
  if (saves > 0 && lastActive === previousDay(yesterday)) return { days: count, activeToday: false, atRisk: true };
  return { days: 0, activeToday: false };
}

/** Saves left in `today`'s month; the used count only applies to the month it was counted in. */
export function savesLeft(profile: Pick<StreakProfile, 'streak_saves_used' | 'streak_saves_month'>, today = localDayKey()) {
  const sameMonth = profile.streak_saves_month?.slice(0, 7) === today.slice(0, 7);
  return Math.max(0, STREAK_SAVES_PER_MONTH - (sameMonth ? profile.streak_saves_used : 0));
}

export function streakFromProfile(profile: StreakProfile, today = localDayKey()) {
  const saves = savesLeft(profile, today);
  return {
    view: streakView(profile.streak_count, profile.last_active_date, today, saves),
    saves,
    savedToday: profile.streak_saved_on === today,
  };
}

/** Celebrate once per day, after the day's first counted activity has been saved. */
export function shouldCelebrate(view: StreakView, celebratedOn: string | null, today = localDayKey()) {
  return view.activeToday && view.days > 0 && celebratedOn !== today;
}

export function celebrationMessage(days: number) {
  if (days === 1) return 'Hari pertama! Langkah kecil yang konsisten itu yang paling berarti.';
  if (days < 7) return `${days} hari beruntun! Kamu semakin konsisten mengelola keuangan.`;
  if (days < 30) return `${days} hari beruntun! Kebiasaan baik ini mulai terbentuk. Pertahankan, ya.`;
  return `${days} hari beruntun! Luar biasa, mencatat sudah jadi kebiasaanmu.`;
}

const CELEBRATED_KEY = 'flowku.streakCelebrated';

export function celebratedOn() {
  try {
    return localStorage.getItem(CELEBRATED_KEY);
  } catch {
    return null;
  }
}

export function markCelebrated(day = localDayKey()) {
  try {
    localStorage.setItem(CELEBRATED_KEY, day);
  } catch {
    // Worst case it shows once more; harmless.
  }
}
