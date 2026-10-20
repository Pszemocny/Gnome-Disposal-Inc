# Shared online leaderboard on Supabase

## Problem

PP chose "2.a": one shared online leaderboard on Supabase for every player of the Pages build. Plan: `2026-10-20-plan-supabase-leaderboard.md`, section "Plan (plan-senior, final)", plus decision 4 (column `key`, HMAC checked by a trigger).

Interpretation: execute the senior's steps 1-11. Decisions 1-3 are taken by recommendation because PP was asleep (to confirm in the morning): 1b per-board flood cap 30/min, 2b daily boards only for today or yesterday UTC, 3a footer "Names are shown publicly online" and autocomplete off. Decision 4: column `key` = hex HMAC-SHA256 over `<score>|<board>|<UTC date>`, checked by a BEFORE INSERT trigger with pgcrypto, today or yesterday UTC accepted. The project exists already (PP gave the URL and the publishable key), so the SQL is applied by the session and the `[PENDING-PP]` curl lines run now against the real project.

Canonical score form (the plan left it to the implementer): `<score>` is the 16 hex digits of the IEEE-754 double (big-endian), in JS from `DataView.setFloat64`, in Postgres from `float8send(score)`. Reason: JS `String(1e20)` is `100000000000000000000`, Postgres `1e20::float8::text` is `1e+20`, and `float8::numeric` rounds to 15 digits; the binary form is exact on both sides for every value the column accepts.

Ladder: rung 6 for `RemoteStore`, the SQL, `check.sh` and the two workflows (the interface at `leaderboard.ts` is the swap point); rung 3 for `fetch`, `AbortSignal.timeout`, `crypto.subtle` HMAC and `atob`; no new dependency.

## Summary

- The game has a `RemoteStore` behind the existing store interface. It is used only in a production build that has all three variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_SUPABASE_SALT`) and a publishable/anon key. The dev server always stays local.
- Every submit writes locally first, then POSTs with `key`. A 4xx shows "rejected", a 5xx or network error shows "could not reach", and an unreachable GET shows the local board with a notice. While a POST is in flight, a second submit and ✕/SKIP/Esc are ignored.
- The database was created on the real project through the Management API from `supabase/leaderboard.sql`, with the salt substituted only for that one run. The trigger checks the daily date (today or yesterday UTC), the HMAC `key` and the per-board cap of 30 per minute.
- GitHub variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` and `VITE_SUPABASE_SALT` are set on Pszemocny/Gnome-Disposal-Inc. The salt (64 hex chars) also lives in the macOS Keychain under `gnome-supabase-salt` and never went into a file in the repo.
- Decisions taken by the senior's recommendation (PP asleep, to confirm in the morning): 1b per-board cap, 2b today/yesterday only, 3a public-names footer and autocomplete off.

Deviations from the plan:
- `RemoteStore` takes a third argument `salt`, and `pickStore()` also needs `VITE_SUPABASE_SALT`. Decision 4 needs a secret on the client, and without the secret every POST would be rejected.
- Done-when 18: `rg -c "vars.VITE_SUPABASE" deploy.yml` gives 5, not 3: the key-check step (`if` + `KEY`) plus three build env lines (SALT added).
- Done-when 27: `check.sh` floods yesterday's daily board instead of `main`, so a check run never fills the ALL-TIME board with 31 test rows. The board it floods is also one that nobody opens.
- Done-when 30: CHANGELOG's top section `2026-10-21 00:30` (the next 5300 build, written by another agent) gets my bullet instead of a new heading. A new heading at 00:07 would sit above a later one.
- `check.sh` takes a third argument (the salt) and tests decision 4 too: wrong key, missing key, a key for another score, and a key 2 days old.

Rejected:
- Showing `money()` for absurd values (1e299 renders as `9.999999999999997e+265dc`): existing formatter, outside this task → separate task if PP cares.
- Fixture changes in the existing scenarios (not product changes): `scenario-leaderboard-app.js` and `scenario-daily.js` set `g.input.wanted = true` before `onLockChange(true)`, because main.ts after the Esc rework takes a lock grant only after a request. Without that the game never "started" and the pause menu had no Leaderboard button. `scenario-daily.js` waits 30 frames instead of 5 after `daily.left = 0.1`, because at 60 fps 5 frames are only 0.08 s. `scenario-leaderboard-app.js` waits once after opening the board, because `render()` reads the store asynchronously.

## Work progress

Scripts (scratchpad `slb/`): `smoke.mjs` (copy, base URL from `BASE`, default 5198), `scenario-remote-lb.js` (R1-R13, stubbed fetch), `scenario-build-lb.js` (production build, FULL=1), `zz-r1.js`, `q.sh` (Management API, token read from Keychain inline), the two existing scenarios with the fixtures above.

Gotowe, gdy (plan `### Done when` 1-30 plus decision 4 lines 31-35), every line run on 2026-10-20/21:
- [PASS] 1 R1 — `run-remote-lb` → `store LocalStore, calls 0`
- [PASS] 2 R2 — `loading true, shown 2, url …select=first_name,last_name,score,level,board,created_at&board=eq.main&order=score.desc&limit=10, apikey true, method GET`
- [PASS] 3 R3 — `containsToday true` (`board=eq.daily-2026-10-20`)
- [PASS] 4 R4 — `post true, keys first_name,last_name,score,level,board,key, board main, keyHex true, prefer return=minimal, localRows 1, msg "Score saved.", calls POST,GET`
- [PASS] 5 R5 — `done 1, hidden true, toast "Could not reach the online board: score saved on this computer only."`
- [PASS] 6 R6 — `URL_QUERY='?lowfx&daily=2026-10-20'` → `title "DAILY 2026-10-20 OVER", postBoard daily-2026-10-20, keyHex true, done 1`
- [PASS] 7 R7 — TypeError and 503: `msg "Online board unreachable: showing scores saved on this computer."`, local rows; abort-only fetch: `warningAfterMs 6084`; LOGS empty
- [PASS] 8 R8 — POST 400 + GET 200 → `open true, localRows 1, msg "The online board rejected this score: saved on this computer only.", lastCall GET`; R8b POST 201 + GET 503 → `msg "Online board unreachable…", ok false`
- [PASS] 9 R9 — `rows ["1. DailyRow Remote"], activeTab "DAILY 2026-10-20"`
- [PASS] 10 R2 — `in 3, shown 2` (row without score dropped)
- [PASS] 11 R4 — `invalid: callsUnchanged true, msg "First name: no HTML, please."`
- [PASS] 12 — `sh supabase/check.sh <url> <key> <salt>` on the real project: `score -1`, `30-char name`, `score 1e400`, `board x`, `id in body`, `array with bad row` all `got 400 want 4xx ok`; `array: rows unchanged: got 0 want 0 ok`
- [PASS] 13 — `PATCH 401`, `DELETE by name 401`, `DELETE no filter 400`, `select=id 401`, `select=key 401`, `select=* 401`; `GET after: got 2 want 2 ok`; `OPTIONS from github.io: got present`
- [PASS] 14 (PP 2b) — `daily-2099-01-01: got 400 want 4xx ok`; R8 stub → `msg "The online board rejected…"`
- [PASS] 15 R4 twice — `postCount 2`
- [PASS] 16 — R2 `oldLocalShown false`; R7 TypeError rows include `4. Old Local`
- [PASS] 17 — `npx vite build --outDir slb/noenv-dist` → `grep -rl supabase.co` → 0 files
- [PASS] 18 — env build → `index-DvUOiWXx.js` contains `example.supabase.co`; `grep -c vars.VITE_SUPABASE deploy.yml` → 5 (deviation above)
- [PASS] 19 — R10 `pub anon, anon JWT anon, service_role null, garbage null, sb_secret_x null`; build with a fake service_role JWT + `vite preview :5311` + FULL=1 headless → `foot "Score = money earned this run. Esc closes.", calls [], WARNING: VITE_SUPABASE_KEY is not the publishable key: online board off`
- [PASS] 20 — deploy.yml step read with Ruby YAML (`if: vars.VITE_SUPABASE_KEY != ''`), run with `KEY=`: service_role JWT → `exit 1` + `has role service_role`; anon JWT → `exit 0`; `sb_publishable_x` → `exit 0`; `garbage` → `exit 1`
- [PASS] 21 R11 — `postCount 1, localRows 1, pending msg "Sending…", disabled true, disabledAfter false, msg "Score saved."`
- [PASS] 22 R12 — `whilePending done 0 open true` (Esc, SKIP, ✕), `doneAfter 1, hidden true`
- [PASS] 23 R13 — `open true, localRows 1, msg "Could not reach the online board: score saved on this computer only."`
- [PASS] 24 — `VITE_SUPABASE_*` set, `npx vite --port 5197` (the dev server serves the env: `VITE_SUPABASE_URL": "https://example.supabase.co"` in the module) + `zz-r1.js` → `store LocalStore, calls 0`
- [PASS] 25 — `touch .env .env.local .env.production && git check-ignore …` → three paths; files removed
- [PASS] 26 — keepalive.yml with Ruby YAML → `cron=0 9 * * * if=vars.VITE_SUPABASE_URL != '' steps=1 curlFail=true perms={}`; its `run:` with the real URL/key → `ping exit 0`. (The first version had `run:` as a plain scalar with `apikey: $KEY` inside: invalid YAML, fixed to a block scalar.)
- [PASS] 27 (PP 1b) — `30 POSTs on daily-2026-10-19: got 30`, `31st: got 400 want 4xx ok`, `POST on daily-2026-10-20 same minute: got 201 want 2xx ok`
- [PASS] 28 (PP 3a) — real build: `foot "Score = money earned this run. Names are shown publicly online. Esc closes.", autocomplete off ×2`; `scenario-leaderboard-app.js` with LocalStore → `0_foot "Score = money earned this run. Esc closes."`
- [PASS] 29 — `scenario-daily.js` → `store LocalStore`, d1-d11 as expected (d5 `offerOpen true, title "DAILY 2026-10-20 OVER"`, d7pause `lbButton true`, d11 `dailyBoardsKept 7`, d11keep `main 50`), LOGS empty; `scenario-leaderboard-app.js` → `0_store LocalStore`, steps 1-8 as expected, LOGS empty
- [PASS] 30 — `grep -n Supabase docs/SPEC.md` → line 215 (+ decision 240); `grep -c supabase.co CHANGELOG.md` → 0, bullet in the top section; README `check.sh`, `Resume project`, `Do not create` → 3 hits; `npx tsc --noEmit` → 0 lines
- [PASS] 31 (decision 4) — real build with the real variables + `vite preview :5312` + FULL=1 headless submit → `msg "Score saved."`, calls `GET, POST, GET`, DB row `Agent Buildcheck, score 0, board main, length(key) 64`
- [PASS] 32 (decision 4) — `wrong key: got 400`, `wrong key: no row: got 0`, `no key: got 400`, `key for another score: got 400`
- [PASS] 33 (decision 4) — `key from yesterday: got 201`, `key from 2 days ago: got 400`
- [PASS] 34 (decision 4, canonical form) — Node `writeDoubleBE` + HMAC for 0, 123456.789, 5e9, 2^53+2, 1.2345678901234567e20, 1e299, 0.1+0.2 → all `201` on the real project; browser `scoreKey('test-salt', 123456.789, 'main', '2026-10-20')` equals the Node reference (`scoreKeyMatchesNode true`)
- [PASS] 35 — `gh api repos/Pszemocny/Gnome-Disposal-Inc/actions/variables` → `VITE_SUPABASE_KEY len=46, VITE_SUPABASE_SALT len=64, VITE_SUPABASE_URL len=40`

Cleanup: all test rows deleted (`delete … where first_name in ('Agent','Check')` → 33 + 8 rows), `select count(*) from public.scores` → 0. Builds with the salt deleted from the scratchpad; `grep -rl <salt>` over the repo and the scratchpad → 0 files. Dev/preview servers 5197, 5198, 5311, 5312 stopped.

Self-check: every new file and branch comes from a plan step or decision 4; no new dependency; no `.env` file; no salt in any file; untouched: factory.ts, robots.ts, input.ts, player.ts, environment.ts.

