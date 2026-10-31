import type { Enums } from '@/lib/database.types';

// The rows of the one budget screen: the two weekly limits (Ingin, Butuh) and one optional limit per expense category.

export type BudgetScope = Enums<'budget_scope'>;
export type BudgetPeriod = Enums<'budget_period'>;

export type PlanRow = {
  key: string;
  name: string;
  scope: BudgetScope;
  categoryId: string | null;
  budgetId: string | null;
  digits: string;
  period: BudgetPeriod;
  // What is stored now, to skip unchanged rows on save.
  saved: { digits: string; period: BudgetPeriod };
};

export type StoredBudget = {
  id: string;
  scope: BudgetScope;
  category_id: string | null;
  period: BudgetPeriod;
  limit_amount: number;
};

const WEEKLY: { scope: BudgetScope; name: string }[] = [
  { scope: 'DISCRETIONARY', name: 'Ingin & Impulsif' },
  { scope: 'ESSENTIAL', name: 'Butuh & Penting' },
];

function row(base: Pick<PlanRow, 'key' | 'name' | 'scope' | 'categoryId'>, budget: StoredBudget | undefined, fallback: BudgetPeriod): PlanRow {
  const digits = budget ? String(budget.limit_amount) : '';
  const period = budget?.period ?? fallback;
  return { ...base, budgetId: budget?.id ?? null, digits, period, saved: { digits, period } };
}

export function buildPlan(categories: { id: string; name: string }[], budgets: StoredBudget[]) {
  const weekly = WEEKLY.map(({ scope, name }) =>
    row(
      { key: scope, name, scope, categoryId: null },
      budgets.find((b) => b.scope === scope && b.period === 'WEEKLY'),
      'WEEKLY',
    ),
  );
  const perCategory = categories.map((c) =>
    row(
      { key: c.id, name: c.name, scope: 'CATEGORY', categoryId: c.id },
      budgets.find((b) => b.scope === 'CATEGORY' && b.category_id === c.id),
      'MONTHLY',
    ),
  );
  return { weekly, perCategory };
}

export function changedRows(rows: PlanRow[]) {
  return rows.filter((r) => r.digits !== r.saved.digits || r.period !== r.saved.period);
}

/** What saving a changed row does: a limit is written, an emptied one removed, an empty new one ignored. */
export function saveAction(r: PlanRow): 'update' | 'insert' | 'delete' | 'none' {
  const amount = Number(r.digits || '0');
  if (amount > 0) return r.budgetId ? 'update' : 'insert';
  return r.budgetId ? 'delete' : 'none';
}
