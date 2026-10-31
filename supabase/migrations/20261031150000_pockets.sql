-- Kantong: splitting one account's balance by purpose (BCA -> Jajan, Cicilan, Tabungan), like the pockets of Bank Jago.
-- Flowku only records money, so a pocket is a division of the balance, not a separate place: the account's balance
-- never changes when money moves between its pockets, and such a move is neither spending nor income.
--   pocket balance = moves in - moves out + income tagged to it - expenses tagged to it
--   Utama (the rest of the account) = account balance - all its pocket balances
-- Deleting a pocket therefore returns its balance to Utama by itself: its transactions stay, without a pocket.
-- Purely additive: existing transactions have no pocket and count towards Utama.

create table public.pockets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  name       varchar(50) not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (id, user_id), -- target for ownership-checked composite FKs
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade
);
create unique index pockets_account_name_idx on public.pockets (account_id, lower(name));
create index pockets_user_idx on public.pockets (user_id);

-- null = Utama. Written only by move_pocket_money, which checks both pockets belong to the account.
create table public.pocket_moves (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id     uuid not null,
  from_pocket_id uuid,
  to_pocket_id   uuid,
  amount         bigint not null check (amount > 0),
  request_id     uuid,
  created_at     timestamptz not null default now(),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  -- Set null, not cascade: when one side is deleted, the other pocket keeps the money it received.
  constraint pocket_moves_from_fkey foreign key (from_pocket_id, user_id)
    references public.pockets (id, user_id) on delete set null (from_pocket_id),
  constraint pocket_moves_to_fkey foreign key (to_pocket_id, user_id)
    references public.pockets (id, user_id) on delete set null (to_pocket_id)
);
create index pocket_moves_user_idx on public.pocket_moves (user_id);
create index pocket_moves_account_idx on public.pocket_moves (account_id);
create index pocket_moves_from_idx on public.pocket_moves (from_pocket_id) where from_pocket_id is not null;
create index pocket_moves_to_idx on public.pocket_moves (to_pocket_id) where to_pocket_id is not null;
create unique index pocket_moves_request_idx on public.pocket_moves (user_id, request_id) where request_id is not null;

alter table public.transactions
  add column pocket_id uuid,
  add constraint transactions_pocket_id_user_id_fkey
    foreign key (pocket_id, user_id) references public.pockets (id, user_id) on delete set null (pocket_id);
create index transactions_pocket_idx on public.transactions (pocket_id) where pocket_id is not null;

alter table public.pockets      enable row level security;
alter table public.pocket_moves enable row level security;
create policy "own rows" on public.pockets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "read own rows" on public.pocket_moves for select to authenticated
  using (user_id = (select auth.uid()));

-- A transaction's pocket must be in the account the money moves through. Moving the transaction to another account
-- (also from an app version that knows nothing about pockets) drops the pocket instead of failing the edit.
create function public.transaction_pocket_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_account uuid := case new.type when 'EXPENSE' then new.from_account_id when 'INCOME' then new.to_account_id end;
begin
  if new.pocket_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.pocket_id = old.pocket_id
     and (new.type is distinct from old.type
          or new.from_account_id is distinct from old.from_account_id
          or new.to_account_id is distinct from old.to_account_id) then
    new.pocket_id := null;
    return new;
  end if;
  if v_account is null or new.fee_for_id is not null or not exists (
    select 1 from public.pockets p where p.id = new.pocket_id and p.account_id = v_account and p.user_id = new.user_id
  ) then
    raise exception 'Kantong ini bukan bagian dari akun transaksinya.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger transactions_pocket_guard
before insert or update of pocket_id, type, from_account_id, to_account_id on public.transactions
for each row execute function public.transaction_pocket_guard();

create view public.v_pocket_balances with (security_invoker = true) as
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
  )::bigint as balance
from public.pockets p;

-- Moves money between Utama (null) and the pockets of one account. The account's balance stays the same. Only money
-- that is there can be moved; retried saves are idempotent through p_request_id.
create function public.move_pocket_money(
  p_account_id uuid,
  p_from uuid,
  p_to uuid,
  p_amount bigint,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  v_available bigint;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominalnya harus lebih dari nol.' using errcode = 'P0001';
  end if;
  if p_from is not distinct from p_to then
    raise exception 'Pilih kantong asal dan tujuan yang berbeda.' using errcode = 'P0001';
  end if;

  -- One move per account at a time, so two moves can't both spend the same balance.
  perform 1 from public.accounts a
  where a.id = p_account_id and a.user_id = uid and a.archived_at is null
  for update;
  if not found then
    raise exception 'Akun tidak ditemukan.' using errcode = 'P0001';
  end if;

  if p_request_id is not null then
    select m.id into v_id from public.pocket_moves m where m.user_id = uid and m.request_id = p_request_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  if (p_from is not null and not exists (
        select 1 from public.pockets p where p.id = p_from and p.account_id = p_account_id and p.user_id = uid))
     or (p_to is not null and not exists (
        select 1 from public.pockets p where p.id = p_to and p.account_id = p_account_id and p.user_id = uid)) then
    raise exception 'Kantong tidak ditemukan di akun ini.' using errcode = 'P0001';
  end if;

  if p_from is not null then
    select b.balance into v_available from public.v_pocket_balances b where b.id = p_from;
  else
    select b.current_balance - coalesce((
             select sum(pb.balance) from public.v_pocket_balances pb where pb.account_id = p_account_id
           ), 0)
    into v_available
    from public.v_account_balances b where b.account_id = p_account_id;
  end if;
  if coalesce(v_available, 0) < p_amount then
    raise exception 'Saldonya tidak cukup untuk dipindahkan.' using errcode = 'P0001';
  end if;

  insert into public.pocket_moves (user_id, account_id, from_pocket_id, to_pocket_id, amount, request_id)
  values (uid, p_account_id, p_from, p_to, p_amount, p_request_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.move_pocket_money(uuid, uuid, uuid, bigint, uuid) from public, anon;
grant execute on function public.move_pocket_money(uuid, uuid, uuid, bigint, uuid) to authenticated;
