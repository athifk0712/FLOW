-- Recurring transactions: monthly rules (rent, subscriptions, salary) that post real transactions when due.
-- Posting happens when the app calls post_due_recurring(), so missed months are caught up on the next open.

create table public.recurring_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type         public.transaction_type not null check (type in ('EXPENSE', 'INCOME')),
  amount       bigint not null check (amount > 0),
  account_id   uuid not null,
  category_id  uuid,
  name         varchar(100) not null,
  -- Expenses can be pre-judged (rent = NEED) so they skip the nightly review.
  necessity    public.necessity_level,
  day_of_month smallint not null check (day_of_month between 1 and 31),
  next_due     date not null default current_date, -- always set by trigger
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  foreign key (account_id, user_id)  references public.accounts (id, user_id) on delete cascade,
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  constraint recurring_necessity_expense_only check (type = 'EXPENSE' or necessity is null)
);
create index recurring_transactions_user_idx     on public.recurring_transactions (user_id);
create index recurring_transactions_account_idx  on public.recurring_transactions (account_id);
create index recurring_transactions_category_idx on public.recurring_transactions (category_id);

alter table public.recurring_transactions enable row level security;
create policy "own rows" on public.recurring_transactions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.transactions
  add column recurring_id uuid references public.recurring_transactions (id) on delete set null;
create index transactions_recurring_idx on public.transactions (recurring_id);

-- The date in month (y, m) for a rule's day, clamped to the month's last day (31 -> 30 Apr, 28/29 Feb).
create function public.recurring_due_date(p_year int, p_month int, p_day int)
returns date
language sql immutable
set search_path = ''
as $$
  select make_date(p_year, p_month, least(p_day,
    extract(day from (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))::int));
$$;

-- The user's local "today".
create function public.user_today(p_user_id uuid)
returns date
language sql stable
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select p.timezone from public.profiles p where p.id = p_user_id), 'Asia/Jakarta'))::date;
$$;

-- next_due is always derived: the first due date on or after today, recomputed when the day changes
-- or a paused rule is resumed (so resuming never back-posts the paused months).
create function public.recurring_set_next_due()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today date := public.user_today(new.user_id);
  candidate date;
begin
  -- Other updates keep whatever next_due they carry (post_due_recurring advances it this way).
  if tg_op = 'UPDATE'
     and new.day_of_month = old.day_of_month
     and not (new.active and not old.active) then
    return new;
  end if;
  candidate := public.recurring_due_date(extract(year from today)::int, extract(month from today)::int, new.day_of_month);
  if candidate < today then
    candidate := public.recurring_due_date(
      extract(year from today + interval '1 month')::int,
      extract(month from today + interval '1 month')::int,
      new.day_of_month);
  end if;
  new.next_due := candidate;
  return new;
end;
$$;

create trigger recurring_set_next_due
before insert or update on public.recurring_transactions
for each row execute function public.recurring_set_next_due();

-- Posts every due occurrence for the calling user (catching up missed months) and returns how many.
-- Runs as the caller, so RLS applies. Rows are locked so two concurrent calls cannot double-post.
create function public.post_due_recurring()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
  due date;
  tz text := coalesce((select p.timezone from public.profiles p where p.id = auth.uid()), 'Asia/Jakarta');
  today date := public.user_today(auth.uid());
  posted integer := 0;
begin
  for r in
    select * from public.recurring_transactions
    where user_id = auth.uid() and active and next_due <= today
    for update
  loop
    due := r.next_due;
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
      posted := posted + 1;
      due := public.recurring_due_date(
        extract(year from due + interval '1 month')::int,
        extract(month from due + interval '1 month')::int,
        r.day_of_month);
    end loop;
    -- day_of_month and active are unchanged, so the trigger keeps this value.
    update public.recurring_transactions set next_due = due where id = r.id;
  end loop;
  return posted;
end;
$$;
