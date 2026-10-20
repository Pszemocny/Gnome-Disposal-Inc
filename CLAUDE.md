# Gnome Disposal Inc.

Browser game, our own design. First-person physics game: a gnome factory makes gnomes, the player feeds them to a hole for money.

## Stack

Three.js (render) + Rapier 3D `@dimforge/rapier3d-compat` (physics, WASM) + Vite + TypeScript. No asset downloads except CC0 textures in `public/textures` (see `CREDITS.md`). Models are built from primitives in `src/world/models.ts`, sounds are synthesised in `src/core/audio.ts`.

## Run

- `npm run dev` → dev server, port 5300 on the LAN (`vite.config.ts`, `strictPort`).
- `npm run build` → type-check + `dist/`.
- Playtest copy for PP: `npx vite build --outDir release --emptyOutDir`, served by `npx vite preview --outDir release` on port 5300. Agents work on a private dev server: `npx vite --port 5199 --host 127.0.0.1`. Never serve half-finished code on 5300.

## Code map

- `src/main.ts`: boot, game loop, autosave.
- `src/core`: `ctx` (shared context, collision groups), state + save (`localStorage`), input, audio.
- `src/data`: gnome types, upgrades (shop), hole levels, land, achievements. Balance numbers live here.
- `src/entities`: gnomes (AI, instancing), factory, coins, mushrooms, machines (tools incl. crate), props.
- `src/player/player.ts`: controller, grab/carry/throw, kick, tool placement.
- `src/systems`: hole (eating, combo, levels, rebirth), buffs, events, goals, achievements, fx.
- `src/ui`: HUD, shop, menu, CSS.

## Rules learned the hard way

- Never change Rapier bodies inside a Rapier query callback (`intersectionsWithShape`, ray predicates): collect first, act after.
- After any code path that can remove a gnome (`gnomes.remove`, `hole.consume`), do not touch its body again in the same loop iteration.
- Adding lights at runtime recompiles all materials: use glow sprites instead.

## Tests

No unit test framework. Verification is scripted play in headless Chromium over CDP:
`node <scratchpad>/smoke/smoke.mjs <outDir> <scenario.js>` with the dev server on 5199 (scripts kept in the session scratchpad; copy them into `tools/smoke/` if they become permanent). In DEV the game exposes `window.gnome` (the `ctx`). Headless rendering runs at about 5 fps, so scenarios wait on frames, not milliseconds.

## Animation rules

Every rule has a check. A change that fails its check is not done. (PP approved these on 2026-10-19.)

1. When you add motion, drive it by `dt` (seconds) or by a timer in seconds, never by frame count. A value chasing a target uses `THREE.MathUtils.damp(a, b, lambda, dt)`, never `a += (b - a) * Math.min(1, dt * k)`. Check: `grep -n "Math.min(1, dt" src` returns nothing new.
2. When a value changes over a fixed time (pop, pulse, ring, text, recoil), map `k = t / T` through an easing from `src/core/ease.ts` (`outBack` for pops and arrivals, `outCubic` for settling, `outElastic` for bounces, `inQuad` for departures). Linear `k` only for physically linear things (belt, rolling wheel). Check: no new `scale.setScalar(k * ...)`, `opacity = 1 - k` or `+= dt * SPEED` on a timed effect without an ease call on the same line.
3. When an object appears, disappears or teleports (spawn, stash, release, consume, respawn, stand up), give it a 0.1-0.3 s transition (scale from 0 / to 0, slerp to the new rotation) and one particle or sound cue at that spot. Check: a headless scenario samples the instance scale and sees at least one value strictly between the two end states.
4. When the player or a machine performs an action (throw, kick, fire, bounce, start, stop), write three phases: anticipation (<= 0.1 s, moves against the action), the action, follow-through (>= 0.15 s, overshoots then settles). The gameplay effect happens on the contact frame of the animation, not before it. A symmetric `Math.sin(t * Math.PI)` is not an action curve. Check: the sampled curve changes sign before the hit and overshoots after it.
5. When something lands, hits, bounces, gets grabbed or eaten, add squash and stretch for 0.1-0.2 s, eased back, with roughly constant volume (`sy * sxz * sxz` within 0.8-1.2). Reuse `g.squash` in `src/entities/gnomes.ts`. Check: the scenario reads the instance matrix scale at the peak frame.
6. When you emit particles, each particle has a lifetime and its alpha or size reaches 0 before it is recycled; a particle never vanishes at full size. Emit from the contact point, in a cone around the impact normal, 6-30 per event, size random +-40 %. Particles must stay visible on the grass (check a screenshot). Check: `ParticlePool.update` in `src/systems/fx.ts` scales alpha or size by `life / maxLife`.
7. When something spins continuously (fan, wheel, gear, swirl, vacuum ring), keep an angular speed and `damp` it toward the target, never `rotation += dt * CONST` directly. Check: breaking a machine makes its spin decay over >= 0.5 s instead of stopping in one frame.
8. When the camera reacts (shake, FOV kick, bob), scale by `trauma * trauma`, sample noise (`three/addons/math/SimplexNoise.js`), cap it (shake <= 0.05 rad, FOV <= +10) and decay within 0.6 s. Check: two shakes of equal strength give different offset sequences.
9. When you read a physics body for rendering, use the interpolated pose (`drawPose` with `ctx.renderAlpha` in `src/core/context.ts`), not the raw body; after any `setTranslation`/teleport call `savePose` so the body does not streak across the map. Check: a scenario that renders between physics steps sees two different matrices for a moving body in consecutive frames.
10. When a character walks, its pose follows its velocity: vertical bob at the step frequency, roll alternating with the steps, lean into acceleration. Scale-only "breathing" is not a walk. Check: the `walk` branch of `writeInstances` uses `linvel`.
11. Before writing a new animation helper, reuse what is on disk: `THREE.MathUtils.{damp, smoothstep, lerp}`, `src/core/ease.ts`, `three/addons/libs/tween.module.js` (Tween.js, bundled with three), `three/addons/math/SimplexNoise.js`, `glowTexture()` (`src/entities/mushrooms.ts`), `ParticlePool`, `g.squash`. A new dependency needs a line in the ai-work note saying why none of these works.
12. Every animation change ships with a headless scenario that samples the animated value over >= 10 frames and asserts its shape (peak, overshoot, decay), plus one screenshot at the peak frame checked by eye.

## Task board as the game spec

PP approved on 2026-10-20: "tablica musi byc aktualizowana po implementacji ogolnymi informacjami, co zostanie wprowadzone, powinny sie tam znalezc decyzje i ich krotkie i tresciwe wyjasnienia, tak aby byla to specyfikacja gry".

- After every finished implementation, update `docs/SPEC.md` (the game spec, in the repo; PP 2026-10-20) and the work status in `BOARD.md` (local): what changed in the game, described for the player (mechanic, behaviour), not a list of files or functions.
- Every decision (PP's or the session's) goes into `docs/SPEC.md` with one or two sentences of "why".
- `docs/SPEC.md` must read like the game specification: someone without the code learns how the game works and why. Technical details and measurements stay in `docs/ai-work/`.

## Decision log

Every task gets a note in `docs/ai-work/YYYY-MM-DD-<topic>.md` (Problem / Summary / Work progress). Read the related notes before changing an area. Design and balance tables: `docs/PLAN.md`.
