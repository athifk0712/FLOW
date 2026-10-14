-- Flowku Together: shared savings targets with friends (patungan). Separate from personal books: nothing here moves
-- money in anyone's accounts, and members only ever see the group's own rows (never each other's transactions).
--
-- Access is enforced here, not in the app:
--   * membership rows are only created by create_group() / join_group() (no INSERT policy), so nobody can add
--     themselves to a group without its invite code, and roles cannot be changed from the client (no UPDATE policy);
--   * only the owner edits the group and its targets, verifies contributions and removes members;
--   * a member records their own contribution as PENDING; only VERIFIED contributions count towards a target.

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        varchar(60) not null check (length(btrim(name)) > 0),
  currency    char(3) not null default 'IDR' check (currency ~ '^[A-Z]{3}$'),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index groups_created_by_idx on public.groups (created_by);

create table public.group_members (
  group_id     uuid not null references public.groups (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name varchar(40) not null check (length(btrim(display_name)) > 0),
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.group_targets (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  name          varchar(80) not null check (length(btrim(name)) > 0),
  description   text,
  target_amount bigint not null check (target_amount > 0),
  deadline      date,
  status        text not null default 'ACTIVE' check (status in ('ACTIVE', 'DONE', 'CANCELLED')),
  created_by    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, group_id)
);
create index group_targets_group_idx on public.group_targets (group_id);
create index group_targets_created_by_idx on public.group_targets (created_by);

create table public.group_contributions (
  id             uuid primary key default gen_random_uuid(),
  target_id      uuid not null,
  group_id       uuid not null,
  user_id        uuid not null default auth.uid(),
  amount         bigint not null check (amount > 0),
  note           varchar(140),
  status         text not null default 'PENDING' check (status in ('PENDING', 'VERIFIED', 'REJECTED')),
  contributed_at timestamptz not null default now(),
  verified_by    uuid references auth.users (id) on delete set null,
  verified_at    timestamptz,
  foreign key (target_id, group_id) references public.group_targets (id, group_id) on delete cascade,
  -- Leaving a group removes your membership; your past contributions stay with the target only while you are a member.
  foreign key (group_id, user_id) references public.group_members (group_id, user_id) on delete cascade
);
create index group_contributions_target_idx on public.group_contributions (target_id);
create index group_contributions_member_idx on public.group_contributions (group_id, user_id);
create index group_contributions_user_idx on public.group_contributions (user_id);
create index group_contributions_verified_by_idx on public.group_contributions (verified_by);

create trigger groups_updated_at before update on public.groups
for each row execute function public.set_updated_at();
create trigger group_targets_updated_at before update on public.group_targets
for each row execute function public.set_updated_at();

-- ========================================================
-- Membership helpers (security definer, so policies on group_members don't recurse)
-- ========================================================
create function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = auth.uid());
$$;

create function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.is_group_owner(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;

-- ========================================================
-- RLS
-- ========================================================
alter table public.groups              enable row level security;
alter table public.group_members       enable row level security;
alter table public.group_targets       enable row level security;
alter table public.group_contributions enable row level security;

create policy "members read" on public.groups for select to authenticated
  using ((select public.is_group_member(id)));
create policy "owner updates" on public.groups for update to authenticated
  using ((select public.is_group_owner(id))) with check ((select public.is_group_owner(id)));
create policy "owner deletes" on public.groups for delete to authenticated
  using ((select public.is_group_owner(id)));

create policy "members read" on public.group_members for select to authenticated
  using ((select public.is_group_member(group_id)));
-- Leave (a member removing themselves) or remove someone else (owner). The owner cannot leave; they delete the group.
create policy "leave or remove" on public.group_members for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role <> 'owner')
    or (user_id <> (select auth.uid()) and (select public.is_group_owner(group_id)))
  );

create policy "members read" on public.group_targets for select to authenticated
  using ((select public.is_group_member(group_id)));
create policy "owner inserts" on public.group_targets for insert to authenticated
  with check ((select public.is_group_owner(group_id)) and created_by = (select auth.uid()));
create policy "owner updates" on public.group_targets for update to authenticated
  using ((select public.is_group_owner(group_id))) with check ((select public.is_group_owner(group_id)));
create policy "owner deletes" on public.group_targets for delete to authenticated
  using ((select public.is_group_owner(group_id)));

create policy "members read" on public.group_contributions for select to authenticated
  using ((select public.is_group_member(group_id)));
create policy "member adds own pending" on public.group_contributions for insert to authenticated
  with check (
    user_id = (select auth.uid()) and status = 'PENDING' and verified_by is null and verified_at is null
    and (select public.is_group_member(group_id))
  );
create policy "owner verifies" on public.group_contributions for update to authenticated
  using ((select public.is_group_owner(group_id))) with check ((select public.is_group_owner(group_id)));
create policy "own pending or owner deletes" on public.group_contributions for delete to authenticated
  using (
    (user_id = (select auth.uid()) and status = 'PENDING')
    or (select public.is_group_owner(group_id))
  );

-- Verifying may only change the status; who and when are stamped here.
create function public.group_contribution_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.amount is distinct from old.amount or new.user_id is distinct from old.user_id
     or new.target_id is distinct from old.target_id or new.group_id is distinct from old.group_id
     or new.contributed_at is distinct from old.contributed_at or new.note is distinct from old.note then
    raise exception 'Setoran tidak bisa diubah, hanya diverifikasi atau ditolak.' using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status then
    new.verified_by := case when new.status = 'PENDING' then null else auth.uid() end;
    new.verified_at := case when new.status = 'PENDING' then null else now() end;
  else
    new.verified_by := old.verified_by;
    new.verified_at := old.verified_at;
  end if;
  return new;
end;
$$;

create trigger group_contributions_guard before update on public.group_contributions
for each row execute function public.group_contribution_guard();

-- ========================================================
-- RPCs: the only ways in
-- ========================================================
create function public.create_group(p_name text, p_display_name text)
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
  if (select count(*) from public.group_members m where m.user_id = uid) >= 20 then
    raise exception 'Maksimal 20 grup per orang.' using errcode = '22023';
  end if;
  insert into public.groups (name, currency, created_by)
  values (btrim(p_name), coalesce((select p.currency from public.profiles p where p.id = uid), 'IDR'), uid)
  returning id into v_id;
  insert into public.group_members (group_id, user_id, display_name, role)
  values (v_id, uid, left(coalesce(nullif(btrim(p_display_name), ''), 'Aku'), 40), 'owner');
  return v_id;
end;
$$;

create function public.join_group(p_code text, p_display_name text)
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
  select g.id into v_id from public.groups g where g.invite_code = upper(btrim(p_code));
  if v_id is null then
    raise exception 'Kode undangan tidak ditemukan.' using errcode = '22023';
  end if;
  if exists (select 1 from public.group_members m where m.group_id = v_id and m.user_id = uid) then
    return v_id; -- already a member
  end if;
  if (select count(*) from public.group_members m where m.group_id = v_id) >= 30 then
    raise exception 'Grup ini sudah penuh (30 anggota).' using errcode = '22023';
  end if;
  insert into public.group_members (group_id, user_id, display_name, role)
  values (v_id, uid, left(coalesce(nullif(btrim(p_display_name), ''), 'Teman'), 40), 'member')
  on conflict do nothing;
  return v_id;
end;
$$;

revoke all on function public.create_group(text, text) from public, anon;
revoke all on function public.join_group(text, text) from public, anon;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.join_group(text, text) to authenticated;
