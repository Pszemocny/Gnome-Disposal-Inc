-- Error reports from the online game (src/ui/crash.ts). Paste into SQL Editor and run once (no secret needed).
-- guard: 20 rows per game session + 2000 per 24 h for errors and, separately, 2000 per 24 h for measurement lines (source = 'note')
-- Nobody can read, change or delete rows with the public key: read them in the dashboard (README "Reading errors").
-- Changing the guard later: run only the "create or replace function" block (create table runs once).

create table public.errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session text not null check (session ~ '^[0-9a-f-]{36}$'),
  build text not null check (char_length(build) <= 200),
  source text not null check (source in ('error', 'unhandledrejection', 'webglcontextlost', 'note')),
  message text not null check (char_length(message) between 1 and 1000),
  stack text not null default '' check (char_length(stack) <= 3000),
  ua text not null default '' check (char_length(ua) <= 300),
  level smallint null check (level between 1 and 99),
  land smallint null check (land between 0 and 9),
  count integer not null default 1 check (count between 1 and 1000000)
);
create index errors_created on public.errors (created_at);
create index errors_session on public.errors (session);

alter table public.errors enable row level security;
revoke all on table public.errors from anon, authenticated;
-- insert only, no select: the game sends with Prefer: return=minimal
grant insert (session, build, source, message, stack, ua, level, land, count) on public.errors to anon;
create policy "anyone can add an error" on public.errors for insert to anon with check (true);

-- security definer: the counts must see every row (anon cannot select)
create or replace function public.errors_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- one lock: concurrent inserts wait here, so every count sees the rows committed before it
  perform pg_advisory_xact_lock(hashtext('public.errors_guard'));
  -- errors and measurement lines each have their own daily budget, so a wave of notes never closes the error log
  if (select count(*) from public.errors where created_at > now() - interval '24 hours' and (source = 'note') = (new.source = 'note')) >= 2000 then
    raise exception 'error log full for today';
  end if;
  if (select count(*) from public.errors where session = new.session) >= 20 then
    raise exception 'too many errors from this session';
  end if;
  return new;
end $$;
create trigger errors_guard before insert on public.errors for each row execute function public.errors_guard();
