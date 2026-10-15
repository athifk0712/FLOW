-- Daily AI quota per user and feature, so one account (or a script) can not run up the Gemini bill.
-- Only the edge functions (service role) take or give back quota; users can read their own count, never change it.
-- Days follow Indonesian time (WIB): the quota resets at midnight in Jakarta.

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  feature text not null check (feature in ('chat', 'scan', 'group_remind')),
  used    integer not null default 0 check (used >= 0),
  primary key (user_id, day, feature)
);

alter table public.ai_usage enable row level security;

create policy "own usage read" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Takes one unit when the user is under the limit. Returns the units left after this one, or -1 when the quota is
-- already used up. One statement, so parallel requests can not slip past the limit together.
create or replace function public.consume_ai_quota(p_user_id uuid, p_feature text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Jakarta')::date;
  new_used integer;
begin
  if p_limit <= 0 then
    return -1;
  end if;
  insert into public.ai_usage as u (user_id, day, feature, used)
  values (p_user_id, today, p_feature, 1)
  on conflict (user_id, day, feature) do update
    set used = u.used + 1
    where u.used < p_limit
  returning u.used into new_used;
  if new_used is null then
    return -1;
  end if;
  return p_limit - new_used;
end;
$$;

-- Gives back the unit of a call that failed (AI busy, error), so failures do not eat the quota.
create or replace function public.refund_ai_quota(p_user_id uuid, p_feature text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
  set used = used - 1
  where user_id = p_user_id
    and day = (now() at time zone 'Asia/Jakarta')::date
    and feature = p_feature
    and used > 0;
$$;

revoke all on function public.consume_ai_quota(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, integer) to service_role;
grant execute on function public.refund_ai_quota(uuid, text) to service_role;
