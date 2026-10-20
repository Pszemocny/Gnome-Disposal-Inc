# Smooth graphics: sky colour, contrast, longer shadows, fog depth, lighter gnomes (2026-10-20)

Plan: `2026-10-20-plan-smooth-graphics.md`, direction A "clean light", orchestrator decisions 1-7 all a) (ACES stays, sun 51° with 2.6 / 0.9, fog from the land size, rocks gone, other clamps stay, navy night, `?lowfx` and the shadows checkbox get the same values). Extra orders from the orchestrator: free the old tube/swirl geometry on hole level-up; delete the unused `rockGeometry()` / `hedgeGeometry()`.

## Problem

PP, 2026-10-20: "spróbuj wygładzić grafikę [...] bo jest taka toporna". The planner ranked the causes: the sky wrote linear colour straight to the screen (too dark and too saturated, with a pale band at the horizon), flat lighting with short faint shadows, no depth in the forest ring, and gnome hats with visible facets while tiny hands, nose and eyes cost 352 triangles each.

## Summary

- `src/world/environment.ts`
  - Sky shader ends with `#include <tonemapping_fragment>` and `#include <colorspace_fragment>`: the top of the sky is now (118,180,220) instead of (25,91,207), and the horizon meets the fog colour.
  - Hemisphere light 1.4 → 0.9, sun 2.2 → 2.6 (same values in the night lerp), sun at `(p.x + 22, 32, p.z + 14)` instead of `(+30, 60, +20)`, `shadow.radius = 2`.
  - `rebuildLand()` sets `fog.near = half + 15`, `fog.far = half + 180` (Backyard 37 / 202, Dark Forest 73 / 238).
  - `rebuildHole()` disposes the old tube and swirl geometry and their per-level materials before `holeGroup.clear()` (the worn ground frees its own geometry, its material is shared and stays).
- `src/world/models.ts`
  - Gnome: hat and brim 24 segments (staff mini-hat too), arms explicit `CylinderGeometry(..., 10)`, hands and nose `SphereGeometry(0.045, 8, 6)`, eyes `SphereGeometry(r, 6, 5)`, so these small parts skip the >= 16 clamp. Classic gnome 2940 → 1516 triangles.
  - `rockGeometry()` and `hedgeGeometry()` deleted (grep: no caller in `src`).
- `src/main.ts`: not touched (ACES stays, decision 1 a).
- Ladder: sky chunks rung 2 (three's own shader chunks); light, sun, fog and segment values rung 5 (numbers in existing lines); dispose loop rung 5; deletions rung 1.

Deviations from the plan:
- Step 4 (`mergeVertices` + `computeVertexNormals` on the bush and cloud icosahedra) not done. Fact: in three r186 an `IcosahedronGeometry` with detail >= 1 already has smooth normals (`PolyhedronGeometry.js`: `normalizeNormals()`, "smooth normals"). Measured on the current code: 0 flat faces in the bush and in the cloud. The recomputed normals differ from today's by up to 20.9° (at the UV seams, where `mergeVertices` cannot merge, so the normals there would be one-sided); so the step would add code and make the seams slightly worse. What looks angular on the bushes is the silhouette (80 faces per blob), which normals cannot fix.
- Done-when 8 expected `max < 1900` over all types. Measured max is 2060 (Boom gnome: fuse bands and spark keep the clamp), Wizard 1980 (staff orb). The plan's matrix says those extras stay unchanged, and every type is "< 1600 + its extras" (each type dropped by exactly 1424). The 1900 was an estimate that did not count the fuse; I kept the matrix.
- Done-when 14 (`DodecahedronGeometry` 3 lines unchanged) is obsolete: the orchestrator ordered `rockGeometry()` removed, so it is 0 lines now.
- Done-when 11 names `scenario-title-frames.js`, which does not exist; the title/pause check lives in `scenario-perf-loop.js` (performance note item 1), run instead.
- Shadow probe: gnome at (-8, 0.6, 10) instead of (0, 0.6, 5), because the worn dirt ring around the hole reaches about 6 m and would skew the brightness ratio; camera beside the gnome so the shadow is not hidden behind it.

Rejected:
- Lowering segments of the Boom fuse spark and the Wizard staff orb to meet the 1900 estimate: the plan's matrix keeps the extras unchanged; the gain is 272 triangles on two rare types.
- Shadow camera frustum: the sun moved closer (41 m instead of 66 m from the player), still inside `near 1 / far 140`; nothing to change.

## Work progress

Scenario `<scratchpad>/smoke/scenario-smooth.js` (new). Metal runs with `<scratchpad>/smooth/tmp-smoke-gpu.mjs`, `FULL=1 URL_QUERY='' DPR=2`; the rest with `<scratchpad>/smoke/smoke.mjs`. Ports 9391-9396, one browser at a time. `<scratchpad>` = `/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-boozed/844ac005-e3c6-4341-b0ea-34b547159d26/scratchpad`.

Numbers, before (baseline on the current code, before any edit) → after:

| check | before | after |
|---|---|---|
| sky top pixel (Metal) | [25, 91, 207] | [118, 180, 220] |
| sun / hemi intensity | 2.2 / 1.4 | 2.6 / 0.9 |
| sun offset from player | (30, 59, 20), 59° | (22, 31, 14), 51° |
| shadow vs lit ground, luminance ratio (Metal) | 0.59 | 0.45 |
| fog near / far, Backyard | 60 / 220 | 37 / 202 |
| fog near / far, Dark Forest | 60 / 220 | 73 / 238 |
| triangles per gnome, classic | 2940 | 1516 |
| triangles per gnome, max (Boom) | 3484 | 2060 |
| triangles per frame, title camera, 0 gnomes (SwiftShader, DPR 2) | 375 543 / 65 calls | 370 923 / 61 calls |
| triangles per frame, about 40 gnomes in view (Metal) | 615 903 (41 gnomes) / 68 calls | 499 317 (41 gnomes) / 69 calls |
| same, SwiftShader | - | 498 175 (38 gnomes) / 68 calls |
| GPU geometries after 3 hole rebuilds | 52 → 58 | 52 → 52 |
| night sky top pixel | [1, 1, 4] | [0, 3, 17] |
| bush / cloud normals | smooth (0 flat faces), 240 tris | unchanged |

Triangles vary ±2 % between runs (random forest and chair).

Screenshots (before / after):
- sky and yard: `<scratchpad>/smooth/before-gpu/10-sky.png` / `<scratchpad>/smooth/run-smooth/10-sky.png` (lighter sky, no pale band, horizon meets the fog)
- gnomes close: `before-gpu/13-gnomes.png` / `run-smooth/13-gnomes.png` (rounder hats, longer darker shadows)
- shadow: `before-gpu/12-shadow.png` / `run-smooth/12-shadow.png`
- forest: `before-gpu/14-forest.png` / `run-smooth/14-forest.png` (far trees fade into the fog)
- night: `before-gpu/11-night.png` / `run-smooth/11-night.png` (navy sky with stars)

Kompletność (plan "Done when"):
- [PASS] 1 — `run-smooth` RESULT `sky: [118,180,220]`; `10-sky.png` no pale horizon band.
- [PASS] 2 — `night: {night: 0.995, sky: [0,3,17]}`; `11-night.png` navy sky with stars.
- [PASS] 3 — `shadow: {ratio: 0.45}`; `12-shadow.png` shadow about 0.8x the gnome's height, soft edge.
- [PASS] 4 — `URL_QUERY='#noshadow' node smoke.mjs ../smooth/run-smooth-off scenario-smooth.js` → `shadows: false`, `light.sun: 2.6`, `LOGS:` empty.
- [PASS] 5 — `URL_QUERY='?lowfx' ... run-smooth-lowfx` → `pr: 1`, `shadows: false`, `fog: {near: 37, far: 202}`.
- [PASS] 6 — same run → `bushNormals: {smooth: true, tris: 240, propTris: 240, propSmooth: true}` (already true before, see deviation).
- [PASS] 7 — same run → `cloudNormals: {smooth: true}`.
- [PASS] 8 — same run → `gnomeTris: {classic: 1516, max: 2060}`; every type 1424 lower than before; max above the 1900 estimate, see deviation.
- [PASS] 9 — same run → `fog: {near: 37, far: 202}`.
- [PASS] 10 — same run → `fogLand3: {near: 73, far: 238}`.
- [PASS] 11 — `node smoke.mjs ../smooth/run-smooth-title scenario-perf-loop.js` → `title.framesIn3s: 0`, `pause.framesIn3s: 0`.
- [PASS] 12 — `URL_QUERY='' DPR=2 node smoke.mjs ../smooth/run-perf-tri scenario-perf-tri.js` → `triangles: 370923, calls: 61`.
- [PASS] 13 — `forty` → 499 317 (Metal, 41 gnomes), 498 175 (SwiftShader, 38 gnomes), both ≤ 500 000.
- [PASS] 14' — `grep -rn "DodecahedronGeometry|rockGeometry|hedgeGeometry" src` → 0 (rocks removed on order).
- [PASS] 15 — the three clamp lines (`models.ts:42-44`) unchanged.
- [PASS] 16 — `main.ts:44 renderer.toneMapping = THREE.ACESFilmicToneMapping`.
- [PASS] 17 — golden hour, booze filter and swirl tint lines present and not edited (`events.ts`, `main.ts` not touched; `environment.ts:377` swirl tint unchanged).
- [PASS] leak — `holeRebuildLeak: {before: 52, after3: 52}` (before the fix 52 → 58).
- [PASS] regression — `node smoke.mjs ../smooth/run-reg15-scope zz-scenario15-scope.js` → all 8 checks (fan ratio 0.99, lift y 1.25, arc green 0.05 + eaten 1, crate 9 inside, rain only specials, hoop bullseye, parade 16/16), `LOGS:` empty.
- [PASS] `npx tsc --noEmit` → exit 0.

Self-check: only `src/world/environment.ts` and the gnome block plus the rock/hedge deletion in `src/world/models.ts` changed; `main.ts` untouched. Every edit has a plan step or an orchestrator order behind it. No new dependency, no new file in `src`. The project is not a git repository, so the edits were read back one by one.
