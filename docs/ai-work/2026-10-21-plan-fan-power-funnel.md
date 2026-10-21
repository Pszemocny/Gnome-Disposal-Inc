# Plan: per-fan power control (A) and the Gnome Funnel (B)

Spec: PP 2026-10-25: "przy najwyzszym ustawieniu w cooling fan pchaja zbyt mocno musi byc opcja zmiany mocy, albo dodaj rure do lapania taki lejek ktory zaczyna sie pionowo i jest kolanko ktore wyceluje w dziure ale trzeba bedzie miec mozliwosc postawic to w powietrzu". Board (BOARD.md:101): first per-fan power (a key while aiming at a fan, 25-100 %), then the funnel as a new tool.
Trivial check: A touches the save format (`PlacedMachine`), the fan force path and the HUD prompt; B adds a placeable tool (data row, model, colliders, catch/launch physics, Fuses row, Tab wheel, blueprints). Two parts in one file; A ships alone.

Decision age: every note this plan leans on is dated 2026-10-19..25 (under 60 days). Nothing to re-confirm.

## Plan v0 (plan-author)

### Goal
A: every placed Cooling Fan has its own push power (100 / 75 / 50 / 25 %), set with one key while aiming at it, saved with the fan. B: a Gnome Funnel hangs where the player looks, swallows gnomes that fall or fly into its mouth and spits them out of its elbow towards the hole.

### Part A: fan power

#### Behaviour matrix (A)
| id | state / input | action | expected outcome | source |
|---|---|---|---|---|
| A1 | new fan placed (any way: key, wheel, blueprint, old save) | fan runs | `power` 1; push, trip range, blade speed, wind puffs byte-identical to today | PP "opcja zmiany mocy" (default = today) |
| A2 | aim at a placed fan (any distance E/G/X work at), not placing | press N | `power` 0.75; prompt line `N power 75% · G move · X pick up Cooling Fan`; float text `75%` above the hub; `audio.buy()` | board "klawisz przy celowaniu w wiatrak" |
| A3 | fan at 0.75 / 0.5 / 0.25 | press N | 0.5 / 0.25 / 1 (wraps) | board "25-100%" |
| A4 | fan at 0.25, ragdoll gnome 3 m in front | 10 frames | gnome speed along the axis about a quarter of the same gnome at 1.0 (0.2-0.3x); `spinRate` damps towards `25 * fanPush() * 0.25`, not in one frame | CLAUDE.md rule 7 |
| A5 | fan at 0.25, walking gnome | at 3 m / at 1.5 m | not tripped (`FAN_TRIP * power` = 2.25 m) / tripped | machines.ts:953-957 (trip only where the push still moves the gnome) |
| A6 | save with a 0.25 fan; save from before this change | reload | `placed[i].power` 0.25 → machine 0.25; field missing → 1 | state.ts `PlacedMachine` |
| A7 | fan at 0.5 | G, place again, then place another fan from the same ghost | moved fan 0.5; the next fan 1 (`ghostPower` resets after one placement) | player.ts:619-624 |
| A8 | blueprint SAVE / LOAD with a 0.5 fan | load | 0.5 (goes through `serialize` / `restore`) | blueprints.ts:140,159 |
| A9 | aim at a belt, a crate, nothing, or hold a placement ghost | press N | nothing (no toast, no sound) | ladder rung 1 |
| A10 | Big Blades L4, fan at 0.5 | fan runs | axis push `55 * 2 * 0.5` = today's L0 push; lift `0.35 * 55 * 0.5` | PP "przy najwyzszym ustawieniu" |
| A11 | broken fan (saboteur), repaired with E | runs again | same `power` as before (field lives on the Machine, not reset by `repair`) | machines.ts:694 |
| A12 | `spec silent`: Leaf Blower (hand tool, Turbo Fan) | hold LMB | unchanged, no power control (the player controls it by releasing LMB) | sweeper.ts blower path |

#### Reach (A)
- `Machine.power` (new, machines.ts:18): writers `place()` (machines.ts:478, new 4th param), `restore()` :534 (`p.power ?? 1`), `cyclePower()` (new); readers `effect()` fan case :939-961, `update()` spin target :795, `serialize()` :655, hud prompt :545.
- `PlacedMachine.power?` (state.ts:4): written by `serialize()`; read by `restore()`; carried untouched by blueprints.ts:140 (`...p`) and :154; rebirth clears `placed` (`freshState`), daily uses `freshState`: unaffected.
- `place()` callers: player.ts:1018 (ghost), machines.ts:545 (`restore`), scenarios (`g.machines.place(type, pos, q)`: default 1 keeps them valid).
- `selectTool()` callers: player.ts:623 (G move, passes `m.power`), :871 (digits), wheel.ts:76 (Tab), shop.ts (after buy; check `rg -n "selectTool" src`): all default 1.
- Key N: free (`rg -n "KeyN" src` → none; I = replay, M = mute). Read in `actions()` (player.ts:604-624), not in `updatePlacement`.
- `fx.wind(p, dir, k)` (fx.ts:124): fan passes `k * power`; blower (sweeper.ts:165) and GUSTY WIND (events.ts:114) keep `k = 1`.
- Shop `EFFECT.fanPower` (shop.ts:118): unchanged (global Big Blades).

#### Data (A)
- No DB. localStorage save: +1 optional number per placed fan (`power`), 3 blueprint slots the same. Per frame: the fan loop (20 fans x ≤320 gnomes) gets two multiplies per gnome; no new scan.

#### Steps (A, edit order)
1. `src/core/state.ts` — `PlacedMachine`: `power?: number; // fan push 0.25-1 (PP 2026-10-25); missing in saves from before: 1`.
2. `src/entities/machines.ts` — `Machine.power: number`; `export const FAN_POWERS = [1, 0.75, 0.5, 0.25];` next to `fanPush`; `place(type, pos, rotation, power = 1)` sets `power` in the literal at :499; `serialize()` adds `power: m.power`; `restore()` :545 passes `p.power ?? 1`; new `cyclePower(m: Machine): void { m.power = FAN_POWERS[(FAN_POWERS.indexOf(m.power) + 1) % FAN_POWERS.length]; ctx.fx.floatText(m.pos.clone().addScaledVector(this.up(m), 1.9), \`${Math.round(m.power * 100)}%\`, '#6ac0ff'); ctx.audio.buy(); }`; fan case: `const strength = 55 * m.power * (1 - d / FAN_RANGE) * g.body.mass();` (whole push incl. lift: power ≤ 1 never lifts more than today), `if (d > FAN_TRIP * m.power) return;`, `ctx.fx.wind(..., fwd, k * m.power)` and the puff rate `dt * 8 * m.power`; `update()` :795 `SPIN_RATE.fan * fanPush() * m.power`. Test: A1, A4, A5, A10, A11.
3. `src/player/player.ts` — `private ghostPower = 1;` `selectTool(type, rotation?, power = 1)` sets `this.ghostPower = power`; G block :623 `this.selectTool(m.type, rot, m.power)`; :1018 `ctx.machines.place(type, this.ghostPos.clone(), q, this.ghostPower); this.ghostPower = 1;`; after the G block: `if (inp.hit('KeyN') && this.lookAt.machine?.type === 'fan') ctx.machines.cyclePower(this.lookAt.machine);`. Test: A2, A3, A7, A9.
4. `src/ui/hud.ts` — prompt :545: `else if (lm?.type === 'fan') pr = \`<b>N</b> power ${Math.round(lm.power * 100)}% · <b>G</b> move · <b>X</b> pick up Cooling Fan\`;` before the generic machine line; help panel :191 add `· <b>N</b> fan power`; `HINTS.fan` += ` Press N on a placed fan to set its power (100, 75, 50, 25 %).` Test: A2.
5. `src/ui/legend.ts` KEYS (:20-29): `['N', 'power of the fan you look at: 100 → 75 → 50 → 25 %']`.
6. Texts: `docs/SPEC.md:114` fan line + a decision line (PP 2026-10-25 quote, why: max Big Blades blew gnomes past the hole); `docs/PLAN.md:87`; `CHANGELOG.md` top section one bullet ("Press N on a placed fan to turn its power down to 75, 50 or 25 %."); `BOARD.md` status; `docs/ai-work/2026-10-21-fan-power-funnel.md` (Problem / Summary / Work progress, Done-when PASS lines).
7. `tools/smoke/scenario-fan-power.js` (new; FAKELOCK=1): checks A1-A12 (A12 static: `rg -n "power" src/player/sweeper.ts` → none).

### Part B: Gnome Funnel

Shape: a vertical tube (r 0.45, local y 0.5-2.5) with a cone mouth on top (r 1.3 at y 3.3), an elbow sphere at the bottom and a short outlet pipe (group, `spin`) that turns on Y towards the hole, tilted 20° down. Catch zone: free gnomes inside the mouth cylinder (local r < 1.3, y 2.3-4.0). Launch: the cannon's ballistic formula from the outlet end, 1 gnome per 0.35 s, queue cap 20.

#### Behaviour matrix (B)
| id | state / input | action | expected outcome | source |
|---|---|---|---|---|
| B1 | shop Tools, hole level < 4 / ≥ 4 | render | row `???` / `Gnome Funnel` root with `Funnel Fuses` child ($1000 x1.8, 5, hole 5); Tools tab 12 rows; price per F1 | upgrades.ts TOOLS, FUSE_NAMES |
| B2 | funnel bought | hotbar, Tab wheel | 12th placeable: hotbar slot without a digit, wheel slice after Cleaning Robot, first-use hint with keys | wheel.ts:83 (`TOOL_IDS.slice(10)`) |
| B3 | ghost, looking at the sky, wheel distance 6 | LMB | placed at eye + 6 m (y > 2), green, fixed body; same spot after 60 frames | player.ts:985-987 (floating exists today) |
| B4 | ghost with the tube box over the hole / tube 0.6 m outside the rim, mouth overhanging | LMB | BLOCKED / placed (box = tube only, like the magnet's base) | machines.ts:351 |
| B5 | free gnome (ragdoll, thrown, blown) enters the mouth zone | next frame | `stash`, `queue` +1, burst + `audio.slurp()`; within 0.35 s `release` at the outlet with velocity towards the hole, `audio.whoosh()`, puff; `thrownBy` 'machine', `throwPos` null → eaten, XP x0.25, no trick text, combo +1 | cannon :1030-1051; hole.ts:173 |
| B6 | gnome walking under / beside the tube (y < 2.3 local) | runs | not caught | catch zone |
| B7 | King in the mouth zone | runs | not caught (`type.id === 'king'`, like the crate and the vacuum) | machines.ts:882, :1062 |
| B8 | hole moves (level-up, land) | after the glide | funnel near the old rim glides with the rim at the same y; outlet re-aims (damp 6) | hole.ts:310-345, cannon :1027 |
| B9 | a shot | 12 frames | outlet pipe sits fully back (-0.3) on the shot frame, springs past 0, settles (outElastic, cannon recoil) | CLAUDE.md rule 4, 12 |
| B10 | saboteur under a floating funnel | hit | fuse blown / broken (horizontal 1.8 m test, gnomes.ts:737); broken: no catch, queue waits; E from ≤ 14 m repairs and it resumes | machines.ts:677, F2 |
| B11 | X, G, Z, hole swallow, blueprint LOAD with a queue | remove | queued gnomes released 1.5 m above the funnel (existing `remove`) | machines.ts:510 |
| B12 | save / blueprint with a funnel at y 4 | reload / LOAD | same x,y,z and rotation; a funnel over the new hole with y ≥ 1.5 stays (blueprints.ts:154 rule) | serialize/restore |
| B13 | robots, mushrooms, hole carry | per frame | no funnel-specific code: a floating funnel is above the truck (robots.ts:819) and not in the grid; on the ground it blocks via `machineBox` | robots.ts:554,808 |
| B14 | queue 20 | more gnomes | not caught (cannon cap) | cannon :1031 |
| B15 | `spec silent`: hand-thrown gnome into the mouth | caught | XP x0.25, no tricks (F3) | hole.ts:173 |
| B16 | `spec silent`: E/G/X on any tool 6-14 m away | aim | work (lookAt ray 6 → 14 m, F2); gnomes/props/switch keep their 4.5 m gates | player.ts:534 |
| B17 | rebirth with Keep Tools | new run | `funnel`, `funnelFuses` kept (`KEEP_TOOL_IDS` = Tools tab) | upgrades.ts:129 |
| B18 | Fuses instancing | boot | `FUSE_CAP` +15, `BOX_CAP` +3 from the rows (no edit) | machines.ts:53 |

#### Reach (B)
- `TOOL_IDS` grows to 12 (readers: player.ts:869 digits ≤ 10, wheel.ts:83, hud.ts:211/454/457, shop.ts:242, icons.ts:42 `MODELS`, `upgradeCost` exemption :137).
- `FUSE_TOOLS` grows to 10: FUSE_ROWS (upgrades.ts:91), `FUSE_ID`/`FUSE_CAP` (machines.ts:49-54), `loadState` migration loop (state.ts:146: an old `fuses` level now lands on `funnelFuses` too, harmless), icons.ts:21, shop.ts EFFECT loop.
- `machineVisual` consumers: ghost (player.ts:902), shop badge (icons.ts), `rebuild` (conveyor only).
- `machineBox` readers (no edit): robots.ts:554,808; mushrooms.ts:63; hole.ts:318; player.ts:943.
- `nearestWorking` (:663) excludes only box/panel → funnel attackable; `breakMachine`/`repair`/hud prompts use `UPGRADE_BY_ID[m.type].name`.
- `Hole.consume` XP path: `release` sets `thrownBy 'machine'` → `FEED_XP`.
- `updateLook` ray length (player.ts:534) is the only reach gate for `lookAt.machine`; `raycast()` has one other caller (grab targeting uses `lookAt.gnome` with its own 4.5 m gate).
- Scenario fixture: `tools/smoke/scenario-tree-expansion.js:263` U15 rows 11 → 12; U14 derives from `UPGRADES.length`.

#### Data (B)
- No DB; save +1 `placed` entry per funnel, +2 upgrade keys. Per frame per funnel: one `forEachNear(mouth, 1.8)` = a linear pass over ≤ 320 gnomes (the cannon does the same at r 5), ≤ 3 funnels → ≤ 960 checks, under the fans' 6400.

#### Steps (B, edit order)
1. `src/data/upgrades.ts` — after `robotArea`: `U('funnel', 'Tools', 'Gnome Funnel', '+1 funnel. Hang it in the air where you look: gnomes that fall or fly into its mouth shoot out of the elbow towards the hole.', 3, 1500, 1.8, 4)` (values per F1); `FUSE_NAMES` += `funnel: 'Funnel'`. Test: B1, B2, B17, B18.
2. `src/entities/machines.ts` — `const FUNNEL_TILT = -0.35;` `const FUNNEL_MOUTH = { r: 1.3, y0: 2.3, y1: 4.0 };` `const FUNNEL_CAP = 20;` `machineVisual` case `'funnel'`: `add(build([{ g: cyl(0.45, 0.45, 2.0, 14), c: 0x8a96a0, p: [0, 1.5, 0] }, { g: cyl(1.3, 0.45, 0.8, 16, 1, true), c: 0xff8a2a, p: [0, 2.9, 0] }, { g: new THREE.SphereGeometry(0.5, 12, 8), c: 0x8a96a0, p: [0, 0.5, 0] }]))`, outlet `const out = new THREE.Group(); const pipe = new THREE.Mesh(build([{ g: cyl(0.4, 0.45, 1.2, 14), c: 0x8a96a0, p: [0, 0.6, 0] }]), mat); pipe.rotation.x = Math.PI / 2 + FUNNEL_TILT; out.add(pipe); out.position.y = 0.5; root.add(out); spin = out;`. `MACHINE_BOX.funnel = { half: [0.55, 1.75, 0.55], center: [0, 1.75, 0] } // tube and elbow only: the mouth may overhang the hole, like the magnet's arm`. `colliderDescs` `case 'funnel': colliders.push(R.ColliderDesc.cylinder(1.0, 0.5).setTranslation(0, 1.5, 0));`. `FUSE_AT.funnel = [0.6, 1.2, 0, Math.PI / 2]`. Extract the cannon's shot (:1042-1051) into `private launch(m: Machine, muzzle: THREE.Vector3): void` (release + puff + shake; the cannon adds `audio.kick()`, the funnel `audio.whoosh()`), and the barrel turn (:1027-1028) into `private aimAtHole(m: Machine, dt: number): void`; `effect` case `'funnel'`: `this.aimAtHole(m, dt)`; `const mouth = m.pos.clone().addScaledVector(this.up(m), (FUNNEL_MOUTH.y0 + FUNNEL_MOUTH.y1) / 2);` `gn.forEachNear(mouth, 1.8, (g, _d, p) => { if (m.queue.length >= FUNNEL_CAP || g.type.id === 'king') return; const l = this.local(m, p); if (Math.hypot(l.x, l.z) > FUNNEL_MOUTH.r || l.y < FUNNEL_MOUTH.y0 || l.y > FUNNEL_MOUTH.y1) return; gn.stash(g); m.queue.push(g); ctx.fx.burst(new THREE.Vector3(p.x, p.y, p.z), 0xff8a2a, 8); ctx.audio.slurp(); });` fire: `if (m.queue.length && m.t > 0.35) { m.t = 0; const outDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(UP, m.spin!.rotation.y).applyQuaternion(m.quat); this.launch(m, m.pos.clone().addScaledVector(this.up(m), 0.5).addScaledVector(outDir, 1.2)); }` recoil as the cannon with `FUNNEL_TILT` (`m.spin.children[0].position.set(0, recoil * Math.cos(FUNNEL_TILT), recoil * Math.sin(FUNNEL_TILT))`). `moving()`/`SPIN_RATE`: no entry (nothing spins). Test: B3-B9, B11, B13, B14.
3. `src/ui/hud.ts` — `TOOL_ICONS.funnel = '🪣'`; `HINTS.funnel = 'Hang it in the air where you look (wheel = distance). Gnomes that fall or get blown into the mouth shoot out towards the hole.'`. Test: B2.
4. `src/player/player.ts:534` — `this.raycast(14)` with the comment `// 14: the farthest a ghost floats (wheel distance), so a funnel hung high still answers to E, G and X; gnomes, props and the lever keep their 4.5 m gates below` (F2). Test: B10, B16.
5. Texts: `docs/SPEC.md` tools list (new line after Cleaning Robot: price, max, level, how it works, "zawieszany w powietrzu", XP x0,25) + decision line with the PP quote and why (max Big Blades threw gnomes past the hole; the funnel catches them); Fuses line "9 węzłów" → "10 węzłów (… Funnel)"; `docs/PLAN.md:87`; `CHANGELOG.md` bullet ("New tool: the Gnome Funnel. Hang it in the air; gnomes that fall into it shoot out towards the hole."); `BOARD.md`; the ai-work note from A7 gets a Part B section.
6. `tools/smoke/scenario-funnel.js` (new; FAKELOCK=1) checks B3-B16; `tools/smoke/scenario-tree-expansion.js:263` U15 expectation rows 11 → 12.

### Tests
- A: `tools/smoke/scenario-fan-power.js`: `g.state.upgrades.fan = 2; g.state.upgrades.fanPower = 4`; place fan F at (hx+8, 0, hz) facing the hole; spawn `classic` ragdoll gnomes 3 m in front at power 1 and at 0.25 (set via CDP keydown `KeyN` while `g.player.lookAt.machine === F`, asserts `F.power` after each press: 0.75, 0.5, 0.25, 1); sample `linvel` along the axis over 10 frames (ratio 0.2-0.3); `spinRate` samples over 10 frames after a power change (monotone, ≥ 3 distinct values); walking gnome at 3 m stays `walk` for 60 frames at 0.25, at 1.5 m becomes `ragdoll`; `saveState` → reload → `placed[0].power === 0.25`; a save JSON without `power` → 1; G-move keeps 0.5, next placement 1; blueprint SAVE/LOAD keeps 0.5; `KeyN` on a belt → `power` unchanged, toast count unchanged; `rg -n "power" src/player/sweeper.ts` → none.
- B: `tools/smoke/scenario-funnel.js`: `g.state.upgrades.funnel = 1`; via the player: `selectTool('funnel')`, pitch +0.6 rad, `ghostDist` 6, CDP mouse down → `placedCount('funnel') === 1`, `m.pos.y > 2`, body `isFixed()`, same translation after 60 frames; ghost over the hole → `ghostBlocked === true`; tube 0.6 m outside the rim → false; spawn a `classic` gnome 1.5 m above the mouth → within 20 frames `state === 'stashed'`, `queue.length === 1`; then within 30 frames `queue.length === 0`, `thrownBy === 'machine'`, `linvel` points at the hole (horizontal angle < 0.2 rad); within 3 s `stats.gnomesEaten` +1 and `holeXp` +0.25 x `xpMult`; no `bigText` with a trick name; a `king` in the mouth zone stays free; a walking gnome under the tube stays `walk`; `m.spin.rotation.y` within 0.1 rad of `atan2` to the hole after 60 frames; outlet `children[0].position.z` sampled 12 frames from a shot: first < -0.2, later > 0, last |z| < 0.03 (screenshot at the peak frame); `breakMachine` x2 with `funnelFuses` 1 → `broken > 0`, gnome dropped in stays free; E from 10 m (player 10 m away, aiming) → `broken === 0`; `g.machines.remove(m)` with a queue → the gnome is `ragdoll` again; `saveState` → reload → `placed[0]` type/y equal; blueprint LOAD restores it; `rg -n "funnel" src/entities/robots.ts src/entities/mushrooms.ts src/systems/hole.ts` → none; `tree-expansion` U15 rows 12.
- Both scenarios run on the private 5199 server with `FAKELOCK=1`, never `FULL=1`.

### Done when
- A1: `scenario-fan-power.js` → `A1 {power:1, near:<same as today ±0.3>}` PASS
- A2: → `A2 {power:0.75, prompt:"N power 75%", float:"75%"}` PASS
- A3: → `A3 {seq:[0.5,0.25,1]}` PASS
- A4: → `A4 {ratio:0.2-0.3, spinSamples:>=3 distinct}` PASS
- A5: → `A5 {at3m:"walk", at1_5m:"ragdoll"}` PASS
- A6: → `A6 {reload:0.25, legacy:1}` PASS
- A7: → `A7 {moved:0.5, next:1}` PASS
- A8: → `A8 {blueprint:0.5}` PASS
- A9: → `A9 {beltPower:1, toasts:same}` PASS
- A10: → `A10 {axisPush: L4@0.5 == L0@1 ±5%}` PASS
- A11: → `A11 {afterRepair:0.25}` PASS
- A12: `rg -n "power" src/player/sweeper.ts` → no output
- B1: `scenario-tree-expansion.js` → `U15 {rows:12}` PASS; `scenario-funnel.js` → `B1 {locked@3:"???", row@4:["Gnome Funnel","Funnel Fuses"]}` PASS
- B2: → `B2 {wheelHas:"funnel", hotbarKey:"", hint:true}` PASS
- B3: → `B3 {y:>2, fixed:true, drift:<0.01}` PASS
- B4: → `B4 {overHole:true, rim0_6:false}` PASS
- B5: → `B5 {stashed:true, released:true, aim:<0.2, eaten:+1, xp:0.25*mult, trick:false}` PASS
- B6: → `B6 {under:"walk"}` PASS
- B7: → `B7 {king:"free"}` PASS
- B8: → `B8 {yawErr:<0.1, afterLevelUp:<0.1, y:same}` PASS
- B9: → `B9 {min:<-0.2, overshoot:>0, settle:<0.03}` PASS + screenshot checked by eye
- B10: → `B10 {broken:true, caughtWhileBroken:0, repairedFrom10m:true}` PASS
- B11: → `B11 {queueReleased:true}` PASS
- B12: → `B12 {reload:same, blueprint:same}` PASS
- B13: `rg -n "funnel" src/entities/robots.ts src/entities/mushrooms.ts src/systems/hole.ts` → no output
- B14: → `B14 {queue:20, extraFree:true}` PASS
- B15: → `B15 {handThrowXp:0.25*mult, trick:false}` PASS
- B16: → `B16 {lookAtFanAt10m:true, gnomeAt5m:undefined}` PASS
- B17: → `B17 {kept:{funnel:1, funnelFuses:1}}` PASS (iframe rebirth with `dTools 1`, as tree-expansion P7)
- B18: → `B18 {fuseCap:+15, boxCap:+3}` PASS (`fuseMesh.count` capacity read from `instanceMatrix.count`)

### Assumptions (numbered)
1. Key N cycles the power down and wraps (100 → 75 → 50 → 25 → 100); one key, no modifier. N is unused (`rg "KeyN" src` → none).
2. Power scales the whole fan push (lift included): with power ≤ 1 the lift never exceeds today's, so Big Blades' "no hover on a level fan" stays true.
3. The trip range scales with power (`FAN_TRIP * power`): at 25 % the push beyond 2.25 m is under grass friction, and a gnome tripped there would lie, stand and trip again (the pin the 9 m limit was added for, SPEC:115).
4. Floating placement needs no new code: `updatePlacement` already puts the ghost at the wheel distance when the ray hits nothing (player.ts:985-987; SPEC:90 "Rzecz unosi się tam, gdzie gracz patrzy"). The brief's "placement today snaps to ground" is not what the code does.
5. The funnel stashes and re-launches (cannon pattern), so XP is x0.25 for every feeder, hand throws included (F3); no tricks.
6. Funnel box = tube and elbow only, so the mouth may overhang the rim (magnet precedent, machines.ts:351).
7. The funnel on the Tab wheel (12th placeable), not on a digit; digits 1-0 stay as today.
8. The King is not caught (crate and vacuum precedent).
9. Catch is instant like the crate and the cannon (`stash`); the cue is a burst plus `slurp` (rule 3's cue); no shrink of the gnome (see Alternatives).

### Alternatives rejected
- (a) Mouse wheel on a fan for power: a trackpad fires many wheel events per gesture (input.ts:85 sums `sign(deltaY)`), and the wheel already means distance in placement.
- (b) A global fan power upgrade/slider: PP asked for a per-fan option ("opcja zmiany mocy" after Big Blades is global); one strong and one gentle fan side by side is the use case.
- (c) Scaling only the axis push (like Big Blades) and keeping the lift: a 25 % fan would still tumble gnomes in place at full lift.
- (d) A shrink animation of the gnome on catch: stashed gnomes are not drawn (`setEnabled(false)`), a shrink needs a new gnome state; the crate and the cannon stash instantly today, the funnel follows them with a burst and a sound.
- (e) Funnel on the ground only with a tall tube: PP asked for "w powietrzu"; the ghost already floats, so this costs nothing.
- (f) A suction pull around the mouth (vacuum-like): not asked; fans are the feeder.

### Ladder
- `PlacedMachine.power`, `Machine.power` (rung 6): "opcja zmiany mocy" per fan needs a saved value.
- `cyclePower`, key N, prompt line (rung 6): "klawisz przy celowaniu w wiatrak".
- `FAN_POWERS` constant (rung 5): the four values from the board.
- `ghostPower` (rung 6): G must keep the fan's power (otherwise moving a fan resets it).
- `funnel` row, `FUSE_NAMES.funnel` (rung 2): same `U(...)` and generated Fuses as the other tools.
- `machineVisual`/`MACHINE_BOX`/`colliderDescs`/`FUSE_AT` entries (rung 2): every tool has these four.
- `launch`, `aimAtHole` extracted from the cannon (rung 2): reuse, not a second ballistic formula.
- `raycast(14)` (rung 5): one number; without it a funnel above 6 m cannot be repaired, moved or picked up.
- Two new scenario files (rung 2): one per task, as every note in `tools/smoke`.
- No new dependency, no new sound (slurp, whoosh exist), no new easing.

### Open decisions (for PP)
PP 2026-10-21: F2 none, F3 b (Slack 21:07: "F1 a F2 nic nie zmieniamy trzeba doskoczyć f3 b wiatrak pod n ok"): [F1] a; [F2] no change, E/G/X keep 6 m for every tool, the player jumps to reach a high funnel; [F3] b, a hand throw caught by the funnel keeps the player's shot like a belt (x1 XP, its tricks), machine-fed gnomes x0.25; fan power key N cycling 100/75/50/25 % confirmed. Implemented in `2026-10-21-fan-power-funnel.md`.

1. [F1] Gnome Funnel price, count and unlock. a) $1500 x1.8, max 3, hole level 4: a cheap catcher right after the Kicking Wheel, so fans plus funnels become a build before the Magnet; b) $3000 x2, max 2, hole level 6, next to the Cannon. (recommendation: a, because the funnel does nothing alone; it needs fans, which players have from level 1)
2. [F2] [spec silent] Zakładam: E, G and X reach every tool up to 14 m (today 6 m), so a funnel hung high can be repaired, moved and picked up | Dowód: `player.ts:534` `this.raycast(6)`; the ghost floats up to 14 m (`:953`) | Jeśli źle: a funnel placed above 6 m can never be repaired after a saboteur hit nor taken back, and the saboteur can hit it from the ground (`gnomes.ts:737` horizontal test) | Pewność: Likely | rekomendacja: a) 14 m for all tools (one number, gnomes and props keep 4.5 m); b) cap the funnel's placement height at 6 m instead.
3. [F3] [spec silent] Zakładam: a gnome the funnel launches pays XP x0.25, also when the player threw it in by hand, and never a trick | Dowód: `gnomes.ts:380` `release` sets `thrownBy 'machine'`; `hole.ts:173`; the cannon does the same | Jeśli źle: hand throws into a funnel beside the hole would pay x1 and the funnel becomes a free trick-less hole with the belt rule (SPEC:22 lists trampoline, belt, fan, magnet as x1 helpers) | Pewność: Likely | rekomendacja: a) x0.25 like the cannon (it swallows and re-fires); b) x1 for hand throws like the belt.

### Self-check
- Every acceptance criterion has a step and a test: A (power key, 25-100 %, per fan, saved) → steps A1-A7, rows A1-A12; B (vertical funnel, elbow aimed at the hole, air placement, Fuses, saboteur, XP) → steps B1-B6, rows B1-B18.
- Every step names a file, a signature or a value; no "handle edge cases".
- Fields written: `Machine.power` / `PlacedMachine.power` with all writers and readers in Reach (A); `queue` on the funnel reuses the cannon's writers (`remove`, `effect`).
- Lists compared with the code: tools that blow (fan, blower, GUSTY WIND) → A12 `spec silent` (blower); feeding methods (`FEED_XP` rule) → B15; reach gates in `updateLook` → B16. `spec silent` rows: 3 (A12, B15, B16). Done-when lines: 30 = matrix rows 12 + 18.
- Decisions older than 60 days: none used (all 2026-10-19..25).
- Plan vs code: the code is about 120 lines of src plus two scenarios; the plan's decision content is shorter than that; the matrices are the bulk.
