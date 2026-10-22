# Robot parks at its station when idle

Interpretation: when a cleaning robot has nothing to do (no target gnome in its area, bed empty or just tipped, not broken), it drives back over the shared route map and parks on its station pad next to the pole, facing the pad direction (away from the pole). It leaves as soon as a scan finds a target. A broken robot stays where it broke; after the repair it drives back and parks.

PP (2026-10-22, verbatim): "dodaj jeszcze ze jak robot nie ma nic do roboty to jest kolo tyczki a nie ze stoi gdzie skonczyl po to jest tyczka aby obok niej stal".

Order: PP "bez planu" (2026-10-21); no job, migration, cache or queue, so no mini-roast.

Gotowe, gdy:
1. scenario-robot-stations P1 → a truck that just tipped its load, no gnomes left: within 12 s it is less than 0.6 m from its station centre, speed < 0.05 m/s, heading within 0.2 rad of the pad direction, and its top speed in the last 0.4 m before parking is below 1.0 m/s (no jolt).
2. scenario-robot-stations P1b → a gnome dropped in its area while parked: within 6 s the truck is in `seek` and more than 0.5 m off the pad.
3. scenario-robot-stations P2 → a truck broken 6 m from its station moves less than 0.1 m in 2 s; after the repair it parks (< 0.6 m, stopped) within 12 s.
4. `npx tsc --noEmit -p .` → exit 0.

## Problem

The `return` state already drove the truck home, but it stopped as soon as it was 0.6 m from the station centre, in whatever heading it arrived with, and an idle truck nudged 0.6-1.0 m off its spot never went back. It arrived at full speed and stopped in one frame.

## Summary

Ladder: rung 2. `return`, `route()` with the shared yard map, the damped heading and the scan loop already exist; the change only tightens the arrival and adds the turn to the pad direction.

- `return` ends at 0.15 m from the station centre (`PARK`) instead of 0.6 m; the last metres the speed falls with the distance (`0.3 + 1.5 x d` m/s, capped at the robot speed), so the truck rolls in without a jolt.
- `idle`: the heading is damped to the pad direction (the marker yaw, the pole behind the truck).
- An idle truck more than `ARRIVE_HOME` (0.6 m) off its spot drives back (was 1 m).
- Broken robots: unchanged (Machines.update skips the robot while broken); after the repair an idle truck off its spot goes `return`.

## Work progress

- `src/entities/robots.ts`: `PARK`, `PARK_SLOW`; `return` ends at `PARK` with the speed taper; new `idle` case turns to the marker yaw; idle re-park threshold `ARRIVE_HOME`.
- `tools/smoke/scenario-robot-stations.js`: P1, P1b, P2 (waits on game time).
- `docs/SPEC.md`: robots line + PP decision with quote; `CHANGELOG.md` one bullet under `## 2026-10-28 14:00`; `BOARD.md` status line.

Run (once, private dev server 5223, no HMR): `URL_QUERY='' FAKELOCK=1 MAXPOLL=4000 CDP_PORT=9831 DEV_PORT=5223 node tools/smoke/smoke.mjs <scratchpad>/park1 tools/smoke/scenario-robot-stations.js` → exit 0, 39 PASS, 0 FAIL (all old rows A0-F3 and R1-R3 still green). Dev server stopped afterwards.

Samokontrola (Gotowe, gdy):
- [PASS] 1 — P1 `{"tipped":true,"parked":true,"queue":0,"atIdle":{"dist":0.15,"yawErr":1.48},"after":{"state":"idle","dist":0.15,"speed":0,"yawErr":0},"slowFrames":22,"slowMax":0.91}`; speed curve over the last 12 frames falls 0.69 → 0.53 m/s, then 0 at 0.15 m. Screenshot `rs-P1-parked.png`: truck on the pad in front of the pole, checked by eye.
- [PASS] 2 — P1b `{"left":true,"state":"seek","target":true,"dist":0.51}`.
- [PASS] 3 — P2 `{"brokenMoved":0,"back":true,"after":{"state":"idle","dist":0.15,"speed":0,"yawErr":0.01}}`.
- [PASS] 4 — `npx tsc --noEmit -p .` → `tsc exit 0`.
- Rule 1 check: `git diff src/entities/robots.ts | grep -c "Math.min(1, dt"` → 0.
- Discipline: two constants, one `case`, one speed line, one threshold; nothing else. Patterns: heading uses the same `damp(r.yaw, r.yaw + wrap(...), 6, dt)` as the drive code.

Odrzucone:
- A truck whose way home is fully walled off still waits at the nearest reachable cell (existing `descend` behaviour); the order asks for parking over the shared route map, not a new fallback.
- The last frame still drops from about 0.5 m/s to 0 at 0.15 m: a lower floor than 0.3 m/s would slow the arrival further and risks the 1.5 s stuck detector at the end; 0.5 m/s at 60 fps is a stop of under 1 cm.

Niepewne: the code before this change already drove an idle truck home (to 0.6 m, any heading), and the old B4 row passed; I did not find from the code why PP saw a robot staying where it finished. Two existing cases still make a truck stand away from its pad: the player standing within 2.5 m in front of it (it waits), and a home it cannot reach.
