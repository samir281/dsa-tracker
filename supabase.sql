-- Run this once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.problems (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.problems enable row level security;

-- Each signed-in user can only see and change their own rows.
drop policy if exists "own problems" on public.problems;
create policy "own problems" on public.problems
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
