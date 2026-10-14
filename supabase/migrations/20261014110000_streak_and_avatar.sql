-- Flowku v2: win streak on the profile, and a profile photo.
--
-- Streak: a day counts once the user does something real that day: a transaction they logged (not one posted
-- automatically by a recurring rule, and not the fee row of a transfer) or a finished daily check (coach session
-- with a summary). The day is the user's local day by the SERVER clock, inside the same database transaction as the
-- activity: a failed save never counts, a repeated save on the same day never counts twice, and a device with a
-- wrong clock cannot fake a day. The client cannot write these columns directly.
--   last day = today      -> unchanged
--   last day = yesterday  -> +1
--   otherwise             -> 1

alter table public.profiles
  add column streak_count integer not null default 0 check (streak_count >= 0),
  add column last_active_date date,
  add column avatar_path text,
  add constraint profiles_avatar_own_folder check (avatar_path is null or split_part(avatar_path, '/', 1) = id::text);

-- One atomic UPDATE: concurrent activities serialize on the profile row.
create function public.bump_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.user_today(p_user_id);
begin
  update public.profiles p
  set streak_count = case
        when p.last_active_date = today then p.streak_count
        when p.last_active_date = today - 1 then p.streak_count + 1
        else 1
      end,
      last_active_date = today
  where p.id = p_user_id
    and p.last_active_date is distinct from today;
end;
$$;
revoke all on function public.bump_streak(uuid) from public, anon, authenticated;

create function public.streak_on_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bump_streak(new.user_id);
  return null;
end;
$$;
revoke all on function public.streak_on_transaction() from public, anon, authenticated;

create trigger transactions_streak
after insert on public.transactions
for each row when (new.recurring_id is null and new.fee_for_id is null)
execute function public.streak_on_transaction();

create function public.streak_on_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.summary is not null and (tg_op = 'INSERT' or old.summary is null) then
    perform public.bump_streak(new.user_id);
  end if;
  return null;
end;
$$;
revoke all on function public.streak_on_check() from public, anon, authenticated;

create trigger coach_sessions_streak
after insert or update of summary on public.coach_sessions
for each row execute function public.streak_on_check();

-- The app may update its own profile (currency, cycle, photo), but the streak only moves through bump_streak().
create function public.profiles_streak_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.streak_count := old.streak_count;
    new.last_active_date := old.last_active_date;
  end if;
  return new;
end;
$$;

create trigger profiles_streak_guard
before update on public.profiles
for each row execute function public.profiles_streak_guard();

-- Profile photos: private bucket, one folder per user ("<user_id>/<file>"), read through signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
