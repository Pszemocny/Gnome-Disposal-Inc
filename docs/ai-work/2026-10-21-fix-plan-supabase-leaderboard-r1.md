# Fix plan: Supabase leaderboard (uncommitted on main), round 1

Status: needs-decision for G1 (global cap, F2). P2 and P3 can run now. P1 runs after PP answers; its recommended shape is written below.

## Findings
- F1 `supabase/leaderboard.sql:43` When several POSTs on one board arrive at the same moment, then each trigger counts fewer than 30 rows and all of them pass (up to ~1500 a minute), because the count takes no lock and READ COMMITTED does not see uncommitted rows (known Postgres fact, accepted by the orchestrator; no live repro allowed).
- F2 `supabase/leaderboard.sql:43` When a script floods the three open boards (main, today, yesterday), then ~130k rows a day pile up and the 500 MB Free database turns read-only for everyone in about 2-4 weeks, because only a per-board cap exists (orchestrator).
- F3 `src/ui/leaderboard.ts:107,137` When the POST takes longer than 6 s, then the player reads "Could not reach the online board: score saved on this computer only" although the row may be stored, so a resend can duplicate it (orchestrator).
- F4 `src/ui/leaderboard.ts:131` When the player's clock is off by more than a day, then every score gets 400 and the player sees a generic "rejected" with no hint, because the key date comes from the browser clock (orchestrator).
- F5 `README.md:25` When PP follows step 2, then the salt is typed into the tracked SQL file of a public repo, one `git add` away from a leak (orchestrator).
- L6 `supabase/leaderboard.sql:48` `revoke all on function public.scores_guard()` does nothing for a trigger function (ponytail-review).
- L7 `src/ui/leaderboard.ts:129` `e.board ?? 'main'` repeats `boardOf(e)` from `:37` (ponytail-review).
- L8 `supabase/leaderboard.sql:28` `security definer` stays, needs a one-line reason (ponytail-review).

## Context
- F1, F2 callers: the trigger `scores_guard` (`supabase/leaderboard.sql:49`) is the only user of the function; it fires for every POST from `RemoteStore.submit` (`src/ui/leaderboard.ts:133`) and from `supabase/check.sh:24-54`. Guard above: none (PostgREST runs one insert per request, READ COMMITTED). All writers go through the same trigger, so the fix belongs in the trigger.
- F1 deliberate decision: `docs/ai-work/2026-10-20-plan-supabase-leaderboard.md:264` (R2) says "Concurrency past 30 accepted as is: the exact number does not matter". That premise holds for 31-35, not for ~1500 a minute: it breaks the storage math at `:183` (43,200 rows/day per board). The lock is what makes the decided cap true, so F1 stays in the plan; it does not change R2's per-board shape.
- F2 deliberate decision: R2 (`:264`) chose a per-board cap on purpose, "the global cap cannot offer" a fresh board tomorrow; SPEC `docs/SPEC.md:242` says the per-board cap stops a flood from filling the whole Free database, which F2 shows is false. A global cap reverses R2, so it goes to PP (needs-decision below).
- F3 callers: `RemoteStore.submit` has one caller, `Leaderboard.send` (`src/ui/leaderboard.ts:311`); `warning` is read at `:317` and `:337`. `W_SEND` is used only at `:137`. `call()` (`:103`) is shared by `list` (`:115`, all errors become `W_DOWN`, correct for a GET) and `submit`. One caller affected.
- F4 callers: `scoreKey` (`:83`) is called only at `:131`. The server checks two values that come from the browser clock: the key date (`:131`) and the daily board name (`src/systems/daily.ts:43`, `new Date().toISOString()`); the trigger answers `bad key` (`supabase/leaderboard.sql:41`) and `daily board must be today or yesterday (UTC)` (`:36`). Both reach the player only as 400. `call()` throws before reading the body (`:109`), so today the client cannot tell them apart.
- F5: README step 2 and the SQL header `supabase/leaderboard.sql:3` give the same instruction. Reader: PP only.
- L6: Postgres refuses a direct call of a function that returns `trigger`, and PostgREST does not expose such functions as RPC, so the EXECUTE grant guards nothing.
- L8: without `security definer` the counts would run as `anon` under RLS and column grants, and `extensions.hmac` would need anon's rights in schema `extensions`.

## Data path (G1)
- Isolation: PostgREST transactions are READ COMMITTED; each plpgsql statement takes a fresh snapshot, so a count taken after a transaction-level advisory lock sees every row committed by the previous lock holder. The lock is held until commit, so the next insert waits until the previous row is visible.
- Lock scope: a global cap counts across boards, so the lock must be one lock for the whole table (`hashtext(new.board)` from the finding would let two boards pass the global count at once). One fixed key serialises all inserts; each insert holds it for a few ms; at hobby volume (`:51` of the plan: < 10k rows/year) no waiting is visible. Supabase's `anon` statement timeout (3 s) bounds a queue during a flood; waiters past it get 5xx, which shows `W_SEND`, acceptable during a flood.
- Lock position: after the date and key checks, so junk requests never take it.
- Indexes: per-board count uses `scores_board_created (board, created_at)`, unchanged. The global 24 h count has no board in the filter and needs `scores_created on public.scores (created_at)`; it scans at most 2000 index entries per insert.
- Cost: per insert 1 lock + 2 index range counts (<= 30 and <= 2000 entries); volume of live rows: not measured, cap bounds it at 2000 per 24 h (~730k rows/year, roughly 100-180 MB/year at an estimated 150-250 B per row with 4 indexes, estimate not measured).
- Live apply: the live project already runs the current SQL. `create table` in the file cannot run twice, so the live update runs only `create or replace function public.scores_guard()` (the trigger stays bound to it) and `create index if not exists scores_created`. The removed `revoke` changes nothing live.
- Transactions in tests: the Management API runs SQL as `postgres`, so a `do` block that ends with `raise exception` rolls back every row it inserted; the global-cap test uses that and leaves no rows.

## Groups
- G1 = F1, F2, L6, L8. Class: "row-count guard in a trigger that counts without a lock under READ COMMITTED". Class grep (`count(*)` in `supabase`, `src`, `.github`): 1 hit, `supabase/leaderboard.sql:43`, in group. No list for Postgres in `~/.claude/skills/antipatterns/lists/`: "count-then-insert guard without a lock under READ COMMITTED" goes to skill `antipatterns` (new list `postgres.md`).
  Shape: (a) chosen: in the trigger, after the key check, `perform pg_advisory_xact_lock(hashtext('public.scores_guard'));`, then the global 24 h count (PP option a), then the existing per-board count. (b) rejected: a separate counter table with `update ... set n = n + 1 where n < 30 returning` is atomic without a lock, but needs a reset per minute and per day and one more table with grants; the lock is one line. (c) rejected: an Edge Function proxy with a per-IP limit was rejected in the plan (`:283`) and nothing here changes its revisit criterion. Ladder step: (3) platform function (`pg_advisory_xact_lock`), plus (6) two `if` lines and one index.
  L6: rung 1, delete the line. L8: comment only, no red test.
- G2 = F3, F4, L7. Class: "the player's message does not match what the server did" (timeout read as "not reached"; clock-caused 400 read as a generic rejection). Class grep (`AbortSignal`, `new Date()` used for a server-checked value): `src/ui/leaderboard.ts:107`, `:131`, `src/systems/daily.ts:43` in group (daily board name reaches the server as the `daily board must be` 400, the same hint covers it). Rejected hits: `src/ui/shot.ts:62,64` and `src/ui/crash.ts:29` (local file names and crash time, nothing on the server checks them).
  Shape: (a) chosen: two message constants and two branches in `submit`; `call()` attaches the response body text to the thrown error. (b) rejected: taking the date from the server `Date` header fixes F4 at the root, but `Date` is not a CORS-safelisted response header, so the browser cannot read it unless Supabase exposes it (unverified), and it adds a dependency on header config for one rare case. (c) rejected: widening the trigger to accept tomorrow's key weakens decision 4 and does not help a clock off by 2+ days. Ladder step: (2) reuse `call()`/`warning`, (6) two constants and two branches. L7: rung 2, reuse `boardOf(e)`.
  Note: when the build's salt does not match the database salt, every POST also answers `bad key` and the player reads the clock hint. README step 2b (`check.sh`, case "valid row") catches that misconfiguration before release; accepted.
- G3 = F5. Class: "an instruction that puts a secret into a tracked file". Class grep (`__SALT__`): `README.md:25`, `supabase/leaderboard.sql:3` in group; `supabase/leaderboard.sql:30` is the placeholder itself and stays. One trivial shape: say "replace `__SALT__` only in the SQL Editor after pasting; never edit the file in the repo".

## Packages

### P1 (G1) verifier: yes. Runs after PP answers the G1 question; shape below is the recommended option (a)
- Owns: `supabase/leaderboard.sql`, `supabase/check.sh`, `docs/SPEC.md` (lines 215 and 242 only), README "Cheating, honestly" paragraph (`README.md:34`). README step 2 belongs to P3; P1 and P3 both touch `README.md`, so P3 is merged into P1 if P1 runs; if PP picks option (b) or (c), P3 runs alone.
- Contract with P2: keep the exception texts `bad key` and `daily board must be today or yesterday (UTC)` word for word; P2 matches on them. The new global-cap text must not contain either string.
- Edit order:
  1. `supabase/leaderboard.sql`: `create function` becomes `create or replace function`; above it one comment line: `-- security definer: the counts must see every row (anon has only column grants and RLS), and hmac must not depend on anon's rights in schema extensions`.
  2. In the function body, after the key check and before the per-board count: `perform pg_advisory_xact_lock(hashtext('public.scores_guard'));` with the comment `-- one lock for all boards: concurrent inserts wait here, so every count sees the rows committed before it`; then `if (select count(*) from public.scores where created_at > now() - interval '24 hours') >= 2000 then raise exception 'the online board is full for today, try again tomorrow'; end if;` (the number from PP's answer).
  3. `create index if not exists scores_created on public.scores (created_at);` next to the other two indexes (all three keep their names).
  4. Delete line 48 (`revoke all on function ...`).
  5. Header line 2: `-- guard: per board 30/min + all boards 2000 per 24 h + today/yesterday + key`; header line 3: see P3 wording; add one line: `-- Changing the guard later: run only the "create or replace function" block and new "create index if not exists" lines (create table runs once).`
  6. `supabase/check.sh`: replace the sequential flood (lines 50-53) with 40 parallel POSTs on `daily-$Y` (each `post` in the background writing its code to a temp file under `mktemp -d`, then `wait`), then `say "40 parallel POSTs on daily-$Y: accepted" "$n" 30`; keep line 54 (`daily-$T` same minute → 2xx). Update the comment on line 50.
  7. README "Cheating, honestly": add that all boards together take at most 2000 new scores per 24 hours, so a flood cannot fill the database, but it can stop online saves for everyone for up to a day; cleanup = delete the flood rows in the dashboard.
  8. `docs/SPEC.md:215` add the global cap to the last sentence; `docs/SPEC.md:242` rewrite the per-board decision line so it no longer claims to protect the database, and add a decision line `(PP, 2026-10-21) <PP's answer>` with one sentence why.
  9. Apply live: from `supabase/leaderboard.sql` take only the function block and the new index, substitute `__SALT__` from Keychain `gnome-supabase-salt` inline into a scratchpad file, run it with the scratchpad `slb/q.sh`, delete the scratchpad file. Never print the salt or the token, never write the salt into the repo file.
- Red tests:
  - F2 (Management API, rolled back): one `do` block that reads `c := count(*) where created_at > now() - interval '24 hours'`, inserts `2000 - c - 5` rows `('Check','Cap',1,1,'main',<valid key for today>)` with explicit `created_at = now() - interval '1 hour'` (outside the 1-minute window, so the per-board cap does not trigger), then inserts with default `created_at` on `main`, today and yesterday (round-robin) until an exception, then `raise exception 'result: % rows, %', n, sqlerrm` so everything rolls back. Expected after the fix: 5 more rows, message `the online board is full for today, try again tomorrow`. Before the fix it stops at 30+ rows with the per-board message (red not run live: same block, read-only effect, may be run by the package before step 9 to show red; it inserts nothing that survives).
  - F1 (`supabase/check.sh`, live, after step 9 only, no red run: live repro forbidden): "40 parallel POSTs on daily-$Y: accepted" → exactly 30.
  - L6, L8: no behaviour change, no red test.
- Run once at the end: the rolled-back `do` block; `sh supabase/check.sh <url> <key> <salt>` (URL and key from GitHub variables or the note, salt from Keychain inline) → every line `ok`, `failed: 0`; then cleanup through `q.sh`: `delete from public.scores where first_name = 'Check' and last_name in ('Script', 'Cap');` and a count of `first_name = 'Check'` → 0; then `select tgname from pg_trigger where tgrelid = 'public.scores'::regclass and not tgisinternal` → `scores_guard`.

### P2 (G2) verifier: no
- Owns: `src/ui/leaderboard.ts`, scratchpad `slb/scenario-remote-lb.js` (`/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-disposal-inc/4c1ea029-d602-463e-ad53-1903c38602be/scratchpad/slb/scenario-remote-lb.js`).
- Edit order:
  1. Constants next to `W_REJECT`: `W_MAYBE = 'The online board did not answer in time: the score is saved on this computer and might have reached the online board too.'` and `W_CLOCK = "The online board rejected this score: check your computer's date and time. Saved on this computer only."`.
  2. `call()` (`:109`): on `!r.ok` attach the body text: `throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status, body: await r.text().catch(() => '') })`.
  3. `submit()` (`:129`): `const board = boardOf(e);` (L7).
  4. `submit()` catch (`:136-137`): `TimeoutError` by `(err as Error).name === 'TimeoutError'` → `W_MAYBE`; status 400 with body matching `/bad key|daily board must be today or yesterday/` → `W_CLOCK`; other `< 500` → `W_REJECT`; rest → `W_SEND`.
  5. Comment on `W_MAYBE` (one line): a resend may store a second row; accepted, honest double submits are allowed (plan row 15).
- Red tests (all in `scenario-remote-lb.js`):
  - F3 new step `R14_post_timeout`: GET answers `[]`, POST hangs until the signal aborts (the R7 "hung" stub, POST only); submit; poll up to 8 s → message equals `W_MAYBE` text, local rows +1, overlay still open.
  - F4 new step `R15_post_400_bad_key`: POST answers `{"code":"P0001","message":"bad key"}` 400 → message equals `W_CLOCK` text; second half: POST 400 `{"message":"daily board must be today or yesterday (UTC)"}` → `W_CLOCK` text.
  - Fixture change in `R8_post_400_get_200`: its POST stub answers `{"message":"new row for relation \"scores\" violates check constraint"}` 400 instead of `bad key`, so R8 keeps checking `W_REJECT` (one sentence in the report).
  - L7: no behaviour change.
- Run once at the end: `npx tsc --noEmit` (0 lines) and, with the private dev server `npx vite --port 5199 --host 127.0.0.1`, from the scratchpad `slb` directory `BASE=http://127.0.0.1:5199 CDP_PORT=9391 MAXPOLL=2400 node smoke.mjs run-remote-lb scenario-remote-lb.js` → R1-R15 as expected, R13 still `W_SEND`, R7 still `W_DOWN`.

### P3 (G3) verifier: no. Merged into P1 when P1 runs (both own `README.md`); runs alone only if PP picks G1 option (b) or (c)
- Owns: `README.md` (step 2), `supabase/leaderboard.sql` (line 3 only, when alone).
- Edit order: 1. README step 2: "Generate the score secret once: `openssl rand -hex 32`. Paste `supabase/leaderboard.sql` into SQL Editor, replace `__SALT__` there with that value, then Run (once). Never put the value into the file in the repo: the repo is public." 2. SQL line 3: `-- Replace __SALT__ only in the SQL Editor after pasting (value of the GitHub variable VITE_SUPABASE_SALT); never in this file: the repo is public.`
- Red test: none (text only). Check: `grep -n "__SALT__" README.md supabase/leaderboard.sql` → the README line says "in SQL Editor", the SQL lines are the header and the placeholder; `git diff supabase/leaderboard.sql | grep -c "^+.*salt  constant text := '[0-9a-f]"` → 0.

## Final tests (orchestrator, once)
- `npx tsc --noEmit`
- `node smoke.mjs run-remote-lb scenario-remote-lb.js` (scratchpad `slb`, dev server 5199)
- the rolled-back global-cap `do` block (P1), then `sh supabase/check.sh <url> <key> <salt>` → `failed: 0`, then the cleanup delete and count → 0

## Verifier scenarios (once, P1 only)
- Honest single insert right after the live apply (check.sh "valid row") and the trigger still bound (`pg_trigger`).
- Boundary: global count at 1999 → next insert passes, at 2000 → refused (the `do` block).
- Concurrency: 40 parallel POSTs → exactly 30 on one board (check.sh line).
- Cost: `explain (analyze, buffers)` of both counts inside a rolled-back transaction on the live project → index scans on `scores_board_created` and `scores_created`, not a seq scan.
- Skipped: empty state (a fresh project counts 0, trivially passes); repeat of the same event (there is no idempotency key; a duplicate is an honest double submit by decision); rollback path (no migration of data; only a function and an index).
- Not verifiable here: a flood long enough to hit the 3 s anon statement timeout while waiting on the lock: UNCLEAR, no live load test allowed.

## Rejected / out of plan
- Removing the browser `keyRole` guard: orchestrator rejected it; plan R1 (`docs/ai-work/2026-10-20-plan-supabase-leaderboard.md:263`) chose both guards on purpose.
- `src/ui/shot.ts:62,64`, `src/ui/crash.ts:29` (class hits for "browser clock"): local names and timestamps, nothing on the server checks them.
- F2 finding's lock key `hashtext(new.board)`: replaced by one global lock, because the global count spans boards.
- Duplicate row after a timed-out POST and a resend: accepted; the text now says it may have arrived, and honest double submits are allowed (plan row 15).
- To skill `antipatterns`: new list `postgres.md` with "count-then-insert guard in a trigger without a lock under READ COMMITTED".

## Open question for PP (G1)
When a script floods the online board, what should stop it from filling the free database?
- a) Cap of 2000 new scores per 24 hours across all boards: the database never fills, but a flood stops online saves for every player for up to a day (they still save locally). Recommended: a full Free database goes read-only for everyone until rows are deleted, which is worse.
- b) Keep only the per-board cap (30 a minute per board, now made exact by the lock): no day-long lockout, but a non-stop flood fills the database in about 2-4 weeks.
- c) Cap per board and delete daily boards older than yesterday: daily boards never pile up, but ALL-TIME still fills in about 2-3 months under a non-stop flood, and old daily results disappear (SPEC says online keeps all days).
- Verifier (fix-verifier): UNCLEAR, it refused to write to the live project without PP's words and there is no local Postgres. Orchestrator check instead, read-only: `pg_indexes` on `public.scores` lists `scores_created (created_at)` and `scores_board_created (board, created_at)`, which match both guard counts; EXPLAIN shows a seq scan only because the table has 0 rows. The behaviour checks stand on P1's own runs (40 parallel POSTs → 30 accepted, rolled-back do-block hits the 2000 cap, cleanup count 0). Scenario copied to `tools/smoke/scenario-remote-lb.js`.
- Default taken (orchestrator, 2026-10-21, PP asleep, to confirm in the morning): option a, global cap 2000 new scores per 24 h across all boards plus the one global advisory lock. P1 and P3 ran together with this shape and the SQL is live.
