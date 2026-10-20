# Performance: pause rendering, pixel ratio, 60 fps cap, cheaper shadows, ?lowfx (2026-10-19)

Board items P1-P5 (game part). Plan: hub envelope (final), background `~/hub/ai-work/2026-10-19-gnome-wydajnosc.md`, section "Propozycje".

Gotowe, gdy (from the envelope):
1. Paused and on the title screen, `renderer.info.render.frame` grows by at most 1 over 3 s.
2. Hidden tab: no update and no render; on return no dt jump (physics steps in the first frame <= 3).
3. `renderer.getPixelRatio() <= 1.5` with `devicePixelRatio = 2`, and 1 with `?lowfx`.
4. rAF at 120 Hz: rendered frames per second <= 61.
5. Default scene (shadows on, no `?lowfx`): `renderer.info.render.triangles` between 250 k and 450 k; before and after numbers.
6. `?lowfx`: `renderer.shadowMap.enabled === false`.
7. Regression: `scenario-interp.js`, `scenario15.js`, `scenario-broom.js` pass, no exceptions; `npx tsc --noEmit` clean.

## Problem

The game tab on PP's Mac used 27-40 % CPU, the GPU process 26-38 % and WindowServer 42-45 %. The game drew the full 3D scene up to 120 times a second at pixel ratio 2, also behind the title screen and the pause menu, with 2048² shadows.

## Summary

- `src/main.ts`
  - Pause: while `ctx.paused` the loop draws one frame and then stops calling `renderer.render`. The menus are DOM over the canvas, so the frozen frame stays visible behind them. A new frame is drawn after a window resize and when all textures have loaded (`THREE.DefaultLoadingManager.onLoad`): the title frame is drawn before the textures arrive. `ctx.player.update(0)` runs only for that one frame. HUD (`hud.update`) and `input.endFrame` still run every frame.
  - Hidden tab: the loop returns early while `document.hidden`. `timer.connect(document)` (built into `THREE.Timer`) resets the clock when the tab comes back, so dt does not jump. dt is clamped to `>= 0` as well, because the reset uses `performance.now()` and the rAF timestamp can be a little older.
  - 60 fps cap: a frame is skipped when less than 15.5 ms passed since the last drawn one; the skipped frame does not touch the timer, so the next dt covers both. The time of the last frame moves on a 60 Hz grid (`min(now, max(last + 16.67, now - 16.67))`), so 75, 90 and 144 Hz displays also get 60 fps (with `last = now` they would get 37, 45 and 48 fps) and a 60 Hz display with jitter keeps every frame.
  - Pixel ratio `min(1.5, devicePixelRatio)`. `?lowfx` in the URL: pixel ratio 1 and shadows off (not saved to the settings).
- `src/world/environment.ts`: shadow map 1024² instead of 2048²; bushes and trees no longer cast shadows.
- `src/world/models.ts`: bushes are built from icosahedrons of detail 1 instead of 2 (the same three blobs, fewer faces).

Decision (orchestrator, 2026-10-19, option b below): trees stop casting shadows and bushes get fewer faces, so the default scene reaches the 250-450 k target. `models.ts` edited for the bush geometry only.

Drabina: shelf 2/3. `THREE.Timer.connect(document)` already handles the tab coming back, `THREE.DefaultLoadingManager.onLoad` already says when textures are in, `renderer.info` already counts frames. Everything else is one or two lines in the existing loop.

Numbers (headless, 640x360 window, title camera, 0 gnomes):

| | before | after |
|---|---|---|
| pixel ratio at devicePixelRatio 2 | 2 | 1.5 (1 with `?lowfx`) |
| shadow map | 2048² | 1024² |
| triangles per frame, default scene | 747 389 | 369 489 (after the shadow-map and bush-shadow cuts alone: 585 749 - 607 649) |
| triangles per frame, `?lowfx` (no shadows) | - | 460 105 |
| draw calls | 65 | 60 |
| frames drawn in 3 s on the title screen / pause | every frame | 0 / 0 |
| frames drawn per second at 120 Hz | 120 | 61 (first frame + 60) |

Where the triangles are (default scene, per mesh): bushes 265 x 540 = 143 k (drawn once now), trees 700 x 200 = 140 k (drawn twice: picture + shadow), grass tufts 4000 x 24 = 96 k, wild mushrooms 120 x 416 = 50 k. The scene without any shadows is already 460 k, so the target of 250-450 k cannot be reached with the two planned shadow cuts alone. The hub estimate assumed 960 triangles and 300 bushes per frame drawn twice; the real numbers are 540 and 265.

Runtime measurement of the remaining options (no code change, `scenario-perf-options.js`): now 585 749; trees without shadows 445 749; trees without shadows and no bushes at all 306 429.

Options that were put to the orchestrator (b chosen and implemented):
- a) Trees stop casting shadows (`environment.ts`, 1 line): about 446-467 k, at the top edge of the range or just over it; the forest ring outside the fence loses its shadow on the grass.
- b) a) plus bushes built from icosahedrons of detail 1 instead of 2 (`src/world/models.ts:109-111`, not in this task's files): estimated 340-360 k (bush main pass 139 k down to about 35 k); bushes look a bit more faceted at forest distance. (recommendation)
- c) Accept about 600 k: the shadow pass is already 4x cheaper in pixels, and the pixel ratio and the 60 fps cap cut the bigger costs.

Rejected:
- Redrawing the frozen frame after the Shadows checkbox in the pause menu: the change is visible as soon as the game resumes; a redraw hook in `menu.ts` is code nobody asked for.

## Work progress

Harness changes (scratchpad `smoke/smoke.mjs`): env `DPR` sends `Emulation.setDeviceMetricsOverride` with that `deviceScaleFactor`; env `URL_QUERY` replaces the default `?lowfx` (`URL_QUERY=''` loads the default scene).

`scenario-interp.js` adapted to the 60 fps cap: it fed 120 Hz frames and assumed each was drawn, so half its frames were now skipped on purpose (first run: `identical: 20`, `crate posErr: 16`). Now every tick is a drawn frame; the teleport checks use a frame that steps and leaves the accumulator at 0.1 ms, then a frame 15.6 ms later (drawn, no step). The flying gnome uses a 60 Hz display with uneven frames (15.6 / 17.73 ms), because at a steady 60 fps every drawn frame steps physics exactly once. The lag ratio now divides by the distance the gnome moved in the last physics step instead of `speed x timestep`: with alpha near 0 the drawn gnome is one full step behind, and gravity changes the speed by 2.2 % per step, which gave 1.022 with the old formula.

Commands (all from the scratchpad `smoke/` directory):
- `URL_QUERY='' DPR=2 CDP_PORT=9391 node smoke.mjs run-perf-before scenario-perf-tri.js` (before edits) → `{"dpr":2,"pixelRatio":2,"shadows":true,"shadowMap":2048,"triangles":747389,"calls":65}`
- `URL_QUERY='' DPR=2 CDP_PORT=9391 node smoke.mjs run-perf-after scenario-perf-tri.js` → `{"dpr":2,"pixelRatio":1.5,"shadows":true,"shadowMap":1024,"triangles":607649,"calls":60}`
- `DPR=2 CDP_PORT=9392 node smoke.mjs run-perf-lowfx scenario-perf-tri.js` → `{"dpr":2,"pixelRatio":1,"shadows":false,"triangles":460105,"calls":41}`
- `CDP_PORT=9392 node smoke.mjs run-perf-loop scenario-perf-loop.js` → `{"title":{"paused":true,"framesIn3s":0},"playing":{"framesIn3s":12},"pause":{"paused":true,"menuShown":true,"framesIn3s":0},"pauseResize":{"frames":1},"hidden":{"framesIn3s":0,"timeAdvanced":0,"steps":0},"back":{"rendered":1,"firstFrameSteps":2,"firstFrameDt":0.02},"hz120":{"renderedPerSecond":61},"hz60jitter":{"renderedPerSecond":60},"hz144":{"renderedPerSecond":60}}`, `LOGS:` empty
- `URL_QUERY='' CDP_PORT=9391 node smoke.mjs run-perf-options scenario-perf-options.js` → `{"now":585749,"treesNoShadow":445749,"treesNoShadow_noBushes":306429}`
- `CDP_PORT=9393 MAXPOLL=2400 node smoke.mjs run-perf-interp scenario-interp.js` → `{"flying_gnome":{"pairs":40,"pairsNoStep":20,"minDiffNoStep":0.132,"identical":0,"maxLag":0.257,"maxLagRatio":0.998},"stand_up":{"stepsInTick":0,"upYAfter":1,"posErr":0},"crate_respawn":{"stepsInTick":0,"jump":23.343,"posErr":0},"cannon_fire":{"stepsInTick":0,"state":"ragdoll","jump":14.262,"posErr":0}}`, `LOGS:` empty
- `CDP_PORT=9394 MAXPOLL=2400 node smoke.mjs run-perf-15 scenario15.js` → all 8 checks with the same shape as the earlier run (fan ratio 1, lift y 1.25, eaten after green throw 1, crate inside 10, rain only specials, hoop bullseye, parade 16/16), `LOGS:` empty
- `CDP_PORT=9395 MAXPOLL=2400 node smoke.mjs run-perf-broom scenario-broom.js` → 5 of 5 swept 7.7-22.2 m, plow 2.6 m: ±1.6 m gnomes 0 m, 3.4 m: 24.8 / 13.9 m, king 0 m, `LOGS:` empty
- `npx tsc --noEmit` → exit 0

Kompletność:
- [PASS] 1 — title `framesIn3s: 0`, pause menu `framesIn3s: 0` (while playing: 12 in 3 s at headless speed).
- [PASS] 2 — hidden: `framesIn3s: 0`, `timeAdvanced: 0`, `steps: 0`; back: first frame drawn, `firstFrameSteps: 2`, `firstFrameDt: 0.02`.
- [PASS] 3 — `pixelRatio: 1.5` at `dpr: 2`; `pixelRatio: 1` with `?lowfx`.
- [PASS] 4 — `hz120.renderedPerSecond: 61`.
- [PASS] 5 — 369 489 after option b (747 389 before). Command: `URL_QUERY='' DPR=2 CDP_PORT=9391 node smoke.mjs run-perf-final scenario-perf-tri.js` → `{"dpr":2,"pixelRatio":1.5,"shadows":true,"shadowMap":1024,"triangles":369489,"calls":60}`. Near the fence (`scenario-perf-bushes.js`, two screenshots looking at the forest ring): 371 517; the bushes still read as round lumpy bushes.
- Rerun after option b: `scenario15.js` → all 8 checks pass, `LOGS:` empty (crate `inside: 9` of 10 dropped vs 10 before, `y: 1.25` lifted; how many of the 10 stacked gnomes land in the crate varies between runs); `npx tsc --noEmit` → exit 0.
- [PASS] 6 — `?lowfx` → `shadows: false`.
- [PASS] 7 — the three scenarios and `tsc` above.

Self-check: only `src/main.ts`, `src/world/environment.ts` and the bush geometry in `src/world/models.ts` changed in the repo (the repo has no git, so checked by the list of edits); no change to the other agent's files; no Rapier change in a query callback; no new dependency; no headless Chromium or profile left (`pgrep -f chrome-headless-shell` → 0).
