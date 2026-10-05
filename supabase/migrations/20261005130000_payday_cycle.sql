-- Custom payday cycle: a "month" can start on any day 1–28 (e.g. payday on the 25th).
-- Monthly budgets, the monthly spending mix and money held back follow the cycle. With the default (1)
-- every result is identical to calendar months, and the `month` column keeps meaning "first day of the period".

alter table public.profiles
  add column cycle_start_day smallint not null default 1 check (cycle_start_day between 1 and 28);

-- First day of the cycle that contains a local date/time.
create function public.cycle_start(p_local timestamp, p_day int)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(day from p_local) >= p_day
      then make_date(extract(year from p_local)::int, extract(month from p_local)::int, p_day)
    else (make_date(extract(year from p_local)::int, extract(month from p_local)::int, p_day) - interval '1 month')::date
  end;
$$;

create or replace view public.v_budget_remaining with (security_invoker = true) as
with active as (
  select
    b.*,
    p.timezone,
    case b.period
      when 'WEEKLY'  then date_trunc('week', now() at time zone p.timezone)
      else                public.cycle_start(now() at time zone p.timezone, p.cycle_start_day)::timestamp
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

create or replace view public.v_spending_mix_monthly with (security_invoker = true) as
select
  t.user_id,
  public.cycle_start(t.occurred_at at time zone p.timezone, p.cycle_start_day) as month,
  coalesce(t.necessity::text, 'UNREVIEWED') as necessity,
  sum(t.amount) as total,
  count(*)      as tx_count
from public.transactions t
join public.profiles p on p.id = t.user_id
where t.type = 'EXPENSE'
group by t.user_id, 2, 3;

create or replace view public.v_saved_money_monthly with (security_invoker = true) as
select
  bi.user_id,
  public.cycle_start(bi.decided_at at time zone p.timezone, p.cycle_start_day) as month,
  sum(bi.estimated_cost) as total_held_back,
  count(*)               as items_held_back
from public.buy_intents bi
join public.profiles p on p.id = bi.user_id
where bi.status = 'CANCELLED'
group by bi.user_id, 2;
