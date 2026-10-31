import { buildPlan, type PlanRow, saveAction } from '@/lib/budget-plan';
import { supabase } from '@/lib/supabase';

export async function loadBudgetPlan() {
  const [cats, buds] = await Promise.all([
    supabase.from('categories').select('id, name').eq('kind', 'EXPENSE').order('created_at'),
    supabase.from('budgets').select('id, scope, category_id, period, limit_amount').is('active_to', null),
  ]);
  const failed = cats.error ?? buds.error;
  if (failed) throw new Error(failed.message);
  return buildPlan(cats.data ?? [], buds.data ?? []);
}

export async function saveBudgetRow(r: PlanRow) {
  const amount = Number(r.digits || '0');
  const action = saveAction(r);
  if (action === 'none') return;
  const { error } =
    action === 'update'
      ? await supabase.from('budgets').update({ limit_amount: amount, period: r.period }).eq('id', r.budgetId!)
      : action === 'insert'
        ? await supabase
            .from('budgets')
            .insert({ scope: r.scope, category_id: r.categoryId, period: r.period, limit_amount: amount })
        : await supabase.from('budgets').delete().eq('id', r.budgetId!);
  if (error) throw new Error(`${r.name}: ${error.message}`);
}
