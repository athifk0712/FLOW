// Category order in Catat: the ones this user picks most, and most recently, come first.
// Each past use counts for less as it ages (half as much after HALF_LIFE_DAYS), so a habit that changed last month
// moves down by itself. Only the user's own transactions are used. Unused categories keep their creation order,
// and "Lainnya" (the catch-all) always goes last.

export type CategoryUse = { category_id: string | null; occurred_at: string };

export const HALF_LIFE_DAYS = 21;
const DAY = 86_400_000;

export function categoryScores(uses: CategoryUse[], now = new Date()) {
  const scores = new Map<string, number>();
  for (const u of uses) {
    if (!u.category_id) continue;
    const ageDays = Math.max(0, (now.getTime() - new Date(u.occurred_at).getTime()) / DAY);
    scores.set(u.category_id, (scores.get(u.category_id) ?? 0) + 0.5 ** (ageDays / HALF_LIFE_DAYS));
  }
  return scores;
}

const isCatchAll = (name: string) => name.trim().toLowerCase() === 'lainnya';

export function rankCategories<T extends { id: string; name: string }>(categories: T[], uses: CategoryUse[], now = new Date()) {
  const scores = categoryScores(uses, now);
  return categories
    .map((c, index) => ({ c, index, score: scores.get(c.id) ?? 0, last: isCatchAll(c.name) }))
    .sort((a, b) => Number(a.last) - Number(b.last) || b.score - a.score || a.index - b.index)
    .map((x) => x.c);
}
