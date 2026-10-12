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
-- A problem counts on its "Solved on" date. That date can never be later than the day it was logged,
-- so future dates do not help, and old problems you import later stay on their real day.
create or replace function public.leaderboard(days int default 3)
returns table (display_name text, easy int, medium int, hard int, total int, points int)
language sql
stable
security definer
set search_path = public, auth
as $$
  with src as (
    select
      p.user_id,
      p.data ->> 'difficulty' as difficulty,
      to_char(p.created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as logged_on,
      p.data ->> 'solvedOn' as solved_on
    from public.problems p
  ),
  eff as (
    select
      user_id,
      difficulty,
      least(
        case when solved_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then solved_on else logged_on end,
        logged_on
      ) as day
    from src
  )
  select
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), 'Coder ' || right(e.user_id::text, 4)) as display_name,
    (count(*) filter (where e.difficulty = 'Easy'))::int   as easy,
    (count(*) filter (where e.difficulty = 'Medium'))::int as medium,
    (count(*) filter (where e.difficulty = 'Hard'))::int   as hard,
    count(*)::int as total,
    ( count(*) filter (where e.difficulty = 'Easy')
      + 2 * count(*) filter (where e.difficulty = 'Medium')
      + 3 * count(*) filter (where e.difficulty = 'Hard') )::int as points
  from eff e
  join auth.users u on u.id = e.user_id
  where e.day >= to_char((now() at time zone 'Asia/Kolkata')::date - (greatest(least(days, 30), 1) - 1), 'YYYY-MM-DD')
  group by e.user_id, u.raw_user_meta_data
  order by 6 desc, 5 desc, 1
  limit 50;
$$;

revoke all on function public.leaderboard(int) from public;
grant execute on function public.leaderboard(int) to anon, authenticated;
