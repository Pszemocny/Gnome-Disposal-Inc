# BIGGEST COMBO board

Gotowe, gdy:
- `npx tsc --noEmit -p .` → exit 0, no output
- `grep -c "combo" supabase/leaderboard.sql` → board regex has `combo` and a `scores_combo_check` line exists
- `grep -n "scores_combo_check\|scores_board_check" docs/ai-work/2026-10-21-combo-board.sql` → drop-if-exists + add for both, trigger function not touched

## Problem

PP (2026-10-21 23:24): "Dodaj do gnome osobny typ rekordu największe combo". A new board BIGGEST COMBO (id `combo`): the highest combo in one run, sent with the other boards when the player jumps into the hole.

Task came "bez planu" (PP 2026-10-21: "zrob wszystko z boardu najpierw implementuj wszystko napisz testy ale ich nie odpalaj").

Mini-roast: CONCERNS. Major: (1) board names are checked by `scores_board_check`, not by the trigger: swap that constraint and add `scores_combo_check`, never touch the trigger (the salt lives in its body); (2) machines keep the combo alive, so the combo is recorded exactly as the game shows it, DB bound 1-100000 whole numbers (orchestrator default, PP asked as [G5]); (3) `LocalStore.submit` keeps only listed boards: add `combo`. Minor: daily runs post to the daily board only (no combo row); combo is not formatted as money; own warning text like `W_TIME`; no combo row when 0; the per-run max lives on the run state, not in `stats` (stats survive rebirth).

## Summary

Ladder: rung 2 throughout, the speed board already has every piece (tab, extra row in `send()`, local keep set, CHECK constraint); combo reuses them.

- `GameState.runMaxCombo` (run state, `freshState` sets 0, so rebirth resets it and old saves load as 0); `hole.consume` updates it next to `stats.maxCombo`.
- Leaderboard: tab BIGGEST COMBO, rows show `N COMBO`, best first; `send()` posts a `combo` row only on the main board and only when the run's combo is above 0; a failed combo row gives "Your combo was not saved online.".
- SQL: fresh install has `combo` in `scores_board_check` and `scores_combo_check`; live migration in `2026-10-21-combo-board.sql` (orchestrator runs it).
- Test: scenario `tools/smoke/scenario-remote-lb.js` step R21 (not run, PP: tests once at the end).

## Work progress
- Assumptions: (1) the combo restarts every run (rebirth reloads the page and `freshState` sets `runMaxCombo` 0; the lifetime `stats.maxCombo` stays); (2) a daily run posts only to its daily board (the combo row goes only with the main board); (3) no combo row when the run's combo is 0; (4) the value is the combo as the HUD shows it, machine feeding included (orchestrator default, [G5] to PP); (5) the combo row carries the run's hole level in `level`, like the money row.
- Files: `src/core/state.ts` (field), `src/systems/hole.ts` (one line in `consume`), `src/ui/leaderboard.ts` (tab, footer, `send()`, `render()`, local keep set, `W_COMBO`), `supabase/leaderboard.sql` (fresh install), `supabase/check.sh` (combo 0 / 1.5 / 100001 refused, combo 1 accepted), `docs/ai-work/2026-10-21-combo-board.sql` (live migration), `tools/smoke/scenario-remote-lb.js` (LocalStore abort at boot, R6 daily with combo, R21), CHANGELOG, SPEC, BOARD.
- Scenario R21 (not run, PP: tests once at the end): tab label, URL `board=eq.combo&order=score.desc`, cell `250 COMBO`; a real `hole.consume` at combo 41 gives `runMaxCombo` 42 and the submit posts `main,combo` with score 42; combo row 503 gives the `W_COMBO` toast; a daily-board offer posts only the daily row; combo 0 posts only `main`; `freshState` resets to 0 and keeps the lifetime best; an old save without the field loads 0; LocalStore keeps `combo` rows best first. R6 (daily URL) now sets combo 7 and reports every POST board.
- Run: `CDP_PORT=9391 MAXPOLL=2400 node smoke.mjs run-remote-lb scenario-remote-lb.js` and the daily variant with `URL_QUERY='?lowfx&daily=2026-10-20'`.

Rejected:
- (superseded 2026-10-21, fix plan r5 package PC) The speed row no longer goes out on daily runs: `send()` posts speed and combo on the main board only. PP's FASTEST rule ("sent with every rebirth") is about full runs; a daily lasts 5 minutes and cannot reach level 12 honestly, so nothing PP approved changes. Code-review round: the combo row is capped at 100 000 (`Math.min`) so an endless machine combo is posted at the database limit instead of being rejected.
- Showing the run's combo in the "Your run:" line of the form: nobody asked for it.

Self-check:
- [PASS] `npx tsc --noEmit -p .` → `tsc exit 0`, no output
- [PASS] `grep -n "combo" supabase/leaderboard.sql` → line 15 regex `^(main|speed|combo|daily-...)$`, line 21 `constraint scores_combo_check check (board <> 'combo' or (score between 1 and 100000 and score = trunc(score)))`
- [PASS] `grep -n "scores_combo_check\|scores_board_check\|function" docs/ai-work/2026-10-21-combo-board.sql` → lines 8-9 and 13-14 drop-if-exists + add; "function" only in the comment line 2, no function body
- Discipline: every change maps to the task or a mini-roast finding; the check.sh lines verify the new constraint the same way the speed lines do. Ladder: rung 2 (the speed board pattern). Patterns: same shape as SPEED / W_TIME. No migration run, no commit, no message.
