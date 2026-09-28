-- FLOW: initial schema
-- Money is stored as BIGINT rupiah (no decimals).
-- Balances and budget remainders are always computed by views, never stored.

-- ========================================================
-- 1. ENUMS
-- ========================================================
create type public.transaction_type as enum ('INCOME', 'EXPENSE', 'TRANSFER');
create type public.necessity_level  as enum ('NEED', 'IMPORTANT', 'WANT', 'IMPULSE');
create type public.account_type     as enum ('BANK', 'EWALLET', 'CASH');
create type public.category_kind    as enum ('EXPENSE', 'INCOME');
-- Stored intent status only records the user's decision.
-- COOLING / READY / EXPIRED are derived from time in v_buy_intents.
create type public.intent_status    as enum ('PENDING', 'PURCHASED', 'CANCELLED');
create type public.budget_scope     as enum ('CATEGORY', 'ESSENTIAL', 'DISCRETIONARY');
create type public.budget_period    as enum ('WEEKLY', 'MONTHLY');

-- ========================================================
-- 2. TABLES
-- ========================================================

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  timezone   text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now()
);

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       varchar(50) not null,
  icon       varchar(30),
  kind       public.category_kind not null default 'EXPENSE',
  created_at timestamptz not null default now(),
  unique (user_id, kind, name),
  unique (id, user_id) -- target for ownership-checked composite FKs
);

create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            varchar(50) not null,
  type            public.account_type not null default 'BANK',
  opening_balance bigint not null default 0,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (id, user_id)
);
create index accounts_user_id_idx on public.accounts (user_id);

create table public.receipts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null,
  ocr_json     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (id, user_id)
);
create index receipts_user_id_idx on public.receipts (user_id);

create table public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type            public.transaction_type not null,
  amount          bigint not null check (amount > 0),
  from_account_id uuid,
  to_account_id   uuid,
  category_id     uuid,
  receipt_id      uuid,
  merchant        varchar(100),
  description     text,

  -- Tagged at nightly review. NULL = not yet judged (no default, to avoid self-deception).
  necessity          public.necessity_level,
  -- Asked at weekly review, days after the purchase: "would you buy this again?"
  regret             boolean,
  regret_reviewed_at timestamptz,
  needs_review       boolean generated always as (type = 'EXPENSE' and necessity is null) stored,

  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Composite FKs: referenced rows must belong to the same user (FK checks bypass RLS).
  foreign key (from_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (to_account_id, user_id)   references public.accounts (id, user_id) on delete restrict,
  foreign key (category_id, user_id)     references public.categories (id, user_id) on delete set null (category_id),
  foreign key (receipt_id, user_id)      references public.receipts (id, user_id) on delete set null (receipt_id),

  constraint transactions_shape check (
    (type = 'EXPENSE'  and from_account_id is not null and to_account_id is null) or
    (type = 'INCOME'   and from_account_id is null and to_account_id is not null
                       and necessity is null) or
    (type = 'TRANSFER' and from_account_id is not null and to_account_id is not null
                       and from_account_id <> to_account_id
                       and category_id is null and necessity is null)
  ),
  constraint transactions_regret_expense_only check (
    (regret is null and regret_reviewed_at is null) or type = 'EXPENSE'
  )
);
create index transactions_user_occurred_idx on public.transactions (user_id, occurred_at desc);
create index transactions_from_account_idx  on public.transactions (from_account_id);
create index transactions_to_account_idx    on public.transactions (to_account_id);
create index transactions_category_idx      on public.transactions (category_id);
create index transactions_receipt_idx       on public.transactions (receipt_id);
create index transactions_needs_review_idx  on public.transactions (user_id) where needs_review;

create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope        public.budget_scope not null,
  category_id  uuid,
  period       public.budget_period not null default 'WEEKLY',
  limit_amount bigint not null check (limit_amount > 0),
  active_from  date not null default current_date,
  active_to    date,
  created_at   timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade,
  constraint budgets_scope_category check ((scope = 'CATEGORY') = (category_id is not null)),
  constraint budgets_active_range check (active_to is null or active_to >= active_from)
);
create index budgets_user_id_idx  on public.budgets (user_id);
create index budgets_category_idx on public.budgets (category_id);

create table public.buy_intents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_name      varchar(100) not null,
  estimated_cost bigint not null check (estimated_cost > 0),
  necessity      public.necessity_level not null,
  category_id    uuid,
  status         public.intent_status not null default 'PENDING',
  cooldown_until timestamptz not null default now(), -- set by trigger, cannot be edited
  decided_at     timestamptz,
  transaction_id uuid,
  created_at     timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  -- transactions has no (id, user_id) unique; ownership of transaction_id is checked in trigger.
  foreign key (transaction_id) references public.transactions (id) on delete set null,
  constraint buy_intents_decision check (
    (status = 'PENDING') = (decided_at is null)
    and (transaction_id is null or status = 'PURCHASED')
  )
);
create index buy_intents_user_created_idx on public.buy_intents (user_id, created_at desc);
create index buy_intents_category_idx     on public.buy_intents (category_id);
create index buy_intents_transaction_idx  on public.buy_intents (transaction_id);

-- ========================================================
-- 3. ROW LEVEL SECURITY
-- ========================================================
alter table public.profiles     enable row level security;
alter table public.categories   enable row level security;
alter table public.accounts     enable row level security;
alter table public.receipts     enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets      enable row level security;
alter table public.buy_intents  enable row level security;

create policy "own profile read"   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own rows" on public.categories   for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.accounts     for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.receipts     for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.transactions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.budgets      for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.buy_intents  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ========================================================
-- 4. VIEWS (security_invoker so RLS of the caller applies)
-- ========================================================

create view public.v_account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.type,
  a.archived_at,
  a.opening_balance + coalesce(i.total, 0) - coalesce(o.total, 0) as current_balance
from public.accounts a
left join (
  select to_account_id as account_id, sum(amount) as total
  from public.transactions where to_account_id is not null group by to_account_id
) i on i.account_id = a.id
left join (
  select from_account_id as account_id, sum(amount) as total
  from public.transactions where from_account_id is not null group by from_account_id
) o on o.account_id = a.id;

-- Budgets for the current period, in the user's local timezone.
create view public.v_budget_remaining with (security_invoker = true) as
with active as (
  select
    b.*,
    p.timezone,
    case b.period
      when 'WEEKLY'  then date_trunc('week',  now() at time zone p.timezone)
      else                date_trunc('month', now() at time zone p.timezone)
    end as local_start,
    case b.period when 'WEEKLY' then interval '1 week' else interval '1 month' end as span
  from public.budgets b
  join public.profiles p on p.id = b.user_id
  where b.active_from <= (now() at time zone p.timezone)::date
    and (b.active_to is null or b.active_to >= (now() at time zone p.timezone)::date)
)
select
  a.id as budget_id,
  a.user_id,
  a.scope,
  a.category_id,
  a.period,
  a.limit_amount,
  a.local_start at time zone a.timezone              as period_start,
  (a.local_start + a.span) at time zone a.timezone   as period_end,
  coalesce(s.spent, 0)                                as spent,
  a.limit_amount - coalesce(s.spent, 0)               as remaining,
  coalesce(s.unreviewed, 0)                           as unreviewed_amount
from active a
left join lateral (
  select
    sum(t.amount) filter (where
      (a.scope = 'CATEGORY'      and t.category_id = a.category_id) or
      (a.scope = 'ESSENTIAL'     and t.necessity in ('NEED', 'IMPORTANT')) or
      (a.scope = 'DISCRETIONARY' and t.necessity in ('WANT', 'IMPULSE'))
    ) as spent,
    sum(t.amount) filter (where a.scope <> 'CATEGORY' and t.necessity is null) as unreviewed
  from public.transactions t
  where t.user_id = a.user_id
    and t.type = 'EXPENSE'
    and t.occurred_at >= a.local_start at time zone a.timezone
    and t.occurred_at <  (a.local_start + a.span) at time zone a.timezone
) s on true;

-- Monthly essential vs discretionary mix. UNREVIEWED is shown as its own slice.
create view public.v_spending_mix_monthly with (security_invoker = true) as
select
  t.user_id,
  date_trunc('month', t.occurred_at at time zone p.timezone)::date as month,
  coalesce(t.necessity::text, 'UNREVIEWED') as necessity,
  sum(t.amount) as total,
  count(*)      as tx_count
from public.transactions t
join public.profiles p on p.id = t.user_id
where t.type = 'EXPENSE'
group by t.user_id, 2, 3;

-- Intents with a time-derived status for the UI.
create view public.v_buy_intents with (security_invoker = true) as
select
  bi.*,
  case
    when bi.status <> 'PENDING'                          then bi.status::text
    when now() < bi.cooldown_until                       then 'COOLING'
    when now() >= bi.cooldown_until + interval '14 days' then 'EXPIRED'
    else 'READY'
  end as effective_status
from public.buy_intents bi;

-- Celebration metric: only explicitly cancelled intents count as money held back.
create view public.v_saved_money_monthly with (security_invoker = true) as
select
  bi.user_id,
  date_trunc('month', bi.decided_at at time zone p.timezone)::date as month,
  sum(bi.estimated_cost) as total_held_back,
  count(*)               as items_held_back
from public.buy_intents bi
join public.profiles p on p.id = bi.user_id
where bi.status = 'CANCELLED'
group by bi.user_id, 2;

-- Weekly regret metric: share of reviewed expenses the user regrets, per necessity tag.
create view public.v_regret_by_necessity with (security_invoker = true) as
select
  user_id,
  necessity,
  count(*) filter (where regret)              as regretted,
  count(*) filter (where regret is not null)  as reviewed,
  sum(amount) filter (where regret)           as regretted_amount
from public.transactions
where type = 'EXPENSE' and necessity is not null
group by user_id, necessity;

-- ========================================================
-- 5. FUNCTIONS & TRIGGERS
-- ========================================================

-- Proportional cooldown, relative to what is left of this week's discretionary budget:
--   < 10%  -> none,  10-50% -> 24h,  > 50% (or over budget) -> 72h,  no budget -> 24h
create function public.intent_cooldown(p_user_id uuid, p_cost bigint)
returns interval
language sql stable
set search_path = ''
as $$
  select case
    when r.remaining is null           then interval '24 hours'
    when r.remaining <= 0              then interval '72 hours'
    when p_cost < r.remaining * 0.10   then interval '0'
    when p_cost <= r.remaining * 0.50  then interval '24 hours'
    else                                    interval '72 hours'
  end
  from (
    select min(v.remaining) as remaining
    from public.v_budget_remaining v
    where v.user_id = p_user_id and v.scope = 'DISCRETIONARY' and v.period = 'WEEKLY'
  ) r;
$$;

create function public.buy_intents_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'PENDING';
    new.decided_at := null;
    new.transaction_id := null;
    new.cooldown_until := now() + public.intent_cooldown(new.user_id, new.estimated_cost);
    return new;
  end if;

  -- UPDATE: the lock and the original price cannot be edited away.
  new.cooldown_until := old.cooldown_until;
  new.estimated_cost := old.estimated_cost;
  new.created_at     := old.created_at;

  if new.status is distinct from old.status then
    if old.status <> 'PENDING' then
      raise exception 'Intent sudah diputuskan (%)', old.status;
    end if;
    if new.status = 'PURCHASED' and now() < old.cooldown_until then
      raise exception 'Masih dalam cooldown sampai %', old.cooldown_until;
    end if;
    new.decided_at := now();
  end if;

  if new.transaction_id is not null and not exists (
    select 1 from public.transactions t
    where t.id = new.transaction_id and t.user_id = new.user_id and t.type = 'EXPENSE'
  ) then
    raise exception 'transaction_id harus transaksi EXPENSE milik user yang sama';
  end if;

  return new;
end;
$$;

create trigger buy_intents_guard
before insert or update on public.buy_intents
for each row execute function public.buy_intents_guard();

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

-- New user: profile + editable default categories.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);

  insert into public.categories (user_id, name, icon, kind)
  select new.id, c.name, c.icon, c.kind::public.category_kind
  from (values
    ('Makan',     'utensils',    'EXPENSE'),
    ('Kopi',      'coffee',      'EXPENSE'),
    ('Transport', 'car',         'EXPENSE'),
    ('Jajan',     'cookie',      'EXPENSE'),
    ('Belanja',   'shopping-bag','EXPENSE'),
    ('Tagihan',   'receipt',     'EXPENSE'),
    ('Kesehatan', 'heart-pulse', 'EXPENSE'),
    ('Hiburan',   'gamepad',     'EXPENSE'),
    ('Lainnya',   'dots',        'EXPENSE'),
    ('Gaji',      'wallet',      'INCOME'),
    ('Lainnya',   'dots',        'INCOME')
  ) as c(name, icon, kind);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
