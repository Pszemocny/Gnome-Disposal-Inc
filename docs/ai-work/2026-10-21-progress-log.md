# Gameplay progress log in Supabase

Interpretation: build plan v0 `2026-10-21-plan-progress-log.md` as the spec (PP 2026-10-21: "zrob wszystko z boardu najpierw implementuj wszystko napisz testy ale ich nie odpalaj"), with PP's choices P1 a (no IP), P2 a (the orchestrator applies the SQL through the Management API; this session never talks to Supabase), P3 a (no toggle, only a menu line), the spec-silent rows as recommended (shard buys and downgrades logged, daily and reset end rows), achievements per row as `{ id, run_time, level }` (PP 23:32), plus the mini-roast fixes below.

## Gotowe, gdy

Static lines (run in this session):
- S1. `npx tsc --noEmit -p .` → exit 0, no output
- S2. `npx vite build --outDir <scratchpad>/build-progress` → `✓ built in`
- S3. `rg -n "progress.end\('rebirth'\)" src/systems/hole.ts` → 1 line above `freshState(old)`; the same for `'daily'` in `daily.ts` and `menu.ts` (yard button), `'reset'` in `menu.ts` above `wipeSave()`
- S4. `rg -n "online" src/systems/progress.ts` → only inside `init()` (no module-top read; import cycle leaderboard ↔ progress)

Scenario lines (written, NOT run: PP said not to run them; the reviewer runs them):
- P0. DEV: `{"store":"LocalStore","calls":0,"key":false,"menuLine":false}`
- P2. one POST `kind level`, keys = the grant list with `rid`, `prefer return=minimal`, `keepalive false`, purchases `kick`, `speed`, achievement `first` with numeric `run_time` and `level`
- P3. shard buy `dStart` and `throw` 1 then 0 in the next row, `repeated false`
- P4. nickname `Tester` stored and sent
- P5. network error keeps the row, then two POSTs in seq order, queue 0
- P6. 400 drops the row; P6b. 404 keeps the row (orchestrator applies SQL before push, a missing table must not lose rows)
- P7. `end('rebirth')` keepalive true; `end` twice on one page sends one row
- P8. rid: 5 rows, 5 different uuids; a resend after a timeout carries the same rid
- P9. fresh module instance reads the same id; blocked `setItem` still posts, no exception
- D1/D2. daily buffer separation (two runs on one profile): yard purchases stay in the yard buffer, daily rows carry only daily purchases, yard buffer unchanged after the daily

## Mini-roast findings (built in)

1. [Major] Shared purchase buffer between yard and daily. Fix: a daily page keeps its purchases and achievements in memory only (a daily run never saves and every page load is a new daily run, so a persisted daily buffer would only leak into the next daily); the yard buffer in `gnome-boozed-player` is not touched on a daily page. "Back to your yard" writes a `daily` end row before leaving. Test: D1/D2.
2. [Major] Two tabs: same seq, overwritten queue. Fix: every row has its own `rid` (`crypto.randomUUID()`), the table has `unique (rid)`, so a resend of a row that already arrived gets 409 and is dropped; seq only orders. Every write re-reads `localStorage` first (read, change, write in one synchronous step), so one tab no longer overwrites the other tab's queue and buffers. PP's query orders by `seq, created_at` and needs no `distinct`. Test: P8.
3. [Minor] 404 keeps the row like 5xx and timeouts. `progress.ts` reads `online` only in `init()`. Verified with `npx vite build` as well as tsc.

## Ladder

- `src/systems/progress.ts`: rung 6 (no module keeps a persisted send queue; `crash.ts` is per page load).
- `online`, `restCall`, `BUILD` reused (rung 2); `crypto.randomUUID`, `localStorage`, `fetch keepalive` (rung 3).

## SQL for PP (SQL Editor)

One player's run, level by level (replace the id; find it with the second query):

```sql
select seq, kind, daily, level, run, run_time, play_time, money, earned, gnomes, gnomes_total, land, purchases, achievements, created_at
from public.progress where player = '<player id>' order by seq, created_at;
```

The same by nickname (every player who ever used it):

```sql
select player, seq, kind, daily, level, run, run_time, play_time, money, earned, gnomes, gnomes_total, land, purchases, achievements, created_at
from public.progress where player in (select player from public.progress where name = '<nickname>') order by player, seq, created_at;
```

Who is who:

```sql
select player, max(name) as name, max(created_at) as last_seen, count(*) as rows from public.progress group by player order by last_seen desc;
```

## Work progress

Built (2026-10-22):
- `src/systems/progress.ts` (new): queue and buffers in `localStorage['gnome-boozed-player']` (`id`, `name`, `seq`, `buy`, `ach`, `queue`); daily buffers in memory; read-change-write on every update; storage that cannot be written falls back to memory for the page load; `end()` once per page load, sent at once with keepalive.
- Hooks: `hole.ts` `levelUp()` (`progress.level()` before `saveState`) and `rebirth()` (`progress.end('rebirth')` before `freshState(old)`); `shop.ts` `buy()` after the currency block (money, shards, downgrade); `achievements.ts` `unlock()`; `leaderboard.ts` `send()` after the name check; `menu.ts` yard button (`end('daily')`) and Reset save (`end('reset')` before `wipeSave()`), the menu line in the settings block (online only) with a `.settings .dim` style; `main.ts` `progress.init()` after the leaderboard and the daily end.
- `crash.ts`: `BUILD` exported.
- `supabase/progress.sql` (new, idempotent), `supabase/check.sh` `ONLY=progress`, README steps 2d and "Reading a player's run", `docs/SPEC.md`, `CHANGELOG.md`, `BOARD.md`.
- `tools/smoke/scenario-progress.js` (new, not run).

Deviations from plan v0:
1. The daily end hook sits in `main.ts` after `daily.update(dt)` (`daily.left === 0`), not in `daily.ts`: `daily.ts` importing `progress.ts` would make `leaderboard.ts` evaluate while `daily` is not initialised yet (`const HOME = daily.active` at its module top), so the game would crash at boot.
2. `rid uuid unique` column added (mini-roast 2); PP's query needs no `distinct on (seq)`.
3. 404 keeps the row (mini-roast minor); the plan dropped every 4xx.
4. Daily buffers in memory instead of a persisted daily key: a daily run never saves and every page load is a new daily run, so a persisted daily buffer would leak into the next daily.
5. Achievement array bound 40 (27 today, room for new ones), purchases text bound 12000 chars (120 entries with 20-digit costs reach about 7000).
6. Index `progress_player` on `(player, created_at)` (the per-player daily count), not `(player, seq)`; PP's query reads a few hundred rows at most.

Rejected:
- The `rebirth` achievement written straight into the new state in `rebirth()` is not logged: the `rebirth` row already says it.
- A tab closed in the middle of a yard run writes no end row: the last level row is where it stopped, and the spec names only rebirth, daily and reset as ends.

Checks run (scenario not run, PP 2026-10-21):
- [PASS] S1 `npx tsc --noEmit -p .` → `exit 0`, no output
- [PASS] S2 `npx vite build --outDir <scratchpad>/build-progress --emptyOutDir` → `✓ built in 426ms`; only the old chunk-size warning, no circular-import warning
- [PASS] S3 `rg -n "progress.end\(" src` → `hole.ts:616 'rebirth'` (above `freshState(old)`), `menu.ts:56 'daily'` (yard button), `menu.ts:66 'reset'` (above `wipeSave()`), `main.ts:278 'daily'` (daily over)
- [PASS] S4 `rg -n "\bonline\b" src/systems/progress.ts` → only the import (line 5), a comment and `init()` (line 159)
- `sh -n supabase/check.sh` → syntax ok
- Scenario lines P0-P9, D1, D2: not run in the first pass (PP's order); run in the second pass below.

Scenario run (orchestrator request, 2026-10-22), private dev server on 5209 (no HMR), FAKELOCK=1, one outDir:
- Orchestrator run r9 showed four suspicious values. Verdicts:
  - P0 `"key": false`: expected. In DEV the log is off, so it writes nothing to localStorage.
  - P0 `"menuLine": false`: expected. The line shows only in the online build.
  - D2 `"yardBufferUntouched": false` and `"samePlayer": false`: the expectation was wrong, not the game. `smoke.mjs` deletes `<outDir>/profile` when a run ends, so the daily run never saw the yard run's localStorage (`yardBuyFromD1` was missing). Fix in the scenario: the daily run seeds the yard's entry itself (known id, one `speed` purchase) before it installs the sink.
- The scenario now prints `checks` with `PASS`/`FAIL` per line (`ok(id, cond, detail)`).
- `DEV_PORT=5209 CDP_PORT=9461 MAXPOLL=2400 FAKELOCK=1 node tools/smoke/smoke.mjs <scratchpad>/r10 tools/smoke/scenario-progress.js` → 14/14 PASS (P0, P2_shape, P2_values, P2_purchases, P2_achievements, P3, P4, P5, P6, P7, P7b, P8, P9, D1), `LOGS:` empty
- the same with `URL_QUERY='?lowfx&daily='` → 3/3 PASS (D2_yard_untouched, D2_daily_row, D2_end), `LOGS:` empty
- `npx tsc --noEmit -p .` → exit 0

Self-check: only plan v0 plus the mini-roast fixes; no new dependency; `online`, `restCall`, `BUILD` reused; the hooks are one line each, like the surrounding code.

## Review round (2026-10-21)

- Fixed: "Born Again" (`rebirth`) never reached the log, because `Hole.rebirth()` pushes it into the next state past `Achievements.unlock`. It is now logged with `progress.achieved('rebirth')` right before the rebirth end row, so the end row carries it.
- Fixed (session decision, the button says "Click again to delete everything"): Reset save now also forgets the log identity: after the reset end row is queued, `progress.forget()` gives the player a new random id, no nickname and empty buffers. Queued rows keep the id they were built with, so the reset row still belongs to the old player.
- Kept as planned: purchases and achievements leave the buffer when their row is queued (the row then waits in localStorage until sent). Rows are lost only if Supabase is down for more than 30 level rows (`QUEUE_MAX`).
- Live DB: `supabase/progress.sql` applied through the Management API (additive: new table only); `scores` 4 and `errors` 18 rows before and after; `ONLY=progress sh supabase/check.sh` 12/12 ok, test row deleted.
