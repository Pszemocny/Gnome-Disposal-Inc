# Plan: smooth graphics (sky colour, lighting contrast, shadows, normals)

Spec: PP, 2026-10-20: "spróbuj wygładzić grafikę, może trzeba dodać jakiś plugin do tego three js albo coś, bo jest taka toporna" (smooth out the graphics, maybe a three.js plugin, it looks crude).
Trivial check: touches `src/world/environment.ts` and `src/world/models.ts` on the per-frame render path (lights, fog, sky shader, instanced geometry of 700 trees / 265 bushes / up to 320 gnomes); the texture pass (`2026-10-20-plan-textures.md`) is already on disk and is not touched.

## Plan v0 (plan-author)

### Goal
The yard reads as a soft, lit cartoon: a sky that meets the horizon, visible shadows with depth, round blobs instead of facets, smoother gnome hats, at no extra GPU cost (triangles and draw calls at or below today).

### What the screenshots say (ranked by visible impact)
Real-GPU screenshots (Chrome for Testing with `--use-angle=metal`, Apple M3 Max, pixel ratio 1.5, 640x360 at DPR 2) in `<scratchpad>/smooth/run-gpu` (variants g0-g12) and `<scratchpad>/smooth/run-final` (f1-f6). Harness copy: `<scratchpad>/smooth/tmp-smoke-gpu.mjs` (`FULL=1 URL_QUERY='' DPR=2 CDP_PORT=<port> node tmp-smoke-gpu.mjs <out> <scenario>`). Fact: the SwiftShader harness renders no PCF shadows at all (only `BasicShadowMap`, see `run-shadow/s3-basic.png`), so every shadow check below runs on the Metal harness.

| # | cause | evidence | fix | GPU/CPU cost at pixel ratio 1.5 |
|---|---|---|---|---|
| 1 | Sky shader writes linear colour straight to the sRGB canvas: top of the sky is (25,91,207) instead of the authored 0x4f9ee8 (~(118,180,220)); the horizon shows a pale band where fog 0xcfe8ff meets a sky bottom that is drawn far darker than 0xcfe8ff | `run-gpu/g0-base-yard.png` vs `run-final/f1-sky-cs-yard.png`, `f1-sky-cs-forest.png`; pixel probe `run-px` RESULT `skyToday [25,91,207]`, `skyFixed [118,180,220]` | two `#include` lines in the fragment shader (`environment.ts:66`) | 0 (same single full-screen sphere) |
| 2 | Flat lighting: hemisphere 1.4 vs sun 2.2 and sun elevation 59° (`update():353`), so shadows are 0.6x object height and only ~35 % darker; gnomes look pasted on the grass | `g0-base-gnomes.png` vs `run-final/f3-pack-aces-gnomes.png` | sun at `(p.x + 22, 32, p.z + 14)` (51°), sun 2.6, hemi 0.9, `shadow.radius = 2` | 0 (r186 PCF is a fixed 5-tap Vogel disk whatever the radius) |
| 3 | Faceted blobs: bushes (265 instanced + 1 prop) and clouds (14) are icosahedrons detail 1 with flat normals | `run-gpu/g10-combo-forest.png` (facets) vs `run-final/f3-pack-aces-forest.png` (smooth) | `mergeVertices` + `computeVertexNormals` on the three icosahedra | 0 (240 triangles per bush before and after, measured) |
| 4 | Gnome close-up facets: hat cone and brim are 16 segments (12 asked, clamped to 16 in `cone`/`cyl`), arms 16; meanwhile hands, nose and eyes are 16x12 spheres (352 triangles each, 1.6-4.5 cm) → 2940 triangles per gnome per pass (measured) | `g0-base-gnomes.png` hat bands | hat and brim 24 segments, arms 10, hands/nose 8x6, eyes 6x5 → 1516 triangles | negative: 120 gnomes x 2 passes 706 k → 364 k triangles |
| 5 | No depth in the forest ring: fog starts at 60 m, the forest stands at 25-60 m, so far trees are as saturated as near ones | `f1-sky-cs-forest.png` vs `f3-pack-aces-forest.png` | fog near/far tied to the land size in `rebuildLand()` | 0 |
| 6 | Tone mapping ACES 1.05 keeps primaries punchy (electric blue/green) | `f3-pack-aces-yard.png` vs `f4-pack-neutral-yard.png` vs `f5-pack-agx-yard.png` | PP's choice (open decision 1) | 0 |

Not causes (checked, no step): aliasing (MSAA 4x is on: `gl.SAMPLES = 4`; `g11-fxaa-yard.png` and `g12-smaa-yard.png` show no edge gain over `g0`); shadow acne/peter-panning (normalBias 0.04 is right); colour banding (none in any shot); pop-in (everything instanced, no LOD); shadow texel size (1024² over 80 m = 7.8 cm, visible only inside 1 m; radius 2 hides it); textures (already redone today).

### Two directions compared
- A) "clean light" (this plan): sky colour fix, longer and darker shadows, smooth normals on blobs, hat segments, fog depth. Wins: fixes every ranked cause, zero added GPU work, fewer triangles, the gnomes PP likes keep their look. Costs: none measurable; the night sky becomes navy instead of near-black (row 2).
- B) "toon + outlines": `MeshToonMaterial` with a 3-step gradient on every `vcMat()` plus inverted-hull outlines (second draw of every mesh, `BackSide`, scaled 1.03) or an edge pass. Wins: a strong, consistent cartoon style. Costs: inverted hull doubles draw calls (60 → ~120) and triangles (369 k → ~740 k, over the 450 k ceiling); an edge pass needs `EffectComposer` (loses the canvas MSAA unless the render target gets `samples: 4`, plus 2 full-screen passes at 2268x1473 on PP's Mac); `g9-toon-yard.png` shows trees and gnomes going flat and posterised, which is more "crude", not less. Recommendation: A. B stays available as a later style task.

### Behaviour matrix
| state / input | action | expected outcome | source |
|---|---|---|---|
| day, default scene | render | sky top-centre pixel ≈ (118,180,220) ± 25, no pale band at the horizon | cause 1, `f1-sky-cs-forest.png` |
| night (hole level ≥ 6, `dayClock` in the night window) | render | sky navy (authored 0x05061a through colour management), stars visible, fog colour follows the same lerp as today | `environment.ts:377-379`, `run-final/f6-pack-night-yard.png` |
| shadows on, gnome standing on grass | render on the Metal harness | shadow ≈ 0.8x gnome height towards −x/−z, soft edge, ground in shadow ≤ 0.7x the lit ground luminance next to it | cause 2 |
| shadows off (menu checkbox) | toggle | no shadow map; sun 2.6 / hemi 0.9 still give the shading contrast; nothing else changes | `menu.ts:41` |
| `?lowfx` | load | pixel ratio 1, shadows off, same lighting and fog values | `main.ts:38-43` |
| forest bushes (265 instanced) and the prop bush | render | smooth normals (the three normals of any face differ), 240 triangles per bush | cause 3, `environment.ts:129`, `props.ts:39` |
| clouds (14) | render | smooth normals, triangle count unchanged | cause 3, `environment.ts:73` |
| gnome, each of the 11 types | spawn | hat/brim 24 segments, 1516 triangles for `classic` (< 1600 for every type without extras); crown, staff, goggles parts unchanged | cause 4, `gnomes.ts:87` |
| land Backyard (half 22) | boot | `fog.near = 37`, `fog.far = 202` | cause 5 |
| land purchase (shop → `rebuildLand()`), e.g. Dark Forest (half 58) | `rebuildLand()` | `fog.near = 73`, `fog.far = 238` | cause 5 |
| title screen / pause | one frame drawn | same settings as play, still one frame (`redraw` logic untouched) | `main.ts:148-150` |
| default scene, title camera, 0 gnomes | `renderer.info` | triangles 250-450 k (today 369 489), draw calls ≤ 66 (today 60) | `2026-10-19-performance.md` |
| 40 gnomes in view | `renderer.info` | triangles ≈ 597 k − 40 x 2 x 1424 ≈ 480 k | measured `run-gpu` g0 |
| [spec silent] rocks (hole level ≥ 2) | render | stay faceted (dodecahedrons are rocks) | open decision 4 |
| [spec silent] wild mushrooms (120), mushroom pickups, hedges, flamingos, UFO lights (all through `sph`/`cyl`/`cone` with the ≥ 16 clamp) | render | unchanged | open decision 5 |
| [spec silent] tone mapping | boot | ACES 1.05 stays unless PP picks b) or c) | open decision 1 |
| [spec silent] Golden Hour tint, combo swirl tint, booze CSS filter | play | untouched (no writer in this plan) | `environment.ts:359-362`, `main.ts:146` |

### Reach
- `environment.ts:60-67` `skyMat` fragment shader: uniform writers `update():377-378` (night lerp) unchanged; no other reader. `ShaderMaterial` gets `toneMapping()` and `linearToOutputTexel()` in its prefix (`WebGLProgram.js:776,782`), so the two chunks compile.
- `environment.ts:71` `scene.fog`: colour writer `update():379` unchanged; near/far get one writer, `rebuildLand()` (callers: constructor, land purchase in the shop). Sprites and sky use `fog: false` and stay out.
- `this.sun` / `this.hemi`: intensity writers are the constructor (`:48,:50`) and `update():380,382`; position writer `update():353`; all four lines change together. `shadow.radius` has no writer today.
- `M.bushGeometry()` callers `environment.ts:129`, `props.ts:39` (both get the smooth normals); `M.cloudGeometry()` `environment.ts:73`; `gnomeGeometry(t)` only `gnomes.ts:87` (11 types, instanced, `castShadow`/`receiveShadow` true).
- `sph`/`cyl`/`cone`/`lathe` helpers (`models.ts:43-46`) and their ≥ 16 clamps stay; the gnome uses explicit `THREE.SphereGeometry`/`CylinderGeometry` for its small parts.
- `renderer.toneMapping` (`main.ts:45`): changed only if open decision 1 picks b/c; materials compile once at boot, so no runtime `needsUpdate`.
- Front/API/save file: none. `?lowfx` and the shadows checkbox keep their meaning.

### Data
No database. Per-frame volumes: trees 700 x 200 triangles (1 call), bushes 265 x 240 (1 call), tufts 4000 x 24, gnomes 120-320 x 2940 → 1516 (one call per type), shadow map 1024² (kept, perf note of 2026-10-19). Draw calls unchanged. Nothing new is uploaded: the smooth bush/cloud geometries replace the old ones at boot.

### Steps (edit order)
1. `src/world/environment.ts:66` fragment shader: `... gl_FragColor = vec4(mix(bottom, top, h),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}` (template string). Test: scenario step `sky` (below).
2. `src/world/environment.ts`: constructor `HemisphereLight(0xdff0ff, 0x4a6a2a, 0.9)`, `DirectionalLight(0xfff2d8, 2.6)`, `this.sun.shadow.radius = 2`; `update()` line 353 `this.sun.position.set(p.x + 22, 32, p.z + 14)`; line 380 `2.6 * (1 - n) + 0.25 * n`; line 382 `0.9 * (1 - n) + 0.35 * n`. Test: scenario steps `shadow`, `night`.
3. `src/world/environment.ts` `rebuildLand()` after `this.half = tier.half;`: `const fog = ctx.scene.fog as THREE.Fog; fog.near = h + 15; fog.far = h + 180;` (constructor keeps `new THREE.Fog(0xcfe8ff, 60, 220)`; `rebuildLand()` runs in the constructor). Test: scenario step `fog`.
4. `src/world/models.ts`: import `mergeVertices` next to `mergeGeometries`; `const smooth = (g: THREE.BufferGeometry) => { const m = mergeVertices(g); m.computeVertexNormals(); return m; };` and wrap the three `IcosahedronGeometry` parts in `bushGeometry()` (line 117-119) and `cloudGeometry()` (line 314-316). Test: scenario step `bushNormals`.
5. `src/world/models.ts` `gnomeGeometry()`: arms `new THREE.CylinderGeometry(0.04, 0.045, 0.22, 10)` (x2), hands `new THREE.SphereGeometry(0.045, 8, 6)` (x2), nose `new THREE.SphereGeometry(0.045, 8, 6)`, eyes `new THREE.SphereGeometry(t.emissiveEyes ? 0.03 : 0.016, 6, 5)` (x2), hat `cone(0.14, 0.34, 24)`, brim `cyl(0.142, 0.142, 0.04, 24)`, staff mini-hat `cone(0.14, 0.3, 24)`. Head (`sph(0.125)` = 20x14), beard, shirt lathe, pants, belt unchanged. Test: scenario step `gnomeTris`.
6. Scenario `scenario-smooth.js` in the smoke dir (unpauses like `scenario15-wait.js`, hides the HUD, spawns 6 gnomes at (0, 0.6, 5)), run on the Metal harness copy; steps and assertions in Tests. Regression: `scenario15.js`, `scenario-perf-tri.js` on the SwiftShader harness.
7. `docs/ai-work/2026-10-20-smooth-graphics.md` (Problem / Summary / Work progress) with the before/after numbers and the screenshot paths.

### Tests
One scenario, `scenario-smooth.js`, steps return JSON through `window.__done`:
- `sky`: render, `gl.readPixels` at (0.5 w, 0.95 h) → `[r,g,b]` with `|r−118| ≤ 25`, `|g−180| ≤ 25`, `|b−220| ≤ 25`; screenshot `10-sky` (no pale band at the horizon, by eye).
- `night`: `g.state.holeLevel = 6; g.env.rebuildHole(); g.env.dayClock = 175;` wait 6 s game time → `g.env.night > 0.95`, sky pixel `b > r` and `r < 60`; screenshot `11-night`.
- `shadow` (Metal harness): one gnome at (0, 0.6, 5), camera at (0.2, 2.2) looking at it; `readPixels` 0.4 m to −x/−z of the gnome's feet (shadow) and 1.5 m further (lit): luminance ratio ≤ 0.7; screenshot `12-shadow` (shadow length ≈ 0.8x height, soft edge, by eye).
- `bushNormals`: `const n = g.env.bushes.geometry.attributes.normal; [n.getX(0), n.getY(0), n.getZ(0)]` differs from vertex 1 of the same face → `true`; `position.count / 3 === 240`.
- `gnomeTris`: `g.gnomes.meshes.get('classic').geometry.attributes.position.count / 3` → `1516`; every type `< 1600 + extras` (crown/staff/goggles add their own parts).
- `fog`: `g.scene.fog.near === 37 && g.scene.fog.far === 202`; then `g.state.land = 3; g.env.rebuildLand();` → `73 / 238`; restore `land = 0`.
- `perfTitle`: existing `scenario-perf-tri.js` (title camera, 0 gnomes) → `triangles` 250 000-450 000, `calls ≤ 66`.
- `npx tsc --noEmit` → exit 0.

### Done when
1. `FULL=1 URL_QUERY='' DPR=2 CDP_PORT=9366 node tmp-smoke-gpu.mjs run-smooth scenario-smooth.js` → RESULT `sky: [118±25, 180±25, 220±25]`, screenshot `10-sky.png` shows no pale horizon band.
2. same run → `night: {night: >0.95, sky: [r<60, g, b>r]}`, screenshot `11-night.png` navy sky with stars.
3. same run (Metal) → `shadow: {ratio: ≤0.7}`, screenshot `12-shadow.png` shadow ≈ 0.8x height, soft edge.
4. `URL_QUERY='' node smoke.mjs run-smooth-off scenario-smooth.js` with `g.renderer.shadowMap.enabled = false` set at the top of the scenario → no exception, `LOGS:` empty, `g.env.sun.intensity === 2.6`.
5. `URL_QUERY='?lowfx' node smoke.mjs run-smooth-lowfx scenario-smooth.js` → `pr: 1`, `shadows: false`, `fog: {near: 37, far: 202}`.
6. same run → `bushNormals: {smooth: true, tris: 240, propTris: 240}` (forest bushes and the prop bush in `props.ts:39` both `position.count / 3 === 240` with smooth normals).
7. same run → `cloudNormals: {smooth: true}` for `g.scene.children.find(o => o.geometry === cloudGeo)` (first cloud mesh).
8. same run → `gnomeTris: {classic: 1516, max: <1900}` over all 11 types.
9. same run → `fog: {near: 37, far: 202}` at boot.
10. same run → `fogLand3: {near: 73, far: 238}` after `rebuildLand()` with `land = 3`.
11. `URL_QUERY='' node smoke.mjs run-smooth-title scenario-title-frames.js` (existing perf check from `2026-10-19-performance.md` item 1) → `renderer.info.render.frame` grows by ≤ 1 over 3 s on the title screen.
12. `URL_QUERY='' node smoke.mjs run-perf-tri scenario-perf-tri.js` → `triangles` between 250 000 and 450 000, `calls ≤ 66`.
13. same scenario with 40 gnomes spawned (step `forty`) → `triangles ≤ 500 000` (was 597 063 in `run-gpu` g0).
14. `rg -n "DodecahedronGeometry" src/world/models.ts` → 3 lines unchanged (rocks untouched).
15. `rg -n "Math.max\(seg, 16\)|Math.max\(w, 16\)" src/world/models.ts` → 3 lines unchanged (clamps untouched).
16. `rg -n "toneMapping = " src/main.ts` → `THREE.ACESFilmicToneMapping` (or the value PP picks in decision 1).
17. `rg -n "goldenHour|hue-rotate|swirl.material.color" src/systems/events.ts src/main.ts src/world/environment.ts` → same lines as today (`git diff` shows none of them).

### Assumptions (numbered)
1. PP's "toporna" means the lit look, not the models' shapes (cone trees, box house): shapes stay.
2. PP's Mac shows PCF shadows (Metal harness does; SwiftShader does not); the headless SwiftShader run is not evidence for shadows.
3. The texture pass tuned material tints under ACES 1.05 (`2026-10-20-plan-textures.md:212`), so tone mapping changes only on PP's say-so.
4. 1516 triangles for `classic` comes from the primitive formulas (box 12, cylinder 4·seg, cone 2·seg, sphere 2·w·(h−1), lathe 2·seg·(points−1)); the implementer records the measured number if it differs.

### Alternatives rejected
- (a) FXAA/SMAA through `EffectComposer` + `OutputPass`: the canvas already has MSAA 4x; the composer's target has `samples: 0` (loses it unless set, doubling bandwidth), adds 2 full-screen passes at 2268x1473 and moves tone mapping into `OutputPass` (changes every colour); `g11`/`g12` show no edge gain.
- (b) GTAO/SSAO: a second scene render for normals (+60 calls, +370 k triangles) plus 2-3 full-screen passes; PP's Mac ran this tab at 27-40 % CPU yesterday.
- (c) VSM shadows: two blur passes on the 1024² map every frame plus light bleeding; `g6-vsm-gnomes.png` is blurrier, not better. `PCFSoftShadowMap` no longer exists in r186 (warning in `run-var` LOGS).
- (d) Environment map (PMREM of the sky): `g4-envmap-gnomes.png` shows a barely visible sheen for one extra cubemap sample on every standard-material fragment; rung 1.
- (e) 2048² shadow map: cut to 1024² yesterday for performance; radius 2 hides the texel edge instead.
- (f) Toon + outlines: direction B above.
- (g) New npm package (postprocessing, n8ao): nothing here needs a full-screen pass, and a dependency needs PP's OK; three's own addons already cover FXAA/SMAA/GTAO if PP ever wants them.
- (h) Lowering the ≥ 16 clamps in `sph`/`cyl`/`cone` globally: would re-facet mushrooms, hedges, flamingos and the UFO (the "angular" complaint of playtest round 1); the gnome gets explicit geometry instead.

### Ladder
- Sky `#include` chunks: rung 2 (three's own shader chunks, no new code).
- Light, sun position, shadow radius, fog values: rung 5 (numbers in existing lines); required by "wygładzić grafikę … toporna" (causes 2, 5).
- `smooth()` helper: rung 4 (`mergeVertices` from the already-imported `BufferGeometryUtils`); required by cause 3.
- Gnome part segments: rung 5 (values); required by cause 4.
- `scenario-smooth.js`: required by Done-when; no new source files, no new dependency.

### Orchestrator decisions (2026-10-20, PP asleep; this plan is final)

Direction A "clean light". Decisions 1-7: all a) (ACES stays; longer shadows 51°, 2.6/0.9; fog from the land size; rocks n/a (removed tonight); other model segment clamps stay; night sky navy; `?lowfx` and the shadows checkbox get the same values).

### Open decisions (for PP)
1. Tone mapping: a) keep ACES (`run-final/f3-pack-aces-yard.png`), b) Neutral (`f4-pack-neutral-yard.png`: calmer greens and blues, golden gnome a touch duller), c) AgX (`f5-pack-agx-yard.png`: pastel, the golden gnome turns olive). (recommendation: a, because the texture tints were tuned under ACES today and b/c change every gameplay colour for a small gain.)
2. Longer shadows (sun from 59° down to 51°, sun 2.6 / hemi 0.9): a) yes, shadows ≈ 0.8x height and clearly darker (`f3-pack-aces-gnomes.png`); b) keep today's flat noon light. (recommendation: a.)
3. Fog tied to the land size (Backyard 37-202 m, Dark Forest 73-238 m): a) yes, the forest ring fades with distance on every land; b) keep 60-220 m fixed, no depth on the Backyard. (recommendation: a.)
4. [spec silent] Zakładam: rocks stay faceted | Dowód: `models.ts:124-126` dodecahedrons detail 1/0, rocks are angular by nature | Jeśli źle: PP still sees angular rocks next to smooth bushes at hole level ≥ 2 | Pewność: Confident | rekomendacja: a) keep faceted.
5. [spec silent] Zakładam: every other primitive keeps the ≥ 16 segment clamp (wild mushrooms 120 x 416 triangles, pickups, hedges, flamingos, UFO) | Dowód: `models.ts:43-46`, decision "smooth shading, more segments" in `2026-10-19-playtest-round-1.md:22` | Jeśli źle: a 1.5 cm mushroom spot still costs 352 triangles and the 120 wild mushrooms stay at 50 k triangles | Pewność: Likely | rekomendacja: a) keep; the gnome is the only model seen from 1 m by the hundred.
6. [spec silent] Zakładam: the night sky may become navy (0x05061a as authored) instead of today's near-black | Dowód: `run-final/f6-pack-night-yard.png`, `environment.ts:12-13` | Jeśli źle: PP wants the darker night back and `NIGHT_TOP`/`NIGHT_BOTTOM` need darker hex values (one line each) | Pewność: Likely | rekomendacja: a) accept the navy.
7. [spec silent] Zakładam: `?lowfx` and the shadows checkbox keep their meaning and get the same lighting values | Dowód: `main.ts:38-43`, `menu.ts:41` write only `shadowMap.enabled` and the pixel ratio | Jeśli źle: slow machines would need their own light values, which nobody asked for | Pewność: Confident | rekomendacja: a) same values.
8. [decision age] none: `old-decisions.sh` reports 0 files older than 60 days; the decisions this plan leans on are from 2026-10-19/20 (shadow map 1024² and bushes detail 1 in `2026-10-19-performance.md`, both kept; "smooth shading, more segments" in `2026-10-19-playtest-round-1.md`, kept for every caller except the gnome's sub-5 cm parts, decision 5).

### Self-check
- Every acceptance criterion (each ranked cause, each matrix row) has a step and a test: yes (steps 1-5 cover causes 1-5, decision 1 covers cause 6).
- Every step names the file, line, exact value or signature: yes; no "handle edge cases" lines.
- Every field written has all writers and readers listed: sun/hemi intensity (constructor + `update`), sun position (`update`), fog near/far (`rebuildLand`), fog colour (`update`, untouched), sky uniforms (`update`, untouched), bush/cloud/gnome geometry (callers listed).
- Lists compared with the code: models with icosahedron/dodecahedron parts (bush, cloud, rock → rock is `spec silent`), callers of `sph`/`cyl`/`cone` clamps (`spec silent`), render-path switches (`?lowfx`, shadows checkbox → `spec silent`), day/night (night row), gnome types (11, one geometry function). 17 matrix rows, 17 Done-when lines, 4 `spec silent` rows.
- Decisions older than 60 days: none (decision 8).
- Plan shorter than the code: no; the code change is about 25 lines, the plan carries the screenshot evidence and the ranking PP asked for ("find out what makes it look crude").
