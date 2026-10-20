# Night hats: gnome hats glow a little at night, Low keeps the day look (2026-10-20)

Plan: `2026-10-20-plan-night2.md`, item B (steps B1-B3), orchestrator decisions all a): the level-6 gate and the 240 s cycle stay; on Low only the look stays day (`night` and `isNight` keep running, so the Shadow Gnome visitor still comes).

Gotowe, gdy (the plan's "Done when" for B, `CDP_PORT=9391 MAXPOLL=2400 URL_QUERY='' node smoke.mjs <out> scenario-daynight.js`):
- N1 `holeLevel 5, dayClock 190` -> `n1 = {night: 0, hatGlow: 0}`
- N2 `holeLevel 6, clocks 50/150/190/230` -> sun down then up
- N3 `clock 190` -> `hatGlow > 0.6`, glow attribute 1 on hat vertices, 0 elsewhere
- N4 `clock 50` -> `hatGlow = 0`
- N5 cookie quality low, clock 190 -> `{nightShade: 0, sun: 2.6, lamp: 0, isNight: true}`
- N6 `?lowfx`, clock 190 -> `nightShade = 0`
- N7 select Low at night, 1 frame -> `{shadeBefore > 0.6, shadeAfter: 0}`
- N8 day frame vs night frame, same gnomes -> calls and triangles equal; also before/after the change
- `night.png` with glowing hats checked by eye
- `npx tsc --noEmit` clean

## Problem

Night 2, item B: at night (hole level 6 and up) gnome hats should glow a little. Low quality keeps the day look. Draw calls and triangles must not change.

## Summary

- `src/world/environment.ts`: new public `nightShade`. It equals `night`, but it is 0 under `?lowfx` or Low quality, read every frame (one compare). Every visual write (sky, fog, sun, hemi, desk lamp, stars, fireflies) now uses `nightShade`. `isNight` still reads `night`, so the Shadow Gnome visitor still comes on Low (decision 6 a). The damping line is untouched.
- `src/world/models.ts`: `Part.glow?: boolean`. When any part of a model asks for it, `build()` adds a float `glow` attribute (1 on glowing parts, 0 elsewhere) and keeps it. Only the gnome hat cone and brim are marked; every other model is built as before.
- `src/entities/gnomes.ts`: each gnome material gets `onBeforeCompile`, which adds `hatGlow * (vGlow * night)` to the emissive term, and `customProgramCacheKey = 'gnome-hatglow'`. The shared `NIGHT` uniform is attached inside `onBeforeCompile`, because the quality switch recompiles every material. `HAT_GLOW = 0.5` (plan value; the screenshot reads as a soft glow, so it stays). `writeInstances()` writes `NIGHT.value = ctx.env.nightShade` first. Getter `hatGlow` for tests.
- Ladder: rung 2/3. The quality prefs, `vcMat`, `build()` and three's own `onBeforeCompile` hook already existed; no new file, no new dependency, no light, no mesh.

Deviations from the plan:
- N2 expected the sun ">= 2.0" at clock 230. The cycle curve is untouched (assumption 3), and at clock 230 its target night is still 0.42, so the sun reads 1.848 (the same 1.848 as before the change). The "up" sample is taken after the clock wraps past 240 (clock 5): sun 2.598. The shape "down then up" holds.

Rejected:
- Tuning `HAT_GLOW` below 0.5: the night screenshot shows lit hats on dark bodies, not blown out; the plan's value stays.
- The wizard's staff mini-hat, the king's crown and the Boom fuse bands do not glow (plan assumption 4).

## Work progress

Scenarios (new): `<scratchpad>/smoke/scenario-daynight.js` (staged over 3 loads: default, cookie Low, `?lowfx`) and `<scratchpad>/smoke/scenario-daynight-shot.js` (close-up day/night shots, triangles per type). `<scratchpad>` = `/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-boozed/844ac005-e3c6-4341-b0ea-34b547159d26/scratchpad`. Command: `URL_QUERY='' CDP_PORT=9391 MAXPOLL=2400 node smoke.mjs ../night-hats/<out> <scenario>`. The first baseline run hung before the title screenshot; the rerun went through.

Before the change (`night-hats/run-before`): 20 gnomes, day 86 calls / 440 547 triangles, night 86 / 440 547.
After (`night-hats/run-daynight`): 20 gnomes, day 85 / 435 029, night 85 / 435 029. Across runs the scene differs by the random forest and chair (±2 %, smooth-graphics note); per gnome nothing changed: classic 1516, Boom 2060, Wizard 1980, King 1752, Saboteur 1668 triangles (same as the smooth-graphics note).

Kompletność:
- [PASS] N1 — `n1: {night: 0, nightShade: 0, hatGlow: 0, sun: 2.6}` at level 5, clock 190.
- [PASS] N2 — `n2.sun: [2.6, 1.756, 0.275, 1.848, 2.598]` for clocks 50 / 150 / 190 / 230 / after the wrap (clock 5); `shade` equals `night` on Medium at every sample. See the deviation for 230.
- [PASS] N3 — `n3: {hatGlow: 0.989, nightShade: 0.989, shaderPatched: true}`; `attr` for all 12 types: `{hatMin: 1, othersMax: 0, hatN: 432}`.
- [PASS] N4 — `n4: {hatGlow: 0, sun: 2.6}` at clock 52.
- [PASS] N5 — cookie `quality: low` → `n5: {night: 0.984, nightShade: 0, hatGlow: 0, sun: 2.6, lamp: 0, stars: 0, isNight: true}`.
- [PASS] N6 — `?lowfx` → `n6: {nightShade: 0, sun: 2.6, isNight: true}`.
- [PASS] N7 — select Low at night → `n7: {shadeBefore: 0.993, shadeAfter: 0}` after 1 frame, sun 2.6, no reload.
- [PASS] N8 — same run: day `calls 85, triangles 435029`, night `calls 85, triangles 435029`, 20 gnomes both.
- [PASS] screenshot — `night-hats/run-daynight/night.png`: hats in red, orange, green, blue, yellow stand out on dark bodies and grass; `close-day.png` looks as before.
- [PASS] `npx tsc --noEmit` → exit 0.
- [PASS] rule 1 — no new `Math.min(1, dt` in the three files (environment 2, gnomes 1, models 0, same as before).
- `LOGS:` empty in every run.

Self-check: only the three owned files changed (the project is not a git repository; diff against copies taken before the first edit). Every new line has a plan step behind it. No edit in `main.ts`, `menu.ts` or other shared files was needed.
