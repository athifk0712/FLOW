// An expense is ready for reflection once the purchase has had time to settle,
// and stops being asked about once it is too old to remember clearly.
const MIN_AGE_DAYS = 3;
const MAX_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** `occurred_at` bounds for expenses that are due for the weekly reflection. */
export function weeklyReviewWindow(now = Date.now()) {
  return {
    from: new Date(now - MAX_AGE_DAYS * DAY_MS).toISOString(),
    to: new Date(now - MIN_AGE_DAYS * DAY_MS).toISOString(),
  };
}
