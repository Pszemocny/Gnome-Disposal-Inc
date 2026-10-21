# Factory hitbox, robots and gnomes under the factory, mouse jumps at the factory

Interpretation: execute `## Plan (plan-senior, final)` of `2026-10-20-plan-factory-bugs.md`. PP was asleep, so every "Decisions for PP" item takes its recommended answer (1a: no 250 px drop, solid factory + raw mouse input + measurement; 2a desk stays out of the robot grid; 3a hitbox only, no gnome push; 4a buried tools go back to the inventory; 5a keep raw input and check the slider). Addition from the brief: PP plays on GitHub Pages, where the `logs/errors.log` beacon has no server, so every measurement line is also printed as a console line (`console.info`) that PP can read in the browser's DevTools.

## Problem

PP 2026-10-20: "Mysz przeskakuje dziwnie przy faktory" and "roboty i gnomy wchodza pod faktorke jakby jej nie bylo popraw jej hitbox". The factory had one box collider; the chute, the pedestal with the button and pipe, and the gear had none. The player walked into the chute (the view filled with it), gnomes and robots walked under it.

## Summary

- `src/entities/factory.ts`: three more static colliders on the factory body (chute at full mesh length and tilt, pedestal + button + pipe, gear); public `footprints` (4 rectangles) and `inside(x, z)`; spawn at `1.8 + 0.56 x type.scale`; `burst(n)` streams one gnome every 0.05 s.
- `src/entities/robots.ts`: the tool rasteriser in `buildGrid` lifted into `block()`, the factory footprints go through it grown by `CLEAR`.
- `src/entities/machines.ts`: `restore` skips a tool at `y < 1.0` inside a factory footprint (back to the inventory).
- `src/core/input.ts`: `requestPointerLock({ unadjustedMovement: true })`, one plain retry on `NotSupportedError`, later locks plain; read-only `pointermove` listener queues jumps over 250 px (max 5 per page load). The `mousemove` look path is untouched.
- `src/ui/crash.ts` `note()`: beacon to `logs/errors.log` plus `console.info('[gnome] …')`; `src/main.ts` sends `mouse-jump` lines and up to 5 `slow-frame` lines (frame > 0.1 s next to the factory).
- `tools/smoke/scenario-factory.js`: new scenario for every matrix row.

Deviations from the plan (with reason):
1. Spawn height `1.8 + 0.56 x type.scale` instead of `0.45`: the plan's arithmetic used the type scale only; the tier scale goes up to 1.25 (massive), so a massive classic's box bottom would be 1.70, under the collider's top edge 1.744. 0.56 = 0.44 x 1.25 + 0.01.
2. `burst(n)` streams one gnome every 0.05 s (not in the plan): gnomes made in the same frame start inside each other, push each other back and, with the solid chute, stayed on it. Probe: 20 mushroom bursts (15) left 5 gnomes on the chute and 1 on the roof before the stream, 0 and 0 after (25 bursts incl. 5 x 40).
3. The 5-per-page-load cap uses a counter: the plan's `jumps.length < 5` is emptied by main every frame, so it capped per frame only.
4. `inside(x, z)` without the plan's unused `pad` parameter.
5. Every measurement line also goes to the browser console (brief addition for GitHub Pages).
6. Scenario: row 8 makes the king after the 40-gnome stream, not in the same frame (a gnome made in the same 0.05 s as the king starts inside it and lands on the roof); row 20 first moves the mouse to its start spot (the first CDP move jumps from the last click spot: red and first green run both read `dYaw=0.026` for that reason; raw deltas probe: `-212`, then `+20` x 10).
7. Done-when 14: the plan's grep also hits the pre-existing `findGnome` loop and two comments; checked inside `buildGrid` only.
8. Row 9 was not red: the straight line from the post to the gnome passes in front of the lip (local z about 3.3), so the truck never needed the footprint there; the row passes before and after.

Rejected:
- Parade (16 gnomes made in one frame by `events.ts`): probe 6 parades, 0 on the chute, 1 on the roof; the roof is an accepted surface since before (plan R11), so not changed.
- Batches (up to 7 per cycle in one frame): probe 12 batches of 7, 0 on the chute or roof, so not changed.

Uncertain (for PP): gnomes that bounce back off a big pile or a king lying on the landing ring can fly back into the top of the chute and stay there (the chute top slopes down to the factory wall, like a trough). The plan accepted gnomes resting on the chute (R11); the player can grab them, robots ignore them (not on the ground). Seen in one scenario run with the king on the ring (3 gnomes) and with a 40-gnome pile (1 fat gnome).

Note for `2026-10-20-plan-physical-loads.md:226` ("the player holds the crate under the chute"): that spot is now solid, the player cannot stand under the chute any more.

## Done when (run after the code, final run `factory-final4`, Esc `esc-final`)

Command: `FULL=1 DPR=1 DEV_PORT=5196 CDP_PORT=9384 MAXPOLL=2400 node tools/smoke/smoke.mjs <scratchpad>/factory-final4 tools/smoke/scenario-factory.js` (dev server `npx vite --port 5196 --host 127.0.0.1`). `LOGS:` empty. Red run (before the code) in brackets.

- [PASS] 1 — `01_player_chute dist=3.20` (red 1.68)
- [PASS] 2 — `02_player_side lx=1.13` (red -13.93: walked right under the chute and out the other side)
- [PASS] 3 — `03_player_pedestal lx=2.93` (red 1.98)
- [PASS] 4 — `04_crank_at_chute produced=+2 at=3.20`
- [PASS] 5 — `05_gnome_chute minLx=0.93 state=walk` (red -1.03)
- [PASS] 6 — `06_gnome_gear maxLx=-2.08 state=walk` (red -1.79)
- [PASS] 7 — `07_gnome_front minLz=3.01 state=walk` (red 1.49)
- [PASS] 8 — `08_spawn_clear stuck=0 worst=0.17 gnomes=41 kingY=1.75`; `factory-08-chute.png`: no gnome inside the chute mesh, the king landed on the gnome pile at the ring (y 1.75, standing height 1.32), not on the chute. One fat gnome bounced back from the pile onto the chute top after the measured window (see Uncertain). (red `stuck=1 worst=2.35`, a gnome on the roof)
- [PASS] 9 — `09_robot_route inside=0 picked=true t=2.3 stall=0.1`
- [PASS] 10 — `10_robot_leaning inside=0 resolved=picked t=1.1 stall=0.2 gnomeAt=0.95,2.00`
- [PASS] 11 — `11_post_band inside=0 idleAt=1.1 puffs=0 picked=true state=idle fromPost=0.59`
- [PASS] 12 — `12_restore_skip list=2 robotAvailable=1 placed=tramp,tramp` (red `list=3 robotAvailable=0 placed=robot,tramp,tramp`)
- [PASS] 13 — `grep -n "fixedCuboid\|deskPos" src/entities/robots.ts` → no output
- [PASS] 14 — `sed -n '/^function buildGrid/,/^}/p' src/entities/robots.ts | grep -n "footprints\|machines.list"` → 2 lines: the tool loop and `for (const f of ctx.factory.footprints) block(...)`
- [PASS] 15 — `15_lock_option first={"unadjustedMovement":true} locked=true raw=true` (red `first=undefined`)
- [PASS] 16 — `16_lock_fallback calls=[{"unadjustedMovement":true},undefined,undefined] locked=true hintHidden=true rawAfter=false lockedAgain=true` (red `calls=[undefined,undefined]`)
- [PASS] 17 — `17_locked_600 dYaw=-1.3200 want=-1.3200`
- [PASS] 18 — `18_jump_logged beacons=1 line=mouse-jump {"ex":900,"ey":0,"n":1,"max":900,"locked":true,"raw":true,"skip":false,"dt":0.017,"near":false,"paused":false} dYaw=0.000 console=1` (red `beacons=0`)
- [PASS] 19 — `19_normal_moves dYaw=-1.7600 want=-1.7600 beacons=0`
- [PASS] 20 — `20_cdp_look dYaw=-0.440 locked=true`
- [PASS] 21 — `21_free_cursor beacon.locked=false beacon.skip=true dYaw900=0.000 dYaw40=-0.0880 want=-0.0880`
- [PASS] 22 — `FULL=1 DPR=1 DEV_PORT=5196 CDP_PORT=9385 MAXPOLL=1600 node tools/smoke/smoke.mjs <scratchpad>/esc-final tools/smoke/scenario-esc.js` → 30 result lines identical to the baseline run before the code (and to `2026-10-20-esc-resume.md`), incl. `28_reenter_delta jump=0.000 after=0.044` and `05c_look_free yawDelta=-0.440`; only `05b_walk_free moved=7.75` vs 7.83 (walk distance varies with timing, 7.54-7.75 in the esc-resume note); `LOGS:` empty
- [PASS] 23 — `23_slow_frame beacons=5 maxSlow<=5:true maxJump<=5:true jumps=5 line=slow-frame {"dt":0.15,"gnomes":0}` (7 slow frames and 8 jumps triggered over the run, 5 + 5 sent)
- [PASS] 24 — `npx tsc --noEmit` → exit 0
- [PASS] 25 — `grep -rn "Math.min(1, dt" src` → 0 lines
- [PASS] 26 — no `scenario-robots*.js` on disk; `26_perf p95=0.200ms frames=601 insideNow=0` with 4 robots and 6 gnomes around the factory (red run without footprints: also 0.200 ms; Chromium's `performance.now()` has 0.1 ms steps)

Self-check: built only the plan plus the deviations above; every new field and branch maps to a plan step or a deviation; the rasteriser is reused, not copied; no new dependency; no file outside the task touched (other sessions edit goals, leaderboard, state, mushrooms, buffs, hud, hole, contracts in the same tree; in SPEC, CHANGELOG and BOARD only my own lines).

## Work progress

- Ladder: colliders and footprints reuse `createCollider` and the tool rasteriser in `buildGrid` (rung 2); `restore` skip one line (rung 5); lock option is a platform feature (rung 3); the measurement reuses `send` in `crash.ts` plus one `console.info` (rung 6, ordered by the brief).
- Burst probes (scratchpad `probe/tmp-spawn*.js`, same harness): count gnomes resting above the factory (local |x| < 2.6, z -1.4..3.2, y > 0.6 + 0.44 x scale) 2.5 s after each burst at hole level 8. One-frame bursts: b15 x 20 → chute 5, roof 1; b40 x 5 → chute 1, roof 9. Frictionless chute tried and dropped: the chute top slopes down towards the factory wall, so gnomes slid into the corner instead of off. Spawn moved to 3.0 m tried and dropped: no better (b15 x 6 → 3). Streamed burst: b15 x 20 and b40 x 5 → 0 and 0. Single shots still land on the ring (10 shots, local z 6.1..6.9).
- Baseline Esc scenario before any edit: `FULL=1 DPR=1 DEV_PORT=5196 CDP_PORT=9376 MAXPOLL=1600 node tools/smoke/smoke.mjs <scratchpad>/esc-before tools/smoke/scenario-esc.js` → 30 result lines, `05b_walk_free moved=7.83`, `05c_look_free yawDelta=-0.440`, `28_reenter_delta jump=0.000 after=0.044`.

## Round 1 (review fixes, package P1 of `2026-10-21-fix-plan-factory-bugs-r1.md`)

Findings F1, F3, F4, F5, F6, F9, F10, F11 and lean L12, done with the plan's shapes:
- Robots skip a gnome resting on the factory (`onGround`: higher than a standing gnome on the grass and inside a factory footprint), because the shovel cannot reach it and the truck retried it every trip.
- Every factory gnome goes through one FIFO release queue (`produce` only enqueues, `spawnNow` spawns): 0.05 s between gnomes, 0.4 s before and after a king. The parade sets `awake`/`parade` in a callback once the gnome is out, only while the parade still runs.
- One parts table in `factory.ts` builds the colliders and the footprints: pedestal 1.2 m like the mesh, red button and pipe as their own colliders, gear a cylinder along x, lever hit box `0.26 x 0.65 x 0.12` (covers the knob in both states) plus its own footprint. The smoke scenario uses `factory.inside` instead of a copied rectangle list.
- Raw lock refusal: the plain retry only while the player still wants the lock (`wanted && !locked`), and the raw refusal's `pointerlockerror` does not reach `onLockError` while the raw request or its retry is out.
- Mouse-jump cap: 5 locked non-skip lines per page load, 5 others in their own budget.
- `Machines.restore` returns how many tools it left in the inventory (inside the factory); the blueprint toast counts them with the hole skips.

Test fixture changes (no assertion removed): row 08 asks for the king once (with the queue, asking every frame queued about 24 kings); row 28 queues 5 gnomes after the king so the gap behind it is measured (FIFO puts the king after the burst); row 31 measures Esc from the raw request and gives B a 600 ms refusal (the first red run measured from before the click).

Red run (before the code): `28_release_gaps FAIL minGap=0.000 kingBefore=0.000`, `29_lever_from_pedestal FAIL lookAt=none flipped=false restY=2.26`, `30_gear_corner FAIL restY=3.09`, `27_robot_chute_gnome FAIL targetedFrames=9`, `33_blueprint_factory_skip FAIL toasts=["Blueprint 1 loaded: 1 tools."]`, `31_esc_during_raw_reject FAIL B.paused=false B.locked=true` (A.hintFrames=0: the hint flash did not show in this harness before the fix either), `32_jump_cap_locked FAIL realLocked=0`.

Final (second run, after the row 28 fixture change): rows 01-26 as before, `28_release_gaps PASS burst=36 minGap=0.050 kingBefore=0.417 kingAfter=0.400 parade=16 joined=16 paradeMinGap=0.050`, `29 PASS lookAt=switch flipped=true produced=+0 restY=0.19`, `30 PASS restY=0.19 at=-3.14,1.71`, `27 PASS targetedFrames=0 skips=0 grassWait=0.7`, `33 PASS toasts=["1 tool skipped: no room there (hole or factory)",...]`, `31 PASS B.escAfterRequestMs=257 B.paused=true B.locked=false`, `32 PASS realLocked=1`, `23 lockedJumps=1 otherJumps=5`; `npx tsc --noEmit` exit 0; scenario-esc 30 baseline lines equal except `05b_walk_free moved=6.17` (wall-time walk, 7.54-7.83 before).

Round 1b (verifier finding, release backlog): with Chaos x3 + OVERTIME + Bigger Batches the crank queued up to ~36 gnomes/s while the mouth lets out at most 20/s (fewer at a low frame rate), so the queue grew without bound and the yard cap ignored it. Now the crank only advances while less than one batch is queued (leftover progress capped at one cycle), and the jam counts `list + queue`; mushroom bursts and event gnomes still queue in full, as before. Row 34 (cap lowered to 40): red `FAIL maxQueue=49 yardMax=87`, green `PASS maxQueue=14 queueAtEnd=0 after5s=0 yardMax=45`; rows 01-33 unchanged; `npx tsc --noEmit` exit 0.
