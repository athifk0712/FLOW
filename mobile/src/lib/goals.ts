import type { Tables } from '@/lib/database.types';

export type Goal = Tables<'v_goal_progress'>;

const monthFormat = new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' });

/** "2026-12-31" -> local Date (a plain date string would otherwise parse as UTC midnight). */
function localDate(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Deadline stored for a target month `offset` months from now: that month's last day, as YYYY-MM-DD. */
export function deadlineFromOffset(offset: number, now = new Date()) {
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

/** Months from now to the deadline's month (0 = this month), for the month stepper. */
export function offsetFromDeadline(deadline: string, now = new Date()) {
  const d = localDate(deadline);
  return (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth();
}

export function deadlineLabel(deadline: string) {
  return monthFormat.format(localDate(deadline));
}

/** One line on where a goal stands: done, how much per month is needed, or just what is left. */
export function goalStatus(goal: Goal, now = new Date()) {
  const target = goal.target_amount ?? 0;
  const saved = goal.saved ?? 0;
  const left = target - saved;
  if (left <= 0) return { done: true, left: 0, perMonth: null, overdue: false };
  if (!goal.deadline) return { done: false, left, perMonth: null, overdue: false };
  const months = offsetFromDeadline(goal.deadline, now) + 1; // this month counts
  if (months <= 0) return { done: false, left, perMonth: null, overdue: true };
  return { done: false, left, perMonth: Math.ceil(left / months), overdue: false };
}
