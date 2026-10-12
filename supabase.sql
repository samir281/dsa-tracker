-- Run this once in Supabase: SQL Editor > New query > paste everything > Run.
-- Safe to run again (it also upgrades the table from the single-user version).

create table if not exists public.problems (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Server-side time the problem was first logged. The leaderboard uses this, not the date typed in the form.
alter table public.problems add column if not exists created_at timestamptz not null default now();
create index if not exists problems_created_at_idx on public.problems (created_at);

alter table public.problems enable row level security;

-- Each signed-in user can only see and change their own rows (solutions stay private).
drop policy if exists "own problems" on public.problems;
create policy "own problems" on public.problems
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Public leaderboard. Returns only a display name and counts, never solutions, emails or ids.
-- days = 1 means today, 3 means today and the 2 days before (India time).
create or replace function public.leaderboard(days int default 3)
returns table (display_name text, easy int, medium int, hard int, total int, points int)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), 'Coder ' || right(p.user_id::text, 4)) as display_name,
    (count(*) filter (where p.data ->> 'difficulty' = 'Easy'))::int   as easy,
    (count(*) filter (where p.data ->> 'difficulty' = 'Medium'))::int as medium,
    (count(*) filter (where p.data ->> 'difficulty' = 'Hard'))::int   as hard,
    count(*)::int as total,
    ( count(*) filter (where p.data ->> 'difficulty' = 'Easy')
      + 2 * count(*) filter (where p.data ->> 'difficulty' = 'Medium')
      + 3 * count(*) filter (where p.data ->> 'difficulty' = 'Hard') )::int as points
  from public.problems p
  join auth.users u on u.id = p.user_id
  where p.created_at >= (((now() at time zone 'Asia/Kolkata')::date - (greatest(least(days, 30), 1) - 1))::timestamp at time zone 'Asia/Kolkata')
  group by p.user_id, u.raw_user_meta_data
  order by 6 desc, 5 desc, 1
  limit 50;
$$;

revoke all on function public.leaderboard(int) from public;
grant execute on function public.leaderboard(int) to anon, authenticated;
