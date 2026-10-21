# Robot stations (fuses at the station, E/G/X at the station)

## Problem

PP (2026-10-24, verbatim): "dodaj aby fuze przy robotach byly przy stacjach (tych patykach rozbuduj je troche daj tam fuze, i sabotazysci musza tam dojsc aby zepsuc robota) robot moze byc przeniesiony za pomoca stacji tj na stacji klikam g lub x (na robocie tez mozna)".
PP answers (Slack, "1. a. 2. a"): a robot from an old save whose station pole would land inside a tool goes back to the inventory with a message; nothing can be placed on the station pad; E/G/X work when aiming at the pad, the pole and the truck.
Scope: steps 3-9 of `## Plan (plan-senior, final)` in `2026-10-24-plan-robot-stations.md`. Steps 1-2 (the ring after a far move) shipped in 02dc799 (`2026-10-25-robot-ring.md`).

## Summary

- Every robot has a station on its marker: a 2 x 2.6 m pad with yellow stripes, a 1.5 m pole with the fuse box (facing the pad) and a lamp on top. The lamp is green when the robot works, red when it needs E (blown fuse or broken), also while broken.
- The station has a fixed body with two colliders: a solid pole (the player bumps into it) and a 0.3 m tall sensor pad. Both are in `byCollider`, so the look ray finds the robot when aiming at the pole or the pad; E/G/X/prompt then work as on the truck. The `PLAYER` filter keeps gnomes, trucks, coins and props out of both.
- The saboteur already walked to the station centre (`m.pos`); the fuse box now hangs there, so the hit and its red burst are at the station.
- The hole step-out runs every frame before the broken check (`stepOutPost`), keeps 1.3 m more for the pole, and moves the station body with the marker.
- Old saves and blueprints: after restore, a robot whose pole touches a fixed tool or stands in the factory goes back to the inventory (blueprint toast as before; game load shows "1 tool is back in your inventory: no room there.").
- Blueprint LOAD and Z undo scale the station marker together with the truck; the fuse box follows the marker scale.
- Texts: HUD hint, shop description, SPEC robots section + two decisions, PLAN.md, CHANGELOG `## 2026-10-26 14:00`.

Ladder: station body and colliders (rung 2, lever body in `factory.ts`), lamp sprite (rung 2, lever lamp), blueprint anim loop (rung 2), `FUSE_AT`/`MACHINE_BOX`/`STATION_REACH`/sensor flag (rung 5), `robotStationGeometry` (rung 6, primitives through `build`). No new dependency.

## Odstępstwa (deviations from the plan)

1. Pad sensor is `cuboid(1.0, 0.15, 1.3)` at y 0.15 (0.3 m tall), not 3 cm: the placement ghost box is shrunk by 8 %, so a tool's box bottom sits 4-21 cm above the ground and never touched a 3 cm pad; the ghost would stay green over the pad.
2. Placement `surface` filter skips sensors (`player.ts`): otherwise the crosshair rests the tool on top of the pad sensor and it is green again.
3. Grounding ray in `initRobot` excludes sensors (`EXCLUDE_SENSORS`): a post must not land on another station's pad sensor.
4. `MACHINE_BOX.robot` = half [1.0, 0.86, 1.3], centre [0, 0.86, 0] (plan: half z 1.15, centre z -0.15): the plan's box left the pad front 0.3 m uncovered, so a new robot's pad could overlap a fan foot.
5. The plan's `overlaps(m, POLE_BOX)` does not fit today's `overlaps(m, oldHalfX)` (belt-only since Wide Belt). New private `poleBlocked(m)`: same pair test over fixed colliders, own station, sensors and ground excluded, plus `factory.inside` at the pole point.
6. `main.ts` pushes a load note when `restore` returns > 0 (the plan wanted a toast; the game load path had none). This also shows a note for tools skipped in the factory, which was silent before.
7. A7 guard not added: the first run showed the player walks out of the pole in 3 of 4 directions; the 4th was blocked by the parked truck 0.1 m away, not by the pole (scenario fixed, see below).
8. Steps were not split into two commits; steps 1-2 had already shipped.

## Work progress

Scenario `tools/smoke/scenario-robot-stations.js` covers A0-A7, B1-B4 (B3b), C1-C7, D1-D4, E1, E1b, E2, E2b, E3, E4, E5, F1, F3 (one `ok()` per Done-when line). F2 is a grep (below).

Run 1, before the orchestrator stopped scenario runs (`URL_QUERY='' FAKELOCK=1 MAXPOLL=2400 CDP_PORT=9385 DEV_PORT=5185 node tools/smoke/smoke.mjs <scratchpad>/rs1 tools/smoke/scenario-robot-stations.js`):
- PASS: A0, A1, A2, A3, A4, A5, A6, B1, B2, B3b, C1, C2, C3, C4, C6, C7, E1, E1b, E2, E4.
- FAIL A7 `{"moved":{"w":4.42,"s":0.01,"a":6.17,"d":6.2}}`: cause in the scenario, the truck parks 0.1 m in front of the pole and blocks the S direction. Fix: truck moved 8 m away (broken, so it stays) before the walks.
- FAIL B3 `overPole` ghost at z -15.7: the ray from the front hit the truck, so the fan rested against it. Fix: aimed from behind the station.
- FAIL B4 `gnomeDz -0.41`: the gnome slid on the grass and friction stopped it 0.25 m before the pole. Fix: thrown in an arc (vy 4), reaches the pole about 1 m high.
- FAIL C5 `repairFromTruck false` and then D1-D4, E2b, E5, F1, F3: the truck aim spot (10, -13.8) is 2.6 m from the shop desk (7.5, -13); E there opens the shop (desk wins over a blown fuse, existing rule), the game paused and every later step failed. Fix: test spot moved to (16, -16), `reset()` closes an open shop and counts it in `shopWasOpen`.
- FAIL E3 0 robots: the iframe reload autosaved the first frame's yard over the prepared save on unload. Fix: a new iframe after the save is written.
- Run 2 not made: the orchestrator (2026-10-21, PP's new workflow) runs every scenario once at the end of the batch.

Other checks:
- `npx tsc --noEmit -p .` → exit 0.
- `grep -rn "home post" src docs/SPEC.md docs/PLAN.md | wc -l` → 0.
- `git diff src | grep -c "Math.min(1, dt"` → 0.
- Screenshots run 1, by eye: `rs-B1-station.png` shows pad with stripes, pole, truck on the pad; `rs-A0-ring-after-move.png` ring on the grass. `rs-C2-station-red-fuse.png` was taken from behind the pole (box not visible); the scenario now takes it from the pad side.

Gotowe, gdy (status after run 1; the orchestrator's batch run decides):
- [PASS] A0, A1, A2, A3, A4, A5, A6, B1, B2, B3b, C1, C2, C3, C4, C6, C7, E1, E1b, E2, E4 — run 1 lines above.
- [PASS] F2 — `grep "home post"` 0 lines; `grep -c station` → hud.ts 1, upgrades.ts 1, PLAN.md 1, CHANGELOG.md 1, robots.ts 22; SPEC.md 0 because the spec is Polish (`stacja`/`stacji`, 9 lines); `not a footprint on the ground` gone from hole.ts; `rides the station marker` in machines.ts.
- [NOT RUN] A7, B3, B4, C5, D1, D2, D3, D4, E2b, E3, E5, F1, F3 — scenario fixed after run 1, not rerun on the orchestrator's order.

Rejected:
- Pole targeting for saboteurs (plan R9): reach stays measured to the pad centre.
- Tool on the pole cap (plan R12): accepted as is.
- The look ray now also hits the pad sensor (0.3 m), so a gnome lying on a pad is aimed at through the station; grabbing still works through the cone target. Accepted: lifting the pad lower lets tools be built on it.

Self-check:
- Discipline: every new line maps to a plan step or a deviation above.
- Patterns: lamp as the factory lever, body/colliders as `place()`, comments one line of "why".
- Process slip: one edit of the scenario file (one check line) went through `sed -i` by mistake; the content is correct, all other edits through Edit/Write.

## Test round (2026-10-21, combined batch run)

- Supersedes item 7 above: the A7 guard IS added. When a station steps out of the growing hole onto the player, the pole body moves only once the player is more than 0.8 m from the new spot (the marker moves at once), because the character controller cannot leave a pole that appears inside it. The A7 check now moves the station onto the player once per direction.
- Scenario fixes: the gold letter G lay 1.4 m from the test spot and turned the preview red, so the scenario moves letters and the chair away first; the F3 badge limit is 2.0 m (truck plus bed are 1.8 m).
- Robot route: at most one heavy route job per frame (map build, distance field or A*), shared by all robots (`searchTime`); F3 worst frame 6.4 ms.
- Results: robot-stations 33/33, tree-expansion 54/54 (F3 green).

## Review round (2026-10-21, package P1)

- Finding 1: when a robot was placed with a tool 1.20-1.31 m behind the station centre, the preview was green but the next load sent it back to the inventory, because the shrunk preview box ended at 1.196 m while the load test (poleBlocked) reaches 1.307 m. The robot's placement box now reaches 1.42 m at the back (half depth 1.36, centre -0.06), so after the 8 % shrink it covers the pole to 1.311 m: placement and load agree. Accepted gap: the shrunk box bottom sits 5 mm above the pole test bottom (0.069 vs 0.064 m); lowering it would lift the pad off the grass, and nothing that low exists.
- Finding 2: a carried or homing crate moved every frame, so the shared yard map was rebuilt every frame and no truck ever got a route. The crate is now skipped in yardSig and buildYard, like the robot (it is a loose body the truck pushes).
- Finding 6: when the growing hole pushed a station out onto a tool, the pole stood inside it and the next load sent the robot back. The step-out now runs poleBlocked and tries other spots at the same distance from the hole, 0.25 rad apart; if none has room, the robot goes to the inventory at once with the existing hole toast and a small burst. Accepted: no shrink-out animation here, the blueprint vanish helper is private to blueprints.ts and the level-up frame already shakes and bursts.
- Scenario: R1 (preview vs load at 1.25 m and 1.40 m), R2 (wiggled crate, truck still plans round a belt), R3 (step-out onto a fan). A7 clears held keys and knock-back before the teleport and moves the player 2 m from the pole before "followed" is read (the 0.8 m guard is unchanged).
- Results: red before the fixes R1, R2 FAIL; R3 red after its setup fix (`poleInFan: true, back: 1`). After: robot-stations 36/36 (a first run had one D1 fail, truck still driving to cargo; the rerun was green), tree-expansion 54/54 (F3 updateMax 5.4 ms).
