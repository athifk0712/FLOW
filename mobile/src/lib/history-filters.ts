import type { Enums } from '@/lib/database.types';

export type TypeFilter = 'ALL' | Enums<'transaction_type'>;
export type Period = 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30';

export type HistoryFilters = {
  type: TypeFilter;
  search: string;
  categoryId: string | null;
  accountId: string | null;
  period: Period;
};

export const EMPTY_FILTERS: HistoryFilters = { type: 'ALL', search: '', categoryId: null, accountId: null, period: 'ALL' };

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'ALL', label: 'Semua waktu' },
  { value: 'THIS_MONTH', label: 'Bulan ini' },
  { value: 'LAST_MONTH', label: 'Bulan lalu' },
  { value: 'LAST_30', label: '30 hari' },
];

/** Local-time [from, to) for a period, or null for all time. */
export function periodRange(period: Period, now = new Date()) {
  switch (period) {
    case 'THIS_MONTH':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    case 'LAST_MONTH':
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case 'LAST_30':
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29), to: null };
    default:
      return null;
  }
}

/** A PostgREST value in double quotes, so commas and parentheses in user text cannot break the filter. */
function quoted(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * The search and account conditions as one PostgREST logic tree for `.or()`, or null when neither is set.
 * Search matches merchant, note, or the name of any category in `matchingCategoryIds`.
 */
export function logicFilter(filters: HistoryFilters, matchingCategoryIds: string[]) {
  const parts: string[] = [];
  const search = filters.search.trim();
  if (search) {
    const pattern = quoted(`*${search}*`);
    const alternatives = [`merchant.ilike.${pattern}`, `description.ilike.${pattern}`];
    if (matchingCategoryIds.length) alternatives.push(`category_id.in.(${matchingCategoryIds.join(',')})`);
    parts.push(`or(${alternatives.join(',')})`);
  }
  if (filters.accountId) parts.push(`or(from_account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId})`);
  return parts.length ? `and(${parts.join(',')})` : null;
}

/** How many filters beyond the type chips are active (for the "Filter (2)" badge). */
export function activeFilterCount(filters: HistoryFilters) {
  return Number(!!filters.categoryId) + Number(!!filters.accountId) + Number(filters.period !== 'ALL');
}
