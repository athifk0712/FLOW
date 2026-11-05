-- Start the books over without deleting the account: every financial record goes, the account itself stays (email or
-- Google sign-in, profile settings, photo, streak, AI quota). Groups in Flowku Together are shared with other people,
-- so they are left alone. The default categories come back, exactly like for a new user.
-- Returns the storage paths of the deleted receipts; the app removes those files from its own folder afterwards.

-- The default categories, in one place for new users and for a reset.
create function public.seed_default_categories(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (user_id, name, icon, kind, default_necessity)
  select p_user_id, c.name, c.icon, c.kind::public.category_kind,
         case when public.category_need_by_name(c.name) then 'NEED' else 'WANT' end::public.necessity_level
  from (values
    ('Makan',     'utensils',    'EXPENSE'),
    ('Kopi',      'coffee',      'EXPENSE'),
    ('Transport', 'car',         'EXPENSE'),
    ('Jajan',     'cookie',      'EXPENSE'),
    ('Belanja',   'shopping-bag','EXPENSE'),
    ('Tagihan',   'receipt',     'EXPENSE'),
    ('Kesehatan', 'heart-pulse', 'EXPENSE'),
    ('Hiburan',   'gamepad',     'EXPENSE'),
    ('Lainnya',   'dots',        'EXPENSE'),
    ('Gaji',      'wallet',      'INCOME'),
    ('Lainnya',   'dots',        'INCOME')
  ) as c(name, icon, kind);
$$;

revoke all on function public.seed_default_categories(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

create function public.reset_my_data()
returns setof text
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

  -- Order matters: debts remove their own wallet rows (triggers), asset events block deleting their transactions,
  -- and transactions block deleting their accounts.
  delete from public.debts where user_id = uid;
  delete from public.assets where user_id = uid;
  delete from public.transactions where user_id = uid;
  delete from public.recurring_transactions where user_id = uid;
  delete from public.budgets where user_id = uid;
  delete from public.buy_intents where user_id = uid;
  delete from public.savings_goals where user_id = uid;
  delete from public.accounts where user_id = uid;  -- pockets and pocket moves cascade
  delete from public.categories where user_id = uid;
  delete from public.coach_sessions where user_id = uid;

  return query delete from public.receipts where user_id = uid returning storage_path;

  perform public.seed_default_categories(uid);
end;
$$;

revoke all on function public.reset_my_data() from public, anon;
grant execute on function public.reset_my_data() to authenticated;
