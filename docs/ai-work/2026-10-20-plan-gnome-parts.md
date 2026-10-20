# Plan: gnome built from moving parts (demo on `classic`) + animation-rule fixes

Spec: PP (hub, 2026-10-20) "poszukać jakiejś biblioteki animacji do tego [...] bo to bardzo drewniane jest" → after research PP chose "a gnom z ruchomych czesci" = option 1 of `docs/ai-work/2026-10-20-animation-options.md` ("Demo to build next", points 1-5). Same brief: fix the rule-1 chasers (`Math.min(1, dt * k)`, 6 sites) and the rule-7 constant spins (`rotation += dt * CONST`).
Trivial check: 10 production files, a new render path (BatchedMesh) that `replay.ts` reads, new per-gnome state, new behaviour (walk cycle, idle, spin-up/down). Not trivial.

## Plan v0 (plan-author)

### Goal
A `classic` gnome is drawn as 7 instanced parts (torso, hat, beard, 2 arms, 2 legs) in one `BatchedMesh`: legs and arms swing from its velocity, hat and beard lag the torso, a standing one breathes; the old one-piece gnome can be drawn next to it for comparison; no chaser or constant spin is left in `src`.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | `classic`, `walk`, moving (`a = min(1, speed/type.speed) > 0.01`) | `writeInstances` | legL pitch `+0.6·a·sin(ph)`, legR `−`, armL `−0.3·a·sin(ph)`, armR `+`, `ph = life·WALK_FREQ`; body matrix (bob, roll, lean) exactly as today | research note step 2 |
| 2 | same gnome turns (target flips) | `update(dt)` | hat world yaw reaches 50 % of the turn 2-6 frames after the torso; beard yaw offset changes sign ≥ 1 time | brief check |
| 3 | same gnome starts from rest (lean 0 → 0.12) | `update(dt)` | hat pitch lags the lean (first-order, λ 12); beard pitch overshoots once (spring K 180, C 12) | note step 2 |
| 4 | `classic`, `walk`, standing (`a ≤ 0.01`) | `writeInstances` | leg and arm matrices constant; torso scale y `1 + 0.015·sin(π·(time + id·0.37))`; hat pitch/roll += `0.04·noise(id·3.1 (+7), time·0.6)` | note step 2 (idle) |
| 5 | `classic`, `statue` | `writeInstances` | all 7 parts rigid (identity local pose), no breath: looks like today's merged mesh | note step 5 (statue idle is a later step) |
| 6 | `classic`, `ragdoll` / `held` / `falling` | `writeInstances` | parts rigid; body matrix keeps today's squash, pop, wiggle, swallow shrink+spin | note "nothing else moves yet" |
| 7 | `classic`, `stashed` | `writeInstances` | its 7 batch instances `setVisibleAt(false)` | today's `HIDDEN` |
| 8 | `remove()` swaps the last slot in | next `writeInstances` | the moved gnome's 7 instances rewritten; ids of the vacated slot hidden | `gnomes.ts:183-200` |
| 9 | `retype()` (Golden Hour, moods) classic ↔ other | spawn + remove | new gnome drawn by its own path; `lag` copied when both have it; pop scale on the body matrix | `gnomes.ts:204-233` |
| 10 | `classic` gnome with `lag = null` (old path, set by the scenario) | `writeInstances` | drawn by the `InstancedMesh` at a compacted index, its batch instances hidden; `mesh.count` = number of old-path gnomes | note step 3 (side by side) |
| 11 | the other 11 types | `writeInstances` | unchanged path (all `lag = null`), same matrices as today | note "classic only" |
| 12 | night (`nightShade > 0`) | render | hat part glows (`glow` attribute 1 on hat, 0 on the rest, same `onBeforeCompile`) | `gnomes.ts:80-109` |
| 13 | shadows on | render | BatchedMesh casts and receives; `renderer.info.render.calls` ≤ today + 2 (main + shadow); with `?lowfx` ≤ today + 1 | brief (draw calls) |
| 14 | 300 part-walkers | 60 frames | `writeInstances` mean ≤ 1.5 ms above the same 300 drawn one-piece; `info.render.triangles` equal within 2 % | brief (frame cost) |
| 15 | replay (key I) recording | `replay.record()` | copies `InstancedMesh` buffers only; playback hides every BatchedMesh, `stop()` shows it again (no frozen part-gnomes during playback) | `replay.ts:27-37, 66-85` |
| 16 | `spec silent` 12 gnome types, not 11 | rollout plan | `PARTS_TYPES` grows to all 12 ids | `gnomeTypes.ts:29-91` |
| 17 | 6 chaser sites | edit | `grep -rn "Math.min(1, dt" src` → 0; motion within 1 % of today at dt 1/60 | CLAUDE.md rule 1 |
| 18 | fan / wheel / vacuum / blackhole placed or restored | `machines.update` | `spinRate` damps 0 → target (25 / 7 / 6 / 3 rad/s, λ 4), reaches 95 % in 0.75 s | rule 7 |
| 19 | such a machine breaks (`breakMachine`) / repairs | `machines.update` | rate decays toward 0 with the same λ: still ≥ 10 % of full at 0.5 s, < 1 % at 1.2 s; repair spins it up again | rule 7 check |
| 20 | `spec silent` conveyor rollers + belt texture (`machines.ts:735-737`) | `machines.update` | same `spinRate` (target `BELT_SPEED / 0.13`), belt offset scaled by `spinRate / target` | rule 7 ("spins continuously") |
| 21 | factory gear | `factory.update` | `gearRate` damps toward `running ? rate·6 : 0` (λ 4) every frame, also when jammed | rule 7 |
| 22 | mushroom pickup, UFO yaw, UFO crash roll | their `update` | each keeps a rate damped toward 2 / 2 / 3 rad/s (λ 4) from 0 at spawn | rule 7 |
| 23 | `spec silent` hole swirl (`environment.ts:434`) | none | left as is: its rate already varies (`spinBoost` decays linearly), it never starts or stops | rule 7 wording |

### Reach
- `src/world/models.ts:51-101` `gnomeGeometry(t)`: caller `gnomes.ts:110` only. `build()` (:12): callers = every geometry in the file; the new optional `glow` parameter defaults to today's behaviour.
- `src/entities/gnomes.ts` `meshes` (`InstancedMesh` per type): readers `replay.ts:30,52,68,77` (copies `instanceMatrix.array`, reads and writes `count`). `mesh.count` writers today: `spawn` :177, `remove` :190; after this plan only `writeInstances`. `g.slot` readers: `remove` :186-188, `writeInstances`; scenario `scenario-anim-b.js:33` (slot-indexed read of the classic buffer: the demo flips its gnome to the old path or reads via `parts.getMatrixAt`).
- `writeInstances()` callers: `main.ts:258`, `replay.ts:69`. `update(dt)` caller: `main.ts:219`.
- `Gnome` literal: `spawn` :167-174 only (new field `lag`).
- `Machine` literal: `machines.ts:418` only (new field `spinRate`). `m.spin` writers: `:712, :765, :833` (deleted), cannon `:801` (damp, stays). Broken gate `:592` runs before the switch, so today a broken fan freezes in one frame.
- Factory gear: `factory.ts:179` only. Mushroom `rotation.y`: `mushrooms.ts:88` only. UFO rotation: `events.ts:294, 298` only.
- Chasers: `gnomes.ts:510`, `environment.ts:439, 449`, `events.ts:318`, `coins.ts:199`, `src/player/sweeper.ts:166`.
- Front/HUD: nothing reads gnome matrices except the renderer and `replay.ts`. No save-file change.
- Concurrency: `gnomes.ts` and `machines.ts` are open in the saboteur investigation, `src/player/sweeper.ts` is in the queued gear-wheel plan (`2026-10-20-plan-gear-wheel.md` step 1). Start this task after those land. `models.ts`, `replay.ts`, `factory.ts`, `mushrooms.ts`, `events.ts`, `environment.ts`, `coins.ts` are free now.

### Data
- GPU buffers only, no save data. Classic BatchedMesh: `maxInstanceCount = 500 × 7 = 3500`, `maxVertexCount` = sum of the 7 parts' position counts (classic 1516 triangles = 4548 vertices non-indexed, `build()` output), attributes position/normal/color/uv/glow. Matrices texture 128×128 RGBA float (256 KB), uploaded when dirty (every frame with walkers); today's classic `instanceMatrix` is 32 KB. Vertex data ≈ 220 KB once.
- Volume: gnome cap `120 + permit × 40` = 320 (`gnomes.ts:127`); classic capacity 500; all 12 capacities sum to 1732 → rollout worst case 12 124 batch instances, ≈ 1.1 MB of float textures.
- Per frame at 300 part-walkers: 2100 `compose` + `setMatrixAt` (+ 2100 `setVisibleAt` early returns), estimate < 1 ms CPU; BatchedMesh `onBeforeRender` walks 3500 instance infos per pass (main + shadow). `WEBGL_multi_draw` present (ANGLE Metal and SwiftShader): one GL call per pass; without it three issues one call per visible instance and `info.render.calls` shows it (row 13 guards this).

### Steps (edit order)
1. `src/world/models.ts` — `export type PartName = 'torso' | 'hat' | 'beard' | 'armL' | 'armR' | 'legL' | 'legR'`; `export const PART_ORDER: PartName[] = ['torso', 'hat', 'beard', 'armL', 'armR', 'legL', 'legR']`; `export const PART_PIVOT: Record<PartName, [number, number, number]> = { torso: [0, 0, 0], hat: [0, 0.155, 0], beard: [0, 0.096, 0.11], armL: [-0.132, 0.029, 0.061], armR: [0.132, 0.029, 0.061], legL: [-0.075, -0.24, 0.02], legR: [0.075, -0.24, 0.02] }` (hat = brim centre; beard = base of the cone after its rotation; arm = top end of the cylinder, `p + Rxyz(r)·(0, 0.11, 0)`; leg = hip at the top of the pants, the foot swings under the pants skirt). `type Part` gets `part?: PartName` (default torso). `build(parts, glow = parts.some((p) => p.glow))`: the attribute is written when `glow` is true. Extract the list of `gnomeGeometry` into `gnomePartList(t): Part[]`, tag :53-54 `legL`/`legR`, :60/:62 `armL`, :61/:63 `armR`, :66 `beard`, :67-68 `hat`; `gnomeGeometry(t) = build(gnomePartList(t))` (output byte-identical). New `export function gnomeParts(t): THREE.BufferGeometry[]` = for each name of `PART_ORDER`: `build(list.filter((p) => (p.part ?? 'torso') === name), true).translate(-px, -py, -pz)`. Extras (goggles, staff, fuse, crown) stay untagged = torso (rollout tags them, see below).
2. `src/entities/gnomes.ts` — imports `gnomeParts, PART_ORDER, PART_PIVOT` and `SimplexNoise` (`three/addons/math/SimplexNoise.js`, as `fx.ts:2`). Consts: `PARTS_TYPES = new Set(['classic'])`, `NPARTS = 7`, `LEG_SWING = 0.6`, `ARM_SWING = 0.3`, `LEAN = 0.12` (replaces the literal at :743), `LAG_LAMBDA = 12`, `BEARD_K = 180`, `BEARD_C = 12`, `BREATH = 0.015`, `HAT_NOISE = 0.04`, `const noise = new SimplexNoise()`. `export interface PartLag { hatP: number; hatY: number; beardP: number; beardY: number; beardVP: number; beardVY: number }`; `Gnome.lag: PartLag | null` ("null = drawn as one piece"); `spawn` sets `lag: PARTS_TYPES.has(type.id) ? { hatP: 0, hatY: 0, beardP: 0, beardY: 0, beardVP: 0, beardVY: 0 } : null`; `retype`: `if (g.lag && n.lag) Object.assign(n.lag, g.lag)`. Field `readonly parts = new Map<string, THREE.BatchedMesh>()`; in the constructor loop, when `PARTS_TYPES.has(t.id)`: `const geos = gnomeParts(t); const bm = new THREE.BatchedMesh(t.capacity * NPARTS, geos.reduce((n, g) => n + g.attributes.position.count, 0), undefined, mat); const ids = geos.map((g) => bm.addGeometry(g)); for slot < capacity, for k < NPARTS: bm.setVisibleAt(bm.addInstance(ids[k]), false)` (ids come out as `slot * NPARTS + k`); `bm.castShadow = bm.receiveShadow = true; bm.frustumCulled = false; bm.perObjectFrustumCulled = false; bm.sortObjects = false; ctx.scene.add(bm); this.parts.set(t.id, bm)`. Delete the `count =` lines at :177 and :190. `update`: :510 → `const prevYaw = g.yaw; g.yaw = THREE.MathUtils.damp(g.yaw, g.yaw + angleDiff(g.yaw, yaw), 8, dt);` and after :517 `if (g.lag) this.updateLag(g.lag, angleDiff(prevYaw, g.yaw), LEAN * Math.min(1, Math.hypot(vx, vz) / g.type.speed), dt)` with `private updateLag(l, dYaw, lean, dt)`: `l.hatY = damp(l.hatY - dYaw, 0, LAG_LAMBDA, dt); l.hatP = damp(l.hatP, lean, LAG_LAMBDA, dt); l.beardY -= dYaw; l.beardVY += (-l.beardY * BEARD_K - l.beardVY * BEARD_C) * dt; l.beardY += l.beardVY * dt; l.beardVP += ((lean - l.beardP) * BEARD_K - l.beardVP * BEARD_C) * dt; l.beardP += l.beardVP * dt;`. `writeInstances`: per type `const bm = this.parts.get(id); let n = 0;` hoist `let a = 0, ph = 0` before the state branches (set in the walk branch); `stashed`: `if (g.lag && bm) hide its 7 ids; continue` (no `HIDDEN` write); after composing `tmpM`: `if (g.lag && bm) this.writeParts(bm, g, i, tmpM, a, ph) else { hide ids i*7..+6 when bm; mesh.setMatrixAt(n++, tmpM) }`; after the loop `mesh.count = n; mesh.instanceMatrix.needsUpdate = true;` and hide ids from `slots.length * NPARTS` to `(this.partsDrawn.get(id) ?? 0) * NPARTS`, then `partsDrawn.set(id, slots.length)`. `private writeParts(bm, g, slot, bodyM, a, ph)`: `idle = g.state === 'walk' && a <= 0.01`, `lean = LEAN * a`, `s = Math.sin(ph)`; per k: pitch/yaw/roll = torso `(0, 0, 0)` with scale y `idle ? 1 + BREATH * Math.sin(Math.PI * (ctx.time + g.id * 0.37)) : 1`; hat `(l.hatP - lean + (idle ? HAT_NOISE * noise.noise(g.id * 3.1, ctx.time * 0.6) : 0), l.hatY, idle ? HAT_NOISE * noise.noise(g.id * 3.1 + 7, ctx.time * 0.6) : 0)`; beard `(l.beardP - lean, l.beardY, 0)`; armL `(-ARM_SWING * a * s, 0, 0)`; armR `(+…)`; legL `(+LEG_SWING * a * s, 0, 0)`; legR `(−…)`; `tmpM2.compose(pivot, tmpQ2.setFromEuler(tmpE.set(p, y, r)), tmpS2.set(1, sy, 1)); tmpM3.multiplyMatrices(bodyM, tmpM2); bm.setMatrixAt(slot * NPARTS + k, tmpM3); bm.setVisibleAt(…, true)`. Non-walk states: `a = 0` so parts are rigid (rows 5-6).
3. `src/systems/replay.ts` — when playback starts (`this.playing = true`): `for (const bm of ctx.gnomes.parts.values()) bm.visible = false;`; in `stop()` before `writeInstances()`: `visible = true`. Comment: "part-drawn gnomes are not recorded; the rollout records body matrix + pose".
4. Chasers (rule 1): `environment.ts:439` → `.lerp(tint, 1 - Math.exp(-4 * dt))`; `:449` → `this.night = THREE.MathUtils.damp(this.night, target, 0.8, dt)`; `events.ts:318` → `.lerp(u.target, 1 - Math.exp(-0.8 * dt))`; `coins.ts:199` → `const k = 1 - Math.exp(-4 * dt)`; `src/player/sweeper.ts:166` → `const k = 1 - Math.exp(-12 * dt)` (gnomes.ts:510 in step 2).
5. Spins (rule 7): `machines.ts` — `Machine.spinRate: number` (`:418` literal `spinRate: 0`); `const SPIN_RATE: Record<string, number> = { fan: 25, wheel: 7, vacuum: 6, blackhole: 3, conveyor: BELT_SPEED / 0.13 }`, `const SPIN_AXIS: Record<string, 'x' | 'z'> = { fan: 'z', wheel: 'x', vacuum: 'z', blackhole: 'z' }`, `SPIN_LAMBDA = 4`; before the gate at :592: `const target = SPIN_RATE[m.type]; if (target !== undefined) { m.spinRate = THREE.MathUtils.damp(m.spinRate, m.broken > 0 ? 0 : target, SPIN_LAMBDA, dt); const axis = SPIN_AXIS[m.type]; if (axis && m.spin) m.spin.rotation[axis] += m.spinRate * dt; if (m.type === 'conveyor') { for (const c of m.root.children) if (c.name === 'roller') c.rotation.x += m.spinRate * dt; const mat = …; if (mat.map) mat.map.offset.y = (mat.map.offset.y + (dt * m.spinRate * 0.13 * BELT_REPEAT) / BELT_LEN) % 1; } }`; delete `:712, :735-737, :765, :833`. `factory.ts` — field `private gearRate = 0`; after `this.running = …`: `this.gearRate = THREE.MathUtils.damp(this.gearRate, this.running ? rate * 6 : 0, 4, dt); this.gear.rotation.x += this.gearRate * dt;` delete `:179`. `mushrooms.ts` — `Pickup.spin: number` (0 at spawn); `:88` → `m.spin = THREE.MathUtils.damp(m.spin, 2, 4, dt); m.mesh.rotation.y += m.spin * dt;`. `events.ts` — ufo object gets `spin: 0, roll: 0`; `:294` → `u.spin = damp(u.spin, 2, 4, dt); m.rotation.y += u.spin * dt`; `:298` → `u.roll = damp(u.roll, 3, 4, dt); m.rotation.z += u.roll * dt`.
6. Scenario `<scratchpad>/smoke/scenario-parts.js` (runs the loop at 60 Hz like `scenario-anim-b.js`, reads `ctx.gnomes.parts.get('classic').getMatrixAt(slot * 7 + k, m)`; local part rotation = `bodyQuat⁻¹ · partQuat` with `bodyQuat` from the torso matrix; leg angle = its x Euler). Steps: `walk` (A parts, B `lag = null`, 1 m apart, same `target`, `think = 99`, 60 frames to +z), `turn` (target flipped, 60 frames), `start` (from rest), `stand`, `statue`, `stash`, `night`, `calls` (today's count read before any spawn on the same scene), `perf300`, `fan` (place via `g.machines.place('fan', …)` as `scenario15.js:25`, sample `spin.rotation.z` deltas, `breakMachine`, `repair`), `gear`, `shroom`, `ufo`; `shot('20-walk-peak')` at the frame of max |legL| with A and B in view (camera as in `scenario-smooth.js` step `13-gnomes`).
7. Regression: `scenario-anim-b.js` (its classic gnome: set `lag = null` or read parts), `scenario-interp.js`, `scenario15.js`, `scenario-perf-tri.js`; `npx tsc --noEmit`. Note `docs/ai-work/2026-10-20-gnome-parts.md`; one `CHANGELOG.md` line.

Rollout cost (after PP picks the part gnome): `PARTS_TYPES` → all 12 ids; tag extras in `gnomePartList` (goggles + strap → torso; staff cylinder + orb → `armR`; staff mini-hat, fuse bands, fuse, spark, crown ring + 5 spikes → `hat`; cape → torso); delete the `InstancedMesh` path, `meshes`, `HIDDEN` and the compaction; `replay.ts` records per gnome the body matrix + 7 pose floats (`a·sin(ph)`, hatP−lean, hatY, beardP−lean, beardY, breath sy, idle noise seed) and `show()` calls a shared `composeParts`; scenarios that read `instanceMatrix` move to `getMatrixAt`. Estimate 1 day + 0.5 day replay; textures ≈ 1.1 MB.

### Tests
One scenario, one `RESULT` key per matrix row (headless Chromium over CDP, dev server on 5199, `node smoke.mjs run-parts scenario-parts.js`):
- rows 1-4: `walk.legZeroCross ≥ 4`, `walk.legPeak ≤ 0.6`, `walk.armSign = −legSign`, `walk.bodyMatchesOld` (A's torso matrix = B's body matrix within 1e-6 at the same frame), `turn.hatLagFrames ∈ [2, 6]`, `turn.beardSignChanges ≥ 1`, `start.hatLagFrames ∈ [2, 6]`, `start.beardOvershoot ≥ 1`, `stand.legDelta = 0`, `stand.breathSpan ∈ (0.02, 0.031)`, `stand.hatNoiseSpan > 0`.
- rows 5-9: `statue.partsIdentity`, `ragdoll.partsIdentity` and `held.partsIdentity` (local quat = identity), `stash.hidden = 7`, `remove.lastHidden`, `retype.lagCopied`.
- rows 10-12: `old.count = 1` with `old.batchHidden`, `others.sameAsBefore` (a `blue` gnome's matrix equals the pre-edit formula), `night.hatGlowAttr` (`parts.geometry.attributes.glow` 1 on the hat range, 0 elsewhere).
- rows 13-14: `calls.lowfx ≤ before + 1`, `calls.shadow ≤ before + 2`, `multiDraw = true`, `perf300.partsMs − perf300.oldMs ≤ 1.5`, `perf300.triRatio ∈ [0.98, 1.02]`.
- row 15: `replay.partsHidden` while playing, `replay.partsVisible` after stop, `LOGS:` empty.
- rows 17-23: grep lines below; `fan.spinUp95 ≤ 0.75 s`, `fan.rateAt0_5sAfterBreak ≥ 2.5`, `fan.rateAt1_2s < 0.25`, `fan.repairSpinsUp`, `conveyor.rollerDecays`, `gear.decaysWhenJammed`, `shroom.spinUp`, `ufo.spinUp`, `swirl.unchanged` (diff of `environment.ts:434`).

### Done when
1. `node smoke.mjs run-parts scenario-parts.js` → `walk: {legZeroCross: ≥4, legPeak: ≤0.6, armSign: -1, bodyMatchesOld: true}`
2. same → `turn: {hatLagFrames: 2..6, beardSignChanges: ≥1}`
3. same → `start: {hatLagFrames: 2..6, beardOvershoot: ≥1}`
4. same → `stand: {legDelta: 0, breathSpan: 0.02..0.031, hatNoiseSpan: >0}`
5. same → `statue: {partsIdentity: true, breathSpan: 0}`
6. same → `ragdoll: {partsIdentity: true}, held: {partsIdentity: true}, falling: {shrinks: true}`
7. same → `stash: {hidden: 7}`
8. same → `remove: {lastHidden: true, movedRewritten: true}`
9. same → `retype: {lagCopied: true, popSeen: true}`
10. same → `old: {count: 1, batchHidden: true}` and `20-walk-peak.png` shows both gnomes, the right one mid-step (checked by eye)
11. same → `others: {sameAsBefore: true}`
12. same → `night: {hatGlowAttr: true}` and a night screenshot shows the part gnome's hat glowing
13. `URL_QUERY='' DPR=2 node smoke.mjs run-parts-calls scenario-parts.js` → `calls: {shadow: ≤ before+2, lowfx: ≤ before+1, multiDraw: true}`
14. same run → `perf300: {partsMs - oldMs ≤ 1.5, triRatio: 0.98..1.02}`
15. same → `replay: {partsHidden: true, partsVisible: true}`, `LOGS:` empty
16. `grep -c "id: '" src/data/gnomeTypes.ts` → `12`, and the rollout section above names 12
17. `grep -rn "Math.min(1, dt" src` → no output
18. scenario → `fan: {spinUp95: ≤0.75}` (also `wheel`, `vacuum`, `blackhole` keys present)
19. scenario → `fan: {rateAt0_5sAfterBreak: ≥2.5, rateAt1_2s: <0.25, repairSpinsUp: true}`
20. scenario → `conveyor: {rollerDecays: true, beltDecays: true}`
21. scenario → `gear: {decaysWhenJammed: true}`
22. scenario → `shroom: {spinUp: true}, ufo: {spinUp: true, rollUp: true}`
23. `grep -n "swirl.rotation.z -= dt" src/world/environment.ts` → 1 line, unchanged
Plus: `npx tsc --noEmit` → exit 0; `scenario-anim-b.js`, `scenario-interp.js`, `scenario15.js` pass with `LOGS:` empty.

### Assumptions (numbered)
1. "Frames" in the lag checks = render frames at the 60 fps cap (`update(dt)` runs once per frame); λ 12 gives a ≈ 5-frame lag behind a ramp.
2. The walk body pose (bob, roll, lean) stays on the body matrix and is inherited by all parts; only limb swing and hat/beard lag are new. Squash while walking (≤ 9 frames after a landing) shears the swinging legs slightly: accepted.
3. `setVisibleAt`/`setMatrixAt` on 3500 pre-created instances is cheaper and simpler than `addInstance`/`deleteInstance` per spawn; ids are `slot * 7 + k` because `addInstance` hands out ids in order on an empty mesh.
4. `WEBGL_multi_draw` is available in the Metal and SwiftShader runs; row 13 fails loudly if not (one call per instance).
5. Machines restored from a save spin up from 0 over 0.75 s on load; placement does the same.
6. `damp` vs `min(1, dt·λ)`: at dt 1/60 the step differs by < 8 % of a step (0.125 vs 0.133 for λ 8), not visible.
7. No decision in `docs/ai-work` older than 60 days exists (oldest file 2026-10-19).

### Alternatives rejected
- (a) 7 `InstancedMesh` per type: 66 → 84 draw calls per pass, over the 66-call ceiling (`2026-10-19-performance.md`); BatchedMesh keeps one call.
- (b) Skeletal/`SkinnedMesh`, `@three.ez/instanced-mesh`, VAT: research note, 5-8 days, new dependency, breaks "models from primitives".
- (c) Separate `InstancedMesh` for the demo type next to the batch (old path by slot, `HIDDEN` for part-gnomes): 300 degenerate gnomes still run through the vertex shader twice; compaction avoids it with the same `count` contract for `replay.ts`.
- (d) Pose recording in `replay.ts` now: +0.5 day before PP has judged the look; the demo hides the batch during playback instead.
- (e) Splitting the pants into two leg cylinders: new geometry changes the silhouette; the foot swinging under the pants skirt needs no new primitive.
- (f) Tween.js for the spring: a 2-line explicit Euler spring on existing fields; rung 5.

### Ladder
- `gnomeParts()`, `PART_ORDER`, `PART_PIVOT`, `Part.part` tag: rung 6; spec "gnom z ruchomych części", "same split extends to all types without rewrite".
- `build(parts, glow)`: rung 6, forced by BatchedMesh `_validateGeometry` (every geometry must carry the same attributes).
- `THREE.BatchedMesh`: rung 2 (three core on disk); spec "draw calls stay flat".
- `SimplexNoise`: rung 4 (bundled addon, already imported in `fx.ts`); note step 2 "hat tilt noise from SimplexNoise".
- `PartLag` + `updateLag`: rung 6; brief checks "hat lags 2-6 frames", "beard overshoots".
- `PARTS_TYPES`: rung 6; "one gnome type (`classic`)".
- `replay` visibility toggle: rung 5; row 15.
- `THREE.MathUtils.damp` / `1 - exp(-λ dt)`: rung 2; rule 1.
- `spinRate`, `gearRate`, `spin`, `roll` fields + `SPIN_RATE`/`SPIN_AXIS`: rung 6; rule 7 and its check.
- Cut (one line each): head turn (needs an 8th part), vertical hat lag per step, statue idle, held kicking, ragdoll flail, per-object frustum culling, `setColorAt`, Tween.js, `standUp` lag reset (values are tiny after a ragdoll).

### Open decisions (for PP)
1. Which gnomes use parts in the playtest build: a) every `classic` gnome (PP sees it live; the scenario flips one to the old path for the screenshot) b) only the scenario's gnome, the game keeps the one-piece look until the rollout. (recommendation: a, because the point of the demo is to see it move in play; the type is 60 % of spawns)
2. Replay during the demo: a) part-drawn gnomes do not appear in the instant replay (the batch is hidden while it plays), the rollout step records them b) record body matrix + pose now, +0.5 day before the look is judged. (recommendation: a)
3. Idle head turn (research note) needs the head as an 8th part: a) demo idle = breathing + hat noise only, head turn with the rollout b) 8 parts now. (recommendation: a, the brief says 7 parts)
4. Leg split: a) the foot box swings under the pants skirt from a hip pivot at the top of the pants b) cut the pants cylinder into two legs (new primitives, changes the silhouette). (recommendation: a; PP judges on the screenshot anyway)
5. [spec silent] Zakładam: the rollout covers 12 types (classic, blue, golden, greedy, boom, angry, dwarf, saboteur, shadow, wizard, fat, king), the brief and the research note say 11 | Dowód: `src/data/gnomeTypes.ts:29-91` has 12 entries | Jeśli źle: one type stays a rigid statue after the rollout | Pewność: Confident | rekomendacja: a) 12
6. [spec silent] Zakładam: the conveyor rollers and belt texture get the same damped rate as the fan (not in the brief's list) | Dowód: `machines.ts:735-737` spins them at a constant rate every frame | Jeśli źle: a broken belt freezes in one frame while the fan beside it winds down | Pewność: Likely | rekomendacja: a) include
7. [spec silent] Zakładam: the hole swirl stays as it is (not in the brief's list) | Dowód: `environment.ts:433-434`: its rate is `0.6 + level·0.12 + spinBoost·5` and `spinBoost` decays linearly, so it never starts or stops | Jeśli źle: a hole pulse's spin kick would be softened by a damp | Pewność: Likely | rekomendacja: a) leave it

### Self-check
- Every acceptance criterion (leg crossings, hat lag, beard overshoot, standing leg, draw calls, 300-gnome cost, side-by-side screenshot, chasers, spins) has a step and a `Done when` line: yes.
- Every step names files, signatures and values: yes (pivots, constants, λ, K/C, tables).
- Every written field lists all writers and readers: `mesh.count` (spawn/remove → writeInstances only; replay reads), `lag` (spawn, retype, updateLag; writeParts reads), `spinRate` (one literal, one block), `gearRate`/`spin`/`roll` (one site each): yes.
- Lists compared with the code: types 11 → 12 (row 16); spin sites 7 named → 9 found (rows 20, 23); chasers 6 named → 6 found. `Done when` lines = 23 = matrix rows.
- Decisions older than 60 days: none (oldest note 2026-10-19).
- Plan shorter than the code: the code is ≈ 300 lines of TypeScript plus a ≈ 250-line scenario; this plan is ≈ 170 lines.

## Review: roast (plan-roaster)

Verdict: CONCERNS

Steel-man: The plan adds limb motion without a skeleton or a new dependency. It cuts the existing primitive list into 7 pivoted parts and draws them through three's own `BatchedMesh` in one call per pass. The body pose stays bit-identical, so the old and new gnome can be compared side by side. Strong points: `gnomeGeometry` stays byte-identical, so shop thumbnails and the album are untouched (checked: `gnomeGeometry` has a single caller, `gnomes.ts:110`; `icons.ts` and `album.ts` never read gnome meshes). The plan pre-creates instances, so spawn and remove never reallocate. It owns the replay gap openly (Open decision 2). The beard spring is stable at the clamped dt (`main.ts:211` caps dt at 0.05 s; Euler stability limit for K 180 is ≈ 0.149 s). The spin fixes are visual only and cannot shift gameplay timing.

Findings:
- [Major] When PP opens the playtest in a browser without `WEBGL_multi_draw`, every visible part becomes its own draw call: 300 classic walkers × 7 parts = 2100 calls in the main pass plus 2100 in the shadow pass.
  Assumption: the extension exists on PP's laptop because it exists in headless Metal and SwiftShader (Assumption 4).
  Scenario: PP loads the 5300 build on the LAN laptop in a browser that does not expose the extension (Firefox has historically not exposed it). The yard fills to the 320 cap, about 60 % of it classic. The frame rate collapses, and row 13 never catches it, because row 13 only runs headless where the extension exists.
  Checked: `node_modules/three/src/renderers/WebGLRenderer.js:1315-1329` (r186). Without the extension it loops `for (i < _multiDrawCount) renderer.render(...)` with a `_gl_DrawID` uniform write per instance. No code in `src` checks the extension (grep `multiDraw|BatchedMesh` in `src`: 0 hits).
  Impact: the demo meant to judge the look is judged at a low frame rate; PP blames the parts gnome or the game.
  Recommendation: at boot, `if (!renderer.extensions.has('WEBGL_multi_draw')) PARTS_TYPES.clear()`, so classic falls back to the one-piece path, plus one HUD/console line saying so. Add a `Done when` line that forces the fallback (for example `?nomultidraw`) and checks `calls ≤ before`.
- [Major] When a classic gnome walks, its feet slide about 0.3 m per step, because the step rate is tied to time, not distance.
  Assumption: `ph = life · WALK_FREQ` (8 rad/s) with ±0.6 rad leg swing fits the walk speed.
  Scenario: classic `speed: 1.3` (`gnomeTypes.ts:32`). A half cycle takes π/8 = 0.39 s, so the body moves 0.51 m per step. Pendulum length from the hip pivot (-0.24) to the foot centre (-0.41) is 0.17 m, so the foot travels 2·0.17·sin 0.6 = 0.19 m. The planted foot skates 0.32 m per step (62 % of the stride). Flee (×1.3) and parade (×1.6, `gnomes.ts:499-501`) raise the speed but not the step rate, so the skating grows.
  Checked: `gnomes.ts:61` (`WALK_FREQ = 8`), `:738-740` (`a` clamps at 1, `ph = g.life * WALK_FREQ`), `models.ts:54-56` (foot boxes at y -0.41, pants -0.38..-0.24).
  Impact: the brief asked exactly this: the walk reads as "ice skating", one of the classic wooden tells. No swing amplitude fixes it at 8 rad/s: the needed 0.51 m would require sin > 1.
  Recommendation: advance a per-gnome phase by distance, `ph += hs · dt · π / (2 · 0.17 · sin(LEG_SWING) · g.scale)` (≈ 16.5 rad/m, ≈ 3.4 steps/s at 1.3 m/s), and drive bob and roll from the same phase. This breaks `walk.bodyMatchesOld`, which PP or plan-senior has to accept. The alternative is to keep the time phase and accept the sliding, after PP has seen the screenshot.
- [Major] Each time a wandering gnome stops or starts, its legs and arms jump up to 0.6 rad in one frame.
  Assumption: swing amplitude `a = min(1, hs / speed)` from the current velocity is smooth.
  Scenario: `decide()` sets `g.target = null` (`gnomes.ts:512, :630`). Then `vx = vz = 0` (`:491-492`), and `setLinvel` zeroes the velocity at once (`:517`). On the next frame `a` drops from 1 to 0, so a leg at `sin(ph) = 1` snaps from 34° to 0 in one frame. On a start, `a` jumps 0 → 1 at a random phase. Wanderers stop every few seconds.
  Checked: `gnomes.ts:491-517`, `:738`. The body bob, roll and lean have the same snap today, but they are 0.05 m and 0.08 rad, and the new limbs are larger and in plain view.
  Impact: PP sees limbs pop at every stop. That is the "wooden" look the task should remove, and it breaks rule 1 in spirit (a value chasing a target must be damped).
  Recommendation: store `swing` in `PartLag`, damp it toward `a` (λ ≈ 10), and use it for limbs only. On a stop the limbs ease back in about 0.2 s. Add one `Done when` key: `stop.maxLegStepPerFrame ≤ 0.1`.
- [Minor] When a gnome is grabbed or thrown mid-walk, its hat and beard stay tilted by the last lean (≈ 0.12 rad) for the whole flight. So `ragdoll.partsIdentity` / `held.partsIdentity` (Done when 6) fail unless the scenario only tests gnomes picked up from rest.
  Assumption: "non-walk states: `a = 0` so parts are rigid".
  Scenario: `writeParts` uses `l.hatP - lean` and `l.beardP - lean`. In non-walk states `lean = 0`, but `l.hatP` stays frozen at ≈ 0.12, because `updateLag` runs only in the walk branch.
  Checked: plan step 2 (the `updateLag` call after `:517`, the hat and beard rows in `writeParts`); the "`standUp` lag reset" cut assumes the values are tiny, but a steady walker holds 0.12.
  Impact: a 7° hat tilt in flight is cosmetic, but the test contradicts the code as specified.
  Recommendation: in `writeParts`, use the lag terms only when `g.state === 'walk'`, or zero `lag` when the gnome leaves `walk`.
- [Minor] When a gnome walks into a wall or a crowd, its hat stays tilted for as long as it is stuck. The lag target uses the wanted velocity (`vx, vz`), but the render lean uses the actual `linvel`. Checked: plan step 2 (`updateLag(..., LEAN * min(1, hypot(vx, vz) / speed))` versus `lean = LEAN * a` from `linvel`). Use the same source for both.
- [Minor] When a gnome reverses, the hat yaw lag peaks at ≈ 0.9 rad (closed form for λ 8 yaw versus λ 12 hat). It is still almost invisible, because the hat is a near-symmetric cone (`models.ts:67-68`), so row 2 passes in numbers but not to the eye. The beard on the same turn swings far enough sideways that it may cut into the shirt (not checked by rendering). Add a screenshot at the peak beard yaw of the `turn` step.
- [Minor] The spin fixes do not change gameplay timing, which answers the brief. The fan push, the belt carry and the vacuum pull never read `spin` (`machines.ts:712-731, 733-760, 832+`), and the broken gate at `:592` stops the effect at once. The visual now disagrees with the effect: (a) a new or loaded fan pushes at full strength while its blades are still winding up for 0.75 s; (b) a broken fan stops pushing at once while its blades coast for 1.2 s; (c) a loaded belt moves gnomes at full `BELT_SPEED` while its texture still crawls. This is accepted unless PP objects. Worth one line in the note.
- [Minor] When PP plays the build, `blue` gnomes keep the old rigid walk next to animated `classic` ones. Both have the same silhouette and speed 1.3 (`gnomeTypes.ts:32, 37`), so PP may read it as a bug. The playtest message should say "only classic has moving parts".
- [Minor] Idle breathing (1.5 % of 0.9 m ≈ 1.3 cm) and hat noise (0.04 rad ≈ 2°) are below a few pixels at play distance. The "standing gnome breathes" part of the goal will likely look unchanged to PP. Judge it on a close screenshot, not on the RESULT key.

Pre-mortem: PP opens the playtest and writes "nadal drewniane, nogi się ślizgają i skaczą" (still wooden, the legs slide and jump), or "tnie się" (it stutters). The first assumption to crack is that a time-driven swing on two shoe boxes under a rigid pants cylinder reads as walking. The feet barely leave the pants outline (front edge ≈ 0.19 m against a pants radius of 0.17). They slide 0.3 m per step and snap at every stop, so the only clearly new motion is the arm swing. The signal everyone missed: every `Done when` key measures curve shape in local part space, and none measures foot speed relative to the ground or the look at play distance. If PP plays in a browser without `WEBGL_multi_draw`, the failure is a frame-rate collapse, and nothing in the plan tests for that.

Inversion worth considering: drive the limb phase by distance walked instead of time (and accept that the body bob changes too). Stride-locked feet do more against "wooden" than the hat and beard lag.

Investigate first: Which browser does PP play in on the laptop, and does it report `WEBGL_multi_draw`? (`renderer.extensions.has('WEBGL_multi_draw')` in the console on the 5300 build.) For plan-performance: the shared `mat` between the classic `InstancedMesh` and the `BatchedMesh` flips `needsProgramChange` on every alternation (`WebGLRenderer.js:2436-2442`). Is that per-frame program lookup measurable?

## Review: impact (plan-impact)

Verdict: CONCERNS

Missing from the plan:
- [High] Three more scenarios read the classic `instanceMatrix` by `gn.slot`, not only `scenario-anim-b.js:33`: `<scratchpad>/smoke/scenario-interp.js:48-49`, `scenario-polish-A.js:51-52`, `scenario-polish-A-wait.js:52-53`. When every classic gnome is drawn by parts (open decision 1 a), these read a buffer that no longer holds their gnome, so `scenario-interp.js` (named as a regression run in step 7) fails or passes on garbage. Fix: step 7 gives each the same treatment as anim-b (set `lag = null` on the watched gnome and read at its compacted index, or read `parts.getMatrixAt(slot * 7)`); note that after compaction "old path" index ≠ `slot` too.
- [High] `docs/ai-work/2026-10-20-replay.md` (PP's Night 2 item D) defines the replay as "one key shows the last 10 s of gnome and player motion". Open decision 2 a hides every part-drawn gnome during playback; with decision 1 a that is every classic gnome, about 60 % of the yard. Fix: open decision 2 should quote that note and say "kiedy gracz wciśnie I, wtedy ~60 % gnomów znika z powtórki", so PP decides against the recorded goal, not against "+0.5 day".
- [Medium] Compaction (`n++`, stashed gnomes skipped) runs for all 12 types, not only classic. When a stashed gnome (crate, cannon queue, robot bed) sits before another in `slots`, that gnome's instance index stops equal to its `slot`. Readers by slot: `<scratchpad>/smoke/scenario-golden.js:50-56` (`mesh.getMatrixAt(c.slot, …)`). Row 11 "same matrices as today" holds per gnome, not per index. Fix: say it in row 11 and move scenario-golden to a lookup by gnome, or compact only `PARTS_TYPES`.
- [Medium] `lag` is written only by `updateLag`, called inside the walk branch (`gnomes.ts:509-517`). The state writers `ragdoll()` (:236), `stash()` (:245), the grab (`held`), `startFalling`, `standUp()` (:525) never reset it, and `writeParts` adds `l.hatP`, `l.hatY`, `l.beardP`, `l.beardY` in every state. When a walking gnome is kicked, its hat and beard keep the last offset frozen for the whole ragdoll, so rows 5-6 and Done 5-6 (`partsIdentity: true`) fail. Fix: zero `lag` in those writers, or use the offsets only when `g.state === 'walk'`.
- [Low] `g.yaw` has a second writer: `gnomes.ts:631` (`stalk`, shadow gnome) snaps yaw with no `prevYaw`, and `standUp()` (:531) snaps the body to `g.yaw`. Not a demo problem (classic only); for the rollout, add both to the dYaw source or the hat sees no turn.

Neighbours checked: replay: affected (rows 15, decision above; `stop()` calls `writeInstances`, which now owns `count`, consistent with `replay.ts:68`) | `mesh.count` writers: affected and covered (spawn :177, remove :190 deleted; replay :68/:81 write it, `writeInstances` overwrites next frame; `clearAll()` has no callers) | shared material / glow: covered (same `mat`, `onBeforeCompile` and `customProgramCacheKey`; `settings.ts:56-70` traverse sets `needsUpdate` on the batch too) | shadows / quality: covered (row 13) | icons thumbnails (`icons.ts:40-44`): not affected, no gnome model; `machineVisual` keeps `spin`, rate lives on `Machine` | shot.ts: not affected, reads the canvas | raycasts on gnome meshes: none (grabs go through Rapier `byCollider`) | speech bubbles, aim labels: not affected, read body positions | golden hour / moods: covered by row 9 (`retype`) | statue / held / stashed: covered by rows 5-7, but see the lag finding | machines: robot uses `m.spin` as its bed (`robots.ts:136`), not in `SPIN_RATE`, so not touched; blown fuses do not gate `effect()`, so `broken` is the only stop and the target rule matches today | conveyor: consistent with `2026-10-19-conveyor.md` ("texture offset grows at speed x repeat / length, rollers spin at speed / radius"), the plan keeps the same steady rate | factory, mushrooms, UFO: one site each, as listed | save file: not affected.
FE/BE: no backend; HUD/UI reads no gnome matrices.
Concurrency: `robots.ts` (being edited now) is not in the plan; the plan adds a required field `spinRate` to `Machine`, and robots builds no `Machine` literal (only `machines.ts:418`), so no clash. `sweeper.ts:166` overlaps the queued gear-wheel plan (already noted in Reach). The computer-shop plan touches `icons.ts`/`shop.ts` only: no overlap. Gear-wheel also edits `main.ts`; this plan does not.
Decisions: conflicts with `2026-10-20-replay.md` (see High above) | consistent with `2026-10-20-animation-options.md` (option 1, BatchedMesh) | consistent with `2026-10-19-performance.md` (draw-call ceiling) | consistent with `2026-10-19-conveyor.md`.
Decisions older than 60 days: none (oldest note 2026-10-19).
Regression vs current behaviour: compaction changes instance index vs `slot` for all 12 types (see Medium above); everything else the old path does (squash, pop, swallow, held wiggle, stashed hide) is kept on the body matrix.

## Review: performance (plan-performance)

Verdict: CONCERNS

| plan step | operation | shape / cost driver | multiplicity | volume (where measured) | cost | severity |
|---|---|---|---|---|---|---|
| 2 | classic `BatchedMesh` draw, browser without `WEBGL_multi_draw` | `WebGLRenderer.js:1316-1327`: one `drawArrays` + one `_gl_DrawID` uniform write per visible instance | per pass (main + shadow), every frame | 300 walkers x 7 parts (cap 320, `gnomes.ts:127`) | 2 100 calls per pass, 4 200 per frame vs 2 today; the whole scene is 60 calls | Medium |
| 2 | classic `BatchedMesh` draw, with `WEBGL_multi_draw` | one `multiDrawArraysWEBGL` per pass | per pass | same | 1 call per pass (+1 main, +1 shadow) | none |
| 2 | `onBeforeRender` / `onBeforeShadow` instance walk | `perObjectFrustumCulled = false`, `sortObjects = false` → loop runs only when `_visibilityChanged` (`BatchedMesh.js:1527`); the shadow pass rebuilds the list, the main pass reuses it | once per frame in which a classic gnome spawns, stashes or is removed; 0 otherwise | 3 500 instance infos | about 3 500 boolean checks on such frames | none |
| 2 | `writeParts`: Euler → quat, `compose`, `multiplyMatrices`, `setMatrixAt`, `setVisibleAt` (early return) | CPU, no allocation (tmp objects) | 7 per gnome per frame | 300 → 2 100 | estimated 0.3-0.6 ms; row 14 measures it against 1.5 ms | none |
| 2 | matrices texture upload | `_matricesTexture.needsUpdate = true` on any `setMatrixAt`, full texture, no `updateRanges` | 1 per frame while any classic gnome exists | `maxInstanceCount` 3 500 → 120 x 120 RGBA float (`BatchedMesh.js:343-347`) | 230 KB per frame (13.8 MB/s at 60 fps) vs 32 KB `instanceMatrix` today | Low |
| 2 | `updateLag` (spring + 2 damps) | scalar math | 1 per classic gnome per `update(dt)` | 300 | negligible | none |
| 2 | idle `noise.noise` | `SimplexNoise` 2D | 2 per standing classic gnome per frame | at most 300 | negligible | none |
| 2 | vertex shader on the batch | 1 indirect + 4 matrix `texelFetch` per vertex instead of instanced attributes; same vertex count | per vertex, 2 passes | 300 x 4 548 vertices = 1.36 M per pass | not measured (headless SwiftShader rasterises on CPU, numbers do not transfer) | none |
| 3 | `replay.record()` | copies `instanceMatrix.subarray(0, count*16)` | 1 per frame | classic `count` drops to the number of old-path gnomes (0 in play) | cheaper than today | none |
| 5 | `spinRate` damp + conveyor roller loop | same loop over `root.children` as `machines.ts:735` today | 1 per machine per frame | machines placed by the player | unchanged | none |
| rollout | 12 batches, one matrices texture each | full upload per type that has at least 1 gnome | per frame | capacities sum 1 732 x 7 = 12 124 instances | up to about 0.75 MB per frame (45 MB/s) when classic, blue, golden and greedy are all on the field | Low |

Findings:
- [Medium] Draw-call fallback: when the player opens the game in a browser without `WEBGL_multi_draw`, three draws every visible part with its own `drawArrays` and uniform write (`WebGLRenderer.js:1316-1327`) → at 300 classic walkers 2 100 calls per pass, 4 200 per frame with shadows, against 60 calls for the whole scene today. Row 13 and Assumption 4 check only headless Chromium (SwiftShader, Metal ANGLE), not the browsers on the LAN port 5300. Fix: in the `Gnomes` constructor, build the batch only when `ctx.renderer.extensions.has('WEBGL_multi_draw')` (otherwise `PARTS_TYPES` acts as empty and every classic gnome stays on the one-piece `InstancedMesh`), plus one `Done when` line: `multiDraw` false in the scenario → `parts.size = 0`, `calls` unchanged. Measured: code read (three 0.186.1 source); which of PP's browsers lack the extension: not measured.
- [Low] Data section numbers: the matrices texture is 120 x 120 (230 KB), not 128 x 128 (256 KB), and the batch instance walk does not run "per pass every frame": with the two flags the plan sets it runs once per visibility change. The full texture goes to the GPU every frame (13.8 MB/s for classic, about 45 MB/s after the rollout). Acceptable on the stated volume; fix: correct the two sentences in Data and keep `perObjectFrustumCulled = false` and `sortObjects = false` (setting either to true makes the walk run every frame on both passes, with a bounding-sphere transform per visible instance: 4 200 per frame at 300 gnomes). Measured: yes (`BatchedMesh.js:343-347, 1523-1690`).

No findings on: per-frame matrix writes (2 100, bounded by row 14), lag spring and idle noise, compaction of the old `InstancedMesh` (`count` = old-path gnomes), replay record and playback toggle, triangle count (same geometry split, row 14 checks 2 %), extra shader program for the batching define (compiled once), machine, gear, mushroom and UFO rate damps, the six chaser rewrites (same work per frame).

## Plan (plan-senior, final)

Status: needs-decision (one product question, Q1; every step is implementable with its recommendation a), which is today's behaviour, so the implementer may start without waiting)

### Resolutions
- R1: roaster [Major] + performance [Medium] no `WEBGL_multi_draw` (same problem, deduplicated): Decision: accepted, step 2 builds the batch only when `ctx.renderer.extensions.has('WEBGL_multi_draw')` and the URL has no `?noparts`; otherwise every classic gnome stays one-piece, `console.info` at boot and one HUD toast on the first `update`. Rationale: headless runs cannot stand in for PP's laptop browser, and a 4 200-call frame would make PP judge the look at 10 fps; `?noparts` lets the scenario force the fallback. Checked: `src/main.ts:65` (`Object.assign(ctx, {renderer...})` runs before `:87 new Gnomes()`), `src/ui/hud.ts:205` (`toast`), `src/core/settings.ts:45` (URL-flag pattern).
- R2: roaster [Major] feet slide 62 % of the stride: Decision: accepted, step 3 adds `Gnome.ph` advanced by distance for EVERY walker (`g.ph += hs * dt * STRIDE / g.scale`, `STRIDE = π / (2 · 0.17 · sin(LEG_SWING))`), `WALK_FREQ` deleted, body bob and roll read `g.ph`. Rationale: with a sinusoidal pendulum the only slide-free rate is the one above; keeping `life·WALK_FREQ` for the body and a second phase for the limbs would be two formulas for one step and the side-by-side gnome B would bob out of phase with A, so `walk.bodyMatchesOld` is KEPT (both paths use `g.ph`) instead of dropped. Cost of this choice: the other 11 types bob at the stride rate too (row 11 reworded), and the cadence at 1.3 m/s is 5.3 steps/s (short legs, 0.17 m); `LEG_SWING` raised 0.6 → 0.8 rad so a step is 0.24 m, not 0.19. Checked: `gnomes.ts:742` (`ph = g.life * WALK_FREQ`), `:470-471` (`hs` from the real `linvel` in `update`), `models.ts:53-55` (feet at y −0.41, pants −0.38..−0.24).
- R3: roaster [Major] limbs pop 0.6 rad on stop/start: Decision: accepted, `PartLag.swing` damped toward `a` (λ 10) in `updateLag`, limbs use `swing`, not `a`. Rationale: the phase stops advancing when `hs = 0` (R2), so the leg freezes at its angle and `swing` eases it to rest in ≈ 0.2 s. New row 25 and `Done when` 25.
- R4: roaster [Minor] + impact [Medium] stale hat/beard offsets in ragdoll/held (same problem): Decision: `updateLag` runs for every gnome with `lag` at the top of its `update` tick, in every state; in `walk` the targets are the real lean, swing and yaw delta, in every other state they are 0. Rationale: a hard reset in five state writers (`ragdoll`, `stash`, `hold`, `startFalling`, `standUp`) is five sites and a 7° one-frame pop on the grab, which is the pop this task removes; the same function with zero targets decays the offsets in < 0.5 s. `partsIdentity` is therefore measured ≥ 0.5 s after the state change with tolerance 0.01 rad. Checked: `gnomes.ts:403-405` (loop head, before the `stashed`/`held` `continue`s), `:241, :248, :255, :375, :528` (state writers).
- R5: roaster [Minor] lean target from wanted velocity vs render lean from `linvel`: Decision: accepted, `updateLag` reads `g.body.linvel()` for lean and swing. Rationale: a gnome stuck at a wall then stands, not marches. New row 27.
- R6: impact [High] replay note "last 10 s of gnome motion" vs open decision 2 a (hide 60 % of the yard): Decision: neither a nor b: `writeInstances` writes every gnome's body matrix (HIDDEN for stashed) into a per-type `Float32Array` `bodies` at `slot * 16`; `replay.record()` copies from `bodies` and `slots.length` instead of `mesh.instanceMatrix`/`count`; playback writes the `InstancedMesh` as today and hides the batch, so classic gnomes appear in the replay as one-piece (rigid limbs) for the demo. Rationale: the product rule from `2026-10-20-replay.md` (every gnome in the replay) holds, pose recording (+0.5 day) waits for PP's verdict on the look, and the same buffer fixes R7. Cost: 320 × 64 B copy per frame. Checked: `replay.ts:27-37` (record reads `mesh.count` and `instanceMatrix.array`), `:76-81` (show writes the mesh), `2026-10-20-replay.md` "Problem".
- R7: impact [High] + [Medium] five scenarios read the classic/golden buffer by `slot` (compaction breaks them): Decision: accepted, step 9 moves `scenario-anim-b.js:33`, `scenario-interp.js:49`, `scenario-polish-A.js:52`, `scenario-polish-A-wait.js:53`, `scenario-golden.js:56` to `ctx.gnomes.bodies.get(type)` at `slot * 16` (R6 buffer). Rationale: the readers want "the body matrix of this gnome", and `bodies` keeps slot order for all 12 types in every state, so compaction stops being their problem. Checked: grep `\.slot` in the scratchpad smoke directory, 5 matrix readers.
- R8: impact [Low] second `g.yaw` writer `stalk` (`:631`) not in `dYaw`: Decision: accepted for free: R4 computes `dYaw = angleDiff(l.yaw, g.yaw)` from the yaw the lag last saw, so every writer counts. No rollout item left.
- R9: performance [Low] Data numbers: accepted, texture is 120 × 120 (230 KB per frame), the instance walk runs only on visibility changes; `perObjectFrustumCulled = false` and `sortObjects = false` stay (either `true` costs 4 200 sphere transforms per frame).
- R10: roaster [Minor] hat yaw lag invisible, beard may cut into the shirt on a turn: accepted, step 8 shoots `21-turn-peak` at the max |beardY| frame, checked by eye.
- R11: roaster [Minor] breathing 1.3 cm and hat noise 2° invisible at play distance: Decision: `BREATH` 0.015 → 0.03 (2.7 cm ≈ 4 px at 5 m), `HAT_NOISE` 0.04 → 0.08 rad. Rationale: the brief says "visible at play distance"; 1.5 % of 0.9 m is under 2 px at 5 m with the game FOV. Row 4 ranges updated.
- R12: roaster [Minor] blue walks rigid next to animated classic: accepted as a line in the note and in the playtest message ("only classic has moving parts"), no code.
- R13: roaster [Minor] fan pushes at full strength while the blades wind up / coast: product rule, goes to PP as Q1; the plan implements a) (visual only, as rule 7 says).
- Rejected: roaster "investigate which browser PP uses" because R1 makes the answer irrelevant (the fallback runs on any browser).
- Rejected: roaster "measure `needsProgramChange` flips between the shared-material `InstancedMesh` and `BatchedMesh`" because row 14 (`perf300`) measures the whole frame cost of that pair at 300 gnomes; a separate micro-measurement adds nothing the gate does not catch.
- Rejected: v0 open decisions 3 (8th head part) and 4 (two leg cylinders) as PP questions because the research note PP approved says 7 parts and the foot box swinging under the pants skirt; both stay cut, one line each in the ladder.
- Rejected: v0 open decision 1 as a PP question because the brief answers it: live on every classic gnome in the playtest build, the scenario flips one gnome to `lag = null` for the side-by-side shot, `?noparts` forces the one-piece look.

### Chosen variant
Classic gnomes drawn as 7 parts in one `BatchedMesh`; the step phase of EVERY walker advances by distance walked; limb swing, hat and beard offsets are damped values updated every frame in every state; a per-type `bodies` buffer feeds the replay and the slot-indexed scenarios; without `WEBGL_multi_draw` (or with `?noparts`) the game stays one-piece. Pros: no foot slide by construction, no pops on stop/start/grab, replay keeps every gnome, old and new gnome share the same body so the screenshot isolates the parts, PP sees it live. Cons: ≈ 60 more lines than v0 (phase field, swing/yaw in `PartLag`, `bodies`, fallback), the other 11 types change their bob rate, classic gnomes are rigid inside the replay until the rollout. Cost (performance): +1 draw call per pass with the extension, 230 KB matrices texture per frame (13.8 MB/s), 0.3-0.6 ms CPU for 2 100 part matrices at 300 gnomes, 20 KB `bodies` copy per frame. Risk (roast): the 5.3 steps/s cadence may read as frantic; the feet stay mostly under the pants skirt; both are judged on `20-walk-peak.png`. Ladder: as v0 (BatchedMesh rung 2, damp rung 2, SimplexNoise rung 4, parts/lag/phase/`bodies`/fallback rung 6, each tied to a row).
### Rejected variant(s)
- (b) v0 as written (time phase, `a` straight from velocity, batch hidden in replay): ≈ 60 lines less; rejected because the feet skate 0.32 m per step, limbs pop 0.6 rad at every wander stop, and 60 % of the yard vanishes from the replay, which are the three ways the roast's pre-mortem ends ("nadal drewniane, nogi się ślizgają i skaczą").
- (c) record body matrix + 7 pose floats in `replay.ts` now: faithful replay; rejected because it is +0.5 day before PP has judged the look, and `bodies` gives the replay every gnome at 2 lines.
- (d) 7 `InstancedMesh` per type: no extension dependency; rejected because 66 → 84 calls per pass breaks the 66-call ceiling (`2026-10-19-performance.md`), while R1's fallback covers the no-extension browser.

### Behaviour matrix (final)
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| 1 | `classic`, `walk`, moving (`hs > 0`) | `update` + `writeInstances` | `g.ph += hs·dt·STRIDE/scale`; legL pitch `+LEG_SWING·swing·sin(ph)`, legR `−`, armL `−ARM_SWING·swing·sin(ph)`, armR `+`; body bob/roll/lean as today on `g.ph`; body travel per step / `2·0.17·sin(legPeak)` ∈ [0.9, 1.1] | R2, R3 |
| 2 | same gnome turns | `update` | hat yaw reaches 50 % of the turn 2-7 frames after the torso; beard yaw changes sign ≥ 1 | v0 + R4 (one-frame delay) |
| 3 | starts from rest | `update` | hat pitch lags the lean (λ 12), beard pitch overshoots ≥ 1, `swing` ramps 0 → 1 with max leg step per frame ≤ 0.1 rad | v0, R3 |
| 4 | `classic`, `walk`, standing ≥ 1 s | `writeInstances` | leg/arm angle delta < 1e-3; torso scale y `1 + 0.03·sin(π·(time + id·0.37))`; hat pitch/roll `0.08·noise(...)` | R11 |
| 5 | `classic`, `statue` | `writeInstances` | parts rigid (local pose identity within 0.01 rad), no breath | v0 |
| 6 | `classic`, `ragdoll` / `held` / `falling` ≥ 0.5 s after leaving `walk` | `update` + `writeInstances` | lag and swing decayed to < 0.01 rad; body matrix keeps squash, pop, wiggle, swallow | R4 |
| 7 | `classic`, `stashed` | `writeInstances` | its 7 batch instances hidden; `bodies` row = HIDDEN | v0, R6 |
| 8 | `remove()` swaps the last slot in | next `writeInstances` | moved gnome's 7 instances rewritten; vacated ids hidden; `bodies` row moved | v0 |
| 9 | `retype()` classic ↔ other | spawn + remove | `lag` copied when both have it, `ph` always copied (no step restart); pop on the body | v0 + R2 |
| 10 | classic with `lag = null` (scenario flag) | `writeInstances` | drawn by the `InstancedMesh` at a compacted index, batch ids hidden, `mesh.count` = old-path gnomes | v0 |
| 11 | the other 11 types | `writeInstances` | same formula as today with `g.ph` in place of `life·WALK_FREQ`; `bodies` written per slot | R2 |
| 12 | night | render | hat part glows (`glow` attribute 1 on hat only) | v0 |
| 13 | shadows on, extension present | render | `calls` ≤ today + 2 (main + shadow), `?lowfx` ≤ today + 1; `multiDraw = true` | v0 |
| 14 | 300 part-walkers | 60 frames | `writeInstances` mean ≤ 1.5 ms above 300 one-piece; triangles equal within 2 % | v0 |
| 15 | replay (key I) | `record` / `show` / `stop` | records `bodies` + `slots.length`; playback hides every batch and shows classic as one-piece; `stop()` shows the batch and `writeInstances` restores | R6 |
| 16 | `spec silent` 12 types | rollout | `PARTS_TYPES` grows to all 12 | v0 |
| 17 | 6 chaser sites | edit | grep → 0; motion within 1 % at dt 1/60 | v0 |
| 18 | fan / wheel / vacuum / blackhole placed or loaded | `machines.update` | `spinRate` damps 0 → target (λ 4), 95 % in 0.75 s | v0 |
| 19 | such a machine breaks / repairs | `machines.update` | rate ≥ 10 % at 0.5 s, < 1 % at 1.2 s; repair spins up | v0 |
| 20 | `spec silent` conveyor rollers + belt | `machines.update` | same `spinRate`, belt offset scaled by `spinRate / target` | v0 |
| 21 | factory gear | `factory.update` | `gearRate` damps toward `running ? rate·6 : 0` | v0 |
| 22 | mushroom pickup, UFO yaw, UFO crash roll | their `update` | rate damped toward 2 / 2 / 3 rad/s | v0 |
| 23 | `spec silent` hole swirl | none | unchanged | v0 |
| 24 | no `WEBGL_multi_draw` or `?noparts` | boot | `parts.size = 0`, every classic `lag = null`, console line + one toast, `calls` = today | R1 |
| 25 | walker stops mid-step (`target = null`) | `update` | limbs ease to rest: max leg step per frame ≤ 0.1 rad, rest within 0.5 s | R3 |
| 26 | any gnome, any state | `writeInstances` | `bodies.get(type)[slot*16..+16]` = its body matrix (HIDDEN when stashed); 5 scenarios read it | R6, R7 |
| 27 | walker wants to move but is blocked (`linvel ≈ 0`) | `update` | `ph` does not advance, swing and hat lean decay to 0 | R5 |

### Steps (edit order)
1. `src/world/models.ts` — exactly v0 step 1 (`PartName`, `PART_ORDER`, `PART_PIVOT`, `Part.part`, `build(parts, glow)`, `gnomePartList(t)`, `gnomeGeometry(t) = build(gnomePartList(t))` byte-identical, `gnomeParts(t)`). Red test: `scenario-parts.js` "night" → `hatGlowAttr: true`, and `scenario-anim-b.js` unchanged output for the one-piece path.
2. `src/entities/gnomes.ts` (fields, constructor, spawn/remove/retype) — consts as v0 step 2 with `LEG_SWING = 0.8`, `ARM_SWING = 0.4`, `STRIDE = Math.PI / (2 * 0.17 * Math.sin(LEG_SWING))`, `SWING_LAMBDA = 10`, `BREATH = 0.03`, `HAT_NOISE = 0.08`; delete `WALK_FREQ`. `export interface PartLag { yaw: number; swing: number; hatP; hatY; beardP; beardY; beardVP; beardVY }` (all `number`). `Gnome` gets `ph: number` and `lag: PartLag | null`. Constructor: `readonly partsOn = ctx.renderer.extensions.has('WEBGL_multi_draw') && !new URLSearchParams(location.search).has('noparts'); if (!this.partsOn) console.info('[gnomes] one-piece gnomes: WEBGL_multi_draw missing or ?noparts');` `readonly parts = new Map<string, THREE.BatchedMesh>()`, `readonly bodies = new Map<string, Float32Array>()` (`new Float32Array(t.capacity * 16)` per type); batch built as v0 only when `this.partsOn && PARTS_TYPES.has(t.id)`. `spawn`: `ph: 0`, `lag: this.partsOn && PARTS_TYPES.has(type.id) ? { yaw, swing: 0, hatP: 0, hatY: 0, beardP: 0, beardY: 0, beardVP: 0, beardVY: 0 } : null`; delete the `count =` lines at `:177` and `:190`. `retype`: `n.ph = g.ph; if (g.lag && n.lag) Object.assign(n.lag, g.lag, { yaw: n.yaw })`. Red test: "old" → `{count: 1, batchHidden: true}`; `?noparts` run → `parts.size = 0`.
3. `src/entities/gnomes.ts` (`update`) — at the loop head (`:404`, before the `stashed` check): `if (g.lag) this.updateLag(g, dt);` and once per `update` call `if (!this.partsOn && !this.fallbackTold) { this.fallbackTold = true; ctx.hud.toast('Gnome parts off: no WEBGL_multi_draw', 'info'); }`. After `const hs = Math.hypot(v.x, v.z);` (`:471`): `g.ph += (hs * dt * STRIDE) / g.scale;`. `:510` → `g.yaw = THREE.MathUtils.damp(g.yaw, g.yaw + angleDiff(g.yaw, yaw), 8, dt);`. `private updateLag(g: Gnome, dt: number): void`: `const l = g.lag!; const walk = g.state === 'walk'; const v = g.body.linvel(); const a = walk ? Math.min(1, Math.hypot(v.x, v.z) / g.type.speed) : 0; const lean = LEAN * a; const dYaw = angleDiff(l.yaw, g.yaw); l.yaw = g.yaw; l.swing = damp(l.swing, a, SWING_LAMBDA, dt); l.hatY = damp(l.hatY - dYaw, 0, LAG_LAMBDA, dt); l.hatP = damp(l.hatP, lean, LAG_LAMBDA, dt); l.beardY -= dYaw; l.beardVY += (-l.beardY * BEARD_K - l.beardVY * BEARD_C) * dt; l.beardY += l.beardVY * dt; l.beardVP += ((lean - l.beardP) * BEARD_K - l.beardVP * BEARD_C) * dt; l.beardP += l.beardVP * dt;`. Red tests: "walk" → `strideRatio ∈ [0.9, 1.1]`, "stop" → `maxLegStepPerFrame ≤ 0.1`, "stuck" → `phDelta = 0`.
4. `src/entities/gnomes.ts` (`writeInstances`, `writeParts`) — walk branch uses `const ph = g.ph` (no `life`); every gnome (including `stashed` → `HIDDEN`) does `tmpM.toArray(bodies, i * 16)` after composing; then as v0 step 2: part gnomes → `writeParts(bm, g, i, tmpM)`, old path → hide ids, `mesh.setMatrixAt(n++, tmpM)`; after the loop `mesh.count = n`, hide the trailing ids, `partsDrawn.set(id, slots.length)`. `writeParts(bm, g, slot, bodyM)`: `const l = g.lag!; const idle = g.state === 'walk' && l.swing <= 0.01; const s = Math.sin(g.ph) * l.swing;` torso scale y `idle ? 1 + BREATH * Math.sin(Math.PI * (ctx.time + g.id * 0.37)) : 1`; hat `(l.hatP - LEAN * l.swing + (idle ? HAT_NOISE * noise.noise(g.id * 3.1, ctx.time * 0.6) : 0), l.hatY, idle ? HAT_NOISE * noise.noise(g.id * 3.1 + 7, ctx.time * 0.6) : 0)`; beard `(l.beardP - LEAN * l.swing, l.beardY, 0)`; armL `(-ARM_SWING * s, 0, 0)`, armR `(+ARM_SWING * s, 0, 0)`; legL `(+LEG_SWING * s, 0, 0)`, legR `(−LEG_SWING * s, 0, 0)`; compose with `PART_PIVOT`, multiply by `bodyM`, `setMatrixAt`, `setVisibleAt(true)`. Red tests: "walk" → `legZeroCross ≥ 4, legPeak ∈ [0.5, 0.8], armSign = −1, bodyMatchesOld: true`; "stand" → `legDelta < 1e-3, breathSpan ∈ (0.045, 0.061), hatNoiseSpan > 0`; "ragdoll"/"held"/"statue" → `partsIdentity: true` at ≥ 0.5 s.
5. `src/systems/replay.ts` — `record()`: `const n = Math.min(ctx.gnomes.slots.get(id)!.length, MAX - used); this.buf.set(ctx.gnomes.bodies.get(id)!.subarray(0, n * 16), …)`; when `this.playing = true`: `for (const bm of ctx.gnomes.parts.values()) bm.visible = false;`; in `stop()` before `writeInstances()`: `bm.visible = true`. Comment: "part-drawn gnomes replay as one piece; the rollout records the pose". Red test: "replay" → `{partsHidden: true, classicShownOnePiece: true, partsVisible: true}`.
6. Chasers (rule 1) — exactly v0 step 4 (`environment.ts:439, 449`, `events.ts:318`, `coins.ts:199`, `src/player/sweeper.ts:166`; `gnomes.ts:510` in step 3). Red test: `grep -rn "Math.min(1, dt" src` → empty.
7. Spins (rule 7) — exactly v0 step 5 (`machines.ts` `spinRate`/`SPIN_RATE`/`SPIN_AXIS`/λ 4 before the broken gate, conveyor rollers + belt; `factory.ts` `gearRate`; `mushrooms.ts` `spin`; `events.ts` `spin`/`roll`). Effects (`machines.ts:712-760, 832+`) untouched (Q1 a). Red tests: "fan" → `spinUp95 ≤ 0.75, rateAt0_5sAfterBreak ≥ 2.5, rateAt1_2s < 0.25, repairSpinsUp`; "conveyor", "gear", "shroom", "ufo" keys as v0.
8. `<scratchpad>/smoke/scenario-parts.js` — v0 step 6 plus steps `stop` (walker at full speed, set `target = null`, sample legL angle per frame for 40 frames), `stuck` (walker with `target` 1 m behind a fence post, `linvel` ≈ 0: `ph` constant, hat pitch → 0), `fallback` (second run with `URL_QUERY='?noparts'`: `parts.size`, `calls`), `replay` (spawn 3 classic + 1 stashed, record 120 frames, press I: batch `visible = false`, `meshes.get('classic').count = 3`, stop → `visible = true`); shots `20-walk-peak` (A one-piece next to B parts, max |legL|) and `21-turn-peak` (max |beardY|). `strideRatio` = body travel between consecutive leg zero crossings / `(2 · 0.17 · sin(legPeak))`.
9. Regression — `scenario-anim-b.js:33`, `scenario-interp.js:49`, `scenario-polish-A.js:52`, `scenario-polish-A-wait.js:53`: read `g.gnomes.bodies.get('classic')` at `gn.slot * 16`; `scenario-golden.js:56`: `M.fromArray(g.gnomes.bodies.get(c.type.id), c.slot * 16)`. Run them plus `scenario15.js`, `scenario-perf-tri.js`, `scenario-replay.js`; `npx tsc --noEmit`. Note `docs/ai-work/2026-10-20-gnome-parts.md` (with the R12 line and Q1 a), one `CHANGELOG.md` line. Playtest message draft for PP: "only classic has moving parts; ?noparts shows the old look".

### Review focus
1. PP's laptop browser without `WEBGL_multi_draw`: classic must look exactly like today and the toast must show once → pinned by step 8's "fallback" (`parts.size = 0`, `calls = before`).
2. A walker blocked by a fence or a crowd keeps "wanting" to move: no marching in place, hat level → pinned by step 8's "stuck" (`phDelta = 0`, `hatP → 0`).
3. Beard cutting into the shirt at the peak yaw of a reversal → pinned by step 8's `21-turn-peak.png` (by eye).
4. Golden Hour `retype` mid-step: the new gnome continues the stride instead of restarting at `ph = 0` → pinned by step 8's "retype" (`phCopied: true`, `lagCopied: true`).
5. Replay with a stashed classic gnome in the window: the HIDDEN row must not draw a gnome at the origin → pinned by step 8's "replay" (`classicShownOnePiece: true`, no instance with scale 1 at (0,0,0)).

### Done when
1. `node smoke.mjs run-parts scenario-parts.js` → `walk: {legZeroCross: ≥4, legPeak: 0.5..0.8, armSign: -1, bodyMatchesOld: true, strideRatio: 0.9..1.1}`
2. same → `turn: {hatLagFrames: 2..7, beardSignChanges: ≥1}`
3. same → `start: {hatLagFrames: 2..7, beardOvershoot: ≥1, maxLegStepPerFrame: ≤0.1}`
4. same → `stand: {legDelta: <0.001, breathSpan: 0.045..0.061, hatNoiseSpan: >0}`
5. same → `statue: {partsIdentity: true, breathSpan: 0}`
6. same → `ragdoll: {partsIdentity: true}, held: {partsIdentity: true}, falling: {shrinks: true}` (sampled ≥ 0.5 s after the state change)
7. same → `stash: {hidden: 7, bodiesHidden: true}`
8. same → `remove: {lastHidden: true, movedRewritten: true, bodiesMoved: true}`
9. same → `retype: {lagCopied: true, phCopied: true, popSeen: true}`
10. same → `old: {count: 1, batchHidden: true}` and `20-walk-peak.png` shows both gnomes, the right one mid-step with the foot clear of the pants (checked by eye)
11. same → `others: {sameAsBefore: true}` (a `blue` gnome's matrix equals the pre-edit formula with `g.ph` substituted)
12. same → `night: {hatGlowAttr: true}` and a night screenshot shows the part gnome's hat glowing
13. `URL_QUERY='' DPR=2 node smoke.mjs run-parts-calls scenario-parts.js` → `calls: {shadow: ≤ before+2, lowfx: ≤ before+1, multiDraw: true}`
14. same run → `perf300: {partsMs - oldMs ≤ 1.5, triRatio: 0.98..1.02}`
15. same → `replay: {partsHidden: true, classicShownOnePiece: true, partsVisible: true}`, `LOGS:` empty
16. `grep -c "id: '" src/data/gnomeTypes.ts` → `12`, and the rollout section names 12
17. `grep -rn "Math.min(1, dt" src` → no output
18. scenario → `fan: {spinUp95: ≤0.75}` (also `wheel`, `vacuum`, `blackhole` keys present)
19. scenario → `fan: {rateAt0_5sAfterBreak: ≥2.5, rateAt1_2s: <0.25, repairSpinsUp: true}`
20. scenario → `conveyor: {rollerDecays: true, beltDecays: true}`
21. scenario → `gear: {decaysWhenJammed: true}`
22. scenario → `shroom: {spinUp: true}, ufo: {spinUp: true, rollUp: true}`
23. `grep -n "swirl.rotation.z -= dt" src/world/environment.ts` → 1 line, unchanged
24. `URL_QUERY='?noparts' node smoke.mjs run-parts-noparts scenario-parts.js` → `fallback: {partsSize: 0, classicLagNull: true, calls: before, toast: 1}`; `grep -n "WEBGL_multi_draw" src/entities/gnomes.ts` → 1 line
25. scenario → `stop: {maxLegStepPerFrame: ≤0.1, restWithin: ≤0.5}`
26. scenario → `bodies: {everySlotWritten: true, stashedHidden: true}` and `scenario-anim-b.js`, `scenario-interp.js`, `scenario-polish-A.js`, `scenario-polish-A-wait.js`, `scenario-golden.js` pass reading `bodies`
27. scenario → `stuck: {phDelta: 0, hatPAfter0_5s: <0.01}`
Plus: `npx tsc --noEmit` → exit 0; `scenario15.js`, `scenario-perf-tri.js`, `scenario-replay.js` pass with `LOGS:` empty; `grep -n "WALK_FREQ" src` → no output.

### Decisions for PP
PP (2026-10-20): 1 → "tylko wyglad" = a (spin is visual only, force as today).
1. Kiedy gracz postawi wiatrak (albo wiatrak się zepsuje), łopaty rozkręcają się 0,75 s i zwalniają 1,2 s, a sam podmuch działa od razu pełną siłą i urywa się od razu. a) tylko wygląd: podmuch, taśma i ssanie działają jak dziś, łopaty tylko wyglądają płynnie; b) siła idzie za łopatami: nowy wiatrak przez 0,75 s dmucha słabiej, zepsuty jeszcze przez około sekundę popycha gnomy, taśma rusza wolniej. (rekomendacja: a, bo reguła 7 mówi o wyglądzie, a b) zmienia balans każdej maszyny)
2. [spec silent] Zakładam: po demie części dostaną wszystkie 12 typów gnomów (brief mówi o 11) | Dowód: `src/data/gnomeTypes.ts:29-91` ma 12 wpisów | Jeśli źle: jeden typ zostanie sztywny po wdrożeniu | rekomendacja: a) 12 (bez odpowiedzi = 12)
3. [spec silent] Zakładam: rolki i taśma przenośnika zwalniają tak jak wiatrak (nie ma ich na liście z briefu) | Dowód: `machines.ts:735-737` kręci je stałą prędkością co klatkę | Jeśli źle: zepsuta taśma stanie w jednej klatce, a wiatrak obok będzie zwalniał | rekomendacja: a) włączyć (bez odpowiedzi = włączone)
4. [spec silent] Zakładam: wir w dziurze zostaje bez zmian | Dowód: `environment.ts:433-434`, jego prędkość i tak rośnie i maleje płynnie, nigdy nie startuje od zera | Jeśli źle: kopnięcie wiru po pulsie dziury byłoby łagodniejsze | rekomendacja: a) zostawić (bez odpowiedzi = zostaje)

### v0 → final
- added: step phase by distance for every walker (`g.ph`, `STRIDE`, `LEG_SWING` 0.8), damped `swing` and lag updated in every state (R3, R4, R5), `bodies` buffer for replay and the five slot-indexed scenarios (R6, R7), `WEBGL_multi_draw` / `?noparts` fallback with toast (R1), bigger breath and hat noise (R11), screenshot at peak beard yaw (R10); matrix 23 → 27 rows, `Done when` 23 → 27 lines.
- dropped: `WALK_FREQ`, hide-batch-only replay (open decision 2), the "standUp lag reset" cut, open decisions 1, 3, 4 as PP questions (answered by the brief and the approved research note).
- moved to PP: fan/belt effect following the blades (Q1, recommendation a); three `[spec silent]` assumptions kept from v0.
