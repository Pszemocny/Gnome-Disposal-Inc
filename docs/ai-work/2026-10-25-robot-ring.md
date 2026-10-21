# Robot area ring after a move

## Problem

PP (2026-10-24, verbatim): "po przeniesieniu robota jego obszar nie rysuje sie".
Scope of this note: steps 1-2 of `## Plan (plan-senior, final)` in `2026-10-24-plan-robot-stations.md` (commit 1: probe A0, grounding the robot post in `initRobot`, ring probes A1-A4). The station work (steps 3-9) is not part of it.

Gotowe, gdy (from the plan's `### Done when`, the rows of steps 1-2):
1. A0: `rs → A0 {posY_pitch0<0.05, posY_pitch5<0.05, ringOnGrass:true}`, red line with `posY` > 0.3 pasted before the fix.
2. A1: `rs → A1 {markerInScene:true, ringScale:6, ringWorldDist<0.05, inFrustum:true, ringPixels>=40, oldPostPixels:0}`
3. A2: `rs → A2 {afterX:{markers:0}, afterPlace:{markers:1, ringPixels>=40}}`
4. A3: `rs → A3 {reloadMarkers:2, blueprintMarkers:2}`
5. A4: `rs → A4 {postMoved:true, markerAtHome:true}` (step-out to `holeRadius + 1.0 + 0.6`; `stationAtHome` and the `+1.3` belong to step 4)
6. Regression: `scenario-tree-expansion.js` U3, `scenario-balance.js` E3, `scenario-factory.js` green; `npx tsc --noEmit` exit 0.

## Summary

When the player moves a robot with G and clicks while aiming level or slightly down at a point further than 7 m, the placement ray hits nothing. The ghost then floats at eye height along the view line, and nothing in the placement check reads its height. So the post was saved 0.6-1.2 m above the grass. The area ring hangs there too, seen almost edge-on as a thin line, which is what PP saw.

Fix: `initRobot` casts a ray straight down from the post (against ground and fixed tools, own body excluded) and puts the post, the marker and the truck body on what it hits. The same line grounds old saves and blueprints with a hovering post, because every path builds the robot through `initRobot`.

Ladder: rung 5 (one ray with Rapier's existing `castRay`, the same group test as `weather.ts:107`). The thicker ring (plan step 1b) was not needed: on a grounded post the ring has about 1900 visible pixels, far above 40.

## Work progress

Red run, before the fix (`FAKELOCK=1 DPR=1 DEV_PORT=5166 CDP_PORT=9431 MAXPOLL=1200 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-robot-stations.js`):
- `FAIL A0 {"pitch0":{"looked":true,"placing":"robot","ghostY":1.23,"blocked":false,"posY":1.23,"moved":11,"ringWorldY":1.27,"ringPixels":1103},"pitch5":{"looked":true,"placing":"robot","ghostY":0.62,"blocked":false,"posY":0.62,"moved":11.03,"ringWorldY":0.66,"ringPixels":1576},"ringOnGrass":false}`
- `PASS A1 {"posY":0.02,"moved":7.9,"markerInScene":true,"ringScale":6,"ringWorldDist":0,"ringWorldY":0.06,"inFrustum":true,"ringPixels":1891,"oldPostMarkers":0,"oldPostPixels":0}` (aiming down, the ray reaches the grass: the bug needs a far aim)
- `PASS A2 {"afterX":{"markers":0,"robots":0},"afterPlace":{"markers":1,"posY":0.02,"ringPixels":1834}}`
- `PASS A3 {"reloadMarkers":2,"blueprintMarkers":2,"robots":2}`
- `PASS A4 {"level":2,"r0":1.6,"r1":2,"startDist":2,"postDist":3.6,"keep":3.6,"postMoved":true,"markerAtHome":true}`

Green run, after the fix (same command):
- `PASS A0 {"pitch0":{"ghostY":1.23,"posY":0,"moved":11,"ringWorldY":0.04,"ringPixels":1916},"pitch5":{"ghostY":0.62,"posY":0,"moved":11.03,"ringWorldY":0.04,"ringPixels":1911},"ringOnGrass":true}`
- `PASS A1 {... "posY":0,"moved":7.9,"markerInScene":true,"ringScale":6,"ringWorldDist":0,"inFrustum":true,"ringPixels":1911,"oldPostPixels":0}`
- `PASS A2 {"afterX":{"markers":0},"afterPlace":{"markers":1,"posY":0,"ringPixels":1839}}`
- `PASS A3 {"reloadMarkers":2,"blueprintMarkers":2}`
- `PASS A4 {"postDist":3.6,"keep":3.6,"postMoved":true,"markerAtHome":true}`
Screenshot `rs-A0-pitch0.png` checked by eye: the teal ring lies flat on the grass around the truck.

Regression (dev server 5166, no HMR):
- `URL_QUERY='' DEV_PORT=5166 CDP_PORT=9432 MAXPOLL=2800 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-tree-expansion.js` → 51 PASS, 1 FAIL: F3 `updateMax 13.2` (gate 8 ms; p95 1.3 ms passes). This is the F3 max gate the orchestrator dropped on 2026-10-24 (`2026-10-24-tree-and-endgame.md`, "Orchestrator decision on F3"): whole-yard route searches of several robots in one frame. The new ray runs once per placement, before the 30 s measure starts, so it is not in these frames. U3 PASS.
- `URL_QUERY='' DEV_PORT=5166 CDP_PORT=9434 MAXPOLL=2400 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-balance.js` → all PASS, E3 PASS, 0 FAIL.
- `FAKELOCK=1 DPR=1 DEV_PORT=5166 CDP_PORT=9433 MAXPOLL=2400 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-factory.js` → every PASS-gated step PASS, no ERR; robot steps 09-12 as expected (`picked=true`, `inside=0`, `11_post_band fromPost=0.59`).
- `npx tsc --noEmit` → exit 0; `git diff src | grep -c "Math.min(1, dt"` → 0.

Gotowe, gdy:
- [PASS] 1 A0 — green run line above (`posY` 0 and 0, `ringOnGrass` true); red line `posY` 1.23 / 0.62.
- [PASS] 2 A1 — `ringPixels` 1911, `oldPostPixels` 0, `inFrustum` true.
- [PASS] 3 A2 — `afterX.markers` 0, `afterPlace.markers` 1, `ringPixels` 1839.
- [PASS] 4 A3 — 2 and 2.
- [PASS] 5 A4 — `postDist` 3.6 = `keep` 3.6, `markerAtHome` true.
- [PASS] 6 regression — U3, E3, factory green, tsc 0; F3 max is the accepted fail from 2026-10-24.

Notes on the scenario: `ringPixels` counts pixels that change when the ring is hidden, rendered from the player's camera 9 m from the post looking 35 degrees down. The player owns one robot, so a placement ends the ghost as for a real player (two owned robots keep the ghost out and the next G toggles it off).

Self-check:
- Discipline: one new block in `initRobot`, one import, the scenario, one SPEC line, one CHANGELOG bullet. Nothing else.
- Ladder: Rapier `castRay` and the group test already used in `weather.ts`; no helper added.
- Patterns: comment and style as the neighbouring code.

Rejected:
- Thicker ring (plan step 1b): not taken, a grounded ring has about 1900 visible pixels.
- Robot saved standing on top of another tool: on reload the ray cannot see a tool restored in the same frame (Rapier queries see new colliders only after the next physics step, `machines.ts` comment in `overlaps`), so that post goes to the grass under the tool. Not fixed: a truck parked on a tool is not a layout the game supports (it drives off on its first trip), and the dynamic truck body is pushed out of the tool by physics.
- A0 to A4 rows from steps 3-9 (`stationAtHome`, `STATION_REACH`): belong to commit 2.
