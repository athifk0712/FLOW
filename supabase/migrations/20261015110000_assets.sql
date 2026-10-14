-- Asset management, part 2: assets (game accounts, gold, stocks, crypto, collectibles, business assets, ...),
-- their history, and the database functions that buy, value and sell them.
--
-- Money model (the wallet balance stays the only cash figure, computed from transactions):
--   buy       wallet -(price + fee)   one ASSET_BUY cash row; cost basis += price + fee (fee is an acquisition cost)
--   valuation wallet unchanged        a VALUATION event only; no cash row, no income
--   sell      wallet +(gross - fee - tax)  one ASSET_SELL cash row; cost basis -= the cost of the units sold
--   realized P/L of a sale = net proceeds - cost of the units sold
-- Cost of units sold uses the weighted average cost of what is held at that moment (all of it when everything goes).
-- Quantity, cost basis, value and P/L are derived from asset_events (v_assets), never stored twice.
-- Buy and sell are atomic and idempotent (request_id). Purely additive: no existing data is changed.

-- ========================================================
-- 1. TABLES
-- ========================================================
create table public.assets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        varchar(80) not null check (length(btrim(name)) > 0),
  category    text not null default 'OTHER'
              check (category in ('GAME', 'GOLD', 'STOCK', 'CRYPTO', 'COLLECTIBLE', 'BUSINESS', 'OTHER')),
  unit        varchar(20),          -- "gram", "lembar", "BTC"; null for single items such as a game account
  divisible   boolean not null default false, -- false: one item, bought and sold as a whole
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index assets_user_idx on public.assets (user_id);

create table public.asset_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset_id       uuid not null,
  kind           text not null check (kind in ('BUY', 'SELL', 'VALUATION')),
  occurred_at    timestamptz not null default now(),
  quantity       numeric(24, 8) check (quantity > 0),        -- BUY / SELL
  amount         bigint check (amount >= 0),                  -- BUY: price paid (without fee); SELL: gross proceeds
  fee            bigint not null default 0 check (fee >= 0),  -- BUY: acquisition cost; SELL: selling cost
  tax            bigint not null default 0 check (tax >= 0),  -- SELL only
  cost_allocated bigint check (cost_allocated >= 0),          -- SELL: cost basis of the units sold
  unit_value     numeric(24, 4) check (unit_value >= 0),      -- price per unit seen at this event
  transaction_id uuid,                                        -- the cash row (none for a valuation or a zero sale)
  request_id     uuid,
  note           varchar(200),
  created_at     timestamptz not null default now(),
  foreign key (asset_id, user_id) references public.assets (id, user_id) on delete cascade,
  -- A cash row that belongs to an asset is removed through the asset, never on its own.
  foreign key (transaction_id, user_id) references public.transactions (id, user_id) on delete restrict,
  constraint asset_events_shape check (
    (kind = 'BUY' and quantity is not null and amount is not null and cost_allocated is null and tax = 0
                  and unit_value is not null) or
    (kind = 'SELL' and quantity is not null and amount is not null and cost_allocated is not null
                   and unit_value is not null) or
    (kind = 'VALUATION' and quantity is null and amount is null and cost_allocated is null and fee = 0 and tax = 0
                        and unit_value is not null and transaction_id is null)
  )
);
create index asset_events_asset_idx on public.asset_events (asset_id, occurred_at);
create index asset_events_user_idx on public.asset_events (user_id, kind, occurred_at);
create unique index asset_events_transaction_idx on public.asset_events (transaction_id) where transaction_id is not null;
create unique index asset_events_request_idx on public.asset_events (user_id, request_id) where request_id is not null;

create trigger assets_updated_at before update on public.assets
for each row execute function public.set_updated_at();

-- ========================================================
-- 2. RLS: read your own; history is written only by the functions below
-- ========================================================
alter table public.assets       enable row level security;
alter table public.asset_events enable row level security;

create policy "own rows read" on public.assets for select to authenticated using (user_id = (select auth.uid()));
-- Renaming / describing is fine; quantities and money live in the events.
create policy "own rows update" on public.assets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows read" on public.asset_events for select to authenticated using (user_id = (select auth.uid()));

-- ========================================================
-- 3. CASH ROWS: new shapes, and only the asset functions may write them
-- ========================================================
alter table public.transactions drop constraint transactions_shape;
alter table public.transactions add constraint transactions_shape check (
  (type = 'EXPENSE'  and from_account_id is not null and to_account_id is null) or
  (type = 'INCOME'   and from_account_id is null and to_account_id is not null
                     and necessity is null) or
  (type = 'TRANSFER' and from_account_id is not null and to_account_id is not null
                     and from_account_id <> to_account_id
                     and category_id is null and necessity is null) or
  (type = 'ASSET_BUY'  and from_account_id is not null and to_account_id is null
                       and category_id is null and necessity is null) or
  (type = 'ASSET_SELL' and from_account_id is null and to_account_id is not null
                       and category_id is null and necessity is null)
);

-- The asset functions run as their owner; a signed-in user writing directly is "authenticated".
create function public.asset_cash_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' and new.type in ('ASSET_BUY', 'ASSET_SELL') then
    raise exception 'Beli/jual aset dicatat dari halaman Aset.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and (old.type in ('ASSET_BUY', 'ASSET_SELL') or new.type in ('ASSET_BUY', 'ASSET_SELL'))
     and (new.type is distinct from old.type or new.amount is distinct from old.amount
          or new.from_account_id is distinct from old.from_account_id
          or new.to_account_id is distinct from old.to_account_id) then
    raise exception 'Nominal dan akun transaksi aset diatur dari halaman Aset.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger transactions_asset_guard
before insert or update on public.transactions
for each row execute function public.asset_cash_guard();

-- ========================================================
-- 4. VIEW: holdings, cost basis, latest value and P/L per asset
-- ========================================================
create view public.v_assets with (security_invoker = true) as
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
  case when coalesce(h.quantity, 0) > 0
       then round(coalesce(v.unit_value, 0) * h.quantity)::bigint - coalesce(h.cost_basis, 0)::bigint
       else 0 end                                         as unrealized_pl,
  coalesce(r.realized, 0)::bigint                         as realized_pl,
  coalesce(r.proceeds, 0)::bigint                         as net_proceeds,
  case when coalesce(h.quantity, 0) > 0 then 'ACTIVE' else 'SOLD' end as status
from public.assets a
left join lateral (
  select
    sum(case e.kind when 'BUY' then e.quantity when 'SELL' then -e.quantity end)              as quantity,
    sum(case e.kind when 'BUY' then e.amount + e.fee when 'SELL' then -e.cost_allocated end)  as cost_basis,
    sum(e.amount + e.fee) filter (where e.kind = 'BUY')                                        as invested,
    min(e.occurred_at) filter (where e.kind = 'BUY')                                           as first_bought_at
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
    sum(e.amount - e.fee - e.tax - e.cost_allocated) as realized,
    sum(e.amount - e.fee - e.tax)                    as proceeds
  from public.asset_events e
  where e.asset_id = a.id and e.kind = 'SELL'
) r on true;

-- ========================================================
-- 5. FUNCTIONS
-- ========================================================

-- Holding of one asset right now (caller must hold the asset row lock).
create function public.asset_holding(p_asset_id uuid, out quantity numeric, out cost_basis bigint)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(case e.kind when 'BUY' then e.quantity when 'SELL' then -e.quantity end), 0),
    coalesce(sum(case e.kind when 'BUY' then e.amount + e.fee when 'SELL' then -e.cost_allocated end), 0)::bigint
  from public.asset_events e
  where e.asset_id = p_asset_id;
$$;
revoke all on function public.asset_holding(uuid) from public, anon, authenticated;

-- Buys an asset. With p_asset_id null a new asset is created (name, category, unit, divisible); otherwise more units
-- of an existing divisible asset are added. The wallet pays price + fee in one ASSET_BUY row. Returns the asset id.
create function public.buy_asset(
  p_asset_id   uuid,
  p_name       text,
  p_category   text,
  p_unit       text,
  p_divisible  boolean,
  p_quantity   numeric,
  p_price      bigint,
  p_fee        bigint,
  p_account_id uuid,
  p_occurred_at timestamptz default null,
  p_note       text default null,
  p_description text default null,
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
  v_tx uuid;
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_existing uuid;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_request_id is not null then
    select e.asset_id into v_existing from public.asset_events e where e.user_id = uid and e.request_id = p_request_id;
    if v_existing is not null then
      return v_existing; -- a retry of a purchase that was already saved
    end if;
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Jumlah harus lebih dari 0.' using errcode = '22023';
  end if;
  if p_price is null or p_price <= 0 then
    raise exception 'Harga beli harus lebih dari 0.' using errcode = '22023';
  end if;
  if coalesce(p_fee, 0) < 0 then
    raise exception 'Biaya tidak boleh negatif.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.accounts a where a.id = p_account_id and a.user_id = uid and a.archived_at is null) then
    raise exception 'Dompet tidak ditemukan atau sudah diarsipkan.' using errcode = '22023';
  end if;

  if p_asset_id is null then
    if p_name is null or length(btrim(p_name)) = 0 then
      raise exception 'Nama aset wajib diisi.' using errcode = '22023';
    end if;
    if not coalesce(p_divisible, false) and p_quantity <> 1 then
      raise exception 'Barang satuan (mis. akun game) dibeli 1 buah.' using errcode = '22023';
    end if;
    insert into public.assets (user_id, name, category, unit, divisible, description)
    values (uid, btrim(p_name), coalesce(p_category, 'OTHER'), nullif(btrim(p_unit), ''), coalesce(p_divisible, false),
            nullif(btrim(p_description), ''))
    returning * into v_asset;
  else
    select * into v_asset from public.assets a where a.id = p_asset_id and a.user_id = uid for update;
    if not found then
      raise exception 'Aset tidak ditemukan.' using errcode = '22023';
    end if;
    if not v_asset.divisible then
      raise exception 'Barang satuan tidak bisa ditambah. Catat sebagai aset baru.' using errcode = '22023';
    end if;
  end if;

  insert into public.transactions (user_id, type, amount, from_account_id, merchant, description, occurred_at)
  values (uid, 'ASSET_BUY', p_price + coalesce(p_fee, 0), p_account_id, left('Beli aset: ' || v_asset.name, 100),
          nullif(btrim(p_note), ''), v_at)
  returning id into v_tx;

  begin
    insert into public.asset_events (user_id, asset_id, kind, occurred_at, quantity, amount, fee, unit_value,
                                     transaction_id, request_id, note)
    values (uid, v_asset.id, 'BUY', v_at, p_quantity, p_price, coalesce(p_fee, 0), p_price / p_quantity,
            v_tx, p_request_id, left(nullif(btrim(p_note), ''), 200));
  exception when unique_violation then
    -- The same request arrived twice at once: undo this copy and return the saved one.
    raise exception 'Permintaan ini sudah diproses.' using errcode = '40001';
  end;
  return v_asset.id;
end;
$$;

-- Records an estimate of what one unit is worth now. No money moves.
create function public.value_asset(p_asset_id uuid, p_unit_value numeric, p_note text default null, p_request_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_unit_value is null or p_unit_value < 0 then
    raise exception 'Nilai tidak valid.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.assets a where a.id = p_asset_id and a.user_id = uid) then
    raise exception 'Aset tidak ditemukan.' using errcode = '22023';
  end if;
  if p_request_id is not null then
    select e.id into v_id from public.asset_events e where e.user_id = uid and e.request_id = p_request_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;
  insert into public.asset_events (user_id, asset_id, kind, unit_value, request_id, note)
  values (uid, p_asset_id, 'VALUATION', p_unit_value, p_request_id, left(nullif(btrim(p_note), ''), 200))
  returning id into v_id;
  return v_id;
end;
$$;

-- Sells part or all of an asset. Net proceeds (gross - fee - tax) go into the wallet; a sale at a loss is allowed.
create function public.sell_asset(
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
                                     unit_value, transaction_id, request_id, note)
    values (uid, v_asset.id, 'SELL', v_at, p_quantity, p_gross, coalesce(p_fee, 0), coalesce(p_tax, 0), v_alloc,
            p_gross / p_quantity, v_tx, p_request_id, left(nullif(btrim(p_note), ''), 200))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Permintaan ini sudah diproses.' using errcode = '40001';
  end;
  return v_id;
end;
$$;

-- Deletes an asset with its whole history, including its cash rows (so the wallets go back to how they were).
create function public.delete_asset(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_tx uuid[];
begin
  if not exists (select 1 from public.assets a where a.id = p_asset_id and a.user_id = uid) then
    raise exception 'Aset tidak ditemukan.' using errcode = '22023';
  end if;
  select array_agg(e.transaction_id) into v_tx
  from public.asset_events e where e.asset_id = p_asset_id and e.transaction_id is not null;
  delete from public.assets a where a.id = p_asset_id and a.user_id = uid; -- events cascade
  if v_tx is not null then
    delete from public.transactions t where t.id = any (v_tx) and t.user_id = uid;
  end if;
end;
$$;

-- Removes only the most recent event of an asset (an "undo"), with its cash row.
create function public.undo_asset_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_event public.asset_events;
  v_latest uuid;
  v_buys int;
begin
  select * into v_event from public.asset_events e where e.id = p_event_id and e.user_id = uid;
  if not found then
    raise exception 'Riwayat tidak ditemukan.' using errcode = '22023';
  end if;
  perform 1 from public.assets a where a.id = v_event.asset_id for update;
  select e.id into v_latest from public.asset_events e
  where e.asset_id = v_event.asset_id order by e.occurred_at desc, e.created_at desc limit 1;
  if v_latest <> p_event_id then
    raise exception 'Hanya riwayat terakhir yang bisa dibatalkan.' using errcode = '22023';
  end if;
  select count(*) into v_buys from public.asset_events e where e.asset_id = v_event.asset_id and e.kind = 'BUY';
  if v_event.kind = 'BUY' and v_buys = 1 then
    raise exception 'Ini pembelian pertama; hapus asetnya saja.' using errcode = '22023';
  end if;
  delete from public.asset_events e where e.id = p_event_id;
  if v_event.transaction_id is not null then
    delete from public.transactions t where t.id = v_event.transaction_id and t.user_id = uid;
  end if;
end;
$$;

revoke all on function public.buy_asset(uuid, text, text, text, boolean, numeric, bigint, bigint, uuid, timestamptz, text, text, uuid) from public, anon;
revoke all on function public.value_asset(uuid, numeric, text, uuid) from public, anon;
revoke all on function public.sell_asset(uuid, numeric, bigint, bigint, bigint, uuid, timestamptz, text, uuid) from public, anon;
revoke all on function public.delete_asset(uuid) from public, anon;
revoke all on function public.undo_asset_event(uuid) from public, anon;
grant execute on function public.buy_asset(uuid, text, text, text, boolean, numeric, bigint, bigint, uuid, timestamptz, text, text, uuid) to authenticated;
grant execute on function public.value_asset(uuid, numeric, text, uuid) to authenticated;
grant execute on function public.sell_asset(uuid, numeric, bigint, bigint, bigint, uuid, timestamptz, text, uuid) to authenticated;
grant execute on function public.delete_asset(uuid) to authenticated;
grant execute on function public.undo_asset_event(uuid) to authenticated;

-- Account deletion: asset events reference their cash rows (on delete restrict), so assets go first.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  delete from public.assets where user_id = uid;
  delete from public.transactions where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;
