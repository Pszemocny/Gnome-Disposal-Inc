# Robot route cache (F3 fix)

Interpretation: PP chose option "b" on Slack (2026-10-21 16:44): fix F3 instead of accepting it. Shape agreed in the order: cache the robots' route map and rebuild it only when placed tools change, so per-frame planning is mostly a lookup. Scenarios are run once at the end by the orchestrator; this task ran one short probe only.

Plan path: none. The order carries PP's decision and the agreed shape (cache + distance fields); one production file (`src/entities/robots.ts`), no save data, no UI.

Gotowe, gdy:
1. `npx tsc --noEmit -p .` → exit 0
2. scenario-tree-expansion F3 → `updateP95 <= 2.0` and `updateMax <= 8` (run by the orchestrator, 30 s)
3. scenario-tree-expansion F3b → a belt placed across a truck's way shows up in its grid (`after.cell === 1`), the truck plans round it (`around >= 2.3`) and reaches the hole (`arrived`)

## Problem

On Dark Forest with 10 belts at Wide Belt 3 in a wall and 12 robots, the worst frames were 10-18 ms (gate 8 ms). Each robot built its own grid and ran A* every 0.5 s; when the local search failed (the wall closes the gaps), it built a second, yard-wide grid and ran A* over the whole yard, about 3-4 ms, and several robots did this in one frame. Before numbers (from `2026-10-24-tree-and-endgame.md`, "F3: what I measured and tried"): belts 3.1 m + 12 robots: max 11-18 ms, 8-16 frames over 8 ms; last full F3 run `updateP95 1.1, updateMax 11.4`.

## Summary

Ladder: rung 6 (minimum code). Nothing in the repo or in three caches a grid or computes a distance field; the existing A*, `clear`, `blocked` and the tool-blocking code are reused as they are.

- One yard map per truck height (0.25 m bands centred on a truck on the ground), shared by all trucks: the whole-yard grid (tools at the truck's height, factory, hole, fence), a component label per free cell, and a distance field per goal.
- The map is thrown away when `yardSig` changes: a hash of every placed tool's position, rotation and box width (Wide Belt), the factory footprints, the hole centre and radius, and the yard size. It is checked at most once per frame and only when a truck plans. So place, remove, move (G), widen and a tool knocked over all rebuild it; robots are not in the hash.
- Driving to the hole and returning to the post read a distance field (Dijkstra with costs 5/7 over 8 rotating buckets, about 2 ms on Dark Forest; a binary-heap version measured 5 ms in node). At most one field is built per frame, and not in the frame that rebuilt the map; a truck that has to wait keeps its way (or drives straight at a new goal) for one frame more.
- Seeking a gnome: the component labels say first whether the gnome is reachable. Unreachable = dropped at once, no search (before: a failed yard-wide A*). Reachable = A* on the truck's copy of the yard grid (one search instead of local + yard-wide), with reused scratch arrays.
- Each truck keeps its own copy of the map (copied every plan, about 54 KB) with the cells around it freed, as before, so a truck standing next to a tool can still leave.

Expected after: `updateMax` under 8 ms, p95 unchanged (~1 ms). Probe (one run, 20 s instead of 30 s, private dev server on 5187): `{"updateP95":1,"updateMax":7.5,"worst":[[27,7.5],[152,5.9],[50,4.6],[101,3.7],[0,2.4],[132,1.9]],"stepP95":1.5,"robots":12,"gnomes":300}`. The two worst frames are in the first 3 s, when the map and the first fields are built. After the probe the map build and the first field were split into separate frames (`fieldTime` set in `yardMap`), which should lower frame 27; that change is not measured.

Behaviour kept: same 0.5 m grid, same CLEAR, same height filter (truck height snapped to its band, ±0.125 m), same unreachable-gnome drop, same 4 x REPLAN after an unreachable plan.

## Work progress

- `src/entities/robots.ts`: `buildGrid(p, goal, margin)` → `buildYard(y)` (whole yard, no escape); new `yardSig`, `yardMap`, `truckGrid`, `startCells`, `goalCells`, `labels`, `reachable`, `field`, `descend`; A* heap moved to module level, scratch arrays reused; `route` uses them; `MARGIN` removed.
- `tools/smoke/scenario-tree-expansion.js`: new F3b check.
- `docs/SPEC.md`: one decision line under "Roboty sprzątające".
- Probe F3b: `{"placed":true,"before":{"cell":0,"path":0,"reached":true},"after":{"cell":1,"path":13,"reached":true,"around":2.41},"arrived":true}`.

Samokontrola:
- [PASS] 1 — `npx tsc --noEmit -p .` → `tsc exit 0` (after the last edit)
- [PASS, probe] 2 — 20 s probe: `updateP95 1, updateMax 7.5`. The final 30 s run is the orchestrator's.
- [PASS, probe] 3 — probe F3b JSON above. The final run is the orchestrator's.
- Discipline: every new function serves the cache, the fields or the reachability check from the order. No CHANGELOG bullet (players do not notice).
- Patterns: grid and A* code style copied from the existing functions.

## Deviations

- When a truck can reach neither the hole nor its post, it now gets one waypoint (the cell of its part of the yard nearest the goal) and drives there in a straight line, instead of an A* path to that cell. Before, it also ended up waiting at that cell.
- Distance-field paths use costs 5/7 (diagonal 1.4 instead of 1.414); the path can differ by a hair from A*'s.

## Odrzucone

- Replanning every truck as soon as the map changes: when a tool is carried, the map changes every frame and all 12 trucks would plan in one frame. Trucks keep the 0.5 s replan timer.
- A slow timer that rebuilds the map anyway: the hash already sees any tool that moves (pushed, knocked over), so a timer would add nothing.
- Fields for gnome targets: gnomes move, so a field per gnome would be rebuilt all the time; reachable gnomes use one A*.

## F3 regression 9.7 ms (2026-10-22)

Problem: tree-expansion F3 gave `updateMax 9.7` (worst frame 207, p95 1 ms), gate 8 ms.

Measured (probe in the session scratchpad, F3 set-up, 30 s, per-frame timers on `machines.effect` per tool type and on each route job, instrumentation removed afterwards):
- Before: max 7.1 ms. Frame 28 = map build in one frame: `buildYard` 2.7 + `labels` 2.1 + 12 gnome scans 0.8. Frames 179 / 1029 / 1177 = one distance field each, 4.2-5.5 ms (not the ~2 ms the first note expected), plus `descend` up to 1.1 ms. A* at most 1.6 ms. Fans 0.3-0.6 ms and belts 0.1-0.3 ms per frame. No frame ran two heavy jobs; the worst frames are single jobs that are too big, and with a noisy frame on top they reach 9.7.
- Also found: a map build did not check `searchTime`, so a second truck height band (or a new map) could be built in a frame that already ran a field or A*.

Fix (`src/entities/robots.ts`):
- The map build, the component labels and each field are separate heavy jobs, at most one per frame: the grid in one frame, the labels in the next, then the fields. `yardMap` returns null when it would have to build in a frame that already ran a job; the truck keeps its old way and plans next frame.
- A field is built a slice per frame (`FIELD_STEP` = 12000 queued cells, about 2.7 ms at most on the Dark Forest), one field at a time; a truck asking for another goal meanwhile pushes the running field on and waits for its own. A field of a thrown-away map is dropped with its queue.
- Gnome A* waits while the map has no labels yet (it needs them to know if the gnome is reachable), instead of dropping the gnome.
- Behaviour cost: on the Dark Forest a truck waits a few frames longer for a fresh way to the hole or its post (before: one frame); it keeps driving its old way meanwhile.

After:
- Probe: max 5.1 ms (frame 27: grid 2.6 + scans 0.9), field slices at most 2.7 ms, labels 2.2 ms alone, 1 frame over 5 ms in 1801.
- tree-expansion alone: `54 PASS`, F3 `updateP95 1.1, updateMax 4.7`, worst `[[28,4.7],[50,3.6],[186,3.1],[797,3.1]]`. F3b `after.path 12, around 2.48, arrived true`; its wait after placing the belt changed from a fixed 2 frames to "until the truck has a path, at most 30 frames", because the map, labels and field now take a few frames.
- robot-stations `36 PASS`; auto-lands `33 PASS`; `npx tsc --noEmit -p .` exit 0.
