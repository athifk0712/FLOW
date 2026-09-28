-- Cover the ownership-checked composite FKs (col, user_id) instead of the single column.
drop index public.transactions_from_account_idx;
drop index public.transactions_to_account_idx;
drop index public.transactions_category_idx;
drop index public.transactions_receipt_idx;
drop index public.budgets_category_idx;
drop index public.buy_intents_category_idx;

create index transactions_from_account_idx on public.transactions (from_account_id, user_id);
create index transactions_to_account_idx   on public.transactions (to_account_id, user_id);
create index transactions_category_idx     on public.transactions (category_id, user_id);
create index transactions_receipt_idx      on public.transactions (receipt_id, user_id);
create index budgets_category_idx          on public.budgets (category_id, user_id);
create index buy_intents_category_idx      on public.buy_intents (category_id, user_id);
