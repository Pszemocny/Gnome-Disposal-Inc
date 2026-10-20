# Remove the trick-shot slow-mo (2026-10-20)

Gotowe, gdy:
1. `grep -n "bullseyes" src/systems/slowmo.ts` → nothing (no trick shot slows time).
2. Headless: `stats.bullseyes++` (BULLSEYE scored) → over the next 30 frames game time / real time ≈ 1 (min `slowmo.scale` = 1).
3. Headless: Tab wheel open → `wheel.timeScale` settles at 0.25; combo 60 / King still start a slow-mo (they are not trick shots, the order keeps them).

## Problem

PP: "usun tez to ze czas zwalnia po niektorych trickshotach bo myslalem ze gra sie zacina". The slow-mo after a BULLSEYE looked like the game stuttering.

## Summary

- The only trick-shot trigger of `Slowmo` was BULLSEYE (`stats.bullseyes`). Removed it. Combo 60 / 100 and an eaten King still trigger, so `slowmo.ts` stays (the order: "otherwise remove only the trick trigger").
- The trick itself is unchanged: payout, big text, gold sparks, fanfare, shake.
- The Tab tool wheel slow-down (`wheel.ts`) is untouched.
- Legend text and `docs/SPEC.md` updated, CHANGELOG bullet added.
- Ladder: step 1, deletion only.

## Work progress

- [x] `src/systems/slowmo.ts`: BULLSEYE trigger and its counter removed; `src/ui/legend.ts` text; `docs/SPEC.md` (mechanic + PP decision); `CHANGELOG.md` "next build".
- Scenario: `/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-boozed/844ac005-e3c6-4341-b0ea-34b547159d26/scratchpad/smoke/scenario-no-trick-slowmo.js` on the live game (`wheel.timeScale * slowmo.scale`, the factor `main.ts` uses). First run had the wheel at 1: the scenario opened it by flag and the next `update` closed it because Tab was not held; fixed in the scenario by dispatching a real Tab keydown.

Self-check (local, dev server 5199, CDP 9383):
- [PASS] 1 — `grep -n "bullseyes" src/systems/slowmo.ts` → no output (exit 1).
- [PASS] 2 — `CDP_PORT=9383 node smoke.mjs run-no-trick-slowmo scenario-no-trick-slowmo.js` → `"bullseye_30_frames":{"minFactor":1,"meanRatio":1}`.
- [PASS] 3 — same run → `"wheel":{"timeScale":0.25,"opened":true,"closedAfter":true}`, `"king_still_slows":{"minScale":0}`; `LOGS:` empty.
- `npx tsc --noEmit` → exit 0, no output.
- Discipline: deletion only, nothing added to the game code.

Rejected: none.

Uncertain: PP said "po niektórych trickshotach". A combo of 60 / 100 is often reached during a run of trick shots and still slows time, so PP may still see a "stutter" there. The order keeps combo and King, so they stay; PP decides.
