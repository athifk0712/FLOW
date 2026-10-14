// Win streak display. The count itself is kept by the server (profiles.streak_count / last_active_date, moved only
// by a successful transaction or a finished daily check, on the server's clock); the app only reads it.

/** Local "YYYY-MM-DD". */
export function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function previousDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return localDayKey(new Date(y, m - 1, d - 1));
}

export type StreakView = {
  days: number; // still alive (today or yesterday active), else 0
  activeToday: boolean;
};

/** A streak whose last day is before yesterday has ended, even though the stored count hasn't been reset yet. */
export function streakView(count: number, lastActive: string | null, today = localDayKey()): StreakView {
  if (!lastActive || count <= 0) return { days: 0, activeToday: false };
  if (lastActive === today) return { days: count, activeToday: true };
  if (lastActive === previousDay(today)) return { days: count, activeToday: false };
  return { days: 0, activeToday: false };
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
