-- Assets the user already owned before recording them in Flowku ("Catat aset lama").
--
-- Unlike buy_asset, nothing is paid now: the wallet balance is already right, so there is no cash row, no spending,
-- no budget or Safe to Spend change. The asset simply becomes known:
--   opening BUY   no transaction; amount = the historical cost (0 when the user does not remember it)
--   VALUATION     the estimate of what it is worth today
-- When the cost is unknown the asset is marked cost_known = false: no unrealized P/L and no percentage is shown, and
-- a later sale records no realized P/L (it would otherwise look like pure profit). Purely additive: existing rows keep
-- opening = false and cost_known = true, which is what they already were.

-- ========================================================
-- 1. COLUMNS
-- ========================================================
alter table public.asset_events
  add column opening boolean not null default false,   -- BUY of an asset owned before it was recorded
  add column cost_known boolean not null default true; -- false: the cost of these units is not known

alter table public.asset_events add constraint asset_events_opening_shape check (
  (not opening or (kind = 'BUY' and transaction_id is null)) and
  (cost_known or kind = 'SELL' or (kind = 'BUY' and opening and amount = 0))
);

-- ========================================================
-- 2. VIEW: same columns as before (P/L left empty when the cost is unknown) plus cost_known and is_opening
-- ========================================================
create or replace view public.v_assets with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.category,
  a.unit,
  a.divisible,
  a.description,
  a.created_at,
  coalesce(h.quantity, 0)                                 as quantity,
  coalesce(h.cost_basis, 0)::bigint                       as cost_basis,
  coalesce(h.invested, 0)::bigint                         as invested,
  h.first_bought_at,
  v.unit_value,
  v.source                                                as value_source,
  v.valued_at,
  case when coalesce(h.quantity, 0) > 0 then round(coalesce(v.unit_value, 0) * h.quantity)::bigint else 0 end
                                                          as current_value,
  case when coalesce(h.quantity, 0) > 0 and coalesce(h.cost_known, true)
       then round(coalesce(v.unit_value, 0) * h.quantity)::bigint - coalesce(h.cost_basis, 0)::bigint
       when coalesce(h.quantity, 0) > 0 then null
       else 0 end                                         as unrealized_pl,
  coalesce(r.realized, 0)::bigint                         as realized_pl,
  coalesce(r.proceeds, 0)::bigint                         as net_proceeds,
  case when coalesce(h.quantity, 0) > 0 then 'ACTIVE' else 'SOLD' end as status,
  coalesce(h.cost_known, true)                            as cost_known,
  coalesce(h.is_opening, false)                           as is_opening
from public.assets a
left join lateral (
  select
    sum(case e.kind when 'BUY' then e.quantity when 'SELL' then -e.quantity end)              as quantity,
    sum(case e.kind when 'BUY' then e.amount + e.fee when 'SELL' then -e.cost_allocated end)  as cost_basis,
    sum(e.amount + e.fee) filter (where e.kind = 'BUY')                                        as invested,
    min(e.occurred_at) filter (where e.kind = 'BUY')                                           as first_bought_at,
    bool_and(e.cost_known) filter (where e.kind = 'BUY')                                       as cost_known,
    bool_or(e.opening)                                                                         as is_opening
  from public.asset_events e
  where e.asset_id = a.id
) h on true
left join lateral (
  select
    e.unit_value,
    case e.kind when 'VALUATION' then 'MANUAL' when 'SELL' then 'SALE' else 'PURCHASE' end as source,
    e.occurred_at as valued_at
  from public.asset_events e
  where e.asset_id = a.id
  order by e.occurred_at desc, e.created_at desc
  limit 1
) v on true
left join lateral (
  select
    sum(e.amount - e.fee - e.tax - e.cost_allocated) filter (where e.cost_known) as realized,
    sum(e.amount - e.fee - e.tax)                                                 as proceeds
  from public.asset_events e
  where e.asset_id = a.id and e.kind = 'SELL'
) r on true;

-- ========================================================
-- 3. FUNCTIONS
-- ========================================================

-- Records an asset the user already owns. p_cost null = cost not remembered. p_value = what all of it is worth now.
-- No wallet is touched. Idempotent on p_request_id; returns the asset id.
create function public.add_existing_asset(
  p_name        text,
  p_category    text,
  p_unit        text,
  p_divisible   boolean,
  p_quantity    numeric,
  p_cost        bigint,
  p_value       bigint,
  p_acquired_at timestamptz default null,
  p_note        text default null,
  p_description text default null,
  p_request_id  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_asset public.assets;
  v_existing uuid;
  v_at timestamptz := coalesce(p_acquired_at, now());
  v_known boolean := p_cost is not null;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_request_id is not null then
    select e.asset_id into v_existing from public.asset_events e where e.user_id = uid and e.request_id = p_request_id;
    if v_existing is not null then
      return v_existing; -- a retry of a record that was already saved
    end if;
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'Nama aset wajib diisi.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Jumlah harus lebih dari 0.' using errcode = '22023';
  end if;
  if not coalesce(p_divisible, false) and p_quantity <> 1 then
    raise exception 'Barang satuan (mis. akun game) dicatat 1 buah.' using errcode = '22023';
  end if;
  if v_known and p_cost <= 0 then
    raise exception 'Modal harus lebih dari 0, atau pilih "Tidak ingat modalnya".' using errcode = '22023';
  end if;
  if p_value is null or p_value < 0 then
    raise exception 'Isi perkiraan nilainya sekarang.' using errcode = '22023';
  end if;
  if v_at > now() + interval '1 day' then
    raise exception 'Tanggal mulai dimiliki tidak boleh di masa depan.' using errcode = '22023';
  end if;

  insert into public.assets (user_id, name, category, unit, divisible, description)
  values (uid, btrim(p_name), coalesce(p_category, 'OTHER'), nullif(btrim(p_unit), ''), coalesce(p_divisible, false),
          nullif(btrim(p_description), ''))
  returning * into v_asset;

  begin
    insert into public.asset_events (user_id, asset_id, kind, occurred_at, quantity, amount, fee, unit_value,
                                     request_id, note, opening, cost_known)
    values (uid, v_asset.id, 'BUY', v_at, p_quantity, coalesce(p_cost, 0), 0,
            case when v_known then p_cost / p_quantity else p_value / p_quantity end,
            p_request_id, left(nullif(btrim(p_note), ''), 200), true, v_known);
  exception when unique_violation then
    raise exception 'Permintaan ini sudah diproses.' using errcode = '40001';
  end;

  -- Today's estimate, just after the opening record so it is the latest value.
  insert into public.asset_events (user_id, asset_id, kind, occurred_at, unit_value, note)
  values (uid, v_asset.id, 'VALUATION', greatest(now(), v_at) + interval '1 millisecond', p_value / p_quantity,
          'Estimasi saat dicatat');
  return v_asset.id;
end;
$$;

-- Same as before, plus: a sale of an asset whose cost is unknown records cost_known = false (no realized P/L).
create or replace function public.sell_asset(
  p_asset_id   uuid,
  p_quantity   numeric,
  p_gross      bigint,
  p_fee        bigint,
  p_tax        bigint,
  p_account_id uuid,
  p_occurred_at timestamptz default null,
  p_note       text default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_asset public.assets;
  v_held numeric;
  v_cost bigint;
  v_alloc bigint;
  v_net bigint;
  v_tx uuid;
  v_id uuid;
  v_known boolean;
  v_at timestamptz := coalesce(p_occurred_at, now());
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  select * into v_asset from public.assets a where a.id = p_asset_id and a.user_id = uid for update;
  if not found then
    raise exception 'Aset tidak ditemukan.' using errcode = '22023';
  end if;
  if p_request_id is not null then
    select e.id into v_id from public.asset_events e where e.user_id = uid and e.request_id = p_request_id;
    if v_id is not null then
      return v_id; -- a retry of a sale that was already saved
    end if;
  end if;
  if p_gross is null or p_gross < 0 or coalesce(p_fee, 0) < 0 or coalesce(p_tax, 0) < 0 then
    raise exception 'Nominal penjualan tidak valid.' using errcode = '22023';
  end if;
  v_net := p_gross - coalesce(p_fee, 0) - coalesce(p_tax, 0);
  if v_net < 0 then
    raise exception 'Biaya dan pajak melebihi harga jual.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.accounts a where a.id = p_account_id and a.user_id = uid and a.archived_at is null) then
    raise exception 'Dompet tidak ditemukan atau sudah diarsipkan.' using errcode = '22023';
  end if;

  select h.quantity, h.cost_basis into v_held, v_cost from public.asset_holding(v_asset.id) h;
  if v_held <= 0 then
    raise exception 'Aset ini sudah terjual semua.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > v_held then
    raise exception 'Jumlah yang dijual melebihi yang kamu punya.' using errcode = '22023';
  end if;
  if not v_asset.divisible and p_quantity <> v_held then
    raise exception 'Barang satuan dijual utuh.' using errcode = '22023';
  end if;
  select coalesce(bool_and(e.cost_known), true) into v_known
  from public.asset_events e where e.asset_id = v_asset.id and e.kind = 'BUY';
  -- Weighted average cost; the last units take whatever cost is left, so nothing is lost to rounding.
  v_alloc := case when p_quantity = v_held then v_cost else round(v_cost * p_quantity / v_held)::bigint end;

  if v_net > 0 then
    insert into public.transactions (user_id, type, amount, to_account_id, merchant, description, occurred_at)
    values (uid, 'ASSET_SELL', v_net, p_account_id, left('Jual aset: ' || v_asset.name, 100),
            nullif(btrim(p_note), ''), v_at)
    returning id into v_tx;
  end if;

  begin
    insert into public.asset_events (user_id, asset_id, kind, occurred_at, quantity, amount, fee, tax, cost_allocated,
                                     unit_value, transaction_id, request_id, note, cost_known)
    values (uid, v_asset.id, 'SELL', v_at, p_quantity, p_gross, coalesce(p_fee, 0), coalesce(p_tax, 0), v_alloc,
            p_gross / p_quantity, v_tx, p_request_id, left(nullif(btrim(p_note), ''), 200), v_known)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Permintaan ini sudah diproses.' using errcode = '40001';
  end;
  return v_id;
end;
$$;

revoke all on function public.add_existing_asset(text, text, text, boolean, numeric, bigint, bigint, timestamptz, text, text, uuid) from public, anon;
grant execute on function public.add_existing_asset(text, text, text, boolean, numeric, bigint, bigint, timestamptz, text, text, uuid) to authenticated;
