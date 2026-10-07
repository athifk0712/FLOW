-- Monthly bank admin fees: an account can carry one recurring rule flagged is_admin_fee, set from the account form.
-- It posts like any other recurring rule; post_due_recurring_details() reports what was posted so the app can say
-- "Biaya admin bulanan BCA sebesar Rp15.000 telah dipotong otomatis".

alter table public.recurring_transactions
  add column is_admin_fee boolean not null default false;

create unique index recurring_one_admin_fee_per_account
  on public.recurring_transactions (account_id) where is_admin_fee;

-- Posts every due occurrence for the calling user (catching up missed months) and returns one row per rule that
-- posted, with how many times. Runs as the caller, so RLS applies. Rows are locked so two concurrent calls cannot
-- double-post.
create function public.post_due_recurring_details()
returns table (rule_id uuid, name text, amount bigint, account_name text, is_admin_fee boolean, posted integer)
language plpgsql
set search_path = ''
as $$
declare
  r record;
  due date;
  tz text := coalesce((select p.timezone from public.profiles p where p.id = auth.uid()), 'Asia/Jakarta');
  today date := public.user_today(auth.uid());
  n integer;
begin
  for r in
    select t.*, a.name as account_name
    from public.recurring_transactions t
    join public.accounts a on a.id = t.account_id and a.user_id = t.user_id
    where t.user_id = auth.uid() and t.active and t.next_due <= today
    for update of t
  loop
    due := r.next_due;
    n := 0;
    while due <= today loop
      insert into public.transactions
        (user_id, type, amount, from_account_id, to_account_id, category_id, necessity, merchant, occurred_at, recurring_id)
      values (
        r.user_id, r.type, r.amount,
        case when r.type = 'EXPENSE' then r.account_id end,
        case when r.type = 'INCOME' then r.account_id end,
        r.category_id, r.necessity, r.name,
        (due + time '09:00') at time zone tz,
        r.id);
      n := n + 1;
      due := public.recurring_due_date(
        extract(year from due + interval '1 month')::int,
        extract(month from due + interval '1 month')::int,
        r.day_of_month);
    end loop;
    -- day_of_month and active are unchanged, so the trigger keeps this value.
    update public.recurring_transactions set next_due = due where id = r.id;
    rule_id := r.id;
    name := r.name;
    amount := r.amount;
    account_name := r.account_name;
    is_admin_fee := r.is_admin_fee;
    posted := n;
    return next;
  end loop;
end;
$$;

-- Kept for apps that still call it (older builds): same posting, returns the count.
create or replace function public.post_due_recurring()
returns integer
language sql
set search_path = ''
as $$
  select coalesce(sum(d.posted), 0)::integer from public.post_due_recurring_details() d;
$$;
