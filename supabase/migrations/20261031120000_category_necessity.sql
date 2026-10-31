-- Budgets no longer wait for a review. Every expense category says what it usually is (Butuh or Ingin), and the
-- weekly budgets and the spending mix use that whenever an expense has not been judged by hand.
-- transactions.necessity stays NULL until the user judges it themselves: it keeps meaning "this is what I said", so
-- the weekly reflection and the regret insight stay honest and do not turn into a longer to-do list.
-- Additive: no transaction is changed.

alter table public.categories
  add column default_necessity public.necessity_level not null default 'WANT';

-- Everything is Ingin unless its name says otherwise. It can be changed per category.
create function public.category_need_by_name(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(p_name)) in (
    'makan', 'transport', 'tagihan', 'kesehatan', 'biaya admin / transfer', 'utang & piutang',
    'bensin', 'listrik', 'air', 'pulsa', 'internet', 'sewa', 'kos', 'kontrakan', 'cicilan',
    'pendidikan', 'sekolah', 'kuliah', 'obat', 'belanja bulanan', 'sembako', 'asuransi', 'pajak'
  );
$$;

update public.categories c
set default_necessity = 'NEED'
where c.kind = 'EXPENSE' and public.category_need_by_name(c.name);

-- New users get the same defaults.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);

  insert into public.categories (user_id, name, icon, kind, default_necessity)
  select new.id, c.name, c.icon, c.kind::public.category_kind,
         case when public.category_need_by_name(c.name) then 'NEED' else 'WANT' end::public.necessity_level
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

-- Same columns as before. unreviewed_amount stays for older app versions; nothing is left out any more, so it is 0.
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
  0::numeric                                          as unreviewed_amount
from active a
left join lateral (
  select
    sum(t.amount) filter (where
      (a.scope = 'CATEGORY'      and t.category_id = a.category_id) or
      (a.scope = 'ESSENTIAL'     and coalesce(t.necessity, c.default_necessity, 'WANT') in ('NEED', 'IMPORTANT')) or
      (a.scope = 'DISCRETIONARY' and coalesce(t.necessity, c.default_necessity, 'WANT') in ('WANT', 'IMPULSE'))
    ) as spent
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.user_id = a.user_id
    and t.type = 'EXPENSE'
    and t.occurred_at >= a.local_start at time zone a.timezone
    and t.occurred_at <  (a.local_start + a.span) at time zone a.timezone
) s on true;

create or replace view public.v_spending_mix_monthly with (security_invoker = true) as
select
  t.user_id,
  public.cycle_start(t.occurred_at at time zone p.timezone, p.cycle_start_day) as month,
  coalesce(t.necessity, c.default_necessity, 'WANT')::text as necessity,
  sum(t.amount) as total,
  count(*)      as tx_count
from public.transactions t
join public.profiles p on p.id = t.user_id
left join public.categories c on c.id = t.category_id
where t.type = 'EXPENSE'
group by t.user_id, 2, 3;
