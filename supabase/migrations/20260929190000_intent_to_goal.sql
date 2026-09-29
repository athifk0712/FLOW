-- Money held back by cancelling a buy intent can be set aside for a savings goal, once per intent.

alter table public.buy_intents add constraint buy_intents_id_user_id_key unique (id, user_id);

alter table public.goal_contributions
  add column intent_id uuid,
  add constraint goal_contributions_intent_once unique (intent_id),
  add foreign key (intent_id, user_id) references public.buy_intents (id, user_id) on delete set null (intent_id);

create index goal_contributions_intent_idx on public.goal_contributions (intent_id, user_id);
