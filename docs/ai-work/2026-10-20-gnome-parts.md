# Gnome built from moving parts (demo on classic) + animation rules 1 and 7

Interpretation: execute `## Plan (plan-senior, final)` of `2026-10-20-plan-gnome-parts.md`, all 9 steps. PP's open question 1 (fan force follows the blades) is not answered: implemented recommendation a), the spin is visual only and every machine effect starts and stops at once as before. If PP answers b) it is a separate change.

Gotowe, gdy: the plan's `### Done when` 1-27 plus its "Plus" line, with the deviations listed below.

## Problem

PP: "bardzo drewniane" and chose "a gnom z ruchomych czesci" (option 1 of `2026-10-20-animation-options.md`). A classic gnome was one rigid mesh that bobbed and rolled. The same brief asked to remove the frame-rate dependent chasers (rule 1) and the constant spins (rule 7).

## Summary

- `src/world/models.ts`: `PartName`, `PART_ORDER`, `PART_PIVOT`, `Part.part` tag, `build(parts, anyGlow)`, `gnomePartList(t)`, `gnomeGeometry(t) = build(gnomePartList(t))` (same output), `gnomeParts(t)` = 7 geometries moved to their joints.
- `src/entities/gnomes.ts`: classic gnomes are drawn by one `THREE.BatchedMesh` (7 instances per slot, created hidden at boot). `Gnome.ph` = step phase advanced by the distance walked (every type; `WALK_FREQ` deleted). `Gnome.lag` (`PartLag`) = limb swing, hat and beard offsets, damped every frame in every state (`updateLag`). `bodies` = every gnome's body matrix by slot (replay, scenarios). One-piece gnomes are packed at the front of the `InstancedMesh`; `writeInstances` owns `count`. No `WEBGL_multi_draw` or `?noparts` = no batch, every classic stays one piece, one `console.info` and one toast.
- `src/systems/replay.ts`: records `bodies` + `slots.length`; playback hides the batch, so classic gnomes replay as one piece; `stop()` shows it again. The saved live counts are gone (`writeInstances` in `stop()` rewrites them).
- Rule 1 chasers: `environment.ts` swirl tint and night, `events.ts` UFO move, `coins.ts` pull, `sweeper.ts` push, `gnomes.ts` yaw.
- Rule 7 spins: `machines.ts` `spinRate` damped toward `SPIN_RATE` (0 while broken, λ 4) before the broken gate: fan, wheel, vacuum, black hole, conveyor rollers and belt texture. `factory.ts` `gearRate`, `mushrooms.ts` `spin`, `events.ts` UFO `spin`/`roll`. The hole swirl stays (plan decision 4).
- `CHANGELOG.md`: one bullet under `## next build (not on 5300 yet)`.

Ladder: `BatchedMesh` rung 2 (three core), `THREE.MathUtils.damp` and `1 - exp(-λ dt)` rung 2, `SimplexNoise` rung 4 (bundled addon, as `fx.ts`), parts / lag / phase / `bodies` / fallback rung 6, each tied to a matrix row of the plan.

Only classic has moving parts; blue (same look, same speed) still walks as one piece (plan R12).

Playtest message draft for PP (not sent): "Only the red-hat Garden Gnome has moving parts in this build; add ?noparts to the URL to see the old look."

### Deviations from the plan

1. `PART_PIVOT` arms: `[∓0.208, 0.029, 0.061]`, not `[∓0.132, ...]`. The plan's own formula (top end of the arm, `p + Rxyz(r)·(0, 0.11, 0)`) gives x = -0.208 (checked with three); -0.132 is the bottom end.
2. Swing target `min(1, a / 0.25)` instead of `a`. With the plan formula the scenario measured `strideRatio: 1.328` (feet slide 33 %): ground friction keeps a walker at 1.03 m/s, 0.79 of its type speed, so the swing never reached 1 while the phase rate assumes full steps. Now the step length is fixed and only the cadence follows the speed: `strideRatio: 1.098`.
3. `SWING_LAMBDA` 7 instead of 10: with full-amplitude legs λ 10 moves a stopping leg 0.12 rad in one frame (> 0.1); λ 7 gives 0.07.
4. Hat and beard counter the body's real lean this frame (`LEAN·a`, passed from `writeInstances`), not `LEAN·swing`. With swing ≠ a the hat leaned with the body on a start (`start.hatLagFrames: 0`).
5. Standing breath and hat wobble are scaled by `1 - swing` (0 outside `walk`) instead of switching on at `swing <= 0.01`: the switch made the torso scale jump up to 3 % and the hat 0.08 rad in one frame (rule 3). Measured now on a stop: torso scale step 0.00245 per frame, hat world pitch step 0.019-0.022.
6. Metrics redefined where the literal bound cannot hold: walking at the plan cadence itself moves a leg 0.175 rad per frame, so `maxLegStepPerFrame <= 0.1` is measured on a start while the swing eases in (first 6 frames) and on a stop while the phase stands (frames where `ph` moves < 0.01). Start `hatLagFrames` is read on `lag.hatP` (the hat's world pitch without the fading wobble); the drawn hat is reported too (`hatLagFramesDrawn: 6`).
7. Done when 16: `grep -c "id: '"` counts 16 because the weight tiers match too; `grep -c "^    id: '"` → 12.
8. Done when 24: `grep -n "WEBGL_multi_draw" src/entities/gnomes.ts` → 3 lines (the check, the console line and the toast text, all three from the plan's own steps 2 and 3).
9. Done when 15: the classic count during playback is 4, not 3: the stashed gnome is a HIDDEN row (zero scale, draws nothing), the three live ones are full-size and none sits at the origin.
10. `Gnomes.slots` is `readonly` instead of `private` (the replay reads `slots.get(id).length`, as plan step 5 writes).
11. "calls before" = the same scene with every classic gnome on the one-piece path (`lag = null`), measured in the same run. A pre-change baseline run (`scenario-parts-before.js`) gave 64-68 calls, consistent.

### Rejected

- `scenario15.js` steps `massive_lifts_at_base` (read the removed `P.beam`; fixed in the scenario to report `"removed"`) and `arc_green_when_aimed_at_hole` (`greenAtPitch: null`: the arc only shows with the Trick Scope since that change) fail for reasons outside this change → separate task (scenario update).
- `scenario-anim-b.js` `swallow.pulse0: null`: `env.pulseT` was removed with the hole rim earlier, outside this change → separate task (scenario update).
- `scenario-replay.js` `r7.liveTotalAfter: 0`: classic gnomes are drawn by the batch now, so the one-piece count is 0; expected.

### Risks PP should know

- At play distance (6-10 m) a still frame looks the same as before (`11-before-far.png` vs `22-after-far.png`): the feet swing mostly under the pants and the arms are small. Close up (2-3 m) the step, the swinging arm and the foot clear of the pants are visible (`20-walk-peak.png`).
- Cadence about 4 steps per second at walking speed (short 0.17 m legs, slide-free stride): may read as busy.
- The body itself still snaps upright in one frame on a stop (0.095 rad, as before this change); the hat above it moves smoothly.
- The beard turns up to 1.08 rad on a 180° turn; on `21-turn-peak.png` it stays at the face (the cone is almost vertical), no cut into the shirt.

## Work progress

Harness: `CDP_PORT=9397 node smoke.mjs <out> <scenario>` in the session scratchpad `smoke/`, dev server 5199.

Runs (final code):
- `node smoke.mjs run-parts scenario-parts.js` (default `?lowfx`) → RESULT complete, `LOGS:` empty.
- `URL_QUERY='' DPR=2 node smoke.mjs run-parts-calls scenario-parts.js` → RESULT complete, `LOGS:` empty, shots `20-walk-peak`, `21-turn-peak`, `22-after-far`, `23-after-close`, `24-night` (1280 x 720).
- `URL_QUERY='?noparts' node smoke.mjs run-parts-noparts scenario-parts.js` → `fallback: {partsSize: 0, partsOn: false, classicLagNull: true, calls: 65, classicCount: 50, toast: 1}`, `LOGS:` empty.
- Baseline before the change: `URL_QUERY='' DPR=2 node smoke.mjs parts-before scenario-parts-before.js` → `perf300: {ms: 0.083, calls: 68, triangles: 1274617}`, shots `10-before-close`, `11-before-far`.
- `npx tsc --noEmit` → exit 0.

Done when:
- [PASS] 1 walk — `walk: {legZeroCross: 7, legPeak: 0.799, armSign: -1, bodyMatchesOld: true (29 frames), strideRatio: 1.098}` (deviation 2)
- [PASS] 2 turn — `turn: {hatLagFrames: 5, beardSignChanges: 2}`
- [PASS] 3 start — `start: {hatLagFrames: 4, hatLagFramesDrawn: 6, beardOvershoot: 1, maxLegStepPerFrame: 0.085}` (deviation 6)
- [PASS] 4 stand — `stand: {legDelta: 0, breathSpan: 0.06, hatNoiseSpan: 0.085}`
- [PASS] 5 statue — `statue: {partsIdentity: true, breathSpan: 0}`
- [PASS] 6 — `ragdoll: {partsIdentity: true, after: 0.003}`, `held: {partsIdentity: true}`, `falling: {shrinks: true}` (sampled 0.75 s after the change, deviation 3)
- [PASS] 7 stash — `stash: {hidden: 7, bodiesHidden: true}`
- [PASS] 8 remove — `remove: {lastHidden: true, movedRewritten: true, bodiesMoved: true}`
- [PASS] 9 retype — `retype: {lagCopied: true, phCopied: true, popSeen: true}`
- [PASS] 10 old — `walk.old: {count: 1, batchHidden: true}`; `20-walk-peak.png` checked by eye: left gnome one piece, right gnome mid-step (leg 0.78 rad), back foot clear of the pants, arm swung back
- [PASS] 11 others — `others: {sameAsBefore: true, maxErr: 9.4e-8}` (blue, pre-edit formula with `g.ph`)
- [PASS] 12 night — `night: {hatGlowAttr: true}`; `24-night.png` checked by eye: hat glows red, body dark
- [PASS] 13 calls — shadows DPR 2: `calls: {before: 66, parts: 66, shadow: 0, multiDraw: true}`; lowfx: `{before: 44, parts: 44, lowfx: 0}` (deviation 11)
- [PASS] 14 perf300 — `perf300: {partsMs: 0.277, oldMs: 0.077, diffMs: 0.2, triRatio: 1}` (bound 1.5 ms)
- [PASS] 15 replay — `replay: {partsHidden: true, classicShownOnePiece: true, partsVisible: true}`, `LOGS:` empty (deviation 9)
- [PASS] 16 — `grep -c "^    id: '" src/data/gnomeTypes.ts` → 12; the plan's rollout section names 12 (deviation 7)
- [PASS] 17 — `grep -rn "Math.min(1, dt" src` → no output (exit 1)
- [PASS] 18 — `fan.spinUp95: 0.75`, `wheel.spinUp95: 0.75`, `vacuum.spinUp95: 0.75`, `blackhole.spinUp95: 0.75`
- [PASS] 19 — `fan: {rateAt0_5sAfterBreak: 3.321, rateAt1_2s: 0.202, repairSpinsUp: true}`
- [PASS] 20 — `conveyor: {rollerDecays: true, beltDecays: true}`
- [PASS] 21 — `gear: {at0_25: 4.334 of 11.78, decaysWhenJammed: true}`
- [PASS] 22 — `shroom: {spinUp: true}`, `ufo: {spinUp: true, rollUp: true}`
- [PASS] 23 — `grep -n "swirl.rotation.z -= dt" src/world/environment.ts` → 1 line (434), unchanged
- [PASS] 24 — `?noparts` run: `fallback: {partsSize: 0, classicLagNull: true, calls: 65, toast: 1}` (one-piece path in the parts run: 66); grep → 3 lines (deviation 8)
- [PASS] 25 stop — `stop: {maxLegStepPerFrame: 0.07, restWithin: 0.383}` (deviation 6)
- [PASS] 26 bodies — `bodies: {everySlotWritten: true, stashedHidden: true}`; `scenario-anim-b.js`, `scenario-interp.js`, `scenario-polish-A.js`, `scenario-polish-A-wait.js`, `scenario-golden.js` read `bodies` and finish with `LOGS:` empty
- [PASS] 27 stuck — `stuck: {phDelta: 0, hatPAfter0_5s: 0.00005}`
- [PASS] Plus — `npx tsc --noEmit` exit 0; `grep -rn WALK_FREQ src` → no output; `scenario-perf-tri.js`, `scenario-replay.js` (all R checks as before), `scenario-robots.js`, `scenario-fuses.js` (31 PASS), `../alias/scenario-aliasing.js` (`exceptions: 0, staleTargets: 0`) finish with `LOGS:` empty; `scenario15.js` finishes with `LOGS:` empty, two stale steps under Rejected; `scenario-anim-b.js` walk spans unchanged (`dySpan 0.039, rollSpan 0.127, leanMin 0.095`), phase sequence shifted (distance phase).

Self-check: every new field, constant and branch maps to a plan row (deviations above name the changed ones); no new dependency; files touched only from the brief's set (`models.ts`, `gnomes.ts`, `replay.ts`, `machines.ts` spin block, `factory.ts`, `mushrooms.ts`, `events.ts`, `environment.ts`, `coins.ts`, `sweeper.ts`, `CHANGELOG.md`, this note) plus scenarios in the scratchpad.

Orchestrator (2026-10-20): the two "separate order" items are closed, not left over. `zz-scenario15-scope.js` was already up to date (scope owned, arc read from `P['arc']`): all steps pass, LOGS empty. `scenario-anim-b.js` read the removed `env.pulseT`; it now samples `env.spinBoost`, which `holePulse()` sets today: swallow pulse0 0 → 0.983 at the fall, all steps without ERR, LOGS empty.
