# Error reports in Supabase

## Problem

PP (Slack via hub, 2026-10-21 06:06): "Weź jeszcze dodaj tam zapisywanie errorów w superbase koniecznie bo teraz tego nie ma jak ludzie grają prawda?" When a player hits an error on GitHub Pages, nothing reaches us today: `logs/errors.log` works only on the machine serving the game.

Plan: `docs/ai-work/2026-10-21-plan-error-reports.md`, section `## Plan (plan-senior, final)`, executed step by step.

## Decisions taken by recommendation (PP has not answered yet)

1. Q1 a): separate daily caps, 2000 errors and 2000 measurement lines (`source = 'note'`) per 24 h, plus 20 rows per session.
2. Q2 a): the raw browser string (`navigator.userAgent`), cut to 300 characters.
3. Q3 a): one row per distinct message per page load, `count` = repeats in the first 3 s (or until `pagehide`).
4. Q4 a): a lost WebGL context is sent as its own source `webglcontextlost`.
5. Q5 a): `slow-frame` lines are sent like `mouse-jump` (both `note`).
6. Q6 a): the leaderboard's own warnings are not sent.

## Summary

- When a production build has the three `VITE_SUPABASE_*` variables and the publishable key, every error, rejected promise, lost WebGL context and `[gnome]` measurement line goes to `public.errors` (one row per distinct message per page load, at most 20). DEV, a build without the variables, a wrong key or a browser without `crypto.randomUUID` send nothing; the box, localStorage and the beacon work as before.
- The table accepts inserts only (named columns, no select, no update, no delete). A trigger with one advisory lock refuses the 21st row of a session and the 2001st error (or note) in 24 h.
- `build` is `<bundle path>@<7-char commit>`; GitHub Actions sets `GITHUB_SHA`, Vite `define` puts it into the bundle.
- The table is live on the project (created through the Management API). Test rows in `errors` and `scores` are deleted: both tables have 0 rows at the end.

Ladder: `restCall` and `online` are lifted from the existing leaderboard code (rung 2); `fetch keepalive`, `pagehide`, `crypto.randomUUID`, Vite `define` are platform (rung 3); the queue/window logic in `crash.ts` and the scenario are new minimum code (rung 6). No new dependency.

## Odstępstwa od planu

- Step 9 `src/main.ts:305-306` comment: not changed, the brief gives `main.ts` to the parallel performance agent. The comment ("browser console on GitHub Pages") is now incomplete, not wrong.
- Step 9 `.github/workflows/deploy.yml:35` comment: not changed, the file is outside the brief's file list. Done-when 21 therefore has no `deploy.yml` line.
- Step 10 (`ship`, push to `main`): not done, the brief says no commit and no push. Done-when 21 and the after-push half of 27 wait for the orchestrator.
- Dev server: port 5184 with the no-HMR config from the brief instead of 5199.
- Scenario E4: a 50 ms pause between the rejection and the context-lost event, so the two rows arrive in the order the plan names (the rejection event fires one task later); and `console.log` is muted for the synthetic context-lost event, because three.js logs "Context Lost" on it.
- Step 7 block A: the 2000 seed rows are counted from what is already in the window (21 check.sh rows were there), otherwise the seed itself hits the cap.

## Odrzucone

- none

## Work progress

Commands (scratchpad = `/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-disposal-inc/4c1ea029-d602-463e-ad53-1903c38602be/scratchpad`):
- `DEV_PORT=5184 CDP_PORT=9471 MAXPOLL=2400 node tools/smoke/smoke.mjs <scratchpad>/errors3 tools/smoke/scenario-errors.js` (runs 2 and 3 compared)
- `DEV_PORT=5184 CDP_PORT=9472 MAXPOLL=2400 node tools/smoke/smoke.mjs <scratchpad>/rlb tools/smoke/scenario-remote-lb.js` → R1-R15, 0 `ERR`, results equal to the PASS lines in `2026-10-20-supabase-leaderboard.md`
- `npx tsc --noEmit -p .` → no output
- Management API through `<scratchpad>/slb/q.sh` (token from Keychain inline, never printed); URL and publishable key from `gh api …/actions/variables`, salt not used (`VITE_SUPABASE_SALT=dummy`).

R13 result: `errors-build-reload: row present` (real Chrome sends the keepalive POST with its CORS preflight during a reload).

### Review round 1 (code-reviewer → fix-finding, 2026-10-21)

- Lean: `rows` deleted, the cap reads `seen.size` (it always equalled it).
- Every row goes out with `keepalive: true` (a row flushed by the 3 s timer was lost on a reload before the preflight returned): red `KEEPALIVE {"timerRows":20,"allKeepalive":false}` → `true`; E2 below now prints `"keepalive":true`.
- Decision: measurement notes (mouse-jump, slow-frame) take at most 10 of the 20 rows per session, so real errors always keep at least 10: red `E11 {"notes":15,"errors":0}` → `{"notes":10,"errors":10}`. Server trigger unchanged.
- deploy.yml comment now names the error log too (plan step 9).

### Gotowe, gdy (plan `### Done when`)

- [PASS] 1 — scenario → `E1 {"calls":0,"box":true}`
- [PASS] 2 — no-variables build + preview 5313 + FULL=1 → `RESULT {"calls":0,"box":true}`; `grep -rl supabase.co <scratchpad>/noenv | wc -l` → `0`
- [PASS] 3 — `E2 {"url":"https://example.supabase.co/rest/v1/errors","method":"POST","apikey":"sb_publishable_test","prefer":"return=minimal","keepalive":false,"keys":"session,build,source,message,stack,ua,level,land,count","source":"error","count":1,"sessionOk":true,"levelOk":true,"landOk":true,...}`
- [PASS] 4 — fake service_role JWT build + preview 5314 + FULL=1 → `RESULT {"calls":0,"box":true}`, LOGS has `WARNING: VITE_SUPABASE_KEY is not the publishable key: online board off` once
- [PASS] 5 — `E4 {"sources":["unhandledrejection","webglcontextlost"],...}`
- [PASS] 6 — `E4 ... "ctxlostStack":""`
- [PASS] 7 — `E5 {"sources":["note","note"],"first":"mouse-jump {\"ex\":900}",...}`
- [PASS] 8 — `E5 ... "second":"slow-frame {\"dt\":0.15}"`
- [PASS] 9 — `E3 {"posts":1,"count":10}`
- [PASS] 10 — `E3_after {"postsAfter":1,"more":"+13 more"}`
- [PASS] 11 — `E6 {"totalPosts":20,"sentInE6":9,...}`
- [PASS] 12 — `E8 {"postedWithinMs":true,"count":1,"later":0,"keepalive":true,"logs":["errors-e8"]}`
- [PASS] 13 — `E7 {"attempts":2,"savedMentioningNet":0,"timeAdvanced":true}`; LOGS lines without `errors-e` → only the `LOGS:` header
- [PASS] 14 — `E10 {"level":null,"land":null,"source":"note"}`
- [PASS] 15 — `E9 {"stack":3000,"message":1000}`; `ONLY=errors sh supabase/check.sh <url> <key>` → `errors: stack 3001: got 400 want 4xx ok`
- [PASS] 16 — check.sh → `errors: 25 parallel POSTs one session: accepted: got 20 want 20 ok`, `errors: 26th POST: got 400 want 4xx ok`
- [PASS] 17 — rolled-back block A → `rollback | seeded 1979 | error: error log full for today | note accepted`; `count(*)` 21 before and 21 after
- [PASS] 18 — check.sh → `errors: GET: got 401`, `PATCH: got 401`, `DELETE: got 401`, `id in body: got 400`, `source x: got 400`, `session abc: got 400`, each `want 4xx ok`; `failed: 0`
- [PASS] 19 — `grep -nE "console\.(warn|error)|catch" src/ui/leaderboard.ts` → lines 49, 80, 102 (`r.text().catch`, moved into `restCall`), 129, 143, 158 (`console.warn`), all pre-existing; `git diff src/ui/leaderboard.ts | grep -c '^+.*queue\|^+.*note('` → `0`
- [PASS] 20 — `E2_session` run 2 `fa1a5ef0-…` vs run 3 `3e7ad66c-…` → differ; `grep -nE "localStorage|sessionStorage" src/ui/crash.ts` → line 1 (comment) and the two existing `KEY` lines
- [PENDING] 21 — after push (orchestrator): Pages hash change. Local half: new doc lines with `errors` → README 6, SPEC 4, BOARD 1 line (4 mentions); `deploy.yml` not edited (Odstępstwa)
- [PASS] 22 — `E0 {"threw":false,"calls":0,"box":true}`
- [PASS] 23 — `select count(*) from public.scores` → 0 before, 0 after `ONLY=errors sh supabase/check.sh <url> <key>` (no salt argument, usage check passed, only `errors:` lines)
- [PASS] 24 — `GITHUB_SHA=$(git rev-parse HEAD)` build with the real URL/key, salt `dummy`, preview 5315, FULL=1 → row `{"source":"error","message":"Uncaught Error: errors-build-check","count":1,"build":"/assets/index-DJDJsLui.js@eff7a5e","level":1,"land":0}`; `git rev-parse --short=7 HEAD` → `eff7a5e`; deleted → `{"errors":0,"scores":0}`
- [PASS] 25 — rolled-back block B → `rollback | seeded 2000 | note: error log full for today | error accepted`; count unchanged (21)
- [PASS] 26 — `E2_build "/src/ui/crash.ts"` (no `@`)
- [PENDING] 27 — after push (orchestrator): `grep -c <origin/main sha>` in the Pages bundle. Local half: the live build bundle contains the full HEAD sha (`grep -l` → 1 file); `errors-build-reload: row present`

Gotowe, gdy: 25/27 PASS, 2 PENDING (need the push the brief forbids).

### Self-check

- Completeness: every Done-when line run now, results above. README queries run on the live table without error (`[]`).
- Discipline: every new constant, function and file maps to a plan step; no extra options.
- Ladder: the REST call, timeout and key guard are reused from `leaderboard.ts`, not copied.
- Patterns: `errors.sql` follows `leaderboard.sql`, the `check.sh` block reuses `code`/`say`, the scenario follows `scenario-remote-lb.js`.
- Tests: the scenario checks the sink through its real capture paths (window errors, rejections, canvas event, `note`) with only `fetch` stubbed; live checks hit the real table.
- Cleanliness: test rows deleted (`errors` 0, `scores` 0), scratch builds removed, dev server and previews stopped. Untracked `src/ui/stats.ts`, `tools/smoke/scenario-perf.js`, `docs/ai-work/2026-10-21-performance.md` belong to the parallel performance agent.
