# Plan: better textures (stylised pass)

Spec: PP, 2026-10-20: "poszukaj jakiejś grafiki na teksturę, w ogóle trzeba poprawić tekstury, niech agent planer na fable pokmini, jak to zrobić" (find better texture graphics; textures in general need improving; a planner should think through how).
Trivial check: touches `public/textures`, `src/world/environment.ts`, `src/entities/machines.ts`, `src/entities/factory.ts`, `src/entities/props.ts`, `CREDITS.md`, `docs/PLAN.md`; changes GPU memory and load time, so it is on the performance path from `2026-10-19-performance.md`.

## Plan v0 (plan-author)

### Goal
Every large surface uses a bright, low-detail, hand-painted-style CC0 texture that matches the toon gnomes and cone trees, the download shrinks from 7.2 MB to about 1.2 MB, and draw calls and triangles stay where the performance pass left them.

### What the screenshots say (headless, shadows on, 640x360)
Screenshots in `<scratchpad>/tex/run-A` and `run-B` (scenarios `scenario-A.js`, `scenario-B.js`; HUD hidden). Baseline numbers from `renderer.info` with 6 gnomes and a crate placed:

| view | triangles | draw calls | GPU textures |
|---|---|---|---|
| 04 hole + gnomes + crate | 412 229 | 76 | 14 |
| 05 hole close | 410 101 | 70 | 14 |
| 06 ground close | 407 645 | 55 | 14 |
| 01b house | 408 693 | 61 | 14 |
| 07 fence + trees | 369 837 | 38 | 14 |
| 08 fence corner | 370 213 | 44 | 14 |
| 09 rocks + hedges (hole lvl 5) | 390 125 | 56 | 14 |
| 10 yard wide (hole lvl 5) | 390 129 | 57 | 14 |

The world already reads as a clean cartoon: flat-colour gnomes, layered cone trees, blob bushes, blue gradient sky, Fredoka UI. The one thing that fights it is the photo grass (`leafy_grass`): brown-green mulch with dead leaves, busy at every distance, with a normal map nobody can see. The house plaster is a flat grey photo wall, the roof is a dark red mass with no visible tiles from the yard, the rocks are smooth grey blobs, and the crate needs an emissive hack because the planks photo is too dark.

### Inventory (today)
Scores: 1 = fine, 10 = ugly and in your face. "Impact" weighs screen area and how close the player gets.

| surface | today | file / size | score |
|---|---|---|---|
| ground (whole yard, 600x600 m shape with a hole) | photo grass `leafy_grass` 5 m tiles + normal map, tinted 0xc8f0a0 → 0xe8d890 by hole level (`environment.ts:214-217`) | `grass_diff.jpg` 1024² 1.2 MB + `grass_nor.jpg` 1024² 1.4 MB | 9 (half the screen, clashes with the toon look) |
| path / worn ground | none; only a strip without grass tufts along the hole's path (`onHolePath`) | - | 6 (the yard has no focus, the hole floats on uniform grass) |
| hole: tube inside | photo forest floor, 4x1 repeat, tint 0x8a7060 (`environment.ts:223-226`) | `dirt_diff.jpg` 1024² 0.85 MB | 4 (seen only when leaning over) |
| hole: rim torus, swirl, glow | vertex colour 0x7a5232, canvas swirl 256², point light | canvas | 2 |
| house walls | photo painted plaster, repeat 3x1.5 on a 14x6x9 box (`models.ts:houseGroup`) | `plaster_diff.jpg` 1024² 0.69 MB | 6 (big, flat grey, next to the shop) |
| house roof | photo clay tiles, repeat 0.3 (`roof_diff`) | `roof_diff.jpg` 1024² 0.88 MB | 5 (tiles invisible from the yard, reads as dark red slab) |
| house trim: chimney, door, garage, windows, slab | vertex colours | - | 4 (blue boxes for windows) |
| fence posts (instanced, ~45-117) | vertex cream 0xf0e6d2 x weathered planks (`environment.ts:313`) | `wood_diff.jpg` 1024² 0.6 MB | 4 |
| fence rails (8 boxes, repeat h/2 x 0.1) | same planks, 4 m per tile (`environment.ts:327`) | same file (second GPU copy per land tier) | 4 |
| desk + PC + lamp | vertex colours, green screen plane, SHOP sprite | - | 4 |
| factory | vertex colours (purple body, grey chimney, chute), gear | - | 5 (big purple box) |
| crate (box tool) | planks x cream, emissive 0x5a3a1a at 0.6 to fight the dark photo (`machines.ts:69`) | `wood_diff.jpg` | 4 |
| other machines: panel, trampoline, fan, conveyor (canvas chevron belt), wheel, magnet, cannon, vacuum, blackhole | vertex colours | canvas 32x64 | 3 (toys, small) |
| trees (700 instanced, 1 draw call) | vertex colours: brown trunk, 3 green cones | - | 4 (shape, not texture; dominate every horizon) |
| bushes (≤300 instanced + 1 prop bush in `props.ts:38`) | vertex colours, 3 icosahedron blobs | - | 4 |
| grass tufts (4000 instanced) | vertex colours, 3 blades | - | 2 |
| wild mushrooms (120 instanced), mushroom pickups | vertex colours | - | 2 |
| rocks (hole lvl ≥ 2, 1-3 per level) | vertex grey, dodecahedrons (`environment.ts:274`) | - | 7 (1-2 m smooth grey blob at eye height) |
| hedges (hole lvl ≥ 2) | vertex green box + spheres (`environment.ts:280`) | - | 5 |
| gnomes (11 types, instanced per type) | vertex colours per type | - | 2 (the best-looking thing on screen; the colours are gameplay signals) |
| coins, props (chair, flamingos, shovel), player tools (magnet gun, broom, tractor), UFO, signs, clouds | vertex colours, canvas sprites | - | 2-3 |
| sky | gradient shader sphere, 600 stars, fog | - | 3 (fits the cartoon) |

Facts about the files: all 8 JPGs are 1024², together 7.2 MB in the repo. Only 6 are ever loaded (`tex(` is never called with `bark_diff` or `metal_diff`): 5.7 MB downloaded per first visit, about 39 MB of GPU memory (6 files plus a second `wood_diff` for the rails, each 1024² RGBA with mipmaps ≈ 5.6 MB). `tex()` creates a separate GPU texture per (file, repeat) pair and never disposes them; each land upgrade adds one more rails copy.

### Style direction: "painted toon"
Bright, saturated, low-detail hand-painted tiling textures (think Kenney / early Zelda), no normal, roughness or AO maps, soft blotches instead of photo detail, and vertex colours doing most of the work. The textures add surface character (grass blades, planks, tiles, stucco) at 0.5-6 m scale and stay quiet from far away.

Why: the models are merged primitives with flat colours and smooth shading, the gnomes are flat-colour toons, the UI is chunky Fredoka. Photo textures sit on those shapes like wallpaper on a Lego brick, and at pixel ratio 1.5 their fine detail only shimmers. Painted textures are also 3-5x smaller as JPG (less detail compresses better) and look right at 512².

Rejected:
- (a) Photo-real PBR (keep Poly Haven, add normal/roughness everywhere): more texture samples on the biggest surface (ground), 5.6 MB GPU per 1k map, and the clash with the toon gnomes gets worse, not better. The crate already needed an emissive hack because of it.
- (b) No textures at all (pure vertex colours, add a toon gradient/outline instead): PP asked for textures twice (playtest round 1: "graphics too angular, use free textures"; today: "find graphics"), and bare ground at 1-6 m is the "angular" look he rejected. Outline/toon shading is a different task.
- (c) Generate painted textures at runtime on a canvas (like the swirl and chevron): zero download and full control, but each one needs tuning by eye through many rounds, and the headless check cannot judge "looks hand-painted". Kept only for the optional wear decals, where a radial alpha mask is drawn over a loaded texture.

### Sources (CC0 only, nothing downloaded yet)
I could not open the web from this session, so asset names come from memory. Rule for the implementer: before downloading, the asset page must show "CC0" and the name must match; if not, take the ambientCG fallback in the same row (ambientCG is CC0 for every asset, Confident). Download the 1K JPG/PNG colour map only; drop normal/roughness/height files.

| surface | first choice (verify) | fallback (ambientCG, CC0) | ships as |
|---|---|---|---|
| ground | 3dtextures.me "Stylized Grass 001/002/003" (Katsukagi, site-wide CC0; Likely) https://3dtextures.me/?s=stylized+grass | `Grass004` or `Grass001` https://ambientcg.com/view?id=Grass004 | `grass_diff.jpg` 1024², q80, ≤ 450 KB |
| hole tube, wear decals | 3dtextures.me "Stylized Dirt 001" / "Stylized Dry Mud 001" (Unclear) | `Ground037` https://ambientcg.com/view?id=Ground037 | `dirt_diff.jpg` 512², ≤ 120 KB |
| fence, crate | 3dtextures.me "Stylized Wood Planks 001" (Unclear) | `Planks021` https://ambientcg.com/view?id=Planks021 (light pine) | `wood_diff.jpg` 512², ≤ 100 KB |
| house walls | 3dtextures.me "Stylized Stucco / Plaster 001" (Unclear) | `PaintedPlaster017` or `Plaster001` https://ambientcg.com/view?id=Plaster001 | `plaster_diff.jpg` 512², ≤ 80 KB |
| house roof | 3dtextures.me "Stylized Roof Tiles 001" (Unclear) | `RoofingTiles012` https://ambientcg.com/view?id=RoofingTiles012 | `roof_diff.jpg` 512², ≤ 120 KB |
| factory body | - | `MetalPlates006` https://ambientcg.com/view?id=MetalPlates006 | `metal_diff.jpg` 512², ≤ 100 KB |
| trees, bushes, hedges, rocks (shared grey mottle) | 3dtextures.me "Stylized Leaves 001" or any painted leaf/rock texture, converted to grey | `Leaves001` or `Rock030` | `mottle.jpg` 256² grey, ≤ 40 KB |

Other CC0 places checked in memory and not chosen: Kenney (no tiling nature textures, only prototype grids and model kits), Quaternius (models, not textures), Poly Haven (photo scans, the current look), OpenGameArt "Tiny Texture Pack" by Screaming Brain Studios (CC0, 256², painted-ish; acceptable third fallback for grass/dirt/wood if both rows above fail).

Processing on the Mac with built-in `sips` (verified today on the existing files): `sips -Z 512 -s format jpeg -s formatOptions 80 in.jpg --out out.jpg` gives 60-140 KB at 512², 578 KB for a 1k photo grass; a painted grass will be smaller. Grey conversion: `sips -Z 256 -s format jpeg -s formatOptions 80 -m "/System/Library/ColorSync/Profiles/Generic Gray Profile.icc"` → 26 KB. `sips` cannot write WebP here (tried, no output file), so JPG it is; WebP/KTX2 are not needed at these sizes (ladder rung 1).

Expected totals: repo `public/textures` ≈ 1.0-1.3 MB (now 7.2 MB); first-visit download the same (now 5.7 MB); GPU ≈ 5.6 (grass 1k) + 5 x 1.4 (512²) + 0.35 (mottle) + rails copies 1.4 per land tier ≈ 13-18 MB (now ≈ 39 MB). Load time on a 20 Mbit link: ≈ 0.5 s instead of 2.3 s.

### Technique per surface
- Ground: `map` only, repeat 1/6 (6 m tiles; painted textures hide repetition better at a larger tile, 5 m photo tiles were visible from the fence). Drop `normalMap` (saves one 1k file, a texture sample per ground pixel and the tangent maths on the largest surface). Keep the `color` tint that dries the grass with hole level; a painted grass is lighter, so the tint stays visible. UVs are already world space (`ShapeGeometry` uses shape x/y as UV), nothing to add.
- Hole tube: same as today, new file. Rim, swirl, glow untouched.
- Fence posts and rails, crate: new planks file through the existing `tex('wood_diff', …)` calls. Crate loses `emissive`/`emissiveIntensity` when the new planks are bright (check on the screenshot; keep the hack if the crate reads darker than the rails).
- House walls and roof: new files, same repeats, same code.
- Factory body: `vcMat({ map: tex('metal_diff') })`; the purple vertex colour multiplies the light grey plates, so the factory stays purple with rivets. Gear, chute and button keep flat colours (one merged geometry shares the map; the chute and pipes get plates too, which is fine for a machine).
- Trees, bushes (both writers: `environment.ts:128` and `props.ts:38`), hedges, rocks: one shared 256² grey `mottle.jpg` as `map`; vertex colours tint it, so the trunk is mottled brown and the foliage mottled green with one texture and no atlas. Instanced meshes keep one draw call per type because the material is still one material. Cone and sphere UVs pinch at the poles; the trees are 3+ m beyond the fence, so it does not show. Grass tufts, wild mushrooms, coins: no map (too small to see it, 4000 tufts would pay for the sample).
- Gnomes: no texture. The hat/shirt colours are the type signal (red = classic, blue = blue, gold = golden, grey + goggles = saboteur); a grain would only dirty them. Keep `vcMat` as is.
- Sky, clouds, desk, other machines, tools, props, UFO, signs: no change (rung 1, nobody asked, small or already canvas-made).
- Colour space: colour maps sRGB (already in `tex()`), the grey mottle too (it is a colour multiplier). Mipmaps: automatic, all files power-of-two (1024/512/256). Anisotropy 8 stays for everything (`tex()`); only the ground gains from it, the cost on 512² maps is negligible.
- Wear decals / path (package 5, only if PP says yes): 12-20 flat `PlaneGeometry` patches 2-4 m wide around the hole (ring r+0.5 … r+3, outside the gnome landing area) and 6-8 along the straight line from the factory landing spot to the hole, all merged with `mergeGeometries` into ONE mesh, material `MeshStandardMaterial({ map: dirtDecal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })` at y 0.01; `dirtDecal` is a 256² `CanvasTexture`: `dirt_diff` drawn once, then a radial gradient with `destination-in` for the soft edge. Rebuilt in `rebuildHole()` because the hole moves 1.2 m per level. Cost: +1 draw call, +40 triangles, +0.35 MB GPU.
- Not doing: texture atlas with per-part UV rects in `build()` (needed only if trunk and leaves must be different textures; the mottle trick makes it unnecessary), KTX2/basis (GPU memory is already 2-3x lower after the pass; the transcoder is 1 MB of JS plus a worker), `Texture.clone()` to share wood between posts and rails (a clone made before the image arrives has `version 0`; whether three uploads it from the shared `Source` is Unclear; the extra 1.4 MB per land tier is cheaper than finding out).

### Behaviour matrix
| state / input | action | expected outcome | source |
|---|---|---|---|
| ground, day, hole lvl 1 | load scene | painted grass, 6 m tiles, tint 0xc8f0a0, no normal map | PP "poprawić tekstury"; `environment.ts:214-217` |
| ground, hole lvl 12 | `holeLevel = 12; rebuildHole()` | grass visibly drier (tint 0xe8d890) on the new texture | existing tint rule, `environment.ts:213` |
| ground, night (`env.night = 1`) | render | textures readable, not black (sun 0.25, hemi 0.35, lamp on) | `environment.ts:390-404` |
| `?lowfx` | load with `?lowfx` | same textures, shadows off, draw calls as before the pass | `2026-10-19-performance.md` |
| hole tube | lean over the hole | painted dirt 4x1, tint 0x8a7060; rim, swirl, glow unchanged | `environment.ts:223-226` |
| hole level up x3 | `rebuildHole()` three times | `renderer.info.memory.textures` unchanged (cache hit in `tex()`) | `textures.ts` cache |
| fence posts, land tier 1-4 | `state.land = 0..3; rebuildLand()` | planks x cream on every post, posts count = tier formula, 1 draw call | `environment.ts:313-324` |
| fence rails, land tier 1-4 | same | plank tile stays ≈ 4 m on 44-116 m rails; `memory.textures` +1 per new tier (accepted) | `environment.ts:327` |
| crate placed | `machines.place('box', …)` | planks map, emissive hack removed if crate ≥ rails brightness | `machines.ts:69` |
| crate placement ghost | hold `1` with box selected | green `MeshBasicMaterial`, no texture (material swapped in `player.ts:748`) | existing |
| house walls | look at the house | painted plaster, repeat 3x1.5 | `models.ts:houseGroup` |
| house roof | same | painted tiles visible from the yard, repeat 0.3 | same |
| house trim | same | chimney, door, garage, windows, slab unchanged vertex colours | same |
| factory body | look at the factory | purple metal plates; gear, chute colours still readable; button still red | `factory.ts:25` |
| trees (700) | look over the fence | mottled trunk and foliage, 1 draw call, triangles unchanged | `environment.ts:125` |
| bushes (≤300 instanced) | same | mottled, 1 draw call | `environment.ts:128` |
| prop bush by the shovel | walk to (-20.6, 20.9) | same mottle as the forest bushes (second writer) | `props.ts:38` |
| hedges, hole lvl ≥ 2 | `holeLevel = 5; rebuildHole()` | mottled green, per-obstacle meshes as today | `environment.ts:280` |
| rocks, hole lvl ≥ 2 | same | mottled grey, no longer a smooth blob | `environment.ts:274` |
| grass tufts (4000), wild mushrooms (120) | render | unchanged vertex colours, no map | ladder rung 1 |
| gnomes, all 11 types | spawn one of each | unchanged vertex colours; hat colours identical to `gnomeTypes.ts` | type colours are gameplay |
| sky, clouds, stars, fog | render day and night | unchanged | rung 1 |
| desk + PC | look at the shop | unchanged (SHOP sprite and green screen do the signalling) | rung 1 |
| machines other than the crate (panel, trampoline, fan, conveyor, wheel, magnet, cannon, vacuum, blackhole) | place each | unchanged | `machines.ts:67-223` |
| [spec silent] coins, mushroom pickups, chair, flamingos, shovel, magnet gun, broom, tractor, UFO, label sprites | render | unchanged | not named by PP |
| [spec silent] path / worn ground | none exists today | package 5 adds dirt decals around the hole and a trail from the factory, only if PP says yes | Open decision 1 |
| a texture file is missing or misnamed | load | `LOGS:` shows a 404 and the surface renders black; Done-when requires `LOGS:` empty | `smoke.mjs` collects console errors |
| title screen before textures arrive | first paint | title frame drawn, redrawn on `DefaultLoadingManager.onLoad` (unchanged behaviour, fewer files) | `main.ts` |
| unused files `bark_diff.jpg`, `metal_diff.jpg` (old) | package 1 | `bark_diff.jpg` deleted (never loaded), `metal_diff.jpg` replaced by the painted plates in package 3 | grep: no `tex('bark_diff')` |
| any package, TypeScript imports added (`tex` in factory, props) | `npx tsc --noEmit` | exit 0 | `npm run build` runs `tsc --noEmit` first |

### Reach
- `src/world/textures.ts:7` `tex(name, repeatX, repeatY, srgb)`: callers `environment.ts:100` (house), `:216` (ground map + normal), `:225` (dirt), `:313` (posts), `:327` (rails), `machines.ts:69` (crate). File name is hard-coded `.jpg`. No change to the function.
- `src/world/models.ts:40` `vcMat(opts)`: callers in environment, factory, props, machines, gnomes, coins (own material), mushrooms, events (UFO), player, sweeper. Only the listed call sites get a `map`; `vcMat` itself does not change.
- `M.bushGeometry()` writers of the bush look: `environment.ts:128` and `props.ts:38` (both get the mottle).
- `rebuildHole()` callers: constructor, hole level up (`hole.ts`), rebirth; it recreates the ground and tube materials every time (existing, `tex()` cache keeps GPU textures shared).
- `rebuildLand()` callers: constructor, land purchase in the shop; new rails material per call.
- `machineVisual('box')` callers: `machines.ts:307` (real crate), `player.ts:744` (ghost; swaps the material, texture irrelevant).
- `public/textures/CREDITS.md` and `docs/PLAN.md` line 8 ("No downloaded assets") describe the asset rule; both change in package 1. `CLAUDE.md` already says "CC0 textures only in `public/textures`".
- Front/API: none. Save file: untouched (textures are not saved).

### Data
- No database. Assets: `public/textures/*.jpg` (8 files, 7.2 MB) → 7 files, ≈ 1.2 MB. GPU: ≈ 39 MB → ≈ 13-18 MB. Draw calls: unchanged (packages 1-4), +1 (package 5). Triangles: unchanged (packages 1-4), +40 (package 5); target range from the performance note 250-450 k stays.
- Fragment cost: ground loses one texture sample and the normal perturbation; trees/bushes/rocks/hedges gain one 256² sample each (mip-cached, tiny). Net: at or below today.

### Steps (edit order)
Package 1: ground + hole + pipeline
1. Download the grass and dirt colour maps (table above), convert with `sips` to `public/textures/grass_diff.jpg` (1024²) and `dirt_diff.jpg` (512²); delete `grass_nor.jpg` and `bark_diff.jpg`. Keep the file names so only two code lines change.
2. `src/world/environment.ts:216`: `new THREE.MeshStandardMaterial({ map: tex('grass_diff', 1 / 6), color: grass, roughness: 1 })` (normal map line removed).
3. `public/textures/CREDITS.md`: one line per file: source site, asset name, URL, "CC0", processing (`sips` size/quality/grey). `docs/PLAN.md:8`: "No downloaded assets except CC0 textures in `public/textures` (see `CREDITS.md`)".
4. Check: `scenario-A.js` + a new `scenario-C.js` (copy of `head.js`/`tail.js` pattern in `<scratchpad>/tex/`) with views: `11-night` (`g.env.night = 1`, view 04 position), `12-dry` (`g.state.holeLevel = 12; g.env.rebuildHole()`, view 05), `13-land4` (`g.state.land = 3; g.env.rebuildLand()`, view 07 at the new `h`), plus `rebuildHole()` x3 and `memory.textures` before/after in `out`.

Package 2: wood (fence + crate)
5. New `wood_diff.jpg` 512². `src/entities/machines.ts:69`: `vcMat({ map: tex('wood_diff') })` if the crate on `04-hole-gnomes-crate.png` is at least as bright as the rails; otherwise keep the emissive line and say so in ai-work.

Package 3: house + factory
6. New `plaster_diff.jpg`, `roof_diff.jpg`, `metal_diff.jpg` (512² each). `src/entities/factory.ts:25`: `vcMat({ metalness: 0.1, roughness: 0.55, map: tex('metal_diff') })` + `import { tex } from '../world/textures'`.

Package 4: vegetation + rocks mottle
7. New `mottle.jpg` 256² grey. `environment.ts:125,128`: `M.vcMat({ map: tex('mottle') })` for trees and bushes; `:266-267` `rockMat`/`hedgeMat` get the same map; `src/entities/props.ts:38`: `M.vcMat({ map: tex('mottle') })` + import.

Package 5 (only after PP's yes on Open decision 1): wear decals + trail
8. `environment.ts`: in `rebuildHole()` build the merged decal mesh described under "Technique" (positions from `holeCenterFor(level)` and the factory landing spot `(-7.5, -13) + 6.5 m towards the hole`), remove the previous one first; `dirtDecal` canvas texture made once next to `makeSwirlTexture()`.

### Tests
No unit framework; each package is checked by the headless scenarios (shadows on, `URL_QUERY=''`) and `npx tsc --noEmit`. Screenshot files are the artefact PP looks at in the release build on 5300; the numbers are the automatic part.

### Done when
Baseline numbers are the table at the top; "±2 %" because the forest placement is random. Commands run from `<scratchpad>/smoke/`.
1. ground day lvl 1: `URL_QUERY='' CDP_PORT=9365 MAXPOLL=1600 node smoke.mjs ../tex/p1 ../tex/scenario-A.js` → `RESULT` with `06-ground-close` `tri` 400-416 k, `calls` 55, `textures` ≤ 13 (one fewer: no normal map); `06-ground-close.png` shows the painted grass.
2. ground lvl 12: scenario-C `12-dry` → screenshot exists, `out['12-dry'].textures` equals `out['11-night'].textures` (no new GPU texture after `rebuildHole`).
3. ground night: scenario-C `11-night` → `11-night.png` exists, `LOGS:` empty.
4. `?lowfx`: `CDP_PORT=9365 node smoke.mjs ../tex/p1-lowfx ../tex/scenario-A.js` (default query) → `calls` for `06-ground-close` ≤ 55, `LOGS:` empty.
5. hole tube: `05-hole-close.png` from line 1 exists; `ls public/textures/dirt_diff.jpg` → 512² via `sips -g pixelWidth`.
6. hole rebuild x3: scenario-C `out.texturesAfter3Rebuilds === out.texturesBefore`.
7. fence posts tier 1-4: scenario-C `13-land4` → `calls` = `07-fence-trees` calls ±0 (posts still one instanced draw), screenshot exists.
8. fence rails tier 1-4: scenario-C `out['13-land4'].textures` = `out['07'].textures + 1` (one rails copy, nothing else).
9. crate: `04-hole-gnomes-crate.png` from package 2 run shows the crate; ai-work states "emissive removed" or "kept because darker than rails".
10. crate ghost: `rg -n "MeshBasicMaterial" src/player/player.ts` → line 748 unchanged (`color: 0x66ff88`).
11. house walls: package 3 run of `scenario-A.js` → `01b-house.png` exists, `LOGS:` empty.
12. house roof: same screenshot; `sips -g pixelWidth public/textures/roof_diff.jpg` → 512.
13. house trim: `rg -n "houseGroup" -A 40 src/world/models.ts` → the `trim` build list unchanged (no `map`).
14. factory: package 3 run `scenario-B.js`-style view at (-7.5, -6) → screenshot exists; `rg -n "metal_diff" src` → exactly one hit in `src/entities/factory.ts`.
15. trees: package 4 run `scenario-B.js` → `07-fence-trees` `calls` 38, `tri` 362-377 k.
16. bushes: same run, `08-fence-corner` `calls` 44.
17. prop bush: `rg -n "bushGeometry\(\)" src` → both hits (`environment.ts`, `props.ts`) sit next to `tex('mottle')`.
18. hedges: `09-rocks-hedges-lvl5.png` exists, `calls` 56 ±0.
19. rocks: same screenshot shows a mottled rock in the foreground (by eye); `rg -n "rockMat = " src/world/environment.ts` → contains `map: tex('mottle')`.
20. tufts, wild mushrooms: `rg -n "grassTuftGeometry\(\), M.vcMat\(\)|wildMushroomGeometry\(\), M.vcMat\(\)" src/world/environment.ts` → both lines still `vcMat()` with no map.
21. gnomes: `rg -n "vcMat\(t.emissiveEyes" src/entities/gnomes.ts` → line unchanged; `04-hole-gnomes-crate.png` shows red, blue, gold, green, dark-red hats.
22. sky/clouds/stars: `rg -n "skyMat|cloudMat|PointsMaterial" src/world/environment.ts` → no `map:` added.
23. desk: `rg -n "deskGeometry\(\), M.vcMat\(\)" src/world/environment.ts` → 1 hit, unchanged.
24. other machines: `rg -n "tex\(" src/entities/machines.ts` → exactly one hit (the crate line).
25. [spec silent] coins, pickups, props, tools, UFO, sprites: `rg -n "tex\(" src` → hits only in `environment.ts`, `machines.ts`, `factory.ts`, `props.ts`.
26. [spec silent] path: before PP's yes `rg -n "decal" src` → 0 hits; after package 5 `scenario-A.js` → `04` `calls` 77 (+1), `tri` +≤ 100, `LOGS:` empty.
27. missing file: every scenario run above prints `LOGS:` followed by an empty line (no 404, no `Texture marked for update` warning).
28. title before load: `CDP_PORT=9365 node smoke.mjs ../tex/p-title ../tex/scenario-A.js` → `00-title.png` exists (taken 7 s after navigate, textures loaded, no black ground behind the menu).
29. old files: `ls public/textures` → exactly `CREDITS.md dirt_diff.jpg grass_diff.jpg metal_diff.jpg mottle.jpg plaster_diff.jpg roof_diff.jpg wood_diff.jpg`; `du -sh public/textures` → ≤ 1.5M; `rg -n "bark_diff|grass_nor" src public/textures/CREDITS.md docs` → 0 hits.
30. type check after every package: `npx tsc --noEmit` → exit 0.

### Assumptions (numbered)
1. "Textures" means surface images on the existing models; model shapes (cone trees, box house) are out of scope.
2. The old file names stay (`grass_diff.jpg` etc.), so the pass is mostly asset swaps plus five code lines.
3. The implementer downloads the assets by hand (browser), as in playtest round 1; no download script, no new dependency.
4. A painted grass with the existing 0xc8f0a0 → 0xe8d890 tint still shows the "drying" effect; if the texture is already yellowish the tint pair may need one adjustment (reported in ai-work, not decided here).
5. The headless renderer (SwiftShader) shows textures the same way as the Mac GPU; mip/anisotropy differences are invisible at 640x360.
6. `renderer.info.memory.textures` counts GPU textures including shadow map and canvas textures (14 today); differences, not absolute values, are the check.
7. ambientCG assets named in the table exist with those IDs (Confident); 3dtextures.me "Stylized" names are Likely/Unclear as marked.

### Risks
- A painted texture that is too bright turns the yard pastel under ACES tone mapping at exposure 1.05; fix is the `color` tint on the material, not the exposure (which would change the gnomes).
- Visible tiling on the ground at 6 m from the fence line (44 m = 7 tiles): if it shows, package 5's decals break it up; a macro-variation shader is not planned.
- The mottle on trees pinches at the cone tips; visible only if the player stands at the fence and looks up at a near tree.
- Another session is editing `src/world/environment.ts` right now (file changed on disk during planning); packages 1 and 4 touch that file and must start from its current content.

### Alternatives rejected
- (a) KTX2/basis compressed textures: GPU memory already drops 2-3x by resizing; the transcoder is ≈ 1 MB of JS and a worker for no visible gain.
- (b) Texture atlas + per-part UV rects in `build()` for trees: needed only if trunk and leaves need different images; the grey mottle x vertex colour gives both from one 26 KB file and no new code in `build()`.
- (c) `MeshToonMaterial`/outline pass for the whole scene: a different task (shading, not textures) and changes the gnomes PP likes.
- (d) Second grass map or shader macro variation on the ground: shader code for a subtle effect; decals (package 5) do the same job where the eye looks.
- (e) WebP files: `sips` cannot write them here and the saving over q80 JPG at these sizes is ≈ 200 KB total.

### Ladder
- New files `public/textures/*.jpg` (7): rung 6, required by "poszukaj jakiejś grafiki na teksturę"; sizes by rung 3 (`sips`).
- Dropped `normalMap` and `grass_nor.jpg`: rung 1 (unasked, invisible at pixel ratio 1.5).
- `map: tex('mottle')` on 5 materials: rung 2 (`tex()` and `vcMat({ map })` already exist, same pattern as the crate).
- `map: tex('metal_diff')` on the factory: rung 2.
- Crate emissive removal: rung 1 (the hack existed only for the dark photo).
- Package 5 decal mesh: rung 2/3 (`mergeGeometries`, `CanvasTexture` and `PlaneGeometry` already used in the repo); exists only if PP picks it.
- No change to `tex()`, `vcMat()`, `build()`: rung 1.

### Open decisions (for PP)
1. Worn ground around the hole and a dirt trail from the factory (package 5)? a) yes: the hole gets a trampled ring and a path leads the eye from the factory to it, +1 draw call, +0.35 MB GPU; b) no: the yard stays uniform grass, cheaper, hole relies on the glow. (recommendation: a, because the hole is the game and today it floats on a flat lawn; also hides grass tiling.)
2. [spec silent] Zakładam: coins, mushroom pickups, props (chair, flamingos, shovel), player tools (magnet gun, broom, tractor), UFO and signs keep their flat colours | Dowód: `props.ts:33-62`, `player.ts:127`, `sweeper.ts:24`, `events.ts:258`, `coins.ts:36` all use `vcMat()`/own material without `map` and none is bigger than 1 m | Jeśli źle: PP sees a textured yard with plain-coloured toys and props, a small style gap | Pewność: Likely | rekomendacja: a) keep flat, they are toy-like on purpose.
3. [spec silent] Zakładam: the desk/PC stays flat-coloured even though PP listed it | Dowód: `environment.ts:108` one merged geometry (desk top, legs, monitor, lamp); a map would cover the monitor too | Jeśli źle: the desk looks plainer than the textured house next to it | Pewność: Likely | rekomendacja: a) keep flat; b) give only the desk top a planks map would need splitting `deskGeometry()` in two meshes (+1 draw call, ~10 lines).
4. Gnomes stay untextured (flat colours are the type signal)? a) yes; b) add a faint felt grain (one 64² noise map at 90-100 % brightness) to every gnome type. (recommendation: a; b adds a sample on up to 1 700 instances for an effect nobody will see at 1-5 m.)
5. Which source first: a) 3dtextures.me "Stylized" set if the pages show CC0 (cleaner painted look); b) ambientCG straight away (certain names and licence, slightly more photographic). (recommendation: a with b as the fallback per row, as in the table.)
6. [decision age] none: every decision in `docs/ai-work` is from 2026-10-19/20 (`old-decisions.sh` window 60 days is empty). The only older-looking rule is `docs/PLAN.md:8` "No downloaded assets", already overridden by playtest round 1 and `CLAUDE.md`; package 1 rewrites that line.

### Self-check
- Every surface PP named has a matrix row, a step or an explicit "unchanged" row, and a Done-when line: yes (30 rows, 30 lines).
- Every step names the file, the line, the exact material call and the file size: yes; no "handle edge cases" lines.
- Every field written has all writers listed: bush look has two writers (environment, props), both in step 7; `tex()` callers all listed under Reach.
- Lists compared with the code: machines (10 cases in `machineVisual`, spec said "machines"), props (chair, flamingo x3, shovel, bush), materials with `map` (6 call sites); 2 `spec silent` rows plus 2 `spec silent` open decisions.
- Decisions older than 60 days: none.
- Plan shorter than the code it describes: no; the code change is about 10 lines plus 7 asset files, the plan is long because the inventory, sources and checks are the deliverable PP asked for ("pokmini, jak to zrobić").
