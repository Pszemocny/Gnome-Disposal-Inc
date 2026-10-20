# Render interpolation between physics steps (2026-10-19)

Board item a. Plan: hub envelope (final), background `~/hub/ai-work/2026-10-19-gnome-animacje.md`, weak point 2 and proposal 1 (Gaffer "Fix Your Timestep").

Gotowe, gdy (from the envelope):
1. Two render frames inside one physics step give two different instance matrices for a flying thrown gnome.
2. The drawn position of a flying gnome is never further than one physics step of travel from its body.
3. A gnome that stands up, a crate that respawns and a gnome fired from a cannon are drawn at the new place in the next frame.
4. Regression: `scenario-polish-A.js`, `scenario15.js`, `scenario-magnet-gun.js` pass, no exceptions, `npx tsc --noEmit` clean.

## Problem

Physics steps at a fixed 1/60 s, render runs at the monitor rate. On a 120/144 Hz monitor every second frame showed the same pose of a flying gnome, so thrown gnomes stuttered. When a frame needed 3 steps, the accumulator was set to 0, so the game slowed down.

## Summary

- Game loop (`src/main.ts`): before each `physics.step()` every drawn dynamic body saves its pose (`savePoses()` on gnomes, coins, props, machines). After the steps `ctx.renderAlpha = acc / timestep`. The slowdown fix: `acc = Math.min(acc, timestep)` instead of `acc = 0` after 3 steps, so the backlog is still dropped (no spiral of death) and alpha stays in 0..1.
- Drawing: `drawPose()` in `src/core/context.ts` gives the pose between the saved one and the body by `renderAlpha` (`lerp` + `slerp`, written from the body side so no temporary object is needed). Used by gnomes (`writeInstances`), coins on the ground, props, and the crate.
- Gnome instances and the crate are now drawn by the game loop after all systems ran (`ctx.gnomes.writeInstances()`, `ctx.machines.drawCrates()`), because they were drawn before the physics step. Side effect: a gnome removed by the hole later in the same frame no longer leaves one frame with a wrong slot matrix.
- Teleports call `savePose()` right after `setTranslation`, so the next frame does not draw a streak: `standUp`, `release` (crate spill, cannon fire, machine removal), the wizard's `cast` teleport, the crate `respawn`, both prop respawns. Spawn starts with prev = spawn pose.
- Game logic still reads the body; `m.pos`, `c.pos` and the prop checks are unchanged.
- Cost: one `Vector3` + one `Quaternion` per gnome, coin, prop and machine, allocated once at spawn. No per-frame allocation added.

Drabina: shelf 3 (Three `lerp`/`slerp`) plus minimum code; one helper pair in `context.ts` next to the other small shared helpers, instead of the same 4 lines in four files.

Odstępstwa:
- `context.ts` got the `Pose` type and the `savePose`/`drawPose` helpers, not only the alpha field. Reason: the same snapshot and blend code was needed in four entity files.
- Teleport handling: explicit reset on each path, no "jump > 2 m" check. Reason: the plan allows either, and the cannon release can be shorter than 2 m from the stash point, so a distance check would miss it.

Odrzucone:
- Interpolating flying coins: they are not drawn from a body (it is removed), they fly by a per-frame lerp to the player.
- Snapping the mesh of a prop on the same frame as its respawn: the old mesh place is under the ground (below the hole, or y < -10), so the one stale frame is not visible; the next frame draws the new place.

## Work progress

Scenario `<scratchpad>/smoke/scenario-interp.js`: it replaces `requestAnimationFrame` and calls the real game loop with timestamps 1/120 s apart (a 120 Hz monitor), and counts `physics.step()` calls. Run: `CDP_PORT=9391 MAXPOLL=2400 node smoke.mjs run-interp scenario-interp.js`. First run: the teleport checks landed on ticks that stepped physics, which does not test the reset; the scenario now waits for a tick right after a step, and reports `stepsInTick`.

Result:
`{"flying_gnome":{"pairs":40,"pairsNoStep":20,"minDiffNoStep":0.12,"identical":0,"maxLag":0.131,"maxLagRatio":0.502},"stand_up":{"stepsInTick":0,"upYBefore":0,"upYAfter":1,"posErr":0,"state":"walk"},"crate_respawn":{"stepsInTick":0,"jump":23.343,"posErr":0},"cannon_fire":{"stepsInTick":0,"state":"ragdoll","jump":14.258,"posErr":0,"oneStep":0.211}}`, `LOGS:` empty.

- [PASS] 1 — 40 frames of a thrown gnome at 120 Hz, 20 of them without a physics step; every frame moved the drawn gnome (smallest move in a no-step frame 0.12 m), 0 identical consecutive matrices.
- [PASS] 2 — largest gap between drawn and body position 0.131 m, at most 0.502 of one physics step of travel.
- [PASS] 3 — in a frame without a physics step: a lying gnome stands up and is drawn upright (up axis y 0 → 1) exactly at the body (error 0); a crate teleported 23.3 m by respawn is drawn at the body (error 0); a gnome fired from a cannon 14.3 m from its stash point is drawn at the body (error 0, one step of its travel is 0.21 m).
- [PASS] 4 — `scenario-polish-A.js` (dust 1, squash 0.15, 1 scream, hop 0.44 → 0.66), `scenario15.js` (all 8 checks as before), `scenario-magnet-gun.js` (all steps returned values, no `ERR`, `allInside` true; first run hung without a result, rerun passed), all `LOGS:` empty; `npx tsc --noEmit` → exit 0.

Self-check: only the six owned files changed; no Rapier change inside a query callback; `savePoses` skips flying coins (their body is removed); no body touched after `remove` (removed entities leave the lists before the next snapshot).
