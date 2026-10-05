-- Lets a user (guest or email) permanently delete their own account and every row they own.
-- All user tables cascade from auth.users, but transactions -> accounts is ON DELETE RESTRICT,
-- so transactions go first. Receipt files in storage are removed by the client beforehand.
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
  delete from public.transactions where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
