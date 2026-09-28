-- Turn a READY buy intent into a real expense in one atomic step.
-- Runs as the caller (RLS applies). buy_intents_guard still blocks purchases during cooldown,
-- which rolls back the inserted transaction too.
create function public.purchase_intent(p_intent_id uuid, p_account_id uuid, p_amount bigint default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_intent public.buy_intents;
  v_tx uuid;
begin
  select * into v_intent from public.buy_intents where id = p_intent_id for update;
  if not found then
    raise exception 'Niat beli tidak ditemukan';
  end if;

  -- Necessity was already judged when the intent was created, so the expense skips nightly review.
  insert into public.transactions (type, amount, from_account_id, category_id, necessity, merchant)
  values ('EXPENSE', coalesce(p_amount, v_intent.estimated_cost), p_account_id,
          v_intent.category_id, v_intent.necessity, v_intent.item_name)
  returning id into v_tx;

  update public.buy_intents set status = 'PURCHASED', transaction_id = v_tx where id = p_intent_id;

  return v_tx;
end;
$$;

revoke execute on function public.purchase_intent(uuid, uuid, bigint) from public, anon;
grant execute on function public.purchase_intent(uuid, uuid, bigint) to authenticated;
