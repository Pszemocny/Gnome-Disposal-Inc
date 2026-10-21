-- Shared online leaderboard (Supabase). Paste into SQL Editor and run once.
-- guard: per board 30/min + all boards 2000 per 24 h + today/yesterday + key
-- Replace __SALT__ only in the SQL Editor after pasting (value of the GitHub variable VITE_SUPABASE_SALT); never in this file: the repo is public.
-- Changing the guard later: run only the "create or replace function" block and new "create index if not exists" lines (create table runs once);
-- re-creating the function needs the salt again.
-- name = a first name or nickname only (PP 2026-10-24), never a full official name; board speed = unpaused seconds to hole level 12, board combo = the biggest combo of one run.
-- Adding the combo board to a live database: docs/ai-work/2026-10-21-combo-board.sql (constraints only, the function stays).
-- The game's own name rule is stricter (letters, digits, spaces, . _ - '); the database guards only size and markup.

create table public.scores (
  id bigint generated always as identity primary key,
  name text not null constraint scores_name_check check (char_length(name) between 1 and 20 and btrim(name) <> '' and name !~ '[<>[:cntrl:]]'),
  score double precision not null check (score >= 0 and score < 1e300),
  level smallint not null check (level between 1 and 99),
  board text not null default 'main' constraint scores_board_check check (board ~ '^(main|speed|combo|daily-\d{4}-\d{2}-\d{2})$'),
  key text not null,
  created_at timestamptz not null default now(),
  -- a guard against nonsense rows, not a skill rule: 20 gnomes/s machine-fed with every XP upgrade is about 24 XP/s, 11 305 XP takes 470 s
  constraint scores_speed_check check (board <> 'speed' or (level = 12 and score >= 120)),
  -- board combo = the biggest combo of one run, as the game shows it (machine feeding counts too); a whole number up to 100 000
  constraint scores_combo_check check (board <> 'combo' or (score between 1 and 100000 and score = trunc(score)))
);
create index scores_board_score on public.scores (board, score desc);
create index scores_board_created on public.scores (board, created_at);
create index if not exists scores_created on public.scores (created_at);

alter table public.scores enable row level security;
revoke all on table public.scores from anon, authenticated;
-- no select on id or key: the browser must always name its columns
grant select (name, score, level, board, created_at), insert (name, score, level, board, key) on public.scores to anon;
create policy "anyone can read scores" on public.scores for select to anon using (true);
create policy "anyone can add a score" on public.scores for insert to anon with check (true);

-- key = hex HMAC-SHA256 over '<16 hex digits of the IEEE-754 score>|<board>|<UTC date>' (the game: scoreKey in src/ui/leaderboard.ts).
-- The binary score is exact on both sides; text forms differ (JS 100000000000000000000, Postgres 1e+20).
-- security definer: the counts must see every row (anon has only column grants and RLS), and hmac must not depend on anon's rights in schema extensions
create or replace function public.scores_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  salt  constant text := '__SALT__';
  today text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
  yday  text := to_char((now() at time zone 'utc') - interval '1 day', 'YYYY-MM-DD');
  msg   text := encode(float8send(new.score), 'hex') || '|' || new.board || '|';
begin
  if new.board like 'daily-%' and new.board not in ('daily-' || today, 'daily-' || yday) then
    raise exception 'daily board must be today or yesterday (UTC)';
  end if;
  -- yesterday too: a score sent just after midnight UTC still passes
  if new.key is distinct from encode(extensions.hmac(msg || today, salt, 'sha256'), 'hex')
     and new.key is distinct from encode(extensions.hmac(msg || yday, salt, 'sha256'), 'hex') then
    raise exception 'bad key';
  end if;
  -- one lock for all boards: concurrent inserts wait here, so every count sees the rows committed before it
  perform pg_advisory_xact_lock(hashtext('public.scores_guard'));
  if (select count(*) from public.scores where created_at > now() - interval '24 hours') >= 2000 then
    raise exception 'the online board is full for today, try again tomorrow';
  end if;
  if (select count(*) from public.scores where board = new.board and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too many scores on this board right now, try again in a minute';
  end if;
  return new;
end $$;
create trigger scores_guard before insert on public.scores for each row execute function public.scores_guard();
