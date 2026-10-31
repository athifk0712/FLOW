-- Missing one day no longer ends a streak straight away. Each month has two saves: the first activity after exactly one
-- missed day uses a save and the streak carries on (the missed day itself is not counted). Without a save left, or
-- after two or more missed days, it starts again at 1. Still moved only by the server, inside the activity's own
-- database transaction.

alter table public.profiles
  add column streak_saves_used smallint not null default 0 check (streak_saves_used >= 0),
  add column streak_saves_month date,
  add column streak_saved_on date;

create or replace function public.bump_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.user_today(p_user_id);
  v_month date := date_trunc('month', today)::date;
  v_profile public.profiles;
  v_used smallint;
begin
  select * into v_profile from public.profiles p where p.id = p_user_id for update;
  if not found or v_profile.last_active_date is not distinct from today then
    return;
  end if;
  v_used := case when v_profile.streak_saves_month = v_month then v_profile.streak_saves_used else 0 end;

  if v_profile.last_active_date = today - 1 then
    update public.profiles p
    set streak_count = p.streak_count + 1, last_active_date = today
    where p.id = p_user_id;
  elsif v_profile.last_active_date = today - 2 and v_profile.streak_count > 0 and v_used < 2 then
    update public.profiles p
    set streak_count = p.streak_count + 1,
        last_active_date = today,
        streak_saves_used = v_used + 1,
        streak_saves_month = v_month,
        streak_saved_on = today
    where p.id = p_user_id;
  else
    update public.profiles p
    set streak_count = 1, last_active_date = today
    where p.id = p_user_id;
  end if;
end;
$$;
revoke all on function public.bump_streak(uuid) from public, anon, authenticated;

create or replace function public.profiles_streak_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.streak_count := old.streak_count;
    new.last_active_date := old.last_active_date;
    new.streak_saves_used := old.streak_saves_used;
    new.streak_saves_month := old.streak_saves_month;
    new.streak_saved_on := old.streak_saved_on;
  end if;
  return new;
end;
$$;
