-- Nightly check-in ("Ngobrol malam") that replaces Tunda Beli. One conversation per user per local day;
-- the transcript and closing summary are kept so later chats (and the user) can look back.
-- buy_intents and its views stay in place so existing data is not lost; the app no longer uses them.

create table public.coach_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  mode       text not null check (mode in ('ai', 'local')),
  messages   jsonb not null default '[]'::jsonb,
  summary    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table public.coach_sessions enable row level security;

create policy "own rows" on public.coach_sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger coach_sessions_updated_at
before update on public.coach_sessions
for each row execute function public.set_updated_at();
