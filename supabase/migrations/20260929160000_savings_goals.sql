-- Savings goals: a target amount (optionally by a month) and the money set aside for it.
-- Contributions are earmarks, not transfers: they do not change account balances.

create table public.savings_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          varchar(100) not null,
  target_amount bigint not null check (target_amount > 0),
  deadline      date, -- last day of the target month
  created_at    timestamptz not null default now(),
  unique (id, user_id)
);
create index savings_goals_user_idx on public.savings_goals (user_id);

create table public.goal_contributions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id    uuid not null,
  amount     bigint not null check (amount <> 0), -- negative = taken back out
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.savings_goals (id, user_id) on delete cascade
);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id);
create index goal_contributions_user_idx on public.goal_contributions (user_id);

alter table public.savings_goals      enable row level security;
alter table public.goal_contributions enable row level security;
create policy "own rows" on public.savings_goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.goal_contributions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create view public.v_goal_progress with (security_invoker = true) as
select
  g.id,
  g.user_id,
  g.name,
  g.target_amount,
  g.deadline,
  g.created_at,
  coalesce(sum(c.amount), 0)::bigint as saved
from public.savings_goals g
left join public.goal_contributions c on c.goal_id = g.id
group by g.id;
