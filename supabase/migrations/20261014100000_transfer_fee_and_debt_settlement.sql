-- Flowku v2: money that moves together is written together.
--   * Transfers can carry an optional admin fee: one TRANSFER row (the amount that arrives) plus one EXPENSE row for
--     the fee, linked by fee_for_id. Source pays amount + fee, destination receives amount; nothing is counted twice.
--   * Settling a debt can record the money movement in a wallet: the payment and its INCOME/EXPENSE transaction are
--     written in one database transaction (record_debt_payment). Deleting that transaction undoes the payment.
--   * Retried saves are idempotent: the app sends a client_request_id per form, and a repeat returns the first result.
-- Purely additive: existing rows are untouched (old debt payments simply have no transaction).

-- ========================================================
-- 1. COLUMNS & CONSTRAINTS
-- ========================================================

-- Target for ownership-checked composite FKs pointing at transactions (FK checks bypass RLS).
alter table public.transactions add constraint transactions_id_user_key unique (id, user_id);

alter table public.transactions
  add column client_request_id uuid,
  add column fee_for_id uuid,
  add constraint transactions_fee_for_fkey
    foreign key (fee_for_id, user_id) references public.transactions (id, user_id) on delete cascade,
  add constraint transactions_fee_is_expense check (fee_for_id is null or type = 'EXPENSE');

create unique index transactions_client_request_idx
  on public.transactions (user_id, client_request_id) where client_request_id is not null;
create index transactions_fee_for_idx on public.transactions (fee_for_id) where fee_for_id is not null;

alter table public.debt_payments
  add column transaction_id uuid,
  add column request_id uuid,
  add constraint debt_payments_transaction_fkey
    foreign key (transaction_id, user_id) references public.transactions (id, user_id) on delete cascade;

create unique index debt_payments_transaction_idx on public.debt_payments (transaction_id) where transaction_id is not null;
create unique index debt_payments_request_idx on public.debt_payments (user_id, request_id) where request_id is not null;

-- ========================================================
-- 2. HELPERS
-- ========================================================

-- The caller's category with this name and kind, created (with an icon) the first time it is needed.
create function public.ensure_category(p_name text, p_kind public.category_kind, p_icon text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select c.id into v_id from public.categories c
  where c.user_id = auth.uid() and c.kind = p_kind and lower(c.name) = lower(p_name)
  limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.categories (user_id, name, kind, icon)
  values (auth.uid(), p_name, p_kind, p_icon)
  on conflict (user_id, kind, name) do nothing
  returning id into v_id;
  if v_id is null then -- created concurrently
    select c.id into v_id from public.categories c
    where c.user_id = auth.uid() and c.kind = p_kind and c.name = p_name;
  end if;
  return v_id;
end;
$$;

-- Fee rows follow their transfer when its source account or date is edited.
create function public.transfer_fee_follow()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.transactions f
  set from_account_id = new.from_account_id, occurred_at = new.occurred_at
  where f.fee_for_id = new.id
    and (f.from_account_id is distinct from new.from_account_id or f.occurred_at is distinct from new.occurred_at);
  return null;
end;
$$;

create trigger transactions_fee_follow
after update of from_account_id, occurred_at on public.transactions
for each row when (new.type = 'TRANSFER')
execute function public.transfer_fee_follow();

-- A settlement's amount is owned by its debt payment; changing it from the transaction screen would make the two
-- disagree. (Account, date and note may still be edited; deleting the transaction undoes the payment.)
create function public.debt_payment_amount_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.amount is distinct from old.amount
     and exists (select 1 from public.debt_payments p where p.transaction_id = old.id) then
    raise exception 'Nominal pelunasan diubah dari halaman Utang & Piutang (batalkan, lalu catat ulang).'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger transactions_debt_amount_guard
before update of amount on public.transactions
for each row execute function public.debt_payment_amount_guard();

-- ========================================================
-- 3. TRANSFER WITH OPTIONAL FEE
-- ========================================================

create function public.create_transfer(
  p_from uuid,
  p_to uuid,
  p_amount bigint,
  p_fee bigint default 0,
  p_occurred_at timestamptz default null,
  p_note text default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  v_at timestamptz := coalesce(p_occurred_at, now());
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal transfer harus lebih dari 0.' using errcode = '22023';
  end if;
  if p_fee is null or p_fee < 0 then
    raise exception 'Biaya admin tidak boleh negatif.' using errcode = '22023';
  end if;
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'Pilih dua akun yang berbeda.' using errcode = '22023';
  end if;
  if (select count(*) from public.accounts a
      where a.id in (p_from, p_to) and a.user_id = uid and a.archived_at is null) <> 2 then
    raise exception 'Akun tidak ditemukan atau sudah diarsipkan.' using errcode = '22023';
  end if;

  if p_request_id is not null then
    select t.id into v_id from public.transactions t where t.user_id = uid and t.client_request_id = p_request_id;
    if v_id is not null then
      return v_id; -- a retry of a transfer that was already saved
    end if;
  end if;

  begin
    insert into public.transactions (user_id, type, amount, from_account_id, to_account_id, description, occurred_at, client_request_id)
    values (uid, 'TRANSFER', p_amount, p_from, p_to, nullif(trim(p_note), ''), v_at, p_request_id)
    returning id into v_id;
  exception when unique_violation then
    -- The same request arrived twice at once; the other one saved it.
    select t.id into v_id from public.transactions t where t.user_id = uid and t.client_request_id = p_request_id;
    return v_id;
  end;

  if p_fee > 0 then
    insert into public.transactions (user_id, type, amount, from_account_id, category_id, necessity, merchant, occurred_at, fee_for_id)
    values (uid, 'EXPENSE', p_fee, p_from,
            public.ensure_category('Biaya Admin / Transfer', 'EXPENSE', 'bank'),
            'NEED', 'Biaya admin transfer', v_at, v_id);
  end if;

  return v_id;
end;
$$;

-- ========================================================
-- 4. DEBT PAYMENTS THAT MOVE MONEY
-- ========================================================

-- Records a (partial) payment of a debt. With an account, also writes the money movement:
--   OWED_TO_ME (piutang): INCOME into the account,  "Pelunasan Piutang: <name>"
--   I_OWE      (utang):   EXPENSE from the account, "Pelunasan Utang: <name>"
-- Without an account it only records the payment (as before v2), e.g. when the money was already logged.
-- The debt row is locked, so two taps cannot overpay it; a repeated request id returns the first payment.
create function public.record_debt_payment(
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
      insert into public.transactions (user_id, type, amount, to_account_id, category_id, merchant, occurred_at)
      values (uid, 'INCOME', p_amount, p_account_id,
              public.ensure_category('Utang & Piutang', 'INCOME', 'handshake'), left(v_label, 100), v_at)
      returning id into v_tx;
    else
      insert into public.transactions (user_id, type, amount, from_account_id, category_id, necessity, merchant, occurred_at)
      values (uid, 'EXPENSE', p_amount, p_account_id,
              public.ensure_category('Utang & Piutang', 'EXPENSE', 'handshake'), 'NEED', left(v_label, 100), v_at)
      returning id into v_tx;
    end if;
  end if;

  insert into public.debt_payments (user_id, debt_id, amount, paid_at, transaction_id, request_id)
  values (uid, v_debt.id, p_amount, v_at, v_tx, p_request_id)
  returning id into v_payment;
  return v_payment;
end;
$$;

-- Undoes a payment: removes its transaction too (the balance goes back), so the debt is open again by that amount.
create function public.delete_debt_payment(p_payment_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_tx uuid;
begin
  select p.transaction_id into v_tx from public.debt_payments p
  where p.id = p_payment_id and p.user_id = auth.uid();
  if not found then
    raise exception 'Pembayaran tidak ditemukan.' using errcode = '22023';
  end if;
  delete from public.debt_payments p where p.id = p_payment_id;
  if v_tx is not null then
    delete from public.transactions t where t.id = v_tx and t.user_id = auth.uid();
  end if;
end;
$$;

revoke all on function public.ensure_category(text, public.category_kind, text) from public, anon;
revoke all on function public.create_transfer(uuid, uuid, bigint, bigint, timestamptz, text, uuid) from public, anon;
revoke all on function public.record_debt_payment(uuid, bigint, uuid, timestamptz, uuid) from public, anon;
revoke all on function public.delete_debt_payment(uuid) from public, anon;
grant execute on function public.ensure_category(text, public.category_kind, text) to authenticated;
grant execute on function public.create_transfer(uuid, uuid, bigint, bigint, timestamptz, text, uuid) to authenticated;
grant execute on function public.record_debt_payment(uuid, bigint, uuid, timestamptz, uuid) to authenticated;
grant execute on function public.delete_debt_payment(uuid) to authenticated;
