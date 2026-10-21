# No trampoline TRICK lesson

## Problem

PP (2026-10-21): "wywal ten goal z trickshotem po trampolinie bo to trudno sie robi". The LESSON "TRICK x3: buy a Trampoline, bounce a thrown gnome off it into the hole" was too hard to do on purpose.

## Summary

- The TRICK lesson is removed from the lesson list in `src/systems/goals.ts`, together with its now unused `trampoline` arrow target.
- The TRICK x3 trick shot itself stays in the game; only the lesson is gone. Old saves that already did the lesson keep their reward; saves that did not simply never see it.
- SPEC updated (lesson list, arrow example).

## Work progress

- `tools/smoke/scenario-tutorial-goals.js`: check 18 now asserts that after AIR at hole level 2 the panel says "Next lesson at hole level 3" (no TRICK); check 28 shows the AIR lesson instead of TRICK; the lesson id lists drop `trick`.
- `npx tsc --noEmit -p .` clean; scenario-tutorial-goals.js with FAKELOCK=1: 30 PASS, 0 FAIL, `LOGS:` empty.
