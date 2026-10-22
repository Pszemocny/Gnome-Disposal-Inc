# Plan: real-time 3D outro (The Deep) with the fed armchairs and flamingos

Spec: PP 2026-10-22 (verbatim): "grafika na koniec gry postaraj sie przygotowac cos takiego z dostepnych modeli aby bylo to bardziej 3d. Mozesz tez zapisac ile flamingow i foteli ktos wrzucil i tez je pokazac gdies na stosie w kolejnych klatkach napisow byloby super ale w takiej formie" + a reference render (bottom of the shaft looking up, walls packed with low-poly gnomes, only eyes glowing: mostly icy blue, some gold and purple; a few gnomes floating in the middle; big gnomes near the camera at the edges; black void in the centre). Palette and text timing: `docs/art/outro-image-brief.md` sections 2-3.
Trivial check: new render path in the frame loop (`src/main.ts`), a new save field with one writer and two readers, a DOM flow (`hud.deep`) with 5 callers (game + 4 scenario calls), a new file; not a one-file change.

## Plan v0 (plan-author)

### Goal
After the jump at hole level 12 the player sees a live 3D shaft of glowing-eyed gnomes behind the whispered lines, then the pile of every armchair and flamingo they ever fed, then THE DEEP and "Be reborn"; the counters live in the save.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | level 12, normal save, quality Medium or High | player falls below y -4 (`player.ts:502`) | `hud.deep()` starts the outro: shaft scene renders on the canvas under a transparent `.deep`; 900 wall gnomes (all 12 types), 8 fallers, 6 000 far eye pairs, lines as today | PP "bardziej 3d", reference render |
| 2 | level 12, quality Low (`prefs.quality === 'low'` or `?lowfx`) | same | 300 wall gnomes, 3 000 far eye pairs, heap caps 60 chairs / 120 flamingos; everything else the same | brief: "Low quality variant"; `settings.ts:51` |
| 3 | `stats.chairs === 0 && stats.flamingos === 0` | outro runs | no heap line, no heap meshes, camera never looks down; 10 frames (9 lines + THE DEEP) | spec silent, decision [O2] |
| 4 | one counter > 0, the other 0 | outro runs | heap line names only the non-zero kind ("…3 armchairs."); heap holds that kind only | [O2] |
| 5 | a counter above its cap (e.g. 400 flamingos, cap 300) | outro runs | heap shows 300 instances, the line says 400 | assumption 3 |
| 6 | old save without `stats.chairs` / `stats.flamingos` | `loadState()` | both read 0, no `loadNotes` entry (`state.ts:149` spreads `base.stats`) | brief: "save field migration" |
| 7 | rebirth | `hole.rebirth()` → `freshState(old)` | counters kept (lifetime per save: `state.ts:89` keeps `stats`) | PP "ile […] ktos wrzucil", assumption 1 |
| 8 | daily run (`?daily`) reaches the Deep | `hud.deep()` | outro plays with the daily's fresh counters (0 → row 3); Press F line and daily board unchanged | `2026-10-21-intro-pressf.md` decision 5a |
| 9 | armchair sinks under y -2.6 inside the hole (`props.ts:134`) | `hole.consumeProp('chair')` | `stats.chairs++` every time, first or repeated, full pay or 10 % | PP "counted every time" |
| 10 | flamingo sinks | `hole.consumeProp('flamingo')` | `stats.flamingos++` every time | same |
| 11 | letter G/N/O/M/E sinks (`props.ts:131`, `consumeLetter`) | | no counter, not on the heap | spec silent [O3] |
| 12 | a line is on screen for >= 0.8 s | key (not Esc/Shift/Ctrl/Alt/Meta/F, not repeat) or mousedown on `.deep` | next line at once, its 2.6 s timer restarts; on the last frame nothing | brief "skip/close controls", [O1] |
| 13 | a line is on screen for < 0.8 s | key or click | ignored (the landing keypress after the jump must not skip "You fall.") | `intro.ts:11` GUARD pattern |
| 14 | outro on | Esc | nothing: no pause menu, `.deep` stays (`main.ts:179` guard unchanged) | existing |
| 15 | `LINKS.coffee` set, line >= 2 | F | pays respects as today, never advances a line | `hud.ts:366-372` |
| 16 | outro on | window resize | outro camera aspect follows `window.innerWidth / innerHeight` on the next frame | brief "must not stall" (no stretched frame) |
| 17 | outro on | heap line shown (after "It was lonely.") | camera pitch damps from looking up to the heap (~1.5 s), back up on the next line | PP "pokazac gdzies na stosie w kolejnych klatkach napisow" |
| 18 | outro on | "Be reborn" click | leaderboard (`z-index 60`) opens over the still-running outro; submit/skip → `rebirth()` → reload (unchanged) | `player.ts:508` |
| 19 | scenarios `scenario-esc.js:305`, `scenario-intro-pressf.js:149,157,285` | `g.hud.deep(n, cb)` | the outro starts too; their DOM asserts (`.deep-line`, `.deep-f`, button) still pass | reach |
| 20 | outro on | every frame | frame loop renders `outro.scene` with `outro.camera` instead of `ctx.scene`; `redraw` logic untouched | `main.ts:301-304` |
| 21 | outro on | every frame | wall drum turns with an angular speed damped to 0.04 rad/s; camera roll = simplex noise x 0.02 rad | animation rules 7, 8 |
| 22 | a faller passes y -1 | | wraps to y 30 at a new angle/radius (fog factor 0.96 there: invisible, no pop needed) | rule 3 |
| 23 | outro on | every 3-9 s per eye pair | both eyes alpha 0 for 0.12 s | brief section 5 "blink" |
| 24 | outro on, Medium | after the first frame | `renderer.info.render.calls <= 20`, `triangles <= 1 700 000`; Low `<= 700 000` | brief "performance" |
| 25 | outro start | t = 0..4 s | `.deep-fade` black overlay goes to 0 opacity over 4 s; "You fall." lands on black, eyes show by line 3 (t 5.2 s) | brief section 5 |

### Reach
- `src/ui/hud.ts:348` `deep(shards, done)`: callers `src/player/player.ts:508` (normal and daily), `tools/smoke/scenario-esc.js:305`, `tools/smoke/scenario-intro-pressf.js:149,157,285`. Signature stays `deep(shards: number, done: () => void)`.
- `src/systems/hole.ts:256` `consumeProp(kind)`: only caller `src/entities/props.ts:135`. Only writer of the new counters.
- `GameState.stats` writers: `freshState` (`state.ts:89`, keeps the object through rebirth), `loadState` spread (`state.ts:149`); readers of other stats fields: `menu.ts:131`, `progress.ts:120-127` (does not read the new ones, [O5]), `legend.ts`, `shot.ts:74`.
- Frame loop `src/main.ts:292-304`: paused branch renders one frame; the outro adds a branch before it. `shot.ts:52` (P key) renders `ctx.scene` while paused: untouched, the P shot during the outro shows the yard (dev only, accepted).
- `main.ts:134,151,179` `document.querySelector('.deep')` guards: `.deep` keeps its class and stays in the DOM, so lock-change, blur and Esc behave as today.
- `src/core/context.ts` `Ctx`: new field `outro: Outro`.
- Gnome geometry: reuse `ctx.gnomes.meshes.get(id)!.geometry` (`gnomes.ts:179`, built once at boot; has a `glow` attribute that `vcMat()` ignores). Chair/flamingo: `M.armchairGeometry()`, `M.flamingoGeometry()` (`models.ts:294,304`). Glow sprite texture: `glowTexture()` (`mushrooms.ts:22`).
- Leaderboard `.leaderboard { z-index: 60 }` (`leaderboard.ts:195`) stays above `.deep` (50).
- No front/back contract: single-page game, save in localStorage.

### Data
- Save (`localStorage` key `gnome-boozed-save-v1`): `stats.chairs: number`, `stats.flamingos: number` added to the `stats` object. Old saves: `{ ...base.stats, ...parsed.stats }` gives 0, no migration block. Daily: `freshState()`, never saved.
- Triangles (measured with a throwaway `tsx` script on `gnomeGeometry(t)`, deleted): classic/blue/golden/greedy/angry/dwarf/shadow/fat 1 516, saboteur 1 668, king 1 752, wizard 1 980, boom 2 060; armchair 60; flamingo 928.
- Per-frame cost, Medium/High: 900 wall gnomes ≈ 1.40 M tris in 12 draw calls (one `InstancedMesh` per type, counts by weight: classic 36 %, blue 24 %, the other 10 types share 40 %, king exactly 2), 8 fallers ≈ 12 k in 1 call, heap ≤ 150 x 60 + 300 x 928 ≈ 287 k in 2 calls, shaft tube 96 tris 1 call, eyes 1 `Points` of 2 x (900 + 8) + 2 x 6 000 = 13 816 points. Total ≤ 1.70 M tris, 17 draw calls, 2 lights (hemisphere + point). Low: 300 gnomes ≈ 465 k + heap ≤ 115 k + eyes 2 x 308 + 6 000 points → ≤ 0.70 M tris. Reference: the game's busy yard (300 gnomes, 12 robots, Dark Forest) is ~0.8 M tris at 136 calls and holds 60 fps on the Mac (`2026-10-24-tree-and-endgame.md` F3, `2026-10-21-performance.md`); the start view is 375 k / 60 calls. The outro replaces the yard render, so its budget is the whole frame. PP's machine is the unknown (the hitch report of 10-21 never reproduced on the Mac): the Low numbers are the safety net.
- CPU per frame: blink timers over 6 908 pairs (one subtraction each), 8 faller matrices, 16 eye positions; `instanceMatrix.needsUpdate` only on the 8-slot faller mesh (512 B upload); eye `color` attribute (alpha) uploaded each frame: 13 816 x 4 floats = 221 kB. Build at start: 13 `InstancedMesh` matrices + 13 816 points ≈ a few ms; `renderer.compileAsync(outro.scene, outro.camera)` right after the build, the 4 s black fade hides the link.
- Fog `THREE.FogExp2(0x000000, 0.06)`: wall bodies fade by 12 m (factor 0.40) and are gone by 30 m (0.96); the eye `PointsMaterial` has `fog: false` so the far eyes stay. Point sprite size 0.07 m world (≈ 38 px at 1080p from 1 m, ≈ 5 px from 8 m): within `ALIASED_POINT_SIZE_RANGE` of every GPU (>= 64 px).

### Steps (edit order)
1. `src/core/state.ts` — `stats` interface: `chairs: number; // armchairs the hole ate, every time (outro heap)` and `flamingos: number;`; `freshState` stats literal: `chairs: 0, flamingos: 0`. No `loadState` change. Test: scenario step 6.
2. `src/systems/hole.ts:256` `consumeProp` — first line of the body: `kind === 'chair' ? ctx.state.stats.chairs++ : ctx.state.stats.flamingos++;`. Test: steps 9-10.
3. `src/ui/intro.ts:15` — `export const IGNORED` (unchanged set), reused by the outro skip.
4. `src/ui/outro.ts` (new) — `export class Outro { scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(75, 1, 0.05, 80); active = false; t = 0; readonly counts = { bodies: 0, fallers: 0, farEyes: 0, chairs: 0, flamingos: 0 }; start(chairs: number, flamingos: number): void; lookAtHeap(on: boolean): void; update(dt: number): void }`. Constants: `R = 6` (hole level 12 radius, `holeLevels.ts:22`), `H = 40`, `WALL = lowfx || prefs.quality === 'low' ? 300 : 900`, `FAR_EYES = low ? 3000 : 6000`, `FALLERS = 8`, `CAP = low ? { chairs: 60, flamingos: 120 } : { chairs: 150, flamingos: 300 }`, `EYE = [0.045, 0.13, 0.15]` (gnome local, 2.5 cm in front of the face sphere so depth test keeps it), colours icy `0x9fe6ff` 88 %, gold `0xffd23f` 8 %, purple `0xc08aff` 4 % (both eyes of a gnome the same), `FOG = 0.06`, `SPIN = 0.04` rad/s, `ROLL = 0.02` rad, `BLINK = 0.12` s, next blink `rand(3, 9)` s, heap centre `(0, 0, -4)`, camera `(0, 0.6, 0)`, up pitch `+PI/2`, heap pitch `-0.35` rad, pitch lambda 2.5 (`THREE.MathUtils.damp`).
   `start()`: guard `if (this.active) return`; shaft `Mesh(CylinderGeometry(R, R, H, 48, 1, true).translate(0, H/2, 0), MeshStandardMaterial({ map: tex('dirt_diff', 4, 8), color: 0x3a2e28, roughness: 1, side: BackSide }))`; floor `CircleGeometry(R, 48)` same material rotated flat at y 0; `HemisphereLight(0x223a4a, 0x05070a, 0.8)`, `PointLight(0x9fe6ff, 5, 14, 1.2)` at the camera; a `Group` `drum` holds the wall meshes and the far eyes. Wall placement: a deterministic LCG (`seed = (seed * 1664525 + 1013904223) >>> 0`) so screenshots repeat; rows every 0.95 m from y 0.8, ~70 per row (angle step 2π/70 with ±0.15 rad jitter), radius `R - 0.45`, y jitter ±0.2, per-gnome scale `type.scale x rand(0.9, 1.15)`, matrix = `lookAt(pos, camera.position, UP)` x scale (every face looks at the viewer, as in the reference); type per slot by the weights above; king 2 at y ≈ 3 on opposite sides. Far eyes: `FAR_EYES` random pairs on the wall (`rand(R - 0.3, R - 0.1)`, y `rand(12, H - 2)`, pair spacing 0.09 m). Fallers: one `InstancedMesh(classic geometry, vcMat(), FALLERS)` on the scene (not the drum), each `{ angle, radius: rand(1, 3), y: rand(2, H - 5), vy: -rand(0.6, 1.2), spin: Vector3(rand) }`. Heap: `InstancedMesh(armchairGeometry(), vcMat(), min(chairs, CAP.chairs))`, same for flamingos; layer `l = floor(i / perLayer)` with `perLayer = 8`, radius `1.2 + 0.25 * l`? no: radius shrinks with the layer (`1.6 - 0.25 * l`, min 0.4), chairs y `0.45 + 0.5 * l`, flamingos on top of the chair layers (`y = chairTop + 0.55 * l`), random yaw, tilt ±0.3; count 0 → no mesh. Eyes `Points`: `position` (3), `color` (4, RGBA), `PointsMaterial({ size: 0.07, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false })`; body eye positions computed from the instance matrices at build; `counts` filled; `fog` set; `void ctx.renderer.compileAsync(scene, camera)`; `active = true`.
   `update(dt)`: `t += dt`; aspect sync when `window.innerWidth / innerHeight` differs; `spin = damp(spin, SPIN, 1, dt); drum.rotation.y += spin * dt`; `camera.rotation.z = noise.noise(t * 0.08, 0) * ROLL` (one `SimplexNoise`); pitch `damp(pitch, target, 2.5, dt)` applied as `camera.rotation.x`; fallers: `y += vy * dt`, rotation by `spin * dt`, wrap at y < -1 to y 30 with a new angle/radius; write 8 matrices + 16 eye positions; blink: per pair `timer -= dt`, alpha `timer < BLINK ? 0 : 1`, when `timer <= 0` reset to `rand(3, 9)`; `color.needsUpdate = true`.
5. `src/core/context.ts` — `outro: Outro` in `Ctx` (type import).
6. `src/main.ts` — after `ctx.leaderboard = new Leaderboard()`: `ctx.outro = new Outro()`; frame loop, before the `if (!ctx.paused || redraw)` render: `if (ctx.outro.active) { ctx.outro.update(realDt); renderer.render(ctx.outro.scene, ctx.outro.camera); } else if (!ctx.paused || redraw) { …existing… }`.
7. `src/ui/hud.ts:348` `deep()` — after `ctx.paused = true`: `ctx.outro.start(ctx.state.stats.chairs, ctx.state.stats.flamingos)`; `h('div', 'deep-fade', el)` as the first child; lines array gets, after 'It was lonely.', the heap line when `chairs + flamingos > 0`: `It kept everything you gave it: ${part(chairs, 'armchair')}${both ? ' and ' : ''}${part(flamingos, 'flamingo')}.` with `part(n, w) = n ? \`${n} ${w}${n === 1 ? '' : 's'}\` : ''`; `next()` records `shownAt = performance.now()` and `timer = setTimeout(next, 2600)`, and calls `ctx.outro.lookAtHeap(lines[i] === heapLine)` before the whisper; skip: `onSkip = (e) => { if (performance.now() - shownAt < 800 || i >= lines.length) return; clearTimeout(timer); next(); }`, `onKeySkip = (e) => { if (!IGNORED.has(e.key) && e.code !== 'KeyF' && !e.repeat) onSkip(); }`; `window.addEventListener('keydown', onKeySkip)`, `el.addEventListener('mousedown', onSkip)`; both removed in the "Be reborn" click together with `onF`. F keeps its own listener and never advances (row 15).
8. `src/ui/style.css:282` — `.deep` `background: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,.6), rgba(0,0,0,0) 50%)` (centre readable, canvas visible), `animation` removed (the fade moves to the overlay); new `.deep-fade { position: absolute; inset: 0; background: #000; animation: fadeout 4s forwards; pointer-events: none; }` and `@keyframes fadeout { to { opacity: 0 } }` (reuse `fadein` if a reverse already exists). `.deep-line`/`.deep-f` unchanged; `.deep-lines` and `.deep-f` need `z-index: 1` over the fade.
9. `tools/smoke/scenario-outro.js` (new) — see Tests.
10. `CHANGELOG.md` top section (one bullet: "The ending is a real 3D scene now: the gnomes you fed line the shaft and watch you, and the hole shows the pile of armchairs and flamingos you gave it. Any key or click moves the story on."), `docs/SPEC.md` "Odrodzenie (The Deep)" paragraph (what the player sees, the counters, skip, why: PP wanted it 3D from existing models; Low variant), `BOARD.md` status line, `docs/ai-work/2026-10-22-outro-3d.md` (Problem / Summary / Work progress with the Done-when results and the screenshots checked by eye).

### Tests
One scenario, `tools/smoke/scenario-outro.js`, run twice: `URL_QUERY='' FAKELOCK=1 DPR=1 DEV_PORT=<private> CDP_PORT=<free> MAXPOLL=1600 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-outro.js` (Medium) and the Low rows through an iframe `/?lowfx` inside the same run (pattern: `scenario-intro-pressf.js` `iframe()`); the daily rows through an iframe `/?daily`. The scenario crafts a save (`craft()` pattern) with `holeLevel: 12, seenIntro: true, stats: { chairs: 3, flamingos: 12 }`, clicks Play (FAKELOCK), then teleports the player (`g.player.body.setTranslation({ x: hole.x, y: -5, z: hole.z }, true)`) and waits 3 frames for `fellIn`. Line advancing uses synthetic `keydown` (`skd` helper) with `code: 'KeyX', key: 'x'`. Screenshots: `outro-eyes` (t ≈ 6 s, no skip yet), `outro-heap` (2 s after the heap line), `outro-final` (THE DEEP + button), `outro-low` (iframe, t ≈ 6 s); compared by eye with the reference: dark shaft, mostly icy-blue eyes with a few gold/purple, bodies only near the bottom, black centre, text readable.
Existing scenarios re-run: `scenario-intro-pressf.js` (FAKELOCK; 25 PASS as in `2026-10-24-fake-pointer-lock.md`). `scenario-esc.js` needs FULL=1 (not run, PP 2026-10-24); its `.deep` asserts are DOM-only and the outro does not touch them.

### Done when
1. scenario `PASS 1 active=true paused=true deep=1 bodies=900 fallers=8 farEyes=6000 lines=11` after the teleport (Medium page) → `g.outro.active && g.paused && document.querySelectorAll('.deep').length === 1 && counts`.
2. iframe `/?lowfx` + `G.hud.deep(5, () => {})` → `PASS 2 bodies=300 farEyes=3000 capChairs=60 capFlamingos=120 triangles<=700000`.
3. iframe `/?daily` (counts 0) → `PASS 3 lines=10 heapMeshes=0 pitchAfter2s>1.4` (skip through all lines: 10 changes of `.deep-line` text before the button).
4. main page `craft({ stats: { chairs: 3, flamingos: 0 } })` iframe → `PASS 4 heapLine="It kept everything you gave it: 3 armchairs." flamingoMesh=null`.
5. iframe `craft({ stats: { chairs: 1, flamingos: 400 } })` → `PASS 5 flamingoInstances=300 lineHas400=true`.
6. `loadState()` on a save JSON whose `stats` lacks both keys → `PASS 6 chairs=0 flamingos=0 notes=0`.
7. `freshState(old)` with `old.stats.chairs = 7` → `PASS 7 kept=7`.
8. `/?daily` iframe row 3 also reports `PASS 8 deepF=<as LINKS.coffee: absent when empty> board=daily-<date>` after the Be reborn click (`.leaderboard` title `SUBMIT YOUR RUN`, board tab `daily-…`).
9. fresh page: chair teleported into the hole (`x: hole.x, y: -3, z: hole.z`), 5 frames, `p.respawn = 0.01`, 2 frames, teleport again, 5 frames → `PASS 9 chairs=2`.
10. same with a flamingo once → `PASS 10 flamingos=1`.
11. letter prop teleported into the hole → `PASS 11 chairs=2 flamingos=1 secretsHasLetter=true` (counters unchanged).
12. outro: wait 1 s, synthetic `x` keydown → `.deep-line` text changes within 2 frames → `PASS 12 before="You fall." after="Past the dirt…"`.
13. right after a line change (< 0.8 s), synthetic `x` keydown → text unchanged after 2 frames → `PASS 13`.
14. synthetic `Escape` keydown → `PASS 14 deep=1 paused=true menuHidden=true`.
15. `LINKS.coffee = 'https://example.invalid'` set before `deep()`, on line 2 synthetic `F` → `PASS 15 lineUnchanged=true respects="Respects paid. Thank you ♥"` (`window.open` stubbed).
16. `cdp Emulation.setDeviceMetricsOverride 800x360` → 2 frames → `PASS 16 aspect=2.222`.
17. skip to the heap line, 2 s → `g.outro.camera.rotation.x < 0`; skip once more, 2 s → `> 1.3` → `PASS 17 down=<v> up=<v>`.
18. click "Be reborn" (done stub) → `PASS 18 lbOpen=true outroActive=true store=LocalStore`.
19. `FAKELOCK=1 … scenario-intro-pressf.js` → `25 PASS`, `LOGS:` empty (lines 1-25 as in `2026-10-24-fake-pointer-lock.md`).
20. 10 consecutive frames during the outro: `renderer.info.render.frame` increases by 1 per frame and `g.renderer.info.render.calls <= 20` each frame; the yard's `g.gnomes.meshes.get('classic').count` not rendered (calls stay under 20 only if `ctx.scene` is skipped) → `PASS 20 calls=[…]`.
21. sample `g.outro.drumAngle` (getter over `drum.rotation.y`) and `camera.rotation.z` over 10 frames → angle strictly increasing, roll not constant → `PASS 21`.
22. sample faller 0 `y` over 10 frames → strictly decreasing; set `fallers[0].y = -1.5` → next frame `y >= 29` → `PASS 22`.
23. sample the eye alpha array over 20 frames spaced 10 frames apart → at least one frame with an alpha `0` and at least one with all pairs `1` for pair 0 → `PASS 23 blinks=<n>`.
24. Medium page, frame after start: `PASS 24 calls=<=20 triangles<=1700000` (`g.renderer.info.render`), and `PASS 24b` screenshots `outro-eyes.png`, `outro-heap.png`, `outro-final.png`, `outro-low.png` exist and are checked by eye (noted in the ai-work file).
25. `getComputedStyle(document.querySelector('.deep-fade')).opacity` at t 0.2 s `> 0.9`, at t 4.5 s `< 0.05` → `PASS 25`; plus `npx tsc --noEmit` → exit 0.

### Assumptions (numbered)
1. "Per save" = lifetime across rebirths: `stats` survives `freshState(old)`, like `gnomesEaten`. A per-run counter would need `runChairs`-style fields and a reset in `rebirth()`.
2. The 3D scene replaces the planned AI background image (`docs/art/outro-image-brief.md`); the brief stays as the palette and timing source. [O4]
3. Heap caps 150 / 300 (Low 60 / 120) keep the heap under 0.3 M tris; the text shows the real numbers. A save at the respawn limit (1 chair / 45 s) needs about 2 h of play per 150 chairs.
4. Every wall gnome faces the camera (`lookAt`), so the eyes read as "looking at you"; no per-gnome AI, no physics in the outro.
5. The outro never stops on its own: every exit is `location.reload()` (`hole.rebirth()`); scenarios end with the page. So no `stop()`/dispose (rung 1).
6. Lights in the outro scene are built once at `start()` with its own materials, so the "no runtime lights" rule (recompile of the yard's materials) is not touched; the yard scene is not rendered during the outro.
7. Headless GPU runs at ~60 fps with Metal (`smoke.mjs` header), so timer-based rows (12, 17, 25) use real seconds; `MAXPOLL=1600`.

### Alternatives rejected
- (a) CSS-only parallax eye layers over a generated image (brief section 5): rejected, PP asked for "bardziej 3d" from existing models; needs art that does not exist yet.
- (b) Render the real yard hole from below with the live gnomes: rejected, the yard has at most 320 gnomes, all above ground, and the hole tube is 4.5 m deep (`environment.ts:300`); the shot would show grass and sky.
- (c) Full-poly bodies for every "thousand" (3 000 bodies ≈ 4.7 M tris): rejected on cost; far eyes as points carry the crowd, bodies only where fog lets them show.
- (d) A low-poly gnome variant in `models.ts` (segment parameter): rejected, new code in a shared builder for one screen; the fog + eyes split gives the same picture.
- (e) Per-point eye size via the `aSize` shader hook (as `ParticlePool`): rejected (rung 1), perspective already scales the sprites; one uniform size.
- (f) `THREE.Sprite` per eye: rejected, one draw call per sprite (13 816 calls).
- (g) Rapier bodies for the heap: rejected, a static pile placed by a seeded LCG is deterministic and free.

### Ladder
- `src/ui/outro.ts`: rung 6, nothing on disk sequences a second scene; PP "cos takiego z dostepnych modeli".
- `InstancedMesh`, `Points`, `FogExp2`, `HemisphereLight`, `PointLight`, `CylinderGeometry`, `MathUtils.damp`, `SimplexNoise`: rung 3 (three, rule 11).
- Gnome geometries from `ctx.gnomes.meshes`, `armchairGeometry`, `flamingoGeometry`, `vcMat`, `glowTexture`, `tex('dirt_diff')`: rung 2.
- Seeded LCG: rung 5 (one line); needed so `outro-heap.png` repeats between runs.
- `IGNORED` export from `intro.ts`: rung 2 (same key filter as the intro).
- `stats.chairs`, `stats.flamingos`: rung 6, PP "zapisac ile flamingow i foteli ktos wrzucil".
- `.deep-fade` overlay: rung 5 (one CSS rule), brief section 5 "fades in from black over about 4 s".
- `counts` object and `drumAngle` getter on `Outro`: rung 5, needed by Done-when 1, 2, 21 (`window.gnome` is DEV only; the fields are plain data).
- Not built (rung 1): `stop()`/dispose, a Quality switch inside the outro, sound beyond the existing whisper, mobile touch beyond `mousedown`, a per-run counter.

### Open decisions (for PP)
PP (2026-10-22): recommendations taken, may override ([O1] a, [O2] a, [O3] a, [O4] a, [O5] a).
PP (2026-10-22, Slack 11:31, overrides O1-O3): "bez pomijania. o2: b zawsze ale tylko niech bedzie linia It kept everything you gave lub It kept nothing else.. o3: leżą na stosie" → [O1] c (no skip; Esc and F as before), [O2] b (always one line: "It kept everything you gave." when anything was fed, else "It kept nothing else.", no counts; camera turns only when a pile exists), [O3] b (eaten letters from `secrets` lie on the pile, no new counter). [O4] a and [O5] a stay.
1. [O1] Skip during the ending: a) any key or click moves to the next line, like the intro cards (Esc and F stay special); the player who waits sees it all. b) one press jumps straight to THE DEEP and the button. c) no skip, as today. (recommendation: a, it is the same gesture as the intro, and a mash still lands on the button.)
2. [O2] Heap line: a) shown only when the player fed at least one armchair or flamingo: "It kept everything you gave it: 3 armchairs and 12 flamingos." (camera turns to the pile for that line), nothing extra otherwise; b) always a line, "It kept nothing else." when both are 0. (recommendation: a, an empty pile is not a beat.)
3. [O3] [spec silent] Zakładam: the five golden letters G N O M E the hole ate are not counted and not on the pile | Dowód: `src/entities/props.ts:131` `consumeLetter` is a separate path from `consumeProp`; the letter is once per save | Jeśli źle: PP expected the letters on the pile as the save's trophies | Pewność: Likely | rekomendacja: a) leave them out.
4. [O4] [spec silent] Zakładam: the 3D scene replaces the AI background image plan in `docs/art/outro-image-brief.md` (no image file, no CSS layers) | Dowód: PP "cos takiego z dostepnych modeli aby bylo to bardziej 3d"; `public/outro/` does not exist | Jeśli źle: PP wanted the image as a backdrop behind the 3D shaft | Pewność: Likely | rekomendacja: a) replace; the brief stays as the palette reference.
5. [O5] [spec silent] Zakładam: the online progress log row (`src/systems/progress.ts:113-130`, table `public.progress`) does not get the two counters | Dowód: the row shape is a database contract (`supabase/progress.sql`), PP asked for the counters "to show on the pile", not in the log | Jeśli źle: PP wants to see fed props per player in Supabase and needs a column migration | Pewność: Confident | rekomendacja: a) leave the log unchanged.
6. [decision age] none: every decision this plan leans on (`2026-10-21-intro-pressf.md` 5a, `2026-10-20-quality-setting.md` Low semantics, the brief's 4 s fade) is from 2026-10-20..22, under 60 days.

### Self-check
- Every acceptance item of the brief has a step and a Done-when line: when it plays (rows 1, 8, 19), skip/close (12-15), performance (2, 20, 24), save migration (6, 7), headless check (1-25), screenshots (24b).
- Every step names a file, a signature or a value; no "handle edge cases" lines.
- `stats.chairs` / `stats.flamingos`: writer `hole.consumeProp` only; readers `hud.deep` → `outro.start`, scenario; `freshState`/`loadState` shape listed; `progress.ts` named and excluded ([O5]).
- Lists compared with the code: prop kinds `'chair' | 'flamingo' | 'letter'` (3 vs 2 named → row 11, [O3]); `deep()` callers 5 (game + 4 scenario lines → row 19); quality values low/medium/high (`settings.ts`, Low vs the rest → row 2); gnome types 12 (`GNOME_TYPES`, all on the wall, king capped at 2). `spec silent` rows: 1 (row 11); Done-when lines 25 = matrix rows 25.
- Decisions older than 60 days: none used.
- Plan ≈ 190 lines; the code it describes (outro.ts ≈ 220, scenario ≈ 250, edits ≈ 60) is longer.
