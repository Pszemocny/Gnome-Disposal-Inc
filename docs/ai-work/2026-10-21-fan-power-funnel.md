# Fan power (key N) and the Gnome Funnel

Interpretation (PP 2026-10-21 through the orchestrator): execute `2026-10-21-plan-fan-power-funnel.md` Part A then Part B with the plan's recommendations: [F1] a ($1500 x1.8, max 3, hole level 4), [F2] a (E/G/X reach 14 m for all tools; gnomes and props keep 4.5 m), [F3] a (a funnel-launched gnome pays XP x0.25, no tricks), key N cycles 100/75/50/25 %. PP may override on Slack. Scenarios are written, not run (PP: tests once at the end); only `npx tsc --noEmit -p .` was run.

## Problem

PP 2026-10-25: "przy najwyzszym ustawieniu w cooling fan pchaja zbyt mocno musi byc opcja zmiany mocy, albo dodaj rure do lapania taki lejek ktory zaczyna sie pionowo i jest kolanko ktore wyceluje w dziure ale trzeba bedzie miec mozliwosc postawic to w powietrzu". When Big Blades is at max, fans blow gnomes past the hole, because the push is global and there was no way to soften one fan.

## Summary

- Part A: every placed Cooling Fan has its own power. N while aiming at it: 100 → 75 → 50 → 25 → 100 %, float text and the prompt show it. Power scales the whole push (lift too), the trip range (9 m x power), blade speed and wind puffs. Saved with the fan (only fans get the `power` field), kept by blueprints and by G (one placement), kept through break and repair.
- Part B: new tool Gnome Funnel (Tools tab, after the Cleaning Robot, tool wheel only). Tube with a cone mouth and an elbow outlet; hangs where the player looks. A free gnome inside the mouth zone (local r < 1.3 m, y 2.3-4.0 m) is stashed (burst, slurp, mouth squash). Every 0.35 s the outlet pulls back 0.08 s, the gnome leaves on the frame the pipe is fully back (cannon's ballistic arc to the hole, whoosh, puff), then the pipe springs out past rest and settles (outElastic). Queue cap 20, no King, broken = no catch. Own Funnel Fuses.
- Reach: the look ray is 14 m. Gnomes, props and the lever keep 4.5 m; the crate (LMB grab) keeps 6 m.
- The cannon's aim and shot moved into `aimAtHole` and `launch` in `machines.ts`; the funnel reuses them.

## Ladder

- `Machine.power`, `PlacedMachine.power`, `cyclePower`, key N, prompt (rung 6): the per-fan option PP asked for needs a saved value and a key.
- `FAN_POWERS` (rung 5): the four values from the board.
- `ghostPower` (rung 6): G must keep the fan's power.
- `funnel` row, `FUSE_NAMES.funnel` (rung 2): same generated rows as every tool.
- `machineVisual`, `MACHINE_BOX`, `colliderDescs`, `FUSE_AT` entries (rung 2): every tool has these four.
- `launch`, `aimAtHole` (rung 2): the cannon's code, moved, not copied.
- `windup`, `gulp` fields (rung 6): animation rules 4 and 5 for the funnel's shot and intake; no existing timer fits (the cannon has no anticipation).
- `raycast(14)` (rung 5): one number.
- No new dependency, sound or easing. Robot route map, mushrooms and hole carry need no funnel code: they read `machineBox` like every tool.

## Deviations from the plan

1. One scenario file `tools/smoke/scenario-fan-funnel.js` instead of two (`scenario-fan-power.js`, `scenario-funnel.js`): the orchestrator's brief named one file.
2. The funnel shot has an anticipation phase (0.08 s pull-back, inside the 0.35 s rate) and the mouth a gulp squash (0.2 s, volume kept): the brief asked for anticipation/follow-through on intake and launch; the plan's cannon recoil starts fully back without a pull-back.
3. The mouth is its own mesh (pivot at its narrow end) for the squash; the plan merged it into the tube.
4. Outlet tilt: `pipe.rotation.x = PI/2 + 0.35` (down); the plan's `PI/2 + (-0.35)` pointed the pipe 20° up. Muzzle 1.3 m along the outlet instead of 1.2 (the pipe's end).
5. The crate keeps a 6 m look range (LMB would otherwise grab a crate from 14 m); not in the plan.
6. `serialize` writes `power` only for fans, so other tools' saves keep their keys (`scenario-robot-stations.js` E1 asserts the exact key list).
7. B8 calls `g.hole.carry` directly (hole grows 1 m in place) instead of a real level-up; B17 checks `KEEP_TOOL_IDS` instead of an iframe rebirth.

## Rejected

- Shrink animation of the caught gnome (rule 3): rejected as in the plan (alternative d): stashed gnomes are not drawn and the crate and cannon stash at once; the cue is the burst, the sound and the mouth squash.
- Validating a saved `power` value: the save is the player's own localStorage, like every other saved number.
- Robots.ts edit: not needed, the yard map reads `machineBox` for the funnel like for every tool (a floating funnel above the truck is skipped by the existing height test).

## Done when (from the plan; scenario lines wait for the single run PP ordered)

Run: `FAKELOCK=1 MAXPOLL=2400 node tools/smoke/smoke.mjs ff-out tools/smoke/scenario-fan-funnel.js` and `FAKELOCK=1 node tools/smoke/smoke.mjs te-out tools/smoke/scenario-tree-expansion.js` on the private 5199 server.

- [PASS] type-check: `npx tsc --noEmit -p .` → exit=0 (no output)
- [PASS] A12: `grep -n "power" src/player/sweeper.ts` → no output
- [PASS] B13: `grep -n "funnel" src/entities/robots.ts src/entities/mushrooms.ts src/systems/hole.ts` → no output
- [PASS] rule 1: `git diff -U0 src | grep "^+" | grep "Math.min(1, dt"` → no output
- [NOT RUN] A1-A11 → `scenario-fan-funnel.js` checks `A1`..`A11`
- [NOT RUN] B1-B12, B14-B18 → `scenario-fan-funnel.js` checks `B1`..`B18` (B9 takes the screenshot `ff-B9-shot`, check by eye)
- [NOT RUN] tree expansion → `scenario-tree-expansion.js` F4 (285 fuses, 57 boxes), F5 (12 tool ids), U1 (10 fuse nodes, Funnel after Wheel), U4 (10 tools), U14 (68 rows, 10 fuse rows), U15 (12 rows)

## Work progress

- Edited: `src/core/state.ts` (one field), `src/entities/machines.ts`, `src/player/player.ts`, `src/ui/hud.ts`, `src/ui/legend.ts`, `src/data/upgrades.ts`; texts `docs/SPEC.md`, `docs/PLAN.md`, `CHANGELOG.md`, `BOARD.md`; plan line "PP (2026-10-21): recommendations taken, may override".
- New: `tools/smoke/scenario-fan-funnel.js`; updated `tools/smoke/scenario-tree-expansion.js` (F4, F5, U1, U4, U14, U15).
- Another implementer edits the same files at the same time (lands): all edits were text-anchored, theirs untouched. Their `src/entities/props.ts` had a `rand` unused error at one point; by the last run tsc was clean.
- Self-check: every new field, branch and file maps to a plan step or the brief; no reviewer called, nothing committed.

## PP answers and test round (2026-10-21)

Supersedes the interpretation on line 3, the "Reach" line in the Summary and deviation 5. PP (Slack 21:07): "F1 a F2 nic nie zmieniamy trzeba doskoczyć f3 b wiatrak pod n ok".
- F1 a stays ($1500 x1.8, max 3, hole level 4).
- F2: no change. E/G/X keep the 6 m look ray for every tool, crate included; a funnel hung high is reached by jumping.
- F3 b: a gnome the player threw into the funnel stays the player's shot, like on a belt: full XP and the tricks of the original throw. Machine-fed gnomes pay x0.25. `launch(m, muzzle, keepThrow)`, only the funnel passes `true`; the cannon is unchanged.
- Fan power on key N confirmed.
- Test round: fan-funnel scenario fixes (shop open/close waits 3 frames, player moved off the shot line, funnel 1 m past the rim for the carry, game paused during the B9 screenshot). B9 pull-back threshold is "at least half back" (< -0.14), because the 0.08 s anticipation spans about 5 frames and the last sampled frame reaches ~70 %; the shot frame itself is fully back (-0.28).
- Results: fan-funnel 27/28 before the B9 threshold change, robot-stations 36/36, tree-expansion 54/54 (F3 updateMax 6 ms).
- Open look: the funnel mouth reads dark brown, not the planned orange, in the B9 screenshot; checked in the review round.

## Review round (2026-10-21)

Seven findings. The orchestrator chose the shapes. Red checks were written first, then all edits, then one final run.

1. No tricks through the funnel (supersedes the F3 b "tricks of the original throw" line above). When the player drops a gnome into the mouth, for example by letting go of the Magnet Gun there, the drop point is the mouth. So every shot read as LONG or SNIPER plus AIR. Now `launch` never keeps the throw: the gnome leaves as `thrownBy = 'machine'` with no `throwPos`, so there is no trick, no flat bonus, no STRIKE and no trick stats. A new field `Gnome.fullXp` carries the player's XP (PP F3 b): hole `feed` pays x1/sqrt(n) for it. `release` and `standUp` clear the field, and `retype` copies it. Check: B15 (full XP, no big text, longShots/airShots/bullseyes +0).
2. Placement reach. When a funnel's tube would start above the standing eye (1.65 m) + jump (v²/2g, twice with Gnome Boots, no Zoom buff) + the 6 m look ray, measured from the surface under it, the ghost turns red. The new constants `STAND_EYE` and `LOOK_REACH` and the method `jumpSpeed()` share the numbers with `move` and `raycast`. Check: RV2 (bottom 7 m green, 10.5 m red, 10.5 m green with Socks 3 + Boots, 13.8 m red).
3. Saboteurs. `nearestWorking(pos)` now gets the gnome's real height. It skips a tool whose lowest point is 2.5 m or more above or below the gnome (`boxBottom`, `SABOTEUR_REACH`), and it measures distance on the ground. Check: RV3 (a funnel 8 m up is skipped, the fan 12 m away is the target).
4. Release height. The funnel lets the gnome out at least max(0.6, 0.5 x scale) m above its box bottom. Check: RV4 (0.6).
5. Damping. The arc solves for the gnome body's linear damping in closed form (`GNOME_DAMPING` 0.15, exported from `gnomes.ts`). Cannon and funnel share it. Check: RV5 (25 m at hole level 5: lands 0.73 m from the centre, radius 3.2; before: 3.84).
6. Mouth colour: emissive 0xff8a2a at 0.35. Screenshot `ff-RV6-mouth-day` checked by eye: orange, before it was dark brown. Check: RV6.
7. Crate home inside a tool: see `2026-10-21-auto-lands.md`, "Review round". Check: `12_crate_home_tool`.

Ladder: `boxBottom` (rung 6, one helper used by placement, saboteur, funnel floor and crate homes); `fullXp` (rung 6, one field, because `thrownBy = 'player'` would also pay STRIKE); `GNOME_DAMPING`, `STAND_EYE`, `LOOK_REACH`, `jumpSpeed` (rung 2, existing numbers given a name).

Results: fan-funnel 33/33, auto-lands 28/28, small-batch 65/65, `npx tsc --noEmit -p .` exit 0.

Same class, not changed (outside the shapes): any tool, not only the funnel, can be hung in the air with no hit under the crosshair, and the reach rule applies only to the funnel.
