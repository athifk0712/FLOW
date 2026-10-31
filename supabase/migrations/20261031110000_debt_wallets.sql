-- A debt can say which wallet the money came from or went to.
--   lend (OWED_TO_ME)    wallet -amount   DEBT_OUT   receivable +amount   net worth unchanged
--   borrow (I_OWE)       wallet +amount   DEBT_IN    debt +amount         net worth unchanged
--   repaid to me         wallet +amount   DEBT_IN
--   I repay              wallet -amount   DEBT_OUT
-- From now on debt money is never counted as income or spending. Existing rows are untouched: payments recorded before
-- this migration stay INCOME / EXPENSE, and existing debts simply have no wallet until the user picks one.

-- ========================================================
-- 1. COLUMNS & CONSTRAINTS
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
                       and category_id is null and necessity is null) or
  (type = 'DEBT_OUT' and from_account_id is not null and to_account_id is null
                     and category_id is null and necessity is null) or
  (type = 'DEBT_IN'  and from_account_id is null and to_account_id is not null
                     and category_id is null and necessity is null)
);

alter table public.debts
  add column opening_transaction_id uuid,
  add column request_id uuid,
  add constraint debts_opening_transaction_fkey
    foreign key (opening_transaction_id, user_id) references public.transactions (id, user_id)
    on delete set null (opening_transaction_id);

create unique index debts_opening_transaction_idx on public.debts (opening_transaction_id)
  where opening_transaction_id is not null;
create unique index debts_request_idx on public.debts (user_id, request_id) where request_id is not null;

-- ========================================================
-- 2. KEEPING THE DEBT AND ITS WALLET ROW TOGETHER
-- ========================================================

-- What the wallet row of a debt is called in Riwayat.
create function public.debt_opening_label(p_direction public.debt_direction, p_person text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(case when p_direction = 'OWED_TO_ME' then 'Pinjamkan ke: ' else 'Pinjam dari: ' end || p_person, 100);
$$;

-- Editing a debt's amount or name also corrects its wallet row.
create function public.debt_opening_follow()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.opening_transaction_id is not null then
    update public.transactions t
    set amount = new.amount, merchant = public.debt_opening_label(new.direction, new.person)
    where t.id = new.opening_transaction_id and t.user_id = new.user_id;
  end if;
  return null;
end;
$$;

create trigger debts_opening_follow
after update of amount, person on public.debts
for each row execute function public.debt_opening_follow();

-- Deleting a debt undoes the money it moved. Payments recorded before this migration (INCOME / EXPENSE) keep their
-- old behaviour and stay in the history.
create function public.debt_delete_payments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.transactions t
  using public.debt_payments p
  where p.debt_id = old.id and t.id = p.transaction_id and t.user_id = old.user_id
    and t.type in ('DEBT_IN', 'DEBT_OUT');
  return old;
end;
$$;

create trigger debts_delete_payments
before delete on public.debts
for each row execute function public.debt_delete_payments();

-- After the delete: the foreign key would otherwise update the row being deleted.
create function public.debt_delete_opening()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.opening_transaction_id is not null then
    delete from public.transactions t where t.id = old.opening_transaction_id and t.user_id = old.user_id;
  end if;
  return null;
end;
$$;

create trigger debts_delete_opening
after delete on public.debts
for each row execute function public.debt_delete_opening();

-- The amount of a settlement or a loan belongs to its debt. Depth 1 = someone editing the transaction itself; the
-- trigger above runs deeper and is allowed through.
create or replace function public.debt_payment_amount_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.amount is distinct from old.amount and pg_trigger_depth() <= 1
     and (exists (select 1 from public.debt_payments p where p.transaction_id = old.id)
          or exists (select 1 from public.debts d where d.opening_transaction_id = old.id)) then
    raise exception 'Nominal pelunasan diubah dari halaman Utang & Piutang (batalkan, lalu catat ulang).'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ========================================================
-- 3. FUNCTIONS
-- ========================================================

-- Writes a debt and, when a wallet is given, its wallet row: all or nothing. A repeated request id returns the first
-- debt. Without a wallet it only records who owes whom, e.g. for money that moved before the user started logging.
create function public.create_debt(
  p_direction public.debt_direction,
  p_person text,
  p_amount bigint,
  p_account_id uuid default null,
  p_note text default null,
  p_due_date date default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_person text := btrim(p_person);
  v_tx uuid;
  v_id uuid;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if v_person is null or v_person = '' then
    raise exception 'Isi namanya dulu.' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal harus lebih dari 0.' using errcode = '22023';
  end if;

  if p_request_id is not null then
    select d.id into v_id from public.debts d where d.user_id = uid and d.request_id = p_request_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  if p_account_id is not null then
    if not exists (select 1 from public.accounts a
                   where a.id = p_account_id and a.user_id = uid and a.archived_at is null) then
      raise exception 'Akun tidak ditemukan atau sudah diarsipkan.' using errcode = '22023';
    end if;
    if p_direction = 'OWED_TO_ME' then
      insert into public.transactions (user_id, type, amount, from_account_id, merchant)
      values (uid, 'DEBT_OUT', p_amount, p_account_id, public.debt_opening_label(p_direction, v_person))
      returning id into v_tx;
    else
      insert into public.transactions (user_id, type, amount, to_account_id, merchant)
      values (uid, 'DEBT_IN', p_amount, p_account_id, public.debt_opening_label(p_direction, v_person))
      returning id into v_tx;
    end if;
  end if;

  insert into public.debts (user_id, direction, person, amount, note, due_date, opening_transaction_id, request_id)
  values (uid, p_direction, v_person, p_amount, nullif(btrim(p_note), ''), p_due_date, v_tx, p_request_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Picks, changes or removes the wallet of an existing debt (null = saldo tidak berubah).
create function public.set_debt_wallet(p_debt_id uuid, p_account_id uuid default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_debt public.debts;
  v_tx uuid;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  select * into v_debt from public.debts d where d.id = p_debt_id and d.user_id = uid for update;
  if not found then
    raise exception 'Catatan utang tidak ditemukan.' using errcode = '22023';
  end if;

  if p_account_id is null then
    if v_debt.opening_transaction_id is not null then
      delete from public.transactions t where t.id = v_debt.opening_transaction_id and t.user_id = uid;
    end if;
    return;
  end if;

  if not exists (select 1 from public.accounts a
                 where a.id = p_account_id and a.user_id = uid and a.archived_at is null) then
    raise exception 'Akun tidak ditemukan atau sudah diarsipkan.' using errcode = '22023';
  end if;

  if v_debt.opening_transaction_id is not null then
    update public.transactions t
    set from_account_id = case when v_debt.direction = 'OWED_TO_ME' then p_account_id end,
        to_account_id   = case when v_debt.direction = 'I_OWE' then p_account_id end
    where t.id = v_debt.opening_transaction_id and t.user_id = uid;
    return;
  end if;

  -- The money moved when the debt was written down, not today.
  if v_debt.direction = 'OWED_TO_ME' then
    insert into public.transactions (user_id, type, amount, from_account_id, merchant, occurred_at)
    values (uid, 'DEBT_OUT', v_debt.amount, p_account_id,
            public.debt_opening_label(v_debt.direction, v_debt.person), v_debt.created_at)
    returning id into v_tx;
  else
    insert into public.transactions (user_id, type, amount, to_account_id, merchant, occurred_at)
    values (uid, 'DEBT_IN', v_debt.amount, p_account_id,
            public.debt_opening_label(v_debt.direction, v_debt.person), v_debt.created_at)
    returning id into v_tx;
  end if;
  update public.debts d set opening_transaction_id = v_tx where d.id = v_debt.id;
end;
$$;

-- As before, except that the wallet row is DEBT_IN / DEBT_OUT rather than income or spending.
create or replace function public.record_debt_payment(
  p_debt_id uuid,
  p_amount bigint,
  p_account_id uuid default null,
  p_paid_at timestamptz default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_debt public.debts;
  v_paid bigint;
  v_remaining bigint;
  v_tx uuid;
  v_payment uuid;
  v_at timestamptz := coalesce(p_paid_at, now());
  v_label text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal pembayaran harus lebih dari 0.' using errcode = '22023';
  end if;

  select * into v_debt from public.debts d where d.id = p_debt_id and d.user_id = uid for update;
  if not found then
    raise exception 'Catatan utang tidak ditemukan.' using errcode = '22023';
  end if;

  if p_request_id is not null then
    select p.id into v_payment from public.debt_payments p where p.user_id = uid and p.request_id = p_request_id;
    if v_payment is not null then
      return v_payment;
    end if;
  end if;

  select coalesce(sum(p.amount), 0) into v_paid from public.debt_payments p where p.debt_id = v_debt.id;
  v_remaining := v_debt.amount - v_paid;
  if v_remaining <= 0 then
    raise exception 'Catatan ini sudah lunas.' using errcode = '22023';
  end if;
  if p_amount > v_remaining then
    raise exception 'Melebihi sisa yang belum dibayar.' using errcode = '22023';
  end if;

  if p_account_id is not null then
    if not exists (select 1 from public.accounts a
                   where a.id = p_account_id and a.user_id = uid and a.archived_at is null) then
      raise exception 'Akun tidak ditemukan atau sudah diarsipkan.' using errcode = '22023';
    end if;
    v_label := case when p_amount = v_remaining then 'Pelunasan' else 'Cicilan' end
      || case when v_debt.direction = 'OWED_TO_ME' then ' Piutang: ' else ' Utang: ' end
      || v_debt.person;
    if v_debt.direction = 'OWED_TO_ME' then
      insert into public.transactions (user_id, type, amount, to_account_id, merchant, occurred_at)
      values (uid, 'DEBT_IN', p_amount, p_account_id, left(v_label, 100), v_at)
      returning id into v_tx;
    else
      insert into public.transactions (user_id, type, amount, from_account_id, merchant, occurred_at)
      values (uid, 'DEBT_OUT', p_amount, p_account_id, left(v_label, 100), v_at)
      returning id into v_tx;
    end if;
  end if;

  insert into public.debt_payments (user_id, debt_id, amount, paid_at, transaction_id, request_id)
  values (uid, v_debt.id, p_amount, v_at, v_tx, p_request_id)
  returning id into v_payment;
  return v_payment;
end;
$$;

revoke all on function public.debt_opening_label(public.debt_direction, text) from public, anon;
revoke all on function public.create_debt(public.debt_direction, text, bigint, uuid, text, date, uuid) from public, anon;
revoke all on function public.set_debt_wallet(uuid, uuid) from public, anon;
grant execute on function public.debt_opening_label(public.debt_direction, text) to authenticated;
grant execute on function public.create_debt(public.debt_direction, text, bigint, uuid, text, date, uuid) to authenticated;
grant execute on function public.set_debt_wallet(uuid, uuid) to authenticated;

-- ========================================================
-- 4. VIEW: which wallet a debt used (new columns go last, so older app versions keep working)
-- ========================================================
create or replace view public.v_debts with (security_invoker = true) as
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
  max(p.paid_at)                                         as last_paid_at,
  a.id                                                   as wallet_id,
  a.name                                                 as wallet_name
from public.debts d
left join public.debt_payments p on p.debt_id = d.id
left join public.transactions t on t.id = d.opening_transaction_id
left join public.accounts a on a.id = coalesce(t.from_account_id, t.to_account_id)
group by d.id, a.id;
