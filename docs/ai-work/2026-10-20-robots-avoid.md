# Cleaning robots drive around placed tools (2026-10-20)

Interpretation: bug from PP's playtest. Robots must steer around tools the player placed (trampolines, panels, conveyors, fans, crates), never squeeze into gaps narrower than the truck, back off and pick another way when blocked, and never push tools. Only `src/entities/robots.ts` changes (plus a read-only footprint helper in `machines.ts` only if needed).

## Gotowe, gdy

1. `scenario-robots-avoid.js` step `tramp` (3 trampolines with 0.8 m gaps + panel, conveyor, fan, crate between post, gnomes and hole; 4 reachable gnomes + 1 wedged in a 0.8 m gap) → the 4 reachable gnomes picked and tipped within 60 s, the wedged one picked or given up, longest stall < 5 s, contact time with tools < 0.5 s, every tool moved 0.00 m.
2. `scenario-robots-avoid.js` step `wall` (a 12 m wall of tools between a loaded robot and the hole) → robot reaches the hole and tips (queue 0, gnomes eaten) within 40 s, tools moved 0.00 m.
3. `scenario-robots-avoid.js` step `perf` (4 robots, tools) → `machines.update` cost per frame measured before/after, stays under 0.5 ms; `scenario-robots.js` and `zz-scenario15-scope.js` results as before; `npx tsc --noEmit` exit 0.

## Problem

PP (playtest): "roboty nie omijają ładnie obiektów, które stawiam, i blokują się między trampolinami".

Red run on the current code (`run-avoid-red`, scenario `scratchpad/smoke/scenario-robots-avoid.js`, port 9381):
- `tramp`: after 60 s 0 gnomes eaten, 2 in the bed, 3 left on the grass, longest stall 10.18 s, truck touching tools for 51.71 s of 60, the crate pushed 0.66 m.
- `wall`: after 40 s 0 of 5 eaten, still `drive`, touching the wall for 30.83 s of 40.
- `perf` (4 robots, two trampoline layouts, 24 gnomes, 30 s): `machines.update` avg 0.108 ms, p95 0.2 ms, max 1.7 ms per frame; 1 gnome eaten; robots touching tools 11.6-22.2 s each; tools (crates) pushed up to 4.69 m.

Cause, in the current code: the truck steers straight at its waypoint and only reacts after 1.5 s without progress, with a 3 m sidestep to a random side. That sidestep does not look at tools either, so in a row of trampolines it lands in the next trampoline or the next narrow gap. A trampoline (0.4 m high) is a wall for the truck. The crate is a dynamic body with the same dominance as the 150 kg truck, so the truck shoves it.

A second cause showed up while testing the fix: the truck stopped dead with nothing around it, at z = hole ± 1.13 (= 0.7 × hole radius). The ground is four overlapping slabs (`environment.ts`, `rebuildHole`), and the sharp bottom edge of the truck's cuboid catches on the seam between two slabs. With zero friction and a velocity set every frame it just sits there; three of five runs stalled for 15 s this way.

## Summary

All in `src/entities/robots.ts`; `machines.ts` untouched (the existing `MACHINE_BOX` export is enough).
- Planning grid (0.5 m cells) over the stretch between the truck and its goal, 6 m margin, rebuilt every 0.5 s or when the goal changes. Blocked: every placed tool except robots (live body pose, `MACHINE_BOX` footprint grown by 0.7 m, so only gaps wider than 1.4 m stay open; the truck is 1.1 m wide), the hole (radius + 1.1 m), the fence. Tilted tools block the square around their bounding sphere. Tools fully above the truck (stacked) are skipped. Cells within 0.8 m of the truck are free, so a truck next to a tool can leave.
- Straight line clear → drive straight as before. Otherwise A* (8 neighbours, no diagonal squeeze past corners) to any cell close enough to the goal (gnome 1.8 m, hole edge + 1.7 m, post 1.0 m). No way inside the window → one more search over the whole yard (a long wall). The truck drives at the farthest of the next 12 path nodes it can see in a straight line.
- Gnome the plan cannot reach (e.g. wedged in a 0.8 m gap) → dropped for this trip at once. Gnome not 0.5 m closer for 8 s → dropped. Driving/returning without progress for 15 s → back at the post with a puff (same code as "fell into the hole"). Waiting for the player does not count.
- Stuck (old 1.5 s check): back off 0.6 s at half speed if the grid is free 1.3 m behind, then the old 3 m sidestep, but only to a side whose straight way is free; replan.
- Truck collider swapped in `initRobot` to a round cuboid of the same outer size (0.45/0.2/0.7 + 0.1 radius = 0.55/0.3/0.8), mass stays 150 (measured). Fixes the seam stall.
- Drabina: footprints rung 2 (`MACHINE_BOX`), round cuboid rung 3 (Rapier shape). Planner rung 6: nothing in the repo plans paths and no installed dependency does; feelers / avoidance forces fail exactly in PP's case (a row of trampolines is a concave wall, the truck has to go round its end), so a tiny grid A* is the simpler robust option. Cost stays flat (perf numbers below).

Rejected:
- House, desk, chairs, flamingos, other trucks are not in the grid: the request is about placed tools; the stuck back-off/sidestep handles the rest as before.
- Crate dominance (the truck can still shove a crate it touches): the plan keeps the truck off the crate; the body setup is in `machines.ts`, out of scope.

## Work progress

- [PASS] 1 tramp — `CDP_PORT=9381 MAXPOLL=2400 node smoke.mjs run-avoid-green scenario-robots-avoid.js` → `tramp: t 31.88 s, eaten 4, left [4] (the wedged one, given up), stall 0.33 s, contact 0.05 s, toolsMoved 0`. Same in `run-avoid-g2` (31.05 / 0.33 / 0.05) and two repeats (`run-avoid-dbg6`, `dbg7`: 31.92 / 31.0 s, stall 0.33, contact 0.03).
- [PASS] 2 wall — same run → `wall: t 9.62 s, eaten 5, queue 0, stall 0.22, contact 0, toolsMoved 0` (red: 0 eaten after 40 s).
- [PASS] 3 perf — same run → `machines.update` avg 0.109 ms, p95 0.2 ms, max 1.5 ms (red: 0.108 / 0.2 / 1.7); 14 gnomes eaten in 30 s (red: 1); tools moved 0 (red: 4.69 m); contact per robot 0-1.53 s (red: 11.6-22.2 s).
- [PASS] 3 regression `scenario-robots.js` (`run-avoid-regrob2`) → every value as in `final3-robots.txt` (c1 0.67 s, c2 tFull 4.27, minHoleDist 2.86 > 2.6, c10 waits 0 → 2.5, c15 3.7 m/s, ...), `LOGS:` empty.
- [PASS] 3 regression `zz-scenario15-scope.js` → `run-avoid-reg15` identical to `final5-s15.txt`. Later runs (`run-avoid-reg15b`, `c`) shift lift y 1.25 → 1.18, green pitch 0.05 → 0.15, hoop y 1.35 → 1.54, crate inside 10 → 9; the scenario places no robot, and the shift came with another session's edit of `src/main.ts` / `src/ui/crash.ts` at 11:19. All checks there still true.
- [PASS] 3 `npx tsc --noEmit` → exit 0. `grep "Math.min(1, dt" src/entities/robots.ts` → nothing.

## Orchestrator check (2026-10-20)

- Worst case the implementer did not measure: Dark Forest (half 58), 4 robots each inside a ring of 16 crates, gnomes outside the ring inside the 6 m work area (`scratchpad/smoke/zz-robot-walled.js`) → `machines.update` avg 0.085 ms, p95 0.2 ms, max 0.8 ms over 1201 frames. The yard-wide search is cheap enough; nothing to change.
- The `zz-scenario15-scope.js` value shift: the harness switched from SwiftShader to the Metal GPU at about 11:20 (60 fps instead of 7), so frame-counted waits in that scenario now cover less game time. Not caused by this change or by the crash report.

Self-check: only `robots.ts` and this note changed. No body changed inside a Rapier callback (the planner reads poses, no queries). New motion (backing) is driven by `dt`. Every new constant and branch maps to the request: avoid tools (grid, A*), gaps wider than the truck (CLEAR), back up and turn (backT), give up a gnome (GIVE_UP / unreachable), last resort to the post (RESCUE), cost (REPLAN, window).
