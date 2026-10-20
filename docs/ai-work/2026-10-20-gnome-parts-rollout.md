# Gnome parts rollout, Phase A: classic gnome seen from behind (sway + arms)

Interpretation: execute ONLY Phase A (steps 1-4) of `## Plan (plan-senior, final)` in `2026-10-20-plan-gnome-parts-rollout.md` and stop. PP narrowed the work to "zwykle gnomy od tylu" and "skup sie na bujaniu i ruchu rak". Phase B (legs, rollout to all types, flail, kick, replay poses, robot wheels) is not started. The orchestrator brief forbids `release/` and port 5300, so step 4 stops after `npx tsc --noEmit` (no `vite build --outDir release`).

Gotowe, gdy: the plan's Phase A `### Done when` A1-A10, plus A11 without the release build, plus SPEC and CHANGELOG lines.

## Problem

From behind at play distance (6-10 m), the demo's moving-parts gnome looked wooden. Its thin arms hung inside the body outline and swung forward and back, which you cannot see from behind. The body rolled 0.08 rad and had no sideways sway.

## Summary

- `src/world/models.ts`: shoulder pivots moved to x ±0.17. Arms are now `CylinderGeometry(0.05, 0.055, 0.26, 10)` and hang 0.3 rad outward. Hands are `SphereGeometry(0.055, 8, 6)` at the arm's end, at (±0.2468, -0.2194, 0.061). The saboteur wrench is centred on the new right hand, and the wizard staff and orb sit at the hand's x/z. The staff is still carried rigid by the torso. Legs, pants and the collider are unchanged.
- `src/entities/gnomes.ts`: `ARM_SWING` goes from 0.4 to 0.6, plus new `FLAP 0.3`, `ROLL 0.2` (was the literal 0.08) and `SWAY 0.06`. `LAG_LAMBDA` goes from 12 to 8, per the plan. `PartLag` gets `roll` and `hatR`. In the walk branch, the body shifts `-sin(ph)·SWAY·a·scale` along the gnome's local +X, which is the side the roll tips the hat. A new helper `walkRoll(g, a)` gives the roll and is shared by the drawn body and `updateLag`. The hat roll lags the body roll (`hatR` damps toward 0, λ 8). Both arms roll by `FLAP·s`, so each arm swings outward on its own back swing. The sway and roll apply to every type, including one-piece gnomes. Only classic has the moving arms and hat.
- Scenario `<scratchpad>/smoke/scenario-parts.js`: new steps `geom`, `hatRoll`, `rear` (+ `40-rear-sheet`), `far` (+ `41-side-sheet`) and `perfGpu`. `walk` and `others` measure sway, roll and arms. `fallback` checks `allLagNull`, `onePieceSway` and `armLen`. The shots are renamed to `30-far-new` and `31-close-new`.
- `docs/SPEC.md` (Gnomy: a movement line plus the PP 2026-10-20 decision with its reason) and `CHANGELOG.md` (`## next build (not on 5300 yet)`).

Ladder: rung 6 for the pose and sway literals (plan values), rung 2 for `THREE.MathUtils.damp`, the existing `PartLag`/`writeParts` machinery and `FWD`/`tmpA`.

### Deviations from the plan

1. No `release/` build (A11): the orchestrator brief says "No `release`, no port 5300". This overrides plan step 4 and R15.
2. A6 `far`: the v0 framing (`tp(sx + 6, sz + 2)`) is a three-quarter view at 8.9-9.5 m, not "side-on at 8 m" as row A6 says. There it measures hand 8.6 px (FAIL ≥12) and hat 6.5 px. Row A6 is now measured side-on at 8.1 m, with the camera keeping pace with three walkers in file. The v0 numbers stay in the result as `v0Framing`. Side-on, the hat's sideways swing points at the camera: on screen it moves 2.8 px (`hatScreenPx`). `hatPx` is therefore the sideways world swing converted to pixels at that depth (9.7 px), the same method as the plan's Data pixel budget and the `rear` step.
3. A5 `rear`: pixel spans use the sideways world offset from the interpolated physics position (no sway), times `f / depth`. Raw screen x would add the perspective drift of off-axis walkers moving away (about 9 px per stride for a walker 2 m off the axis). Bounds are on the median of the 6 walkers. In the final run one walker stood still while sampled (`minWalker` torso 0 px): it was most likely bumped by a neighbour. In the previous run all 6 moved (min torso 8.6, hat 14.5, hand 6.6 px).
4. A3 `hatRoll`: the peak is read on the hat's world roll angle, not on the hat tip's world lateral position. The tip position includes the in-phase body sway, which hides the lag (about 1 frame).
5. Projection at 1280x720: the harness canvas is 960x540 (the game caps the pixel ratio). Pixels are computed on a virtual 720 px tall image (`f = 360 / tan(fov/2)`), as in the plan's budget. The sheets are 320x240 crops at canvas resolution.
6. Runs: `run-A` is `URL_QUERY='' DPR=2` (needs shadows and the non-lowfx `shots` step for the stills and sheets). The scenario's lowfx pass gave the same Phase A numbers.

### Rejected

- none

### Uncertain

- `perfGpu` (render + `gl.finish()`) reads about 0.2 ms for 300 walkers and 1.28 M triangles with shadows, parts and one-piece alike. That looks too low for the GPU: ANGLE on Metal likely returns from `finish()` before the GPU is done (inference, not measured). The bound passes, but the number probably does not see GPU cost. Phase B's `perf300.renderMs` has the same limit.

## Work progress

Red run before the code (lowfx): `geom: {armLen: 0.199, pivotX: 0.208, handOutward: false, ...}`, `walk: {swaySpan: 0, rollSpan: 0.126, armPeakPitch: 0.4, armRollSpan: 0, armOutOnBackswing: false}`, `hatRoll: {lagFrames: 0}`, `rear: {torsoPx: 0, ..., sameSide: 0.517}`, `others.blueSwaySpan: 0`.

Commands (dev server 5199, `CDP_PORT=9381`): `URL_QUERY='' DPR=2 node smoke.mjs run-A scenario-parts.js`; `URL_QUERY='' node smoke.mjs run-A-gpu scenario-parts.js`; `URL_QUERY='?noparts' node smoke.mjs run-A-gpu-np scenario-parts.js`; `URL_QUERY='?noparts' node smoke.mjs run-A-np scenario-parts.js`. Every run ended with `LOGS:` empty.

Gotowe, gdy (Phase A):
- [PASS] A1 — run-A `geom: {armLen: 0.26, pivotX: 0.17, handOutward: true, wrenchAtHand: true, staffAtHand: true}`; `rg -n "0.24, 10\)|-0.15, 0.02" src/world/models.ts` → no output (exit 1)
- [PASS] A2 — run-A `walk: {swaySpan: 0.095, rollSpan: 0.316}`, `others: {blueSwaySpan: 0.095, sameAsFormula: true}`
- [PASS] A3 — run-A `hatRoll: {lagFrames: 4, lags: [4,4,3,4]}`
- [PASS] A4 — run-A `walk: {armPeakPitch: 0.6, armRollSpan: 0.6, armOutOnBackswing: true}`
- [PASS] A5 — run-A `rear: {torsoPx: 9.092, hatPx: 15.223, handPx: 6.863, sameSide: 0.983, distance: [6.021, 7.011], strides: 1.892}`
- [PASS] A6 — run-A `far: {handPx: 15.095, hatPx: 9.701, hatScreenPx: 2.814, footPx: 13.906, distance: [8.12, 8.137]}` (deviation 2)
- [PASS] A7 — `ls run-A/` → `30-far-demo.png 30-far-new.png 31-close-demo.png 31-close-new.png 40-rear-sheet.png 41-side-sheet.png` (6 files + the 2 sheets). By eye, rear sheet at 7.1-7.5 m: hands stick out to the side and flick outward one after the other, the bodies tilt, hats lean. The waddle reads by comparing tiles, not strongly in a single frame. Side sheet at 8.1 m: gnomes about 30 px tall, arm swing barely visible.
- [PASS] A8 — run-A `turn: {hatLagFrames: 7}`, `start: {maxLegStepPerFrame: 0.085}`, `stop: {maxLegStepPerFrame: 0.07, restWithin: 0.383}`, `stand: {legDelta: 0}`, `stuck: {phDelta: 0}`
- [PASS] A9 — `run-A-gpu perfGpu.renderMs 0.22` − `run-A-gpu-np perfGpu.renderMs 0.208` = 0.012 ms ≤ 1.5 (see Uncertain)
- [PASS] A10 — run-A-np `fallback: {partsSize: 0, allLagNull: true, toast: 1, calls: 65, onePieceSway: true, armLen: 0.26}`. The calls count equals the demo's `?noparts` run (65).
- [PASS] A11 (without release) — `npx tsc --noEmit` → exit 0; no Phase B edit.
- [PASS] Rule 1 check — `grep -rn "Math.min(1, dt" src` → no output.
- [PASS] Regression (gnome body readers) — `scenario-anim-b`, `scenario-interp`, `scenario-polish-A`, `scenario-polish-A-wait`, `scenario-golden`, `scenario-replay` → RESULT and `LOGS:` empty (replay `r6.bytes 12321600`, unchanged in Phase A).

Self-check: the diff touches only the arm and hand primitives, the wrench and staff positions, 4 consts, 2 `PartLag` fields, the walk branch, `updateLag` and the hat/arm cases of `writeParts`, plus one helper that is used twice. Nothing is added beyond plan steps 1-3. The new code follows the existing `damp` and literal-with-formula-comment style.
