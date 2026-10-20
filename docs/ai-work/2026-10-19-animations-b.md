# Easing and action animations (2026-10-19)

Board item b. Plan: hub envelope (final), background `~/hub/ai-work/2026-10-19-gnome-animacje.md` (weak points 1, 4, 6; proposals 2, 3, 5 step 1, 6 for throw/kick/cannon; "Animation rules").

Interpretation: one plain easing file; the swallow, the walk pose, the kick leg, the throw camera and the cannon barrel use it. Physics and game logic stay as they are; everything here is drawing only (the kick impulse still lands at the key press).

Gotowe, gdy (from the envelope):
1. An eaten gnome's instance scale takes at least 3 values strictly between 1 and 0 before it is removed, and it rotates around the hole axis.
2. A walking gnome's matrix changes height and roll over its steps; a standing (zero velocity) gnome's does not; the scale stays 1.
3. Kick leg angle sampled over the kick: moves backwards before the hit, then forward, and overshoots on the way back.
4. Throw: FOV rises then returns to the base within 0.3 s.
5. Cannon: barrel offset goes back then returns with overshoot; barrel yaw changes over several frames when the hole moves.
6. Regression: `scenario-polish-A.js`, `scenario-interp.js`, `scenario15.js`, `scenario-broom.js` pass; no exceptions; `npx tsc --noEmit` clean.
7. One screenshot at the peak of the swallow and of a walk, checked by eye.

## Problem

Gnomes eaten by the hole just fell through the floor and vanished. Walking gnomes only pulsed their scale ("breathing"). Kick, throw and cannon had no wind-up or follow-through: the kick leg was a symmetric `sin(t*π)`, a throw did nothing to the camera, the cannon barrel snapped to the hole in one frame and had no recoil.

## Summary

- `src/core/ease.ts`: `inQuad`, `outCubic`, `outBack`, `outElastic`, `inOutSine` (formulas from the hub report). Drabina: shelf 6, five one-line functions; Tween.js is overkill for single timers (hub report says so too).
- Swallow (`gnomes.ts`): `startFalling` sets `g.timer = 0` (counts up while falling, the field is unused in that state) and calls `ctx.env.holePulse()` once. `writeInstances` for `falling`: scale `1 - inQuad(t / 0.5)` and the drawn pose turns around the hole's vertical axis by `3π * inQuad(...)` (position and rotation), on top of the existing pull to the centre. Physics untouched (collisions are already off while falling).
- Walk (`gnomes.ts`): scale pulse removed. Pose from `linvel`: amplitude `a = min(1, horizontal speed / type speed)`, phase `life * 8`; bob `|sin| * 0.05 * a * scale`, roll around the gnome's forward axis `sin * 0.08 * a`, lean `0.12 * a` towards the velocity. Zero velocity = no offset at all.
- Kick leg (`player.ts`): swing value 0 → -0.25 in 0.06 s (`inQuad`), → 1 in 0.08 s (`inQuad`), → 0 in 0.16 s with `outBack` (passes rest, comes back). Same 0.3 s total.
- Throw camera (`player.ts`): on `throwHeld` a 0.15 s kick: FOV +3 and pitch up 1.5°, both `1 - outCubic(k)`; while Wind-up charges the view dips by up to 1° (`inOutSine(charge)`). The FOV smoothing moved to a `fov` field with `THREE.MathUtils.damp` so the kick adds on top of it instead of being smoothed away.
- Cannon (`machines.ts`): barrel yaw `damp(…, 6, dt)` along the shortest angle; barrel mesh recoils 0.3 along its axis on the shot frame and springs back with `outElastic` over 0.6 s. A placed cannon starts with `t = 0.6`, so it does not show a recoil when placed or loaded (side effect: its first shot can go right away instead of after up to 0.35 s).
- `hole.ts` not changed: the pulse at the fall start is called from `startFalling`; the pulse on `consume` stays ("plus 1 pulse", hub report proposal 3).

Odrzucone:
- A separate fall timer field: `g.timer` is free in the `falling` state.

Decision (orchestrator, after the first report): the kick impulse and the leg's contact frame must coincide. Done with the smallest change: pull-back 0.02 s + strike 0.04 s (contact 0.06 s after the key press), return 0.24 s with `outBack` (total still 0.3 s, cooldown still 0.45 s). `kick()` now only starts the animation and sets `kickPending`; the old effect moved unchanged to `kickHit()`, which `updateKickLeg` calls once the kick timer passes the contact time (no `setTimeout`).

## Work progress

Scenario `<scratchpad>/smoke/scenario-anim-b.js`: takes over `requestAnimationFrame` and runs the real game loop at 60 Hz (one physics step per frame), samples every frame. Run: `CDP_PORT=9387 MAXPOLL=2400 node smoke.mjs run-anim-b scenario-anim-b.js`, `LOGS:` empty.

- [PASS] 1 — swallow: 30 frames in `falling`, 27 scale values strictly between 1 and 0 (1 → 0.84 → 0.51 → 0.066 → 0), drawn angle around the hole axis vs the body goes 0 → -3π over the fall; gnome removed; rim pulse fresh (0.233 s) at the fall start.
- [PASS] 2 — walk over 40 frames: walker height offset span 0.039, roll -0.063 … +0.063 (alternating), lean 0.095 into the move, scale deviation 0; standing gnome (state walk, no target): height span 0, roll span 0, scale deviation 0.
- [PASS] 3 — kick leg angle minus rest, per frame (after the contact decision): -0.104, -0.067 (back), +0.272, +0.525 (strike, peak at frame 3 = 0.067 s), then down to -0.06 (overshoot past rest), then 0. `kickHit` ran at frame 3 and a gnome 1.2 m ahead started moving at frame 3: impulse and contact frame coincide. `scenario15.js` rerun: all 8 checks, `LOGS:` empty; `npx tsc --noEmit` → exit 0.
- [PASS] 4 — throw: FOV +3 on the throw frame, 2.1, 1.4, … 0 at 0.15 s.
- [PASS] 5 — cannon: offset along the barrel -0.3, -0.21, -0.08, +0.03 … +0.111 (overshoot), settles to 0; hole moved 90° around the cannon: barrel yaw moves over 28 frames, largest single-frame step 0.149 rad.
- [PASS] 6 — `scenario-polish-A.js` (dust 1, squash 0.15, 1 scream, hop 0.44 → 0.66), `scenario-interp.js` (0 identical frames, lag ratio 0.998 < 1 step, teleports error 0), `scenario15.js` (all 8 checks), `scenario-broom.js` (all steps; sweep 5 of 5 ≥ 3 m when run alone; 3 of 5 when five Chromes ran in parallel, the scenario walks real-time gnomes) — all `LOGS:` empty. `npx tsc --noEmit` → exit 0 (also after the orchestrator's tier change in `gnomes.ts`).
- [PASS] 7 — screenshots `run-anim-b/swallow-peak.png` (gnome at ~0.85 size inside the hole over the vortex) and `run-anim-b/walk.png` (gnome leaning/rolling mid-step, normal size), checked by eye.

Self-check: only `ease.ts` (new), `gnomes.ts`, `player.ts`, `machines.ts` and this note changed; `fx.ts` and `hole.ts` untouched; no Rapier change in a query callback; no body read after removal (render-only code).
