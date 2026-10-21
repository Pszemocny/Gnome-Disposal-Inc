# Leaderboard: one name or nickname, MOST MONEY, FASTEST LVL 12

## Problem

PP (2026-10-24): the online board stores only a first name or a player name, never an official first and last name; add a board for the most money (earned, held plus spent) and a separate board for the fastest climb to hole level 12. Answers: "1. a. 2. a (ale ogranicz je do 20 znakow) 3. za kazdym razem gdy wskoczysz", and "wpisywanie sie do leaderboard dajemy tylko po wskoczeniu pod escape wyswietlamy sama liste bez formularza".

Plan: `2026-10-24-plan-leaderboard-name.md`, section `## Plan (plan-senior, final)`.

Interpretation (from the PP decisions under `### Decisions for PP`):
1. MOST MONEY = today's per-run board of `totalEarned` (earned this run, spent or not), only relabelled.
2. A name has 1-20 characters: letters, digits, spaces, `. _ - '`, at least one letter or digit. The database checks 1-20 too.
3. The form shows only after jumping into the hole ("SUBMIT YOUR RUN") and at the end of a daily run. The pause-menu Leaderboard shows the boards only.
4. Every run that reached level 12 posts its time together with that rebirth submit.

## Summary

- The board asks for one "Name or nickname" (1-20 characters); online and locally only `name` is stored. Old local entries with first and last show as "first last" and are rewritten on the next submit.
- Tabs MOST MONEY (today's per-run `totalEarned` board), DAILY and FASTEST LVL 12 (`board = 'speed'`, ascending, `h:mm:ss`).
- `runTime` counts unpaused real seconds per run (same branch as `playTime`); `maxLevelAt` is frozen at the level-12 level-up. The rebirth submit posts the money row and, when `maxLevelAt` is set, the time row; then the board closes as before.
- The pause-menu Leaderboard has no form; the warning line moved out of the form so "Online board unreachable" still shows there. The daily end keeps its form.
- Live database changed through the Management API (columns, checks, trigger with the salt from Keychain, never printed or stored); `check.sh` → `failed: 0`; check rows deleted.

Deviations from the senior plan:
1. No `timeSent` field and no `saveState` after the submit (plan step 5b, R3, R8): PP's later decision puts the form only on the rebirth screen, so a run has exactly one submit and the next run starts fresh; "every run that reached 12 posts its time" needs no flag. Done-when 16-18 and 28-30 were rewritten around the toast and the second run.
2. Names 1-20 (PP), also in the database check (`scores_name_check`), plus a `21-char name` case in `check.sh`.
3. `send()` lost its pause-menu branch (re-render, "Score saved."): the form never shows there any more, so after the submit the board always closes and `done()` runs; warnings come as a toast, as the rebirth path already did.
4. `loadState` has no explicit `maxLevelAt` line: the `...base` spread already gives `null` to an old save.
5. Live data fact differs from the plan: the table had 1 real player row (main board, level 12, 2026-10-21), not 0. The migration kept its first name as `name` and dropped its 1-character last name, which is what PP asked for.
6. Done-when 27 grep `first_name|last_name` finds one line: the `check.sh` "old columns" case from plan step 7, which posts the old column names to prove they are refused.

Rejected:
- none.

## Work progress

### Gotowe, gdy (from `### Done when`, adapted to the PP decisions; deviations below)

1. R1 (pause menu) → `formHidden true`; R16 (offer) → `inputs ["name"], placeholder "Name or nickname", autocomplete ["off"], maxLength 20`
2. R16 → `ok: callsPOST 1, body.name "Ania_42", keys "name,score,level,board,key", localName "Ania_42"`
3. R16 → `html: msg "Name: no HTML, please.", calls 0`
4. R16 → `long: msg "Name: 1-20 characters."`, `blank: msg "Name: 1-20 characters."`
5. R16 → `bang: msg "Name: letters, digits, spaces, . _ - ' only."`
6. R16 → `legacyRow "1. Old Local", legacyStored {"name":"Old Local"}`
7. R2 → `rows ["1. Alpha","2. Beta"], shown 2, in 3`
8. R1 (local) → foot `Score = money earned this run, spent or not. FASTEST = time to hole level 12. Esc closes.`; R2 (remote) → foot contains `Your name or nickname is shown publicly online`
9. check.sh → `old columns` 4xx ok, `30-char name` 4xx ok, `21-char name` 4xx ok, `valid row` 2xx ok
10. check.sh → `select=id`, `select=key`, `select=*` 4xx ok, `valid row stored: got 1 want 1 ok`
11. `rg -n "totalEarned \+=" src` → exactly `src/systems/hole.ts:83`
12. `rg -n "totalEarned -=" src` → no output
13. R18 → `unpausedDelta > 0.3, pausedDelta 0`
14. R18 → `level 12, maxLevelAtSet true, diff < 0.1, frozen true`
15. R17 → run line contains `· Lvl 12 in 0:20:34`; R4 → run line lacks `Lvl 12 in`
16. R17 → `posts ["main","speed"], speedBody {score:1234, level:12}, keyHex true, localRows 2, done 1`
17. R17 → second run (new offer, `maxLevelAt` set again) → `posts ["main","speed"]` again (every run that reached 12)
18. R17 → `fail` (speed POST 503): toast `Could not reach the online board: score saved on this computer only.`, `localRows 2`, `done 1`
19. R4 → `calls "POST"` (one POST without a time; the board closes after the submit)
20. R19 → `rebirth: posts 2, done 1, fresh {runTime:0, maxLevelAt:null}`
21. R19 → url contains `board=eq.speed&order=score.asc&limit=10`, rows `["1. Fast"]`, cells `["0:10:00","Lvl 12"]`
22. R19 → `localSpeedKept 50, ascending true, mainKept unchanged`
23. check.sh → `speed 119 s` 4xx, `speed level 11` 4xx, `speed 120 s lvl 12` 2xx, `board x` 4xx, `40 parallel POSTs on daily-…: accepted: got 30`
24. `rg -n "runTime: parsed.runTime \?\? parsed.stats\?.playTime" src/core/state.ts` → 1 line
25. R17 → `noTime: posts ["main"]` with `maxLevelAt null, holeLevel 12`
26. `rg -n "score >= 120" supabase/leaderboard.sql` → 1 line; `rg -n "daily" src/ui/leaderboard.ts` shows no speed condition
27. `rg -n "nazwa gracza|FASTEST LVL 12" docs/SPEC.md` ≥ 2; `rg -n "name like 'Check-%'" README.md` → 1; `rg -n "build = 'check.sh'" README.md` → 1; `rg -n "nickname" CHANGELOG.md` ≥ 1; `rg -n "first_name|last_name" src supabase tools README.md docs/SPEC.md` → no output
28. R17 → `reject` (speed POST 400 check constraint): toast `The online board rejected this score: saved on this computer only.`, `localRows 2`, `done 1`
29. R17 → `clock` (speed POST 400 bad key): toast contains `check your computer's date and time`
30. `rg -n "timeSent" src` → no output (not needed: one submit per run, see deviations)
31. check.sh → `speed 120 s lvl 12` 2xx and `daily-2099-01-01` 4xx in one run; `rg -n "new.board like 'daily-%'" supabase/leaderboard.sql` → 1; `rg -n "daily board must be today or yesterday" supabase/leaderboard.sql src/ui/leaderboard.ts` → 2
32. Release order: live SQL and `check.sh … → failed: 0` done in this run, before the orchestrator's push

### Ladder

- `runTime`, `maxLevelAt` (rung 6): no per-run clock exists; `stats.playTime` survives rebirth.
- `clock()` in `format.ts` (rung 6): no helper formats `h:mm:ss`; `secs()` gives whole seconds only.
- Name rule, `SPEED`, `rank` sort, keep-list (rung 5, one line each).
- SQL checks (rung 3, platform): the database is the trust boundary.
- `timeSent` from the plan (rung 1, dropped): with the form only on the rebirth screen a run has exactly one submit.

### Commands run

- `npx tsc --noEmit` → exit 0
- `DEV_PORT=5165 CDP_PORT=9391 MAXPOLL=2400 node tools/smoke/smoke.mjs <scratchpad>/slb/run-lbname tools/smoke/scenario-remote-lb.js` → all 19 steps, 0 `ERR`, no page logs
- `URL_QUERY='?lowfx&daily=2026-10-20' … scenario-remote-lb.js` → `R6_daily_over: open true, form true, postBoard "daily-2026-10-20", keyHex true, done 1`
- `FAKELOCK=1 DPR=1 DEV_PORT=5165 CDP_PORT=9372 … scenario-esc.js` → `17_leaderboard_esc lb=false menu=visible paused=true opened=true`, all other steps as before
- Screenshots (offer with a bad name, pause board on FASTEST): layout checked by eye, message under the form, no form in the pause board
- Live: constraint names read first (`scores_first_name_check`, `scores_last_name_check`, `scores_board_check`); migration in one transaction → HTTP 201; schema re-read: columns `id,name,score,level,board,key,created_at`, grants on `name`, new checks, trigger `like 'daily-%'`
- `sh supabase/check.sh <url> <key> <salt>` (url/key from the GitHub variables, salt from Keychain) at 09:48 UTC → `failed: 0`
- Cleanup `delete … where name like 'Check-%'` and `build = 'check.sh'` → `check_scores 0, check_errors 0, all_scores 1`

### Kompletność

1. [PASS] R1 `formHidden true`; offer `inputs ["name"], placeholder "Name or nickname", autocomplete ["off"], maxLength 20`
2. [PASS] R16 `ok: callsPOST 1, bodyName "Ania_42", keys "name,score,level,board,key", localName true`
3. [PASS] R16 `html: msg "Name: no HTML, please.", calls 0`
4. [PASS] R16 `long` and `blank: msg "Name: 1-20 characters."`; `twenty` (20 chars) posts 1
5. [PASS] R16 `bang` and `emoji: msg "Name: letters, digits, spaces, . _ - ' only."`
6. [PASS] R16 `legacyRow "1. Old Local", legacyStored {name "Old Local", keys "score,level,at,board,name"}`
7. [PASS] R2 `rows ["1. Alpha","2. Beta"], shown 2, in 3`
8. [PASS] R1 foot `Score = money earned this run, spent or not. FASTEST = time to hole level 12. Esc closes.`; R2 `remoteFoot` contains `Your name or nickname is shown publicly online`
9. [PASS] check.sh `old columns: got 400`, `30-char name: got 400`, `21-char name: got 400`, `valid row: got 201`
10. [PASS] check.sh `select=id/key/*: got 401`, `valid row stored: got 1 want 1 ok`
11. [PASS] `rg` → `src/systems/hole.ts:83:    s.totalEarned += v;` only
12. [PASS] `rg "totalEarned -="` → no output
13. [PASS] R18 `unpausedDelta 0.533, pausedDelta 0`
14. [PASS] R18 `level 12, maxLevelAtSet true, diff 0, frozen true`
15. [PASS] R17 `runLine "Your run: $123k · Hole lvl 12 · Lvl 12 in 0:20:34"`; R4 `runLineLacksTime true`
16. [PASS] R17 `posts ["main","speed"], speedBody {score 1234, level 12}, keyHex true, localRows 2, done 1`
17. [PASS] R17 `secondRun ["main","speed"]`
18. [PASS] R17 `fail: toast ["Could not reach the online board: score saved on this computer only."], localRows 2, done 1`
19. [PASS] R4 `calls "POST"`
20. [PASS] R19 `rebirth: posts 2, done 1, fresh {runTime 0, maxLevelAt null}`
21. [PASS] R19 url `…board=eq.speed&order=score.asc&limit=10`, `rows ["1. Fast"], cells ["0:10:00","Lvl 12"]`
22. [PASS] R19 `localSpeedKept 50, ascending true, fastestKept true, mainKept 3`
23. [PASS] check.sh `speed 119 s: 400`, `speed level 11: 400`, `speed 120 s lvl 12: 201`, `board x: 400`, `40 parallel POSTs on daily-2026-10-20: accepted: got 30`
24. [PASS] `rg` → `159:      runTime: parsed.runTime ?? parsed.stats?.playTime ?? 0,`
25. [PASS] R17 `noTime: posts ["main"], holeLevel 12`
26. [PASS] `rg "score >= 120"` → line 18; `rg daily src/ui/leaderboard.ts` → no speed condition
27. [PASS] SPEC 3 lines, README `name like` 1 and `build = 'check.sh'` 1, CHANGELOG `nickname` 1; `first_name|last_name` → only the intended `check.sh` "old columns" case (deviation 6)
28. [PASS] R17 `reject: toastIsReject true, localRows 2, done 1`
29. [PASS] R17 `clock: toastIsClock true`
30. [PASS] `rg timeSent src` → no output
31. [PASS] check.sh `speed 120 s lvl 12: 201` and `daily-2099-01-01: 400` in the same run; `rg like 'daily-%'` → 1; `rg "daily board must be today or yesterday"` → 2 (sql:42, leaderboard.ts:155)
32. [PASS] live SQL applied and `check.sh failed: 0` at 09:48 UTC, before any push (the orchestrator pushes next)

### Self-check

- Discipline: every new field, constant and branch maps to PP's words or a plan step; `timeSent` dropped as unneeded.
- Ladder: `clock()` is the only new helper (no `h:mm:ss` on disk); `legacy` maps instead of dropping old local rows (plan step 5).
- Patterns: same store interface, same toast path the rebirth already used, same check.sh `say` cases.
- Tests: through the public UI (form, tabs, fetch stub), localStorage and the live REST API; no warnings in the page logs.
- Cleanliness: no stray files in the repo; scratch files and the salt-free migration template stay in the scratchpad.
