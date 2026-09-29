-- Debts and receivables: who owes whom, with partial payments. A tracker only: account balances do not change.

create type public.debt_direction as enum ('OWED_TO_ME', 'I_OWE');

create table public.debts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  direction  public.debt_direction not null,
  person     varchar(100) not null,
  amount     bigint not null check (amount > 0),
  note       text,
  due_date   date,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index debts_user_idx on public.debts (user_id);

create table public.debt_payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  debt_id    uuid not null,
  amount     bigint not null check (amount > 0),
  paid_at    timestamptz not null default now(),
  foreign key (debt_id, user_id) references public.debts (id, user_id) on delete cascade
);
create index debt_payments_debt_idx on public.debt_payments (debt_id, user_id);
create index debt_payments_user_idx on public.debt_payments (user_id);

alter table public.debts         enable row level security;
alter table public.debt_payments enable row level security;
create policy "own rows" on public.debts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.debt_payments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Paid and remaining per debt; settled once nothing is left.
create view public.v_debts with (security_invoker = true) as
select
  d.id,
  d.user_id,
  d.direction,
  d.person,
  d.amount,
  d.note,
  d.due_date,
  d.created_at,
  coalesce(sum(p.amount), 0)::bigint                     as paid,
  greatest(d.amount - coalesce(sum(p.amount), 0), 0)::bigint as remaining,
  coalesce(sum(p.amount), 0) >= d.amount                 as settled,
  max(p.paid_at)                                         as last_paid_at
from public.debts d
left join public.debt_payments p on p.debt_id = d.id
group by d.id;
