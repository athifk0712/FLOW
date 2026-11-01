-- Protected pockets: money in a reserved pocket (Tabungan) still belongs to the account, so balances and net worth stay
-- the same, but it no longer counts as safe to spend.
--   safe = cash - bills - debts - goals - essentials - reserved pockets
-- Purely additive: every pocket starts unprotected, and existing pockets named exactly "Tabungan" are protected once
-- here. The user can turn it off. Older app versions don't know the column and keep working.

alter table public.pockets add column reserved boolean not null default false;

update public.pockets set reserved = true where lower(trim(name)) = 'tabungan';

-- New column last: create or replace can only append.
create or replace view public.v_pocket_balances with (security_invoker = true) as
select
  p.id,
  p.user_id,
  p.account_id,
  p.name,
  p.created_at,
  (coalesce((select sum(m.amount) from public.pocket_moves m where m.to_pocket_id = p.id), 0)
   - coalesce((select sum(m.amount) from public.pocket_moves m where m.from_pocket_id = p.id), 0)
   + coalesce((select sum(t.amount) from public.transactions t where t.pocket_id = p.id and t.type = 'INCOME'), 0)
   - coalesce((select sum(t.amount) from public.transactions t where t.pocket_id = p.id and t.type = 'EXPENSE'), 0)
  )::bigint as balance,
  p.reserved
from public.pockets p;

-- Mirrors computeSafeToSpend() in mobile/src/lib/safe-to-spend.ts. Runs as the caller, so RLS applies.
create or replace function public.safe_to_spend(p_user_id uuid)
returns table (safe bigint, daily_limit bigint, days_left int)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tz        text;
  v_day       int;
  v_now       timestamp;
  v_today     date;
  v_end       date;  -- exclusive
  v_cash      bigint;
  v_bills     bigint;
  v_debts     bigint;
  v_goals     bigint;
  v_pockets   bigint;
  v_essential numeric := 0;
  v_spent     bigint;
  v_limit     numeric;
  v_remaining numeric;
  v_week_days int;
  v_per_day   numeric;
begin
  select p.timezone, p.cycle_start_day into v_tz, v_day from public.profiles p where p.id = p_user_id;
  v_tz    := coalesce(v_tz, 'Asia/Jakarta');
  v_day   := coalesce(v_day, 1);
  v_now   := now() at time zone v_tz;
  v_today := v_now::date;
  v_end   := (public.cycle_start(v_now, v_day) + interval '1 month')::date;
  days_left := greatest(1, v_end - v_today);

  select coalesce(sum(b.current_balance), 0) into v_cash
  from public.v_account_balances b
  where b.user_id = p_user_id and b.archived_at is null;

  -- Active recurring expenses due before the cycle ends (next_due, and the month after if it still fits).
  select coalesce(sum(r.amount * (
           (r.next_due < v_end)::int +
           (public.recurring_due_date(
              extract(year  from r.next_due + interval '1 month')::int,
              extract(month from r.next_due + interval '1 month')::int,
              r.day_of_month) < v_end)::int)), 0)
    into v_bills
  from public.recurring_transactions r
  where r.user_id = p_user_id and r.active and r.type = 'EXPENSE';

  select coalesce(sum(greatest(d.remaining, 0)), 0) into v_debts
  from public.v_debts d
  where d.user_id = p_user_id and d.direction = 'I_OWE' and not d.settled
    and d.due_date is not null and d.due_date < v_end;

  select greatest(coalesce(sum(g.saved), 0), 0) into v_goals
  from public.v_goal_progress g
  where g.user_id = p_user_id;

  -- Reserved pockets of the accounts counted in v_cash. An overdrawn pocket reserves nothing: its minus must not
  -- cancel out what another pocket protects.
  select coalesce(sum(greatest(pb.balance, 0)), 0) into v_pockets
  from public.v_pocket_balances pb
  join public.accounts a on a.id = pb.account_id
  where pb.user_id = p_user_id and pb.reserved and a.archived_at is null;

  -- Essentials reserve from the weekly ESSENTIAL budget: this week's remainder, then the weekly rate.
  select v.limit_amount, v.remaining into v_limit, v_remaining
  from public.v_budget_remaining v
  where v.user_id = p_user_id and v.scope = 'ESSENTIAL' and v.period = 'WEEKLY'
  limit 1;
  if v_limit is not null then
    v_week_days := 7 - ((extract(isodow from v_today)::int + 6) % 7); -- Monday-based, including today
    v_essential := round((
        greatest(v_remaining, 0) * least(1, days_left::numeric / v_week_days)
        + (v_limit / 7) * greatest(0, days_left - v_week_days)
      ) / 1000) * 1000;
  end if;

  -- Spending out of a reserved pocket lowers cash and the reserve equally, so it never used today's allowance.
  select coalesce(sum(t.amount), 0) into v_spent
  from public.transactions t
  where t.user_id = p_user_id and t.type = 'EXPENSE'
    and t.occurred_at >= v_today::timestamp at time zone v_tz
    and not exists (select 1 from public.pockets p where p.id = t.pocket_id and p.reserved);

  safe := v_cash - v_bills - v_debts - v_goals - v_pockets - v_essential::bigint;
  v_per_day := greatest(0, (safe + v_spent)::numeric / days_left);
  daily_limit := case when v_per_day >= 1000 then floor(v_per_day / 1000) * 1000 else floor(v_per_day) end;
  return next;
end;
$$;
