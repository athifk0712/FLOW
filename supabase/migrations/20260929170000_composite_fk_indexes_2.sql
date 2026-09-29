-- Same as 20260928143000: cover the new ownership-checked composite FKs (col, user_id).
drop index public.recurring_transactions_account_idx;
drop index public.recurring_transactions_category_idx;
drop index public.goal_contributions_goal_idx;

create index recurring_transactions_account_idx  on public.recurring_transactions (account_id, user_id);
create index recurring_transactions_category_idx on public.recurring_transactions (category_id, user_id);
create index goal_contributions_goal_idx         on public.goal_contributions (goal_id, user_id);
