# Animations c: particle fade and noise camera shake

Gotowe, gdy (from the hub task, headless, sample >= 10 frames):
1. A burst's particle alpha (colour channel 4) decreases with remaining life and is near 0 (<= 0.1) in the frame before recycling; no particle disappears at full brightness.
2. Points use a round texture (material has a map); sparks use additive blending.
3. Two shakes of equal strength started at different times give different offset sequences; offset magnitude <= 0.05 rad; back to 0 within 0.6 s.
4. One screenshot of a spark burst and one of dust on grass, checked by eye (dust visible, not black squares, not glowing).
5. Regression: `scenario-polish-A.js`, `scenario15.js` pass, no exceptions, `npx tsc --noEmit` clean.

Plan: `~/hub/ai-work/2026-10-19-gnome-animacje.md`, weak points 3 and 8, proposals 4 and 7, animation rules 6 and 8.

## Problem

Particles lived at full size and brightness and vanished in one frame; points were square (no texture). Camera shake used fixed-frequency sines, so every shake looked the same and periodic.

## Summary

- Ladder: step 2/3 (repo + three). `glowTexture()` was already exported from `src/entities/mushrooms.ts`, used as is. `PointsMaterial` already supports per-vertex alpha when the colour attribute has 4 components; per-particle size needs one `onBeforeCompile` line (`gl_PointSize = size * aSize`). No `ShaderMaterial`, no new dependency.
- Fade choice: alpha fade by `life / maxLife` for all pools. With `AdditiveBlending` three uses `SRC_ALPHA, ONE`, so alpha 0 = adds nothing (same as colour to black). Dust and smoke stay in the normal-blending pool with the same alpha fade, so they never glow on grass.
- Random size +-40 % per particle (`aSize` 0.6..1.4).
- Sparks pool additive. Dark bursts (linear luminance < 0.05: black stalker vanish, shadow/saboteur/angry hats) go to a small third pool with normal blending, because additive black is invisible.
- Shake: `SimplexNoise` sampled at `ctx.time * 15` per axis, amplitude `0.028 * trauma²` per axis (vector magnitude <= 0.0485 rad), trauma decays at `dt / 0.6`, so a full shake is gone in 0.6 s.
- New shake call: gnome landing hard within 6 m of the player, `0.15 * strength` (one line in `src/entities/gnomes.ts`).

## Rejected

- Crate landing shake: the crate code has no landing detection (only dump, respawn, tip-over, catch), so there is no existing call site; adding detection is new behaviour outside the task.
- Kick hit and cannon fire: already call `ctx.fx.shake` (0.12 and 0.05); left as is.

## Work progress

Files: `src/systems/fx.ts` (pools, shake), `src/entities/gnomes.ts` (one line: landing shake near the player). `src/entities/mushrooms.ts` unchanged (`glowTexture` was already exported).

Scenario: `<scratchpad>/smoke/scenario-anim-c.js` (port 9391/9392). Regression copies `scenario-polish-A-wait.js` and `scenario15-wait.js` only add a wait for `window.gnome` at the start: the original files started before the game booted (`window.gnome` undefined, `TypeError ... reading 'player'`) and hung.

Self-check (Gotowe, gdy):
- [PASS] 1 alpha fade: `node smoke.mjs run-anim-c scenario-anim-c.js` → spark burst followed 22 frames, first particle alpha 0.942 → 0.014 (17 samples), `maxLastAlpha 0.083` over 20 particles, `nonMonotonic 0`; dust 18 frames, `maxLastAlpha 0.057`, `nonMonotonic 0`; sizes 0.615..1.391.
- [PASS] 2 material: `sparks {map: true, blending: 2 (Additive), colorItemSize: 4}`, `puffs {map: true, blending: 1 (Normal)}`, black burst routed to the normal pool (`darkEmitted 5`).
- [PASS] 3 shake: `sequencesEqual false` (first samples `[-0.012,-0.007,0.018]` vs `[-0.012,0.008,0.001]`), `zeroAt 0.6` both, max over 2000 samples at trauma 1 `0.038` rad; landing near the player gives `maxTrauma 0.066`.
- [PASS] 4 screenshots `run-anim-c2/spark-burst.png` (round glowing dots), `run-anim-c2/dust-grass.png` (soft brown round puffs on grass, no squares, no glow), `run-anim-c2/smoke-puffs.png`.
- [PASS] 5 regression: polish-A → `drop_impact {dust: 1, maxSquash: 0.15}`, all four steps without ERR; scenario15 → all eight steps without ERR; `LOGS:` empty in all runs; `npx tsc --noEmit` → exit 0.

Discipline: no new dependency, no new file in `src`. Dust is softer than the old square puffs (the glow map fades to the edge); visible by eye, but fainter.

Orchestrator follow-up (same day): the dust screenshot showed the brown puffs blending into the grass. Fixed: puff pool opacity 0.55 → 0.9 and dust colour light beige (0.8-0.88, 0.72-0.78, 0.56-0.62). `scenario-anim-c.js` rerun: fade series unchanged, `LOGS:` empty, `run-dust2/dust-grass.png` shows clearly visible puffs.
