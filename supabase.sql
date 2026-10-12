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


-- ---------------------------------------------------------------------------
-- Short ID login: each user picks a short ID (like "samir") and can log in with it instead of the email.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  short_id   text not null,
  created_at timestamptz not null default now(),
  constraint short_id_format check (short_id ~ '^[a-z0-9_.-]{3,20}$')
);
create unique index if not exists profiles_short_id_key on public.profiles (short_id);

alter table public.profiles enable row level security;

-- Each user can read, create and change only their own profile row.
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Failed and successful tries are counted here to slow down password guessing through the short ID route.
create table if not exists public.login_attempts (
  short_id text not null,
  at       timestamptz not null default now()
);
create index if not exists login_attempts_idx on public.login_attempts (short_id, at);
alter table public.login_attempts enable row level security; -- no policies: only the function below can touch it

-- Public: is this short ID free? (used on the sign up form)
create or replace function public.short_id_available(p_short_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(p_short_id)) ~ '^[a-z0-9_.-]{3,20}$'
     and not exists (select 1 from public.profiles where short_id = lower(trim(p_short_id)));
$$;

-- Public: turns (short ID + password) into the login email, but ONLY when the password is right.
-- The email is never returned to someone who does not already know the password.
-- After 8 tries in 10 minutes for the same short ID it refuses with 'too_many_attempts'.
create or replace function public.login_email(p_short_id text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  sid text := lower(trim(p_short_id));
  v_email text;
  v_hash text;
  recent int;
begin
  delete from public.login_attempts where at < now() - interval '1 day';
  select count(*) into recent from public.login_attempts where short_id = sid and at > now() - interval '10 minutes';
  if recent >= 8 then
    raise exception 'too_many_attempts';
  end if;
  insert into public.login_attempts (short_id) values (sid);

  select u.email, u.encrypted_password into v_email, v_hash
  from public.profiles pr
  join auth.users u on u.id = pr.user_id
  where pr.short_id = sid;

  if v_hash is null or v_hash = '' then
    return null;
  end if;
  if crypt(p_password, v_hash) = v_hash then
    delete from public.login_attempts where short_id = sid;
    return v_email;
  end if;
  return null;
end;
$$;

revoke all on function public.short_id_available(text) from public;
revoke all on function public.login_email(text, text) from public;
grant execute on function public.short_id_available(text) to anon, authenticated;
grant execute on function public.login_email(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Optional public links (GitHub / LinkedIn). A link is public only when its own "show" switch is on.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists github_url   text;
alter table public.profiles add column if not exists linkedin_url  text;
alter table public.profiles add column if not exists show_github   boolean not null default false;
alter table public.profiles add column if not exists show_linkedin boolean not null default false;
alter table public.profiles drop constraint if exists github_url_format;
alter table public.profiles add constraint github_url_format
  check (github_url is null or (length(github_url) <= 200 and github_url ~* '^https://(www\.)?github\.com/[A-Za-z0-9._/-]+$'));
alter table public.profiles drop constraint if exists linkedin_url_format;
alter table public.profiles add constraint linkedin_url_format
  check (linkedin_url is null or (length(linkedin_url) <= 200 and linkedin_url ~* '^https://([a-z]{2,3}\.)?linkedin\.com/[A-Za-z0-9._%/-]+$'));

-- Public leaderboard. Returns a display name, counts and (only if the user switched them on) GitHub / LinkedIn links.
-- Never solutions, emails or ids.
-- days = 1 means today (India time). days = 0 means overall, all time.
-- A problem counts on its "Solved on" date. That date can never be later than the day it was logged,
-- so future dates do not help, and old problems you import later stay on their real day.
drop function if exists public.leaderboard(int);
create function public.leaderboard(days int default 1)
returns table (display_name text, easy int, medium int, hard int, total int, points int, github text, linkedin text)
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
      + 3 * count(*) filter (where e.difficulty = 'Hard') )::int as points,
    case when pr.show_github   then pr.github_url   end as github,
    case when pr.show_linkedin then pr.linkedin_url end as linkedin
  from eff e
  join auth.users u on u.id = e.user_id
  left join public.profiles pr on pr.user_id = e.user_id
  where days <= 0
     or e.day >= to_char((now() at time zone 'Asia/Kolkata')::date - (greatest(least(days, 30), 1) - 1), 'YYYY-MM-DD')
  group by e.user_id, u.raw_user_meta_data, pr.github_url, pr.linkedin_url, pr.show_github, pr.show_linkedin
  order by 6 desc, 5 desc, 1
  limit 50;
$$;

revoke all on function public.leaderboard(int) from public;
grant execute on function public.leaderboard(int) to anon, authenticated;
