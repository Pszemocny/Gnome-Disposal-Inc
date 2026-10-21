-- Gameplay progress log from the online game (src/systems/progress.ts): one row per hole level-up and one at the end of a run.
-- Paste into SQL Editor and run; safe to run again (adds only, never drops data). No secret needed.
-- guard: 200 rows per player + 3000 rows in total per 24 h. rid is unique, so a row sent twice (timeout, two tabs) is stored once.
-- Nobody can read, change or delete rows with the public key: read them in the dashboard (README "Reading a player's run").

create table if not exists public.progress (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  rid uuid not null unique,
  player text not null check (player ~ '^[0-9a-f-]{36}$'),
  name text null check (char_length(name) between 1 and 20),
  seq integer not null check (seq between 1 and 1000000),
  kind text not null check (kind in ('level', 'rebirth', 'daily', 'reset')),
  daily boolean not null default false,
  level smallint not null check (level between 1 and 99),
  run integer not null check (run between 0 and 100000),
  run_time integer not null check (run_time >= 0),
  play_time integer not null check (play_time >= 0),
  money double precision not null check (money >= 0 and money < 1e300),
  earned double precision not null check (earned >= 0 and earned < 1e300),
  gnomes integer not null check (gnomes >= 0),
  gnomes_total integer not null check (gnomes_total >= 0),
  land smallint not null check (land between 0 and 9),
  purchases jsonb not null default '[]' check (jsonb_typeof(purchases) = 'array' and jsonb_array_length(purchases) <= 120 and char_length(purchases::text) <= 12000),
  achievements jsonb not null default '[]' check (jsonb_typeof(achievements) = 'array' and jsonb_array_length(achievements) <= 40 and char_length(achievements::text) <= 3000),
  build text not null check (char_length(build) <= 200),
  ua text not null default '' check (char_length(ua) <= 300)
);
create index if not exists progress_player on public.progress (player, created_at);
create index if not exists progress_created on public.progress (created_at);

alter table public.progress enable row level security;
revoke all on table public.progress from anon, authenticated;
-- insert only, no select: the game sends with Prefer: return=minimal
grant insert (rid, player, name, seq, kind, daily, level, run, run_time, play_time, money, earned, gnomes, gnomes_total, land, purchases, achievements, build, ua) on public.progress to anon;
drop policy if exists "anyone can add a progress row" on public.progress;
create policy "anyone can add a progress row" on public.progress for insert to anon with check (true);

-- security definer: the counts must see every row (anon cannot select)
create or replace function public.progress_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- one lock: concurrent inserts wait here, so every count sees the rows committed before it
  perform pg_advisory_xact_lock(hashtext('public.progress_guard'));
  if (select count(*) from public.progress where created_at > now() - interval '24 hours') >= 3000 then
    raise exception 'progress log full for today';
  end if;
  if (select count(*) from public.progress where player = new.player and created_at > now() - interval '24 hours') >= 200 then
    raise exception 'progress log full for this player today';
  end if;
  return new;
end $$;
drop trigger if exists progress_guard on public.progress;
create trigger progress_guard before insert on public.progress for each row execute function public.progress_guard();

-- PP: one player's run, level by level (replace the id; find it with the last query):
--   select seq, kind, daily, level, run, run_time, play_time, money, earned, gnomes, gnomes_total, land, purchases, achievements, created_at
--   from public.progress where player = '<player id>' order by seq, created_at;
-- by nickname (rows from before the nickname was entered included):
--   select player, seq, kind, daily, level, run, run_time, play_time, money, earned, gnomes, gnomes_total, land, purchases, achievements, created_at
--   from public.progress where player in (select player from public.progress where name = '<nickname>') order by player, seq, created_at;
-- who is who:
--   select player, max(name) as name, max(created_at) as last_seen, count(*) as rows from public.progress group by player order by last_seen desc;
