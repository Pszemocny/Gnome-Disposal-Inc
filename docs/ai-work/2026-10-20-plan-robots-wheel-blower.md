# Plan: cleaning robots (C), tool wheel (B), leaf blower (A)

Spec: PP, Slack 2026-10-20 00:47: "Dodaj dmuchawę jako narzędzie i może koło wyboru narzędzi jak z GTA V. I niech doda jeszcze roboty sprzątające, które w jakimś obszarze zbierają krasnale na pakę i kiprują do dziury." Plus: "Niech nie będą super drogie" (prices like mid tools, $100-$900) and "Wywal miotłę" (the Push Broom is removed tonight by another agent; C toggles hands <-> Plow Tractor). Hub spec in BOARD.md items PP-A/B/C.
Trivial check: C adds a new machine type (model, physics body, state machine, save/restore, shop rows, HUD) across machines.ts, a new robots.ts, upgrades.ts, shop.ts, hud.ts; B touches input, player, main loop (time scale) and HUD; A touches sweeper, player, upgrades, shop, hud, models. All three have a data path (placed machines in the save, gnome stash/consume, money).

## Plan v0 (plan-author)

### Goal
A bought robot clears gnomes in a circle around its home post into the hole by itself; every owned tool is pickable with the mouse from a radial wheel; the leaf blower pushes gnomes in a cone in front of the player.

### Part C: cleaning robots

#### Design decisions (what the implementer cannot pick alone)

- **A robot is a `Machine` of `type: 'robot'`** placed through `Machines.place()` (`src/entities/machines.ts:304`). Reason: placement ghost, BLOCKED rules, X pick-up (releases `m.queue`), G move, `serialize`/`restore`, `available()`, the hotbar and the "hole moved under a machine" rule (`src/systems/hole.ts:214-218`) all come for free. `m.pos` = `m.home` = the home post (area centre, saved); the truck's live position is its body. Behaviour lives in a new file `src/entities/robots.ts` (`robotVisual()`, `robotColliders()`, `updateRobot(m, dt)`, `robotCap()`, `robotSpeed()`, `robotArea()`), called from `machines.ts` by type.
- **Gnomes ride stashed** (`ctx.gnomes.stash(g)` + `m.queue.push(g)`, crate precedent `machines.ts:486-495`) and are shown as hats on the bed (`name = 'fill'`, crate precedent `machines.ts:71-80`, max 6 hats, `shown = round(queue/cap * fill.length)`). Tipping = `ctx.hole.consume(g)` for every gnome in `m.queue` in one frame (crate dump precedent `machines.ts:465-469`): pays money, combo, XP, Boom explosions, Golden x100, at the hole middle (`holeOrigin`). No bodies on the bed.
- **The truck is a dynamic body driven like a walking gnome**: `RigidBodyDesc.dynamic().setDominanceGroup(1)`, `lockRotations(true)`, mass 150, one cuboid collider half (0.55, 0.3, 0.8) at y 0.3, group `groups(G.PROP, 0xffff)` (crate precedent `machines.ts:317,352`); each frame `setLinvel({x: fwd.x*speed, y: v.y, z: fwd.z*speed})` and `setRotation(yaw)` (gnome walk precedent `gnomes.ts:388-391`). Reason: fences, house, factory, desk and placed tools stop it physically with zero code; gnomes bounce off it (dominance); the player cannot push it (mass); `savePoses`/`drawPose` for interpolation (rule 9) reuse the crate branch (`machines.ts:417-424`). A kinematic body would drive through every static and need a shape cast per frame.
- **Steering, no pathfinding**: `yaw = THREE.MathUtils.damp(yaw, atan2(dx, dz), 6, dt)` toward the current waypoint (rule 1); speed 0 while `|angleDiff| > 1.2 rad` (turn in place). Hole guard every frame: if `holeDist(next) < holeRadius + 1.0` the outward radial velocity component is kept and the inward one zeroed. Yard guard: waypoints clamped to `|x|,|z| <= half - 1.3`. Stuck detector: moved < 0.3 m in 1.5 s while in a moving state -> detour waypoint 3 m to a random side (perpendicular to the heading), then back to the previous target; a seek target that caused two detours is dropped for this trip. Player guard: a player within 2.5 m in front (dot > 0.5) -> speed 0, state unchanged.
- **State machine** (`m.robot.state`): `idle` (at home; every 0.5 s look for the nearest free gnome within `robotArea()` of home via `forEachNear(home, area)`; found -> `seek`) -> `seek` (drive to the target gnome; target re-read every 0.3 s, dropped if no longer `isFree` or out of the area) -> `pick` (target within 1.1 m of the scoop point = truck centre + fwd*0.9, y within feet..feet+1.3: 0.35 s arm swing, stash on the contact frame at 0.15 s, `fx.puff` + `audio.thud`; `queue.length < cap` -> `seek`, else `full`) -> `full` (= `drive`; also entered from `seek`/`idle` when `queue.length > 0` and no gnome was found for 4 s) -> `drive` (waypoint = `ctx.env.hole` read live; arrive when `holeDist(truck) <= holeRadius + 1.3`) -> `tip` (bed hinged at its front edge: anticipation dip -0.08 rad over 0.05 s, rise to 1.05 rad over 0.3 s with `outCubic`, consume all on the frame the rise ends, return with `outBack` over 0.4 s; rule 4) -> `return` (waypoint = home; arrive within 0.6 m -> `idle`). Broken (`m.broken > 0`): `machines.update` skips the effect, so `updateRobot` is not reached; the broken branch gets one line for robots, `m.body.setLinvel({x:0,y:0,z:0}, true)`, so the truck does not coast; its state is kept and resumes after repair.
- **Picked gnomes lose trick flags** (`thrownBy = 'machine'`, `throwPos = null`, `bounced = bullseye = false`; sweeper precedent `src/player/sweeper.ts:100-104`): a gnome the player threw into the area must not pay LONG SHOT when the robot dumps it. The king is never picked (crate/vacuum precedent).
- **Visual** (`robotVisual()` in `robots.ts`, geometry in `src/world/models.ts` `robotGeometry()` + `robotBedGeometry()` via `build()`): a Roomba-like disc (cylinder r 0.6, h 0.3) with a dome cab and an antenna, one merged mesh, no wheels (so rule 7 does not apply); the bed is a separate child `name = 'bed'` (box 1.1 x 0.25 x 1.0 open top, pivot at its front edge), hats are children of the bed (so they tip with it) -> `place()` collects fill via `root.getObjectsByProperty('name', 'fill')` instead of `root.children.filter` (one-line change, covers all types). Area ring: a flat `RingGeometry(area-0.08, area, 48)` mesh `name = 'drop'` on the ghost (removed on place by the existing line `machines.ts:306`), and a home marker (`Machine.marker?: THREE.Object3D`, new optional field: post + translucent ring at `m.home`, removed in `Machines.remove`). Draw calls per robot: body 1, bed 1, hats <= 6, marker 2 = 10; 4 robots = +40 on a base of 60 (`2026-10-19-performance.md`).
- **Upgrades** (`src/data/upgrades.ts`, Tools tab; prices after PP "niech nie będą super drogie"): `robot` "Cleaning Robot" +1 robot, max 4, $400 x1.6, hole 2; `robotBed` "Bigger Bed" +3 gnomes per load (5 at start), max 4, $150 x1.6; `robotSpeed` "Faster Motor" +0.6 m/s (2.5 at start), max 4, $120 x1.6; `robotArea` "Wider Area" +2 m work radius (6 m at start), max 4, $150 x1.6. Reasoning: a robot clears about one gnome per 4-5 s near the hole = $12-15/min at x1, so $400 pays back in 25-30 min at hole 2-3 (x1.5-x2), same tier as the Conveyor ($250) and the Kicking Wheel ($900); a full set of 4 robots with all upgrades is about $6.4k, below one Gnome Cannon. `TOOL_IDS` (`upgrades.ts:76`) must exclude the three level upgrades: `const NOT_PLACEABLE = new Set(['crateSize', 'robotBed', 'robotSpeed', 'robotArea'])`.
- **Limits**: 4 robots (upgrade max), one `forEachNear` per robot per 0.3 s (<= 320 gnomes x 4 / 0.3 s = 4.3k distance checks/s; the fan does 320 per frame), one body each, 10 draw calls each.
- **11th tool has no digit key**: `hotkeys()` maps only `Digit1..Digit0` (`player.ts:819-822`) and the shop toast prints `(key+1)%10` (`shop.ts:120`), so `robot` at index 10 would say "Press 1". Change: hotbar `k` span empty for `i >= 10`; shop toast for `i >= 10`: "Open the tool wheel (hold Tab) to place it." Headless tests call `gnome.player.selectTool('robot')` directly. See Open decision 1.

#### Behaviour matrix (C)
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| C1 | robot placed, a free gnome inside the area | robot update | `seek` -> `pick`: gnome `state = 'stashed'`, in `m.queue`, one more hat visible | spec "picks gnomes up onto its truck bed" |
| C2 | `queue.length === robotCap()` | robot update | `drive` to the hole, stops at `holeDist <= R + 1.3`, `tip` consumes all: money up by sum of values, combo +N, `queue = []` | spec "drives to the hole, tips the load into the middle" |
| C3 | after `tip` | robot update | `return` to home within 0.6 m, then `idle` | spec "drives back" |
| C4 | `queue.length > 0`, no free gnome in the area for 4 s | robot update | `drive` with the partial load (spec silent) | Open decision 2 |
| C5 | no gnome in the area | robot update | stays `idle` at home, speed 0 | spec "in its area" |
| C6 | king inside the area | robot update | never picked (spec silent) | crate `machines.ts:486` |
| C7 | gnome stashed in a crate/cannon or held by the player | robot update | not picked (`isFree` false) | `gnomes.ts:52` |
| C8 | player-thrown gnome lands in the area and is picked | `pick` | `throwPos = null`, `thrownBy = 'machine'`; the dump pays no trick multiplier (spec silent) | `sweeper.ts:100-104` |
| C9 | placed tool / fence / house between truck and target | drive | no exception; stuck detector -> detour; `holeDist(truck) >= R + 1.0` on every frame of a 60 s run | hub "no heavy pathfinding" |
| C10 | player within 2.5 m in front of the truck | any moving state | speed 0 until the player leaves (spec silent) | Open decision 5 |
| C11 | X looking at the truck | pick up | `machines.remove`: cargo released at `m.pos` (home, assumption 6), `available('robot')` +1, marker gone | `player.ts:576-580`, `machines.ts:360` |
| C12 | G looking at the truck | move | ghost with the area ring; LMB elsewhere -> new home, truck starts `idle` there | `player.ts:583-588` |
| C13 | hole level-up moves the hole under the home post | level-up | robot back to inventory with the existing toast; hole moves while a robot is in `drive` -> it drives to the new centre | `hole.ts:214-218` |
| C14 | save + reload with a robot carrying 3 gnomes | restore | robot at home, `idle`, `queue = []` (gnomes are never saved) | `state.ts PlacedMachine`, `machines.ts:373` |
| C15 | `robotBed`/`robotSpeed`/`robotArea` level L | shop | cap `5 + 3L`, speed `2.5 + 0.6L` m/s, area `6 + 2L` m; preview "now/next" lines | spec "upgrades: bed capacity, speed, number of robots, area size" |
| C16 | saboteur reaches the home post | break | truck stops (linvel 0), smoke at `m.pos`; E on the truck repairs, state resumes | `machines.ts:398-412` |
| C17 | 4 robots owned | shop | `robot` row shows MAX; a 5th cannot be bought | spec "robot limit" |
| C18 | robot at `TOOL_IDS[10]` | hotbar / shop toast | hotbar slot without a key number; toast says "Open the tool wheel (hold Tab) to place it."; `selectTool('robot')` works (spec silent) | Open decision 1 |
| C19 | placement ghost | placing | ghost shows the area ring (radius `robotArea()`); BLOCKED over the hole and outside the yard like other tools | `player.ts:885-960` |
| C20 | truck `y < -1` or outside `half + 0.5` | robot update | respawn at home, cargo kept (crate precedent; spec silent) | `machines.ts:454-461` |
| C21 | rebirth without Keep Tools / with | reload | robots gone / kept at home | `hole.ts:406-409` |
| C22 | all of the above | `npx tsc --noEmit`, regression scenarios | clean; `scenario15-wait.js`, `scenario-magnet-gun.js` pass, `LOGS:` empty | repo rule |

### Part B: tool wheel (short)

- **Key: Tab, held.** Tab is already `preventDefault`ed (`src/core/input.ts:13`) and today only duplicates B for the shop (`player.ts:831`); PLAN.md documents the shop as B only. Remove `|| inp.hit('Tab')` from the shop line; Q stays "cancel placement". GTA V uses Tab for the weapon wheel. Rejected: Q (cancel while placing is in muscle memory now), middle mouse (not on PP's trackpad).
- New `src/player/wheel.ts`, `class ToolWheel { open = false; items: WheelItem[]; cursor = new THREE.Vector2(); index = -1; get timeScale(): number; update(inp, player): void }`. `WheelItem = { id: string; kind: 'gear' | 'tool'; label: string; icon: string; count?: string; enabled: boolean }`. Items in order: `hands` (icon 🧲 when `magGun` is owned, label "Hands"), `tractor` if `lvl('tractor')`, `blower` if `lvl('blower')` (part A; absent until then), then `TOOL_IDS.filter(lvl > 0)` with `available/lvl` as `count` and `enabled = available > 0`. Opening: `inp.hit('Tab')` while locked and not paused: `open = true`, cursor 0, index = current (placing id or gear). While open: camera yaw/pitch frozen (`player.ts:410` gets `&& !this.wheel.open`), `cursor += (dx, dy)` clamped to 140 px, dead zone 24 px keeps `index`, else `index = floor(((atan2(y, x) + PI/2 + 2PI) % 2PI) / (2PI / n))`. Release (`!inp.down('Tab')`): `kind === 'gear'` -> `player.setGear(id)` (make `setGear` public; `hands` while placing -> `cancelPlacement()` + `setGear('hands')`), `kind === 'tool'` -> `player.selectTool(id)` (handles the sold-out toast). Unlock/pause while open -> close, no selection.
- Slow motion: `ctx.timeScale` is not needed; `main.ts` frame: `const dt = Math.max(0, Math.min(0.05, timer.getDelta())) * ctx.player.wheel.timeScale` where `timeScale` is `damp`ed between 1 and 0.25 (lambda 12; rule 1). `ctx.hud.update(dt)` keeps the scaled dt (toasts slow too, acceptable).
- DOM: `hud.ts` adds `this.wheelEl = h('div', 'hud-wheel hidden', this.root)`; `Hud.update` rebuilds slices when the key `items.map(id+enabled+count).join()+index` changes: a 320 px circle with N absolutely positioned `.wslice` divs (icon + label + count) on a ring, `.on` for `index`; CSS in `style.css` (`.hud-wheel`, `.wslice`, `.wslice.on`, `.wslice.off`). Help line: "hold Tab tool wheel".
- Files: new `src/player/wheel.ts`; edit `src/player/player.ts` (field `wheel = new ToolWheel()`, hotkeys Tab, camera freeze, `setGear` public), `src/main.ts` (one line), `src/ui/hud.ts` (wheel element + help line), `src/ui/style.css`, `docs/PLAN.md` controls row.

| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| B1 | locked, not paused, hold Tab | open | `wheel.open = true`, slices = hands + owned gears + owned placeables, `timeScale` reaches 0.25 within 0.4 s, player yaw unchanged while the mouse moves | spec "holding a key shows a radial menu, game time slows" |
| B2 | mouse moved 100 px at angle a | update | `index` = slice at a; a move inside 24 px keeps the previous index | spec "mouse movement picks a slice" |
| B3 | release on a placeable with `available > 0` | close | `player.placing === id`, ghost in the scene, `timeScale` back to 1 | spec "releasing confirms" |
| B4 | release on a sold-out placeable | close | toast "All your ...s are placed. X picks one up.", nothing placed | `player.ts:841-845` |
| B5 | release on `tractor` / `hands` (while placing) | close | `sweeper.gear === 'tractor'` / `placing === null` and gear hands | spec "placeable tools + tractor/blower/magnet gun/hands" |
| B6 | Tab while the shop is open or unlocked | - | no wheel; B opens the shop, Tab does not | remap decision (Open decision 3) |
| B7 | Esc/unlock while the wheel is open | close | `open = false`, no selection, `timeScale = 1` | pause rules `main.ts:117-130` |
| B8 | nothing owned | hold Tab | one slice "Hands", release keeps hands (spec silent) | - |

### Part A: leaf blower (short)

- Own gear in `src/player/sweeper.ts` after the broom removal: `Gear = 'hands' | 'tractor' | 'blower'`, `ORDER = ['hands', 'tractor', 'blower']`, `next()` unchanged (owned only; `lvl('blower')`). View model on the camera like the old broom (`blowerGeometry()` in `models.ts`: tube r 0.07 x 0.9, motor box, handle, built with `build()`), bottom right, trembles while LMB is held (`sway` reused).
- Blow (LMB held, `active`): cone from `pl.eye` along `pl.dir`, half-angle 25 deg (`dot >= 0.9`, fan precedent `machines.ts:544`), range `blowRange() = 6 + 1.5 * lvl('blowRange')`; per free non-king gnome inside: `ragdoll(g, 2)`, clear trick flags (sweeper precedent), `applyImpulse(dir * a * mass * dt + up 0.3 * a * mass * dt)` with `a = 45 * (1 + 0.25 * lvl('blowPower')) * (1 - d / range)` (fan precedent: weight does not matter). Collect first with `forEachNear(eye + dir * range/2, range/2 + 1)`, act after (Rapier rule). `audio.whoosh()` every 0.35 s and `fx.wind(eye + dir, dir)` at `dt * 8` chance (fan precedent `machines.ts:551`) while LMB is held.
- Upgrades (Movement tab): `blower` "Leaf Blower" $150, max 1, hole 1: "Press C to hold a leaf blower. Hold LMB to blow gnomes away in a cone."; `blowPower` "Turbo Fan" +25% blow power, max 4, $80 x1.6; `blowRange` "Long Nozzle" +1.5 m blow range, max 4, $100 x1.6. Mid-tier like the Magnet Gun ($300) and Fan ($200); the broom was $60 and is gone.
- HUD gear line (`hud.ts:299`): `BLOWER · ${range.toFixed(1)} m (C)`; `shop.ts` previews: `blowPower: L => +${25*L}% power`, `blowRange: L => ${(6+1.5L).toFixed(1)} m`. Hotkeys toast when nothing is owned (`player.ts:826`): "Buy the Plow Tractor or the Leaf Blower in the shop (Movement)." (the broom agent rewrites this line first).
- Files: `src/player/sweeper.ts` (blower branch), `src/world/models.ts` (`blowerGeometry`), `src/data/upgrades.ts` (3 rows), `src/ui/shop.ts` (2 previews), `src/ui/hud.ts` (gear line, help), `src/player/player.ts` (toast text only), `docs/PLAN.md` C row.

| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| A1 | `blower` owned, tractor not | C | gear `blower`, view model visible; C again -> hands | spec "a hand tool", coordinator "own gear in that cycle" |
| A2 | 3 gnomes 3 m ahead at lateral 0, +-1 m (18 deg) | LMB 1.5 s | each moved >= 2 m away from the player | spec "gnomes in the cone fly off" |
| A3 | 2 gnomes 3 m ahead at lateral +-2.5 m (40 deg); 1 gnome 10 m straight ahead | LMB 1.5 s | each moved < 0.3 m | spec "those outside stay", "weaker with distance" |
| A4 | `blowPower` 0 vs 2 | LMB 1 s on a gnome 3 m ahead | displacement at level 2 >= 1.3x level 0 | spec "power upgrade" |
| A5 | `blowRange` 0 vs 2, gnome 7.5 m ahead | LMB 1.5 s | level 0: < 0.3 m; level 2: >= 1 m | spec "range upgrade" |
| A6 | king 2 m ahead | LMB 2 s | moved < 0.5 m (spec silent; broom/plow rule) | `sweeper.ts:85` |
| A7 | blower out, LMB on a gnome | - | `held` null; gun view model hidden | `player.ts:538`, `player.ts:197` |
| A8 | blown gnome falls into the hole | consume | pays base value, no trick label (flags cleared; spec silent) | `sweeper.ts:100-104` |
| A9 | shop Movement | buy | "Leaf Blower" $150 -> `upgrades.blower = 1`; HUD line `BLOWER · 6.0 m (C)` | spec "bought like the broom" |

### Reach
- `src/entities/machines.ts:304 place()`: callers `player.ts:947` (placement), `machines.ts:378 restore()`. New `case 'robot'` in `machineVisual` (`:55`), colliders switch (`:320-345`), `MACHINE_BOX` (`:274`, `half [0.6, 0.45, 0.8], center [0, 0.45, 0]`), `fill` collection (`:349`), `desc` (`:317`: dynamic + dominance for `box || robot`), `grp` (`:352`: PROP for `box || robot`), `remove()` (`:360`: also `marker`), `savePoses`/`drawCrates` (`:417-424`: `box || robot`), `update()` (`:426`: robot branch before `broken`, like the crate), `nearestWorking` (`:388`: robots are sabotage targets, keep).
- `m.queue` writers: crate (`:490`), cannon (`:627`), robot (new); readers: `remove` (`:361`), contracts (`contracts.ts:140`, box only), HUD prompt (`hud.ts:325`, box only).
- `ctx.hole.consume` callers: crate (`:468`), vacuum/blackhole (`:663`), gnomes falling (`gnomes.ts:330`), robot tip (new); it calls `ctx.gnomes.remove(g)` on a stashed gnome (crate precedent, safe: `remove` does not touch the body state).
- `TOOL_IDS` readers: `player.ts:819` hotkeys, `hud.ts:264-270` hotbar, `shop.ts:119-121` toast, `hole.ts:407` Keep Tools, `wheel.ts` (new). All get `robot` automatically; `robotBed/Speed/Area` must be excluded (see decisions).
- Golden Hour swaps skip non-free gnomes (`events.ts:226`), so stashed cargo is safe; the player cannot grab a stashed gnome (`grabbable` uses `isFree`).
- `hole.ts:214` level-up check reads `m.pos` = home: a robot whose home ends under the moved hole goes back to inventory; a truck standing over the new hole falls (C20 respawn).
- Kick (`player.ts:794`) only kicks `box` machines; the robot is not kickable. LMB grab (`player.ts:541`) only grabs `box`; the robot is not grabbable.
- `sweeper.gear` readers: `player.ts:189,197,267,416,439,475,538`, `hud.ts:296-301`, `contracts.ts:142` (tractor only). The blower adds a value; every `=== 'hands'` check keeps working.
- Shop `Tab` key: `player.ts:831` only. `input.ts:13` already prevents the browser default for Tab.
- `main.ts:168` dt: the only place that produces game time; the wheel's time scale multiplies it there.

### Data
- No database. Save: `state.placed[]` (`PlacedMachine`), robot = one entry (home + quat) like any tool; cargo not saved (gnomes are never saved). Up to 4 robots x 1 body x 1 collider; cargo <= 17 stashed (disabled) bodies each.
- Volume: gnomes <= 320 (`gnomes.ts:99`); robot scans: 4 x `forEachNear` per 0.3 s; draw calls +10 per robot (base 60, `2026-10-19-performance.md`); triangles: disc 24-seg cylinder + dome + bed + hats ~1.5k per robot.
- Blower: one `forEachNear` per frame while LMB is held (fan precedent, same cost as one fan).
- Wheel: DOM only, rebuilt on change (hotbar precedent `hud.ts:264`).

### Steps (edit order)
C (robots):
1. `src/data/upgrades.ts`: four `U(...)` rows after `blackhole` (values above); `NOT_PLACEABLE` set and `TOOL_IDS` filter.
2. `src/world/models.ts`: `robotGeometry()` (disc + dome + antenna, merged), `robotBedGeometry()` (open box 1.1 x 0.25 x 1.0, origin at the front-bottom edge).
3. `src/entities/robots.ts` (new): `export interface Robot { state: RobotState; yaw: number; target: THREE.Vector3 | null; targetGnome: Gnome | null; scan: number; wait: number; stuck: number; lastPos: THREE.Vector3; detours: number; anim: number; marker: THREE.Group }`, `export type RobotState = 'idle' | 'seek' | 'pick' | 'drive' | 'tip' | 'return'`, `robotCap()`, `robotSpeed()`, `robotArea()`, `robotVisual(): { root, bed }` (hats named `fill`, ring named `drop`), `robotMarker(area)`, `updateRobot(m: Machine, dt: number)` (state machine, steering, guards, tip animation with `outCubic`/`outBack` from `src/core/ease.ts`).
4. `src/entities/machines.ts`: `Machine.robot?: Robot`, `Machine.marker?: THREE.Object3D`; `case 'robot'` in `machineVisual`, `MACHINE_BOX.robot`, colliders, dynamic desc + PROP group for robot, `fill` via `getObjectsByProperty`, marker add/remove, `savePoses`/`drawCrates` for robot, `update()` robot branch (`updateRobot`), broken branch sets linvel 0 for robots.
5. `src/ui/hud.ts`: `TOOL_ICONS.robot = '🤖'`; hotbar key span empty for index >= 10. `src/ui/shop.ts`: previews for `robotBed`, `robotSpeed`, `robotArea`; toast text for index >= 10.
6. `docs/PLAN.md`: Tools line for the robot.
B (wheel): 7. `src/player/wheel.ts` (new). 8. `player.ts`: `wheel` field, Tab handling, camera freeze, `setGear` public, shop line without Tab. 9. `main.ts` dt line. 10. `hud.ts` wheel element + help; `style.css`. 11. `docs/PLAN.md` row.
A (blower): 12. `upgrades.ts` 3 rows. 13. `models.ts` `blowerGeometry()`. 14. `sweeper.ts` gear + blow. 15. `shop.ts` previews, `hud.ts` gear line + help, `player.ts` toast. 16. `docs/PLAN.md`.

### Tests
Headless scenarios in the scratchpad `smoke/` (dev server on 5199, `?lowfx`), one per matrix row, through `window.gnome` (ctx): `scenario-robots.js` (C1-C21), `scenario-wheel.js` (B1-B8), `scenario-blower.js` (A1-A9). Money/combo assertions read `gnome.state.money` and `gnome.hole.combo`; state assertions read `gnome.machines.list[i].robot.state` and `.queue.length`; placement via `gnome.player.selectTool('robot')` + a synthetic LMB; the tip animation samples `bed.rotation.x` over >= 10 frames (rule 12) and one screenshot at the peak.

### Done when (one line per matrix row; `R = gnome.machines.list.find(m => m.type === 'robot')`)
- C1: place a robot at (8,0,8), spawn 1 awake gnome at (10,0,8), run 300 frames -> `R.queue.length === 1`, that gnome `state === 'stashed'`, 1 hat visible.
- C2: spawn `robotCap()` gnomes within 3 m of home, run until `R.robot.state === 'return'` (<= 2400 frames) -> `gnome.state.money` increased by >= cap x 1, `R.queue.length === 0`, min `holeDist(truck)` during the run >= `holeRadius + 1.0`.
- C3: continue -> `R.robot.state === 'idle'` and truck within 0.6 m of home within 900 more frames.
- C4: 2 gnomes only, cap 5 -> after both are picked and 4 s pass, `R.robot.state === 'drive'`.
- C5: no gnomes, 600 frames -> truck moved < 0.1 m, state `idle`.
- C6: king 2 m from home, 600 frames -> `R.queue.length === 0`.
- C7: gnome stashed in a crate inside the area, 600 frames -> `R.queue.length === 0`.
- C8: gnome with `throwPos` set and `thrownBy: 'player'` picked -> `throwPos === null`, `thrownBy === 'machine'`; after the dump no "LONG SHOT" big text was shown.
- C9: a Metal Panel placed between home and the hole; 60 s run -> no exception in `LOGS:`, robot reached `return` at least once, every frame `holeDist(truck) >= R + 1.0`.
- C10: player teleported 2 m in front of the moving truck -> truck speed < 0.1 m/s for the next 60 frames; player moved away -> speed > 1 m/s again.
- C11: X on the truck with 3 in the queue -> `gnome.machines.list` has no robot, 3 gnomes `state === 'ragdoll'` near the home post, `available('robot') === lvl('robot')`, marker not in the scene.
- C12: G on the truck, place at (-8,0,8) -> `R.home` ≈ (-8, y, 8), state `idle`.
- C13: home within `holeRadius + 0.6` of `Environment.holeCenterFor(level+1)`, trigger a level-up -> robot removed; robot in `drive` when the hole moves -> its waypoint equals the new `ctx.env.hole`.
- C14: reload with the save holding a robot -> one robot at the same home, `queue.length === 0`, state `idle`.
- C15: set `upgrades.robotBed = 2` -> `robotCap() === 11`; `robotSpeed = 2` -> 3.7 m/s measured over 1 s on a straight drive; `robotArea = 2` -> gnome at 9 m picked, at 11 m not; shop rows show "now: 5 gnomes, next: 8 gnomes" etc.
- C16: `gnome.machines.breakMachine(R)` -> truck speed 0 within 10 frames; `repair(R)` -> moving again.
- C17: `upgrades.robot = 4`, shop Tools -> "Cleaning Robot" row shows MAX.
- C18: hotbar slot for the robot has an empty `.k`; buy toast contains "tool wheel"; `selectTool('robot')` -> `placing === 'robot'`.
- C19: ghost over the hole -> `ghostBlocked === true`; ghost at (8,0,8) -> ring child named `drop` with outer radius 6 present; after placing, no `drop` child on `R.root`.
- C20: `R.body.setTranslation({x:0,y:-3,z:0})` -> next frame truck at home, queue unchanged.
- C21: rebirth with `deep.dTools = 0` -> `placed` has no robot after reload; `dTools = 1` -> robot restored.
- C22: `npx tsc --noEmit` -> exit 0; `scenario15-wait.js`, `scenario-magnet-gun.js` pass, `LOGS:` empty.
- B1: hold Tab 30 frames -> `wheel.open === true`, items = ["hands", ...owned], `wheel.timeScale <= 0.3`, `player.yaw` unchanged after 50 px of mouse dx.
- B2: dx 100 at 0 deg -> `wheel.index === 1 of n` (slice to the right); dx 10 more -> same index.
- B3: release on "fan" (owned, available) -> `player.placing === 'fan'`, ghost in the scene, `timeScale === 1` within 20 frames.
- B4: release on a sold-out slice -> toast contains "are placed", `placing === null`.
- B5: release on "tractor" -> `sweeper.gear === 'tractor'`; while placing, release on "hands" -> `placing === null`, gear hands.
- B6: Tab with the shop open -> `wheel.open === false`; B -> shop opens; Tab alone never opens the shop.
- B7: wheel open, `input.unlock()` -> `open === false`, `timeScale === 1`, `placing` unchanged.
- B8: no upgrades, hold Tab -> one item "hands"; release -> gear hands.
- A1: `upgrades.blower = 1`, C -> `gear === 'blower'`, view model visible; C -> `hands`.
- A2: 3 gnomes at 3 m, lateral 0/+-1 m, LMB 1.5 s -> each >= 2 m further from the player.
- A3: gnomes at 3 m lateral +-2.5 m and one at 10 m ahead, LMB 1.5 s -> each moved < 0.3 m.
- A4: displacement of a gnome 3 m ahead after 1 s: level 2 >= 1.3 x level 0.
- A5: gnome at 7.5 m: `blowRange 0` -> < 0.3 m; `blowRange 2` -> >= 1 m.
- A6: king 2 m ahead, LMB 2 s -> moved < 0.5 m.
- A7: blower out, LMB on a gnome 1 s -> `held === null`, gun group `visible === false`.
- A8: a blown gnome with `throwPos` set -> `throwPos === null`; it falls into the hole -> no trick big text.
- A9: shop Movement lists "Leaf Blower" at $150; buy -> `upgrades.blower === 1`, money -150; HUD gear line `BLOWER · 6.0 m (C)`.

### Assumptions (numbered)
1. The broom-removal agent finishes before A and B start, and before C edits `upgrades.ts`, `models.ts`, `hud.ts` (no git: two agents writing the same file lose edits). After it, `Gear` is `'hands' | 'tractor'` and the C toast names the tractor.
2. Gnome count stays <= 320 and robots <= 4, so one scan per 0.3 s per robot is cheap (Data section).
3. Dynamic truck with dominance 1 and mass 150: gnomes and the crate cannot push it; the player's KCC (mass 3, `player.ts:124`) moves it by millimetres. The truck is stopped by fixed bodies (walls at `half + 0.5`, house, desk, placed tools).
4. A robot picks only its current seek target (O(1) check per frame); gnomes it bumps into on the way are not collected.
5. The hole has no floor, so a truck over the rim falls; the radial guard plus C20 respawn cover it.
6. `Machines.remove` releases cargo at `m.pos` = home (`machines.ts:361`), not at the truck; accepted (gnomes reappear at the home post). Open decision 4 if the orchestrator prefers the truck.
7. Robot capacity never exceeds 17, so 6 hats suffice as a fill gauge (crate: 12 hats for 60).
8. Slow motion scales game dt only; input and the render loop keep real time, so the wheel reads mouse movement at full rate.
9. No decision in `docs/ai-work` older than 60 days is used (all notes are from 2026-10-19/20), so no decision-age question.

### Alternatives rejected
- (a) Kinematic truck (`kinematicPositionBased`, `setNextKinematicTranslation`): rejected because kinematic bodies pass through every fixed body (fence, house, placed tools) unless a shape cast per frame steers around them, and frames with 0 physics steps lose movement; the dynamic gnome-walk pattern already exists in the repo.
- (b) Physical gnome bodies riding on the bed (re-enabled, parented by contacts): rejected because they slide off under steering, cost up to 17 contact pairs per robot per step, and the crate already proves stashed + hats is enough.
- (c) A separate `Robots` class with its own list, save field and loop hook: rejected because `Machines` already provides placement, BLOCKED rules, X/G, save/restore, available counts and the hotbar; a separate class would duplicate all six.
- (d) Wheel on Q or a new key: rejected (Q is "cancel placement" in muscle memory, Tab is already captured and is the GTA V key).

### Ladder
- `src/entities/robots.ts` (new file): rung 6, spec "cleaning robots ... collect gnomes onto the bed and tip them into the hole"; the behaviour does not exist anywhere.
- `Machine.robot?`, `Machine.marker?`: rung 6, needed for the state machine and the home post ("in some area").
- `NOT_PLACEABLE` set in `upgrades.ts`: rung 5 (one line), spec "upgrades: bed capacity, speed, area" in the Tools tab must not become placeable tools.
- `getObjectsByProperty` for `fill`: rung 3 (three.js built-in), hats under the bed child.
- Truck body: rung 2 (crate dynamic body + gnome `setLinvel` walk).
- Steering: rung 3 (`THREE.MathUtils.damp`), tip: rung 2 (`ease.ts`).
- `src/player/wheel.ts` (new): rung 6, spec "radial menu ... mouse movement picks a slice". Time scale: rung 5 (one multiplication in `main.ts`).
- Blower: rung 2 (fan cone + impulse pattern, sweeper gear cycle, `fx.wind`, `audio.whoosh`); `blowerGeometry`: rung 6 (model does not exist).
- Not built (rung 1): robot wheels/spin, opportunistic pick-up of bumped gnomes, cargo persistence, robot engine sound (no loop helper in `audio.ts`), wheel slice for the Magnet Gun as its own item (it is the hands slot).

### Open decisions (for the orchestrator / PP)
1. [spec silent] Zakładam: the robot is the 11th placeable, has no digit key, and is selected from the tool wheel (B) or the hotbar key gap is accepted until B lands | Dowód: `player.ts:819-822` maps Digit1..Digit0 only; `shop.ts:120` prints `(key+1)%10` | Jeśli źle: after buying a robot the player cannot place it until B ships | Pewność: Confident | rekomendacja: a) build B right after C's steps 1-6 (different files: wheel.ts/main.ts vs robots.ts/machines.ts, both touch player.ts/hud.ts lightly), and C's shop toast says "tool wheel". b) move `robot` before `blackhole` in `UPGRADES` so it gets key 0 and the Black Hole loses its key (Black Hole is hole 10, rarely owned).
2. [spec silent] Zakładam: a robot with a partial load and no gnome found for 4 s drives to the hole anyway | Dowód: spec says "up to capacity"; without this, 3 gnomes stay on the bed forever when the yard is empty | Jeśli źle: money sits on the bed until the next gnome walks in | Pewność: Likely | rekomendacja: a) 4 s timeout.
3. Tab becomes the wheel; the shop stays on B (and E at the desk). a) Tab = wheel (recommendation: a, Tab only duplicates B today, PLAN.md documents B). b) Q = wheel, Tab stays shop; then placement cancel moves to Esc/RMB.
4. [spec silent] Zakładam: the player cannot take gnomes off the bed (stashed, hidden); X on the truck spills the cargo at the home post | Dowód: `isFree` excludes stashed (`gnomes.ts:52`), `machines.remove` releases at `m.pos` (`machines.ts:361`) | Jeśli źle: PP expected to steal a gnome from a passing robot for a trick shot | Pewność: Likely | rekomendacja: a) no grabbing (crate precedent); release at home on X.
5. [spec silent] Zakładam: a robot waits while the player stands within 2.5 m in front of it | Dowód: the KCC treats dynamic bodies as obstacles (`player.ts:464`) and a truck pushing the player would jam both | Jeśli źle: the player blocks a robot on purpose and it never finishes a trip | Pewność: Likely | rekomendacja: a) wait, the stuck detector does not fire while waiting.
6. [spec silent] Zakładam: picking a gnome stashes it instantly with a puff and a thud, no 0.1-0.3 s scale transition (rule 3) | Dowód: crate stash `machines.ts:490` does the same | Jeśli źle: rule 3 check fails on the pick | Pewność: Likely | rekomendacja: a) accept like the crate; b) add a shrink-out in `writeInstances` for a new `g.vanish` timer (touches `gnomes.ts`, +15 lines).
7. [spec silent] Zakładam: a truck that falls into the hole or leaves the yard respawns at home with its cargo | Dowód: crate respawn `machines.ts:454-461` | Jeśli źle: cargo should be eaten (it fell into the hole after all) | Pewność: Unclear | rekomendacja: a) respawn with cargo (the radial guard makes this rare).
8. Prices: robot $400 x1.6 (hole 2), bed/speed/area $150/$120/$150 x1.6; blower $150, power $80, range $100 (recommendation: as listed, mid-tier per "niech nie będą super drogie"). Alternative b) robot $250 at hole 1 if PP wants automation from the first minutes.

**Orchestrator decisions (2026-10-20, PP asleep; this plan is final):** 1 a) build B (tool wheel) right after C steps 1-6; 2 a); 3 a) Tab = wheel, shop stays on B; 4 a); 5 a); 6 a) accepted (crate precedent; the puff + thud is the rule-3 cue); 7 a); 8 a) prices as listed. Work starts when the Scope/broom-removal agent has released `player.ts`, `sweeper.ts`, `upgrades.ts`, `hud.ts`, `models.ts`, `machines.ts`.

### Risks
- Same-file edits by two agents without git (`upgrades.ts`, `models.ts`, `hud.ts`, `player.ts`, `sweeper.ts`): the broom agent must finish first, then C, then B and A (B and A share `player.ts` and `hud.ts`, run them in sequence or one implementer).
- Stuck truck against a cluster of tools: the detour is random-side, so a U-shaped enclosure can trap it; the player can X and re-place. Not solved (no pathfinding by spec).
- Many robots dumping at once: the combo and the eat burst scale per gnome (`hole.ts:129`), 4 x 17 consumes in one frame = 68 `coins.burst` calls; the crate already does 60.
- Slow motion while the wheel is open also slows toasts and HUD timers (scaled dt passed on); acceptable.

### Self-check
- Every acceptance criterion from the hub spec has a matrix row, a step and a Done-when line (C: 22, B: 8, A: 9 = 39 rows, 39 lines).
- Every step names a file, a signature or a value; no "handle edge cases" lines.
- Fields written: `m.queue` (writers crate, cannon, robot; readers listed), `m.robot`, `m.marker` (robots.ts + machines.ts only), `state.placed` (unchanged shape), `upgrades.*` (shop only), `sweeper.gear` (all readers listed).
- Lists compared with the code: tool switch points in `machines.ts` (visual, box, colliders, desc, group, draw, update) all listed; `GnomeState` (6 members) checked against the pick rule; `TOOL_IDS` readers (5) listed; gear readers (9) listed. `spec silent` rows: C4, C6, C8, C10, C18, C20, B8, A6, A8 = 9.
- No `docs/ai-work` decision older than 60 days is used.
- Plan length vs code: robots.ts ~250 lines, wheel.ts ~140, blower ~70, edits ~120 = ~580 lines; the plan is shorter.
