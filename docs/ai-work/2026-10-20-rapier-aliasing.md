# Rapier "recursive use of an object" freeze (2026-10-20)

PP: no plan ("bez planu"). Mini-roast: not needed (no job, migration, cache or queue).

Gotowe, gdy:
1. `scenario-aliasing.js` (robots chasing gnomes, then Golden Hour swaps every free gnome) → `"exceptions":0`, `"staleTargets":0`, game time keeps advancing.
2. The same scenario before the fix → first error `RuntimeError: unreachable` in `rbTranslation` from `updateRobot`, then `recursive use of an object` every frame (red).
3. `npx tsc --noEmit` → exit 0.

## Problem

PP's release build froze. The console showed `recursive use of an object detected which would lead to unsafe aliasing in rust` every frame, from `computeColliderMovement` in `Player.move`.

That error is only the follow-on. Any Rapier call on a removed body traps inside WASM (`RuntimeError: unreachable`). The trap skips the Rust code that releases the borrow of the body set. From then on every call that needs the body set for writing fails, the player controller first, every frame. Probe: remove a gnome, call `translation()` on its old body → `RuntimeError: unreachable`, next frame the exact PP error.

The first error: when Golden Hour (or a UFO abduction, a greedy gnome running off, a shadow gnome vanishing) removes a gnome that a robot is chasing, the robot reads `tg.body.translation()` on the next frame (`src/entities/robots.ts:170`), because its only check is `isFree(tg)`, and a removed gnome keeps its old state (`walk`, `statue`, `ragdoll`), so `isFree` says yes. `retype` in Golden Hour removes every free gnome, so with robots on the yard this hits almost every time.

## Rapier callbacks in src (all clean)

- `player.ts` `predict` castShape filter `solid`: `byCollider.has`, `col.parent()` (cached JS field), `isHeldBody` (JS compare). No Rapier call, cannot throw.
- `player.ts` `raycast` filter `skip`: `col.parent()`, `isHeldBody`. Clean.
- `player.ts` `kickHit` intersectionsWithShape: pushes handles, acts after. Clean.
- `player.ts` `updatePlacement` filters `solid`, `surface`, `same` and the overlap intersectionsWithShape: Map lookups and cached `parent()` only. Clean.
- `weather.ts` `wetPass` forEachCollider: a JS map walk (not a Rapier query); `collisionGroups()` read inside, `setFriction` after. Clean.
- No event queue drains, no physics hooks, the character controller has no filter.

## Summary

- Fix in `src/entities/gnomes.ts`: `remove(g)` sets `g.state = 'gone'` (new `GnomeState` value) and `isFree` returns false for it. Every holder of a gnome reference that checks `isFree` (robot target, robot pick-up) now drops a removed gnome instead of reading its body. Live gnomes are never `gone`, so no other caller changes.
- Ladder: step 2 (the existing `isFree` guard and state field), one line in `remove`.

Odrzucone:
- try/catch around the frame or around Rapier calls as a safety net: it would hide the next use-after-remove, and the world stays poisoned after the first trap anyway.

## Work progress

Scenario: scratchpad `alias/scenario-aliasing.js`, run with `CDP_PORT=9399 MAXPOLL=400 node smoke/smoke.mjs <out> alias/scenario-aliasing.js` on the 5199 dev server. 4 robots, 40 awake gnomes around them; once at least 2 robots chase a gnome, `events.start('golden')`; 3 game seconds.

- [PASS] 2 (red, before the fix, 2 runs) — `"targetsSwapped":1,"staleTargets":1,"exceptions":205,"first":"RuntimeError: unreachable | at l.rbTranslation | at xI.translation | at updateRobot (robots.ts:174 served = :170 source) | at Machines.effect | at Machines.update | at frame"`, `"second":"Error: recursive use of an object detected which would lead to unsafe aliasing in rust | ... | at Player.move | at Player.update | at frame"` (the PP stack).
- [PASS] 1 (green, after the fix, 2 runs) — `"targetsSwapped":2,"golden":38,"gameTimeAdvancedAfterSwap":true,"staleTargets":0,"exceptions":0` and `"targetsSwapped":3,"golden":39,...,"exceptions":0`.
- [PASS] 3 — `npx tsc --noEmit` → `tsc exit 0`.
- Sweep: 13 existing scenarios (robots, robots-more, robots-rebirth, robots-avoid, robots2, gnomenado, tractor, pound, blower, replay, magnet-gun, strike, land-balance) run with a probe that logs any Rapier method called on a removed body or collider (`alias/tmp-instr.js`). Result: 12 finished with 0 bad uses and 0 `unreachable`/`recursive use` lines (tractor stopped early on its own shop-button step, still 0 bad uses); land-balance finished later with 0 bad uses too, so all 13 are clean.

Side effect: the headless runs post their errors to the dev error log, so `logs/errors.log` has lines from these runs (`HeadlessChrome` user agent, 2026-10-20 ~09:36Z onwards), not from PP.

Self-check: one file changed (`src/entities/gnomes.ts`, 3 lines) plus this note. No change in the four files another agent is editing. `isFree` only changes for removed gnomes, which are never in `gnomes.list`, so loops over live gnomes behave as before.
