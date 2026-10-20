# Plan: hand-tool wheel (Hands / Magnet Gun / Tractor / Blower on Tab), placeables on keys

Spec: PP, Slack 2026-10-20: "nie moge przelaczyc magnesu na rece. Rzeczy do postawienia 1-0 narzedzia pod tab w tym rece" (1: with the Magnet Gun owned the player can never go back to plain hands; 2: placeable things on the digit keys, hand tools incl. Hands on the Tab wheel).
Trivial check: `sweeper.gear` is read in player.ts, hud.ts, contracts.ts, wheel.ts; `lvl('magGun')` gates grab/reach/cone/HUD in three files; the hotbar/toast/legend/help text all list keys. Four files with shared state and new behaviour.

Ordering with batch 1 (`2026-10-20-plan-hud-right-stack.md`): batch 1 is already in `player.ts` (`coneTargets`, `ballCap`, no `beam`/`collectCd`, mtime 13:42). This plan ships AFTER batch 1 by the same implementer; it edits the gun branch condition (`if (!lvl('magGun'))`) and `const left = ...`, both lines batch 1 kept. Line numbers below are from 13:43 and may drift; anchor on the quoted code.

## Plan v0 (plan-author)

### Goal
The Magnet Gun is a fourth hand tool next to Hands, Plow Tractor and Leaf Blower: C cycles them, the Tab wheel shows only them, and every placeable tool has its own hotbar key.

### Design (what the implementer cannot pick alone)
- **Gear id = upgrade id.** `Gear = 'hands' | 'magGun' | 'tractor' | 'blower'` (sweeper.ts). Then `player.update` "upgrade gone → hands" (`if (gear !== 'hands' && !lvl(gear))`), `firstUse(gear)` (HINTS.magGun, GEAR_KEYS.magGun exist) and `lvl(gear)` in `next()` keep working unchanged. Rejected: `'gun'` with a map to `'magGun'` (one more table).
- **Gear table lives in sweeper.ts**, exported: `export const GEARS: { id: Gear; label: string; icon: string }[] = [{ id: 'hands', label: 'Hands', icon: '✋' }, { id: 'magGun', label: 'Magnet Gun', icon: '🧲' }, { id: 'tractor', label: 'Plow Tractor', icon: '🚜' }, { id: 'blower', label: 'Leaf Blower', icon: '🍃' }]`; `ORDER = GEARS.map((g) => g.id)`; `owned(): Gear[] { return ORDER.filter((g) => g === 'hands' || lvl(g)); }` used by `next()` and by the wheel. One list for C and Tab, so they can never disagree.
- **`Sweeper.grabs` getter**: `get grabs(): boolean { return this.gear === 'hands' || this.gear === 'magGun'; }` = "LMB grabs with this gear". Replaces every `gear === 'hands'` that means "not driving / not blowing" (player.ts `const left`, `gunPulling`, hud.ts sack panel). `gear === 'hands'` stays only where plain hands are meant (one-gnome grab branch).
- **Gun gating by gear, not by ownership**: every `lvl('magGun')` in player.ts/hud.ts that decides behaviour becomes `this.sweeper.gear === 'magGun'`: `gunPulling`, `updateGun` show, the grab branch, `magReach` (+0.6 m per Coil), the cone `minDot`, hud.ts `const gun`. Plain hands with the gun owned behave exactly like hands before the purchase (one gnome, narrow cone, hand reach). `ballR`/`ballCap` stay Coil-based (only read on the gun path).
- **`setGear` drops and cancels on every switch**: `if (gear === this.sweeper.gear) return; this.dropAll(); this.cancelPlacement(); this.lmbBlocked = true; this.sweeper.gear = gear; ctx.hud.hideHint(); if (gear !== 'hands') ctx.hud.firstUse(gear);`. Today gun → hands kept the swarm in the air with hands (the gun is gone but `swarm` is only dropped on LMB release); dropping on every switch is one rule for four gears.
- **`selectTool` keeps the gun**: `if (!this.sweeper.grabs) this.setGear('hands');` instead of `this.setGear('hands')`. The gun already slides out while placing (`!this.placing` in `updateGun`) and back after, as today; the tractor/blower still get put away (they change movement / LMB).
- **Wheel = gears only**: `build()` returns `GEARS.filter((g) => g.id === 'hands' || lvl(g.id))`; `WheelItem` becomes that entry type (`kind`, `count`, `enabled` deleted; imports of `TOOL_IDS`, `UPGRADE_BY_ID`, `TOOL_ICONS` deleted); on open `index = items.findIndex((it) => it.id === pl.sweeper.gear)`; on release `pl.cancelPlacement(); pl.setGear(it.id)`. hud.ts wheel render drops `it.count`/`it.enabled` (`.wslice .c`, `.wslice.off` CSS deleted).
- **Hotbar keys 1-0 then `-` and `=`** (open decision 1, assumed a): `src/data/upgrades.ts` after `TOOL_IDS`: `export const TOOL_KEYS: [code: string, label: string][] = [['Digit1','1'],['Digit2','2'],['Digit3','3'],['Digit4','4'],['Digit5','5'],['Digit6','6'],['Digit7','7'],['Digit8','8'],['Digit9','9'],['Digit0','0'],['Minus','-'],['Equal','=']];` and `if (TOOL_IDS.length > TOOL_KEYS.length) throw new Error('more placeable tools than hotbar keys');` (boot-time guard, so a 13th tool fails loudly in dev instead of silently having no key). `Minus`/`Equal` are unused today (`rg "'Minus'|'Equal'" src` → nothing). `hotkeys()`: `TOOL_KEYS.forEach(([code], i) => { if (i < TOOL_IDS.length && inp.hit(code)) this.selectTool(TOOL_IDS[i]); })`. hud.ts hotbar `k` = `TOOL_KEYS[i][1]`, `firstUse` key = `<b>${TOOL_KEYS[i][1]}</b>`, shop toast `Press ${TOOL_KEYS[key][1]} to place it.`; the three `i >= 10` / "tool wheel" branches are deleted (dead with the guard).
- **Buying the Magnet Gun equips it** (spec silent, open decision 2, assumed a): shop.ts `buy()` after `s.upgrades[id] = L + 1`: `if (id === 'magGun') ctx.player.setGear('magGun');` and the toast `Magnet Gun bought! C or hold Tab switches between hands and the gun.` Today the purchase arms the gun instantly (hands = gun once owned); without this line PP buys it and nothing visible happens.
- **Start of a session with the gun owned**: gear is not saved (`2026-10-19-broom-tractor.md`: "gear: not saved"), so a reload would start with plain hands even though yesterday's build started with the gun. main.ts after `ctx.machines.restore(state.placed)`: `if (lvl('magGun')) ctx.player.setGear('magGun');` (open decision 3, assumed a).
- Text: hud.ts `GEAR_KEYS.magGun = '<b>C</b> or hold <b>Tab</b> · <b>hold LMB</b> pull · release <b>LMB</b> drop · <b>RMB</b> throw'`; help box `<b>C</b> next hand tool · <b>hold Tab</b> hand tools (hands, Magnet Gun, tractor, blower)` and `<b>1-0 - =</b> pick a tool`; legend.ts `['C', 'next hand tool: hands, Magnet Gun, tractor, blower']`, `['hold Tab', 'hand tool wheel']`, `['1-0 - =', 'pick a tool to place']`; C toast when nothing is owned: `Buy the Magnet Gun (Magnet tab), the Plow Tractor or the Leaf Blower (Plow tab).`; PLAN.md rows LMB, C, 1-9 0, Tab.
- `firstUse('magGun')` on the first LMB press (player.ts `if (left && inp.mouse.leftPressed && lvl('magGun'))`) is deleted: `setGear('magGun')` shows the hint when the gun is first taken.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| G1 | gun owned, gear `magGun` | C | gear `hands`, `gun.visible` false within 0.2 s (`gunShow` slides 1 → 0), swarm dropped, LMB ignored until released | spec "przelaczyc magnesu na rece" |
| G2 | gun owned, gear `hands`, LMB on a gnome | hold LMB | ONE gnome in `held`, `swarm.length === 0`, gun not visible, HUD panel `MAGNET · <name>` | spec (hands = plain hands) |
| G3 | gun owned, gear `hands`, 10 gnomes in the wide cone off-centre | hold LMB | at most one gnome (`gnomeTarget` with the narrow cone `0.94 - 0.02 x Dish`), `magReach` without the Coil bonus | design "gun gating by gear" (spec silent: hand reach while the gun is owned; open decision 4) |
| G4 | gun owned, gear `magGun`, LMB | hold LMB | `coneTargets()` batch into `swarm` as batch 1 left it; `gun.visible` true | batch 1 D1 unchanged |
| G5 | gun owned, blower owned, tractor owned | C x4 from hands | `hands → magGun → tractor → blower → hands` | spec "narzedzia pod tab w tym rece", today's `ORDER` |
| G6 | gun not owned, nothing owned | C | gear stays `hands`, toast `Buy the Magnet Gun (Magnet tab), the Plow Tractor or the Leaf Blower (Plow tab).`, deny sound | today's `next() === null` branch |
| G7 | gun owned, nothing else | C | `hands → magGun → hands` | `owned()` |
| G8 | gear `magGun`, swarm of 5 | C / Tab to tractor | `swarm.length === 0`, gnomes dropped (`ctx.gnomes.drop`), tractor visible | design "setGear drops" (today: hands → tractor already drops) |
| G9 | gear `magGun` | key 2 (trampoline owned) | `placing === 'trampoline'`, gear stays `magGun`, `gun.visible` false while placing, true again after LMB place / Q | design "selectTool keeps the gun"; today's `!this.placing` in `updateGun` |
| G10 | gear `tractor` | key 2 | gear `hands`, placing `trampoline` | today's `selectTool` (`2026-10-19-broom-tractor.md` "selectTool puts the tractor away") |
| G11 | gear `magGun` | rebirth (magGun not in `KEEP_TOOL_IDS`) | next frame gear `hands` (`!lvl('magGun')`), gun slides out | player.ts "rebirth or a reset took the tractor away" line, unchanged |
| G12 | gun owned, fresh page load | boot | gear `magGun` after `restore` (open decision 3) | spec silent |
| G13 | gun not owned | buy Magnet Gun in the shop | gear `magGun`, toast `Magnet Gun bought! C or hold Tab switches between hands and the gun.`, hint shown on the first Tab/C take is skipped (firstUse fired by `setGear`) | spec silent (open decision 2) |
| W1 | gun, tractor, blower owned, 3 placeables owned | hold Tab | `wheel.items.map(id)` = `['hands','magGun','tractor','blower']`, no placeable slices, no `.c` count badges | spec "narzedzia pod tab w tym rece" |
| W2 | nothing owned | hold Tab | one slice `hands` | today's B8 |
| W3 | gear `tractor`, hold Tab, release on 🧲 | release Tab | gear `magGun`, `wheel.open === false`, `timeScale` back to 1 | wheel release |
| W4 | placing `fan`, hold Tab, release on ✋ | release Tab | `placing === null`, gear `hands` | today's B5 |
| W5 | placing `fan`, gear `magGun`, hold Tab, release on 🧲 (same gear) | release Tab | `placing === null` (setGear early-returns, so the wheel calls `cancelPlacement()` first), gear `magGun` | spec silent: picking the current gear from the wheel while placing (open decision 5) |
| W6 | wheel open | index highlight | `.wslice.on` is the current gear on open (`findIndex(gear)`), no `off` class anywhere | today's open index rule |
| K1 | `box..blackhole` owned (10) | keys 1-0 | `selectTool(TOOL_IDS[i])` as today; hotbar `k` = `1..0` | spec "Rzeczy do postawienia 1-0" |
| K2 | robot owned (`TOOL_IDS[10]`) | key `-` (`Minus`) | `placing === 'robot'`; hotbar slot `k` = `-`; buy toast `Cleaning Robot bought! Press - to place it.`; first-use hint `<b>-</b> · LMB place ...` | spec silent: 11th placeable (open decision 1) |
| K3 | `TOOL_IDS.length` 11, `TOOL_KEYS.length` 12 | boot | no throw; a 13th placeable would throw at module load | design guard |
| K4 | key `=` (`Equal`), no 12th tool | press | nothing happens (`i < TOOL_IDS.length` guard) | design |
| T1 | help box (H), legend (L), PLAN.md | open | C line, Tab line and key range updated as in "Text" | spec (keys listed to the player) |

Lists compared with code (rule 1.6): gears in `ORDER` = 3 today + 1 new (no other `Gear` writer: `rg "gear = "` → `setGear` only); `lvl('magGun')` readers in player.ts: `gunPulling`, `updateGun`, firstUse line, grab branch, `magReach`, `minDot` (6) + hud.ts `const gun` + wheel.ts icon = 8, all in steps 2-4; `sweeper.gear` readers: player.ts (update reset, `gunPulling`, `updateGun`, move speed, pound, friction, `const left`), hud.ts (sack panel, gear line), contracts.ts:143 (tractor only, untouched), wheel.ts; `TOOL_IDS` readers: player.ts hotkeys, wheel.ts (removed), icons.ts (unchanged), hole.ts `KEEP_TOOL_IDS` (unchanged), shop.ts toast, hud.ts firstUse + hotbar (all in steps 5-7); key texts: hud.ts help box, hud.ts `GEAR_KEYS`, legend.ts `KEYS`, PLAN.md (4 places, step 8). `spec silent` rows: G3, G12, G13, W5, K2 = 5.

### Reach
- `Sweeper.gear` (sweeper.ts) writers: `Player.setGear` only. Readers: player.ts `update` (reset to hands), `gunPulling`, `updateGun`, `move` (tractor speed), `pound.update` (tractor flag), friction branch, `actions` (`const left`), `selectTool`; hud.ts sack panel + gear line; contracts.ts:143; wheel.ts open index.
- `Sweeper.next()` caller: player.ts `hotkeys()` KeyC only. `ORDER`: `next()` only (now also `owned()` → wheel).
- `Player.setGear` callers: wheel.ts release, player.ts `update` reset, `hotkeys` C, `selectTool`; new: shop.ts buy, main.ts boot.
- `Player.selectTool` callers: hotkeys, wheel.ts (removed), G key, headless scenarios (`gnome.player.selectTool('robot')` keeps working).
- `swarm` writers: grab branch, `release()`, `throwHeld`, `updateSwarm`; `setGear` now empties it through `dropAll()` → `release()` (drops via `ctx.gnomes.drop`, the hole-fall rule kept).
- `ToolWheel.items` reader: hud.ts wheel render (`id`, `icon`, `label`, `count`, `enabled` → only the first three after step 4).
- `TOOL_ICONS` (hud.ts) readers: hud.ts hotbar, wheel.ts (removed); stays exported for the hotbar.
- `ctx.hud.firstUse` callers for gear ids: `setGear`; `state.seenHints` unchanged (ids `magGun`, `tractor`, `blower` already used).
- No save format change: `gear` is not saved (`2026-10-19-broom-tractor.md`), `TOOL_IDS` order unchanged so `placed` restore is untouched.
- Front/back contract: none (single-page game).

### Data
- No persisted data changes. `localStorage` save untouched (`seenHints` gains no new ids).
- Cost: `owned()` filters 4 entries on C press and wheel open; hotkeys loop 12 `inp.hit` calls per frame instead of 10 (microseconds). Wheel render rebuilds on `items` key change only, as today.

### Steps (edit order)
1. `src/player/sweeper.ts` — `Gear` + `GEARS` + `ORDER` + `owned()` as in Design; `grabs` getter; `next()` uses `owned()`. `update()` unchanged (the gun view model stays in player.ts).
2. `src/player/player.ts` — `gunPulling`: `this.sweeper.gear === 'magGun' && !this.held && inp.mouse.left && inp.locked && !this.placing && !this.lmbBlocked`; `updateGun`: `const show = this.sweeper.gear === 'magGun' && !this.placing`; `actions`: `const left = inp.mouse.left && this.sweeper.grabs && !this.lmbBlocked`, delete the `firstUse('magGun')` line, `if (!lvl('magGun'))` → `if (this.sweeper.gear === 'hands')`; `magReach`: `(this.sweeper.gear === 'magGun' ? 0.6 * lvl('magPower') : 0)`; `minDot`: `this.sweeper.gear === 'magGun' ? Math.cos(...) : 0.94 - ...`; `hotkeys`: `TOOL_KEYS` loop + the new C toast text; `selectTool`: `if (!this.sweeper.grabs) this.setGear('hands')`; `setGear` body as in Design. Comment above `setGear` becomes "Any switch drops what is held and cancels placement; LMB waits for a release."
3. `src/data/upgrades.ts` — `TOOL_KEYS` + the length guard after `TOOL_IDS`.
4. `src/player/wheel.ts` — `WheelItem` = `(typeof GEARS)[number]`; `build()` = `GEARS.filter((g) => g.id === 'hands' || lvl(g.id))`; open index from `pl.sweeper.gear`; release: `pl.cancelPlacement(); pl.setGear(it.id);`; drop the three imports. File header comment: "hand tools only; placeables live on the hotbar keys".
5. `src/ui/hud.ts` — `GEAR_KEYS.magGun` text; help box C / Tab / `1-0 - =` lines; `firstUse`: `const keys = i < 0 ? GEAR_KEYS[id] ?? '' : `<b>${TOOL_KEYS[i][1]}</b> · ${PLACE_KEYS}``; hotbar `k` = `TOOL_KEYS[i][1]`; wheel render without `count`/`off`; `const gun = p.sweeper.gear === 'magGun' && !h`; `const hands = p.sweeper.grabs` (sack panel shows for hands and gun, gear line only for tractor/blower). `src/ui/style.css`: delete `.wslice .c`, `.wslice.off`.
6. `src/ui/shop.ts` — toast `Press ${TOOL_KEYS[key][1]} to place it.` (delete the `key >= 10` branch); `if (id === 'magGun') { ctx.player.setGear('magGun'); ctx.hud.toast('Magnet Gun bought! C or hold Tab switches between hands and the gun.', 'good'); }`.
7. `src/ui/legend.ts` — three `KEYS` rows. `src/main.ts` — `if (lvl('magGun')) ctx.player.setGear('magGun');` after `ctx.machines.restore(state.placed)`.
8. `docs/PLAN.md` — rows LMB ("hands: ONE thing; the Magnet Gun is a hand tool taken with C or the Tab wheel"), C (`hands → Magnet Gun → Plow Tractor → Leaf Blower`), `1-9, 0, -, =`, Tab ("hand tools only: hands, Magnet Gun, tractor, blower; placeables are on the keys"). Note `docs/ai-work/2026-10-20-gear-wheel.md`.

### Tests
Headless scenario `scenario-gear-wheel.js` in the session scratchpad `smoke/` (template: `scenario-wheel.js` there; dev server 5199, `?lowfx`), through `window.gnome`:
- G1/G2/G3/G4/G7: `state.upgrades.magGun = 1`, 10 gnomes placed in a 30° fan 5 m ahead; `player.setGear('magGun')`, LMB 20 frames → `swarm.length >= 2`; C → gear `hands`, sample `player['gun'].position.y` over 12 frames (rule 12: at least one value strictly between the rest y and rest y - 0.3, monotone down), `gun.visible === false` by frame 15; LMB release + LMB 20 frames → `held.gnome` set, `swarm.length === 0`; `player.magReach` equals `7 + 1.2 * magRange` with hands.
- G5/G6: `tractor = blower = 1`, C x4 → gear sequence; all zero → toast text and gear `hands`.
- G8: gun, swarm 5, `setGear('tractor')` → `swarm.length === 0`, each dropped gnome `!held`.
- G9/G10: `trampoline = 1`; gear `magGun`, key 2 → placing, gear `magGun`, `gun.visible` false; Q → `gun.visible` true within 15 frames; gear `tractor`, key 2 → gear `hands`.
- G11: `state.upgrades.magGun = 0` with gear `magGun` → next frame gear `hands`.
- G12: save with `magGun = 1`, reload page → gear `magGun` after boot.
- G13: `state.money = 1000`, `shop.buy('magGun')` (or the DOM click) → gear `magGun`, toast text.
- W1-W6: Tab held 30 frames → `wheel.items.map((i) => i.id)`; DOM `.wslice` count equals items, no `.c`, `.on` index = current gear; mouse 100 px to the slice; release → gear; placing + release on ✋ / 🧲.
- K1-K4: `robot = 1`, key `Minus` → `placing === 'robot'`; hotbar slot `.k` text `-`; `shop.buy('robot')` toast contains `Press -`; key `Equal` → `placing` unchanged; `TOOL_KEYS.length === 12`, `TOOL_IDS.length === 11`.
- T1: `grep` lines below. One screenshot of the open wheel with four slices at the peak of the pop, checked by eye.

### Done when
- G1: scenario → `C: gear=hands gunShow samples [1, 0.7x, 0.4x, ..., 0] visible=false at frame<=15 swarm=0`.
- G2: scenario → `hands+LMB: held.gnome=<id> swarm=0 panel="MAGNET · ..."`.
- G3: scenario → `hands reach=<7+1.2*dish> grabbed<=1 of 10`.
- G4: scenario → `magGun+LMB: swarm>=2 gun.visible=true`.
- G5: scenario → `C cycle: hands,magGun,tractor,blower,hands`.
- G6: scenario → `nothing owned: gear=hands toast="Buy the Magnet Gun (Magnet tab), the Plow Tractor or the Leaf Blower (Plow tab)."`.
- G7: scenario → `gun only: hands,magGun,hands`.
- G8: scenario → `setGear(tractor) with swarm 5: swarm=0 heldFlags=[false x5] tractor.visible=true`.
- G9: scenario → `magGun + key2: placing=trampoline gear=magGun gun.visible=false; Q: gun.visible=true@<=15`.
- G10: scenario → `tractor + key2: gear=hands placing=trampoline`.
- G11: scenario → `magGun=0: gear=hands next frame`.
- G12: scenario (reload) → `boot: gear=magGun`.
- G13: scenario → `buy magGun: gear=magGun toast="Magnet Gun bought! C or hold Tab switches between hands and the gun."`.
- W1: scenario → `wheel items=hands,magGun,tractor,blower .wslice=4 .c=0`.
- W2: scenario → `wheel items=hands`.
- W3: scenario → `release on magGun: gear=magGun open=false timeScale=1`.
- W4: scenario → `placing fan, release hands: placing=null gear=hands`.
- W5: scenario → `placing fan, gear magGun, release magGun: placing=null gear=magGun`.
- W6: scenario → `.wslice.on index == items.indexOf(gear) .off=0`.
- K1: scenario → `Digit1..Digit0: placing=<TOOL_IDS[i]> x10; hotbar k=1,2,3,4,5,6,7,8,9,0`.
- K2: scenario → `Minus: placing=robot; slot.k="-"; toast="Cleaning Robot bought! Press - to place it."`.
- K3: `npm run build` → exit 0; `grep -n "more placeable tools than hotbar keys" src/data/upgrades.ts` → 1 line.
- K4: scenario → `Equal: placing unchanged`.
- T1: `grep -c "next hand tool" src/ui/hud.ts src/ui/legend.ts` → `1` each; `grep -n "1-0 - =" src/ui/hud.ts src/ui/legend.ts docs/PLAN.md` → 3 lines; `grep -n "Magnet Gun → Plow Tractor" docs/PLAN.md` → 1 line; `grep -c "tool wheel (hold Tab)" src/ui/shop.ts src/ui/hud.ts` → `0`.

### Assumptions (numbered)
1. Batch 1 (`plan-hud-right-stack.md`, D) is finished in `player.ts` before this plan starts (observed 13:42: `coneTargets`, `ballCap`, no `beam`). If it is not, step 2 touches the same `const left` / `if (!lvl('magGun'))` lines; the same implementer does both in sequence, batch 1 first.
2. Gear stays unsaved (`2026-10-19-broom-tractor.md`, 1 day old); G12 re-arms the gun at boot instead.
3. `GEARS` icons reuse the wheel's current emoji; `TOOL_ICONS` stays in hud.ts for the hotbar.
4. `lmbBlocked = true` on every switch is harmless for the blower (it blows only while LMB is held after a release) and the tractor (ignores LMB).
5. After a rebirth with Keep Tools the tractor and blower stay owned (`KEEP_TOOL_IDS` lists them) while the Magnet Gun does not (Magnet tab, not listed), so the gun is put away by the existing "upgrade gone → hands" line (G11). This plan does not change `KEEP_TOOL_IDS`.
6. No one is editing `wheel.ts`, `sweeper.ts`, `legend.ts` now (mtimes 01:54 / older); `player.ts`, `shop.ts`, `gnomes.ts` were modified at 13:41-13:42 by batch 1.

### Alternatives rejected
- (a) Keep "hands = gun when owned" and add a "holster" toggle key: rejected, a fifth state next to the gear cycle, and PP asked for the gun on the wheel with Hands.
- (b) Wheel keeps the placeables past the 10th (mixed wheel): rejected, contradicts "rzeczy do postawienia 1-0, narzedzia pod tab", and the 11th tool would be the only placeable in the wheel.
- (c) Second hotbar page (Shift+digit): rejected, new UI state and a hotbar redraw for one tool.
- (d) Separate `gun` id with a map to `magGun`: rejected, three places would need the map (`lvl`, `firstUse`, `KEEP_TOOL_IDS`).

### Ladder
- `GEARS` table + `owned()` (rung 2/5, reuse of `ORDER`; spec "narzedzia pod tab w tym rece": C and Tab must list the same four).
- `grabs` getter (rung 5; replaces four `=== 'hands'` checks that would otherwise each need `|| === 'magGun'`).
- `TOOL_KEYS` + guard (rung 5; spec "rzeczy do postawienia 1-0" with 11 placeables; open decision 1).
- `setGear` in shop buy and main boot (rung 5 each; spec silent, open decisions 2-3; keeps today's "the gun is ready once bought").
- Deleted: `kind`/`count`/`enabled` on `WheelItem`, `.wslice .c`/`.off` CSS, the three "tool wheel (hold Tab)" branches, the LMB `firstUse('magGun')` line (rung 1).
- No new dependency, no new file.

### Open decisions (for PP)
1. Gdzie idzie 11. narzędzie do postawienia (Cleaning Robot), gdy koło pokazuje tylko narzędzia ręczne? a) klawisze `-` i `=` za zerem (robot pod `-`, 12 slotów, hotbar pokazuje `-`), wtedy wszystko stawia się z klawiatury; b) koło zostawia narzędzia do postawienia od 11. w górę, wtedy robot jest jedynym stawianym w kole; c) druga strona hotbara (Shift+cyfra), wtedy nowy stan UI. (rekomendacja: a, zero nowego UI, jedna tabela klawiszy; plan zakłada a; „b" zmienia krok 4 i usuwa `TOOL_KEYS`).
2. [spec silent] Zakładam: kupno Magnet Gun od razu bierze go do ręki i pokazuje toast „C or hold Tab switches between hands and the gun." | Dowód: dziś `lvl('magGun')` w `gunPulling`/`updateGun` uzbraja pistolet w chwili zakupu, bez tej linii po zakupie nic się nie zmienia | Jeśli źle: PP kupuje pistolet i dalej ma puste ręce, aż naciśnie C | Pewność: Likely | rekomendacja: a) auto-wyposażenie przy zakupie.
3. [spec silent] Zakładam: po wczytaniu zapisu z kupionym pistoletem gracz startuje z pistoletem w ręce (jedna linia w `main.ts`) | Dowód: `2026-10-19-broom-tractor.md` „gear: not saved (a new game starts with hands)", a wczorajszy build startował z pistoletem, bo ręce = pistolet | Jeśli źle: po każdym odświeżeniu strony trzeba nacisnąć C, żeby mieć pistolet | Pewność: Likely | rekomendacja: a) start z pistoletem, gdy kupiony; b) zapisywać `gear` w stanie (zmiana formatu zapisu, odrzucone w planie).
4. [spec silent] Zakładam: gołe ręce z kupionym pistoletem mają zasięg i stożek jak przed zakupem (bez +0.6 m za Coil, wąski stożek) | Dowód: `magReach` i `minDot` w player.ts czytają `lvl('magGun')`; dziś ręce = pistolet, więc ta ścieżka nie istniała | Jeśli źle: ręce ciągną za daleko/za szeroko albo za słabo względem oczekiwań PP | Pewność: Confident | rekomendacja: a) jak przed zakupem.
5. [spec silent] Zakładam: wybranie w kole narzędzia, które już trzymam (np. 🧲 w trakcie stawiania wiatraka), anuluje stawianie i zostawia narzędzie | Dowód: wheel.ts `if (it.id === 'hands') pl.cancelPlacement()` + `setGear` z early-return | Jeśli źle: duch wiatraka zostaje po zamknięciu koła | Pewność: Confident | rekomendacja: a) koło zawsze anuluje stawianie.
No decision older than 60 days is used (all cited notes are from 2026-10-19/20).

PP (2026-10-20): "Robot niech bedzie na kole wyboru" → decision 1 = b (the wheel keeps placeables from the 11th up; robot stays on Tab; no `-`/`=` keys). Decisions 2-5: PP was told the recommendations (gun in hand after purchase, C/Tab switch, bare hands as before the gun) and did not object → a.

### Self-check
- Every matrix row has a step and a Done-when line: G1-G13 → steps 1, 2, 6, 7; W1-W6 → 4, 5; K1-K4 → 2, 3, 5, 6; T1 → 5, 7, 8. Done-when lines: 24 = matrix rows (13 + 6 + 4 + 1).
- Every step names the file, the exact expression or text and the value (`GEARS`, `grabs`, `TOOL_KEYS` 12 entries, toast strings, `setGear` body).
- Fields written: `sweeper.gear` (writer `setGear`; all readers in Reach), `swarm`/`held` (emptied by `setGear` through `release()`), `placing` (cancelled by `setGear`), `lmbBlocked` (writer `setGear`, reset in `actions`). No saved field changes.
- Lists compared with code: gears (3 → 4), `lvl('magGun')` readers (8), `sweeper.gear` readers (12), `TOOL_IDS` readers (7), key texts (4 places). 5 `spec silent` rows, each in Open decisions.
- No decision older than 60 days.
- Plan vs code: the change is about 60 edited lines across 8 files; this plan is longer because of the matrix and texts, not because of code in markdown.

## Review: impact (plan-impact)

Verdict: CONCERNS

Missing from the plan:
- [Medium] `src/ui/shop.ts` `buy()` runs while the shop is open (`open()` sets `ctx.paused = true`), and `main.ts:276` ticks the HUD with `ctx.hud.update(realDt)` even when paused. When PP buys the gun, step 6 calls `setGear('magGun')` → `firstUse('magGun')` pushes `magGun` into `seenHints` and the hint plays out behind the shop overlay (inference: the overlay covers the hint). Step 2 also deletes the LMB `firstUse('magGun')` fallback (`player.ts:526`), so the player never sees the gun hint. Fix: in `buy()` switch the gear without the hint and show it on shop close (or on the first LMB with gear `magGun`, keeping the line at `:526` with `gear === 'magGun'`); add a G13 check that the hint is visible after `shop.close()`.
- [Medium] Scratchpad scenarios assume "gun owned = hands pull a swarm": `scenario-gun-pull.js` (batch 1's own D1-D13 check), `scenario-magnet-gun.js`, `line1-ball.js`, `probe-ball.js`, `probe-sparks.js`, `diag-mg.js`, `zz-mg-diag.js`, `scenario-volley-tricks.js`, `scenario-tree.js`, `scenario-tree-shots.js`, `scenario-skill-tree.js`, `scenario-prereqs*.js` set `magGun` and never call `setGear`. After this plan they test plain hands (one gnome), so batch 1's regression check fails, or passes on the wrong path. `scenario-wheel.js:94-96` reads `item.enabled` / `item.count` and expects placeable slices (B1-B8). Fix: in Tests, add `g.player.setGear('magGun')` after the upgrade line in the gun scenarios and rerun `scenario-gun-pull.js`; retire or rewrite `scenario-wheel.js` B-rows that test tool slices.
- [Medium] Ordering against batch 2 of `2026-10-20-plan-hud-right-stack.md:412` is not stated. Batch 2 edits `hud.ts`, `style.css`, `shop.ts`, `legend.ts`, `player.ts` and `docs/PLAN.md`, the same files as steps 2, 5, 6, 7 and 8 here. Assumptions 1 and 6 order this plan only after batch 1. If two implementers run them at once, they overwrite each other's edits. Fix: in Assumption 1, say "after batch 1 and before/after batch 2, never in parallel", and name which one goes first.
- [Low] `docs/PLAN.md:84` says "Cleaning Robot ... placed from the tool wheel". Step 8 updates rows 28/31/33/34 only, and T1 does not grep line 84. Fix: add `-` key there.
- [Low] G3 "behave exactly like hands before the purchase" holds for reach and cone only. Pull acceleration `player.ts:666` and grip `:721` keep the Coil bonus for hands. That is consistent with `2026-10-19-magnet-gun.md:60` ("for hands and gun"), so no code change is needed. Reword G3 so the implementer does not "fix" the acceleration.

Callers checked (all in the plan): `setGear` (wheel.ts:75, player.ts:396/833/857, +shop, +main), `selectTool` (hotkeys, wheel.ts:72 removed, G key player.ts:584 → keeps the gun, fine), `sweeper.next()` (player.ts:832 only), `lvl('magGun')` in player.ts 186/192/526/534/600/765, hud.ts:349, wheel.ts:80 (8, matches the plan), `TOOL_IDS` index readers hud.ts:170-171/324-326, shop.ts:214-217, player.ts:827. `cancelPlacement` external callers (shop.ts:162, blueprints.ts:79, legend.ts:126) do not touch gear, so they are not affected. `swarm.length` readers in gnomes.ts:256/418 get 0 sooner after a switch, which is harmless.

Neighbours checked: sweeper gear/C: affected, in the plan (steps 1-2) | wheel: affected, in the plan (step 4); `scenario-wheel.js` not (above) | hotbar/HUD keys: affected, in the plan (step 5, hud.ts:326) | hints/first-use: affected, shop path above | legend: affected, in the plan (legend.ts:21-23); `:17` "many with the Magnet Gun" still true | help text: in the plan (hud.ts:151) | shop buy toast: in the plan (shop.ts:214-217) | blueprints: not affected (only `cancelPlacement`, no gear) | tractor/blower: in the plan (`setGear` now drops on every switch; tractor → hands already blocked LMB) | pound (J): not affected (`pound.update` reads `gear === 'tractor'` only, player.ts:441) | fuses E sites + lever: not affected (E branch player.ts:567-573 does not read gear) | Keep Tools rebirth: not affected (`hole.ts:520` copies `KEEP_TOOL_IDS` without `magGun`, then `location.reload()` at `:529`, so the boot line in step 7 sees `magGun = 0`) | replay: not affected (`replay.ts` reads no gear/gun/wheel) | save/load: not affected (gear not saved; `seenHints` ids unchanged; daily run uses `freshState()` so boot keeps hands) | contracts: not affected (`contracts.ts:143` tractor only) | boot order: OK (`ctx.hud` main.ts:79 and `ctx.player` :93 exist before `restore` :104).
FE/BE: none (single-page game, no backend).
Decisions: consistent with `2026-10-19-broom-tractor.md` ("gear: not saved"); consistent with `2026-10-19-magnet-gun.md:23` ("Hands (no purchase) still carry one thing") and `:60`; supersedes `2026-10-20-robots-wheel-blower.md` (placeables on the Tab wheel, robot from the wheel) and `2026-10-20-tool-hints-fall.md:3` (Tab wheel replaced mouse-wheel tool cycling) with PP's own new words from 2026-10-20, so consistent.
Decisions older than 60 days: none (all cited notes are from 2026-10-19/20).
Regression vs current behaviour: the wheel no longer shows the free/owned count or the "all placed" deny for a tool. The hotbar slot `.c` (`hud.ts:326`) still shows the count, and the digit key still denies through `selectTool`, so nothing is lost. Switching gun → hands now drops the swarm (today it stays in the air); this change is intended (step 2, G1).

## Review: performance (plan-performance)

Verdict: APPROVE

Cost here = work per frame (player `update`, HUD `update`) and DOM rebuilds (`innerHTML`). Read from code at 2026-10-20, not profiled.

| plan step | operation | shape | multiplicity | volume | cost | severity |
|---|---|---|---|---|---|---|
| 2 | `hotkeys()` loop over `TOOL_KEYS` | 12 `inp.hit` set lookups (today 10) | every frame | 12 keys | +2 lookups/frame | none |
| 1, 2 | `sweeper.owned()` / `next()` | filter of 4 entries + `lvl` | on C press only | 4 | negligible | none |
| 4 | `ToolWheel.build()` | `GEARS.filter` (4); drops the per-tool `ctx.machines.available(id)` loop (11 tools x `list.filter`) | once per Tab open | 4 | cheaper than today | none |
| 5 | wheel render key `wh.items.map(...)` | while open: string of 4 ids (today up to 14 items with count/enabled) | every frame while Tab held | ≤4 | cheaper; `innerHTML` rebuild still only on key change (index move) | none |
| 2 | `coneTargets()` / `magReach` gated by gear | `forEachNear` with the hand reach and narrow cone when gear = hands | on LMB press (grab branch line 535-542), not per frame | gnomes near the player | smaller radius with hands than today's gun-owned path | none |
| 5 | HUD `const gun = gear === 'magGun' && !h` → `p.ballGnomes` | `swarm.filter().map()` | every frame, only with the gun in hand | ≤ `ballCap` | same as today, skipped with hands | none |
| 2, 6, 7 | `setGear` → `dropAll()` + `cancelPlacement()` | `release()` per swarm gnome | per gear switch (C / Tab release / buy / boot) | ≤ `ballCap` | one-shot, not per frame | none |
| 5 | hotbar key `TOOL_IDS.map(lvl + machines.available)` | 11 x `list.filter` over placed machines | every frame | unchanged by this plan | unchanged | none |

Findings: none.

No findings on: hotkeys loop, `owned()`/`next()`, wheel `build()` and render key, gear-gated cone and reach, HUD gun panel, `setGear` drop on switch (one-shot), boot and shop `setGear` (once), `TOOL_KEYS` length guard (module load, once). The hotbar key's per-frame `available()` scan is existing code this plan does not touch.

## Review: roast (plan-roaster)

Verdict: CONCERNS (no Critical, no Major; two Minor findings feed open decisions 5 and 1)

Steel-man: The plan makes the Magnet Gun a gear with the same id as its upgrade. This removes the hidden rule "hands = gun once owned", which is the root of PP's complaint. The existing "upgrade gone → hands" line, `firstUse` and `lvl` keep working without a mapping table. Strengths: one `GEARS` list feeds both C and Tab, so the two can never disagree. One `setGear` rule (drop, cancel, block LMB) covers all four gears, and today's gun → hands leak, where the swarm stayed in the air, goes away. `e.code` key codes make `Minus`/`Equal` work on any layout. The length guard makes a 12th/13th tool fail loudly instead of silently having no key.

Scenarios checked explicitly:
- Switch mid-carry (gun ball full, C or Tab to hands/tractor). Breaks the plan: no. `setGear` → `dropAll()` → `release()` drops every swarm gnome through `ctx.gnomes.drop` (player.ts:632-637), so the hole-fall rule is kept. `lmbBlocked` stops a re-grab while LMB is still held, and `actions` clears it only on release (player.ts:524-525). `hotkeys` runs after `actions` in the same frame (player.ts:400-403), so nothing touches a dropped body later in that iteration.
- Placing + gear switch (C while the ghost is out, Tab while placing). Breaks the plan: no, `setGear` cancels placement. `selectTool` with gear `magGun` skips `setGear`, and `updateGun` hides the gun through `!this.placing` (player.ts:192). See Minor 1 for the Tab tap.
- E on fuses with the gun out. Breaks the plan: no. The E branch (player.ts:565-572) and the prompt (hud.ts:396) read no gear. `raycast` skips only held bodies (player.ts:496), so a full ball does not hide the tool from E.
- Old saves. Breaks the plan: no. Gear is not saved. `TOOL_IDS` order is unchanged (11 entries: box ... robot, upgrades.ts:101, `NOT_PLACEABLE` drops crateSize/robot*/fuses), so `placed` restore is untouched. The only writer of `upgrades.magGun` is `shop.buy` (shop.ts:210). Rebirth reloads the page (hole.ts:529), so the boot line sees the post-rebirth state.
- Robot off the wheel. Breaks the plan: no. The wheel was the only way to place a robot from scratch. `Minus` replaces it, and G (player.ts:581-585) still calls `selectTool('robot')`. Input uses `e.code` (input.ts:15-16), the physical key, so the Polish Programmers layout and the plain Polish layout both send `Minus`/`Equal`.
- Same event twice (C mashed, Tab tapped during switch). Breaks the plan: no, `setGear` returns early on the same gear.
- Empty state (nothing owned). Breaks the plan: no. W2 gives one slice and C gives the toast.

Findings:
- [Minor] A quick Tab tap during placement now cancels the placement.
  Assumption: W5 covers only an explicit pick of the current gear.
  Scenario: PP is placing a fan with gear `magGun` and taps Tab out of habit, without moving the mouse. The cursor stays inside `DEAD` (24 px), so `index` stays on the current gear. On release the wheel runs `pl.cancelPlacement(); pl.setGear('magGun')`, and the ghost disappears. Today a tap is a no-op: the open index is `pl.placing` and `if (pl.placing !== it.id)` skips it (wheel.ts:56-57, 71-72).
  Checked: wheel.ts:53-75 (DEAD zone keeps `index`, release path); plan step 4.
  Impact: the habit "Tab = tools" from yesterday's build silently kills the ghost mid-placement.
  Recommendation: add to open decision 5 "a tap inside the dead zone also cancels". Alternative: cancel only when `cursor.length() > DEAD`.
- [Minor] When all four gears are owned, going from the gun back to hands with C takes 3 presses through the tractor and the blower.
  Assumption: C is a usable way back to hands.
  Scenario: gun, tractor and blower are owned, gear is `magGun`. C gives tractor (the camera lifts 0.4 m, sweeper.ts:56-58), C gives blower, C gives hands. Each step drops whatever is held. Tab is one flick, so the spec is still met.
  Checked: plan G5 order `hands → magGun → tractor → blower`; sweeper.ts:69-73 `next()`.
  Impact: PP plays fast and his literal complaint was "nie mogę przełączyć magnesu na ręce". With C that switch stays slow.
  Recommendation (optional): none required. Keep it as a sentence in the PP summary, so PP knows Tab is the fast path.
- [Minor] Assumption 4 is wrong: the blower ignores `lmbBlocked`.
  Scenario: PP pulls a full ball with LMB held, holds Tab and releases on 🍃. The ball drops, and the same frame `Sweeper.update` blows it away, because `blow = gear === 'blower' && active && mouse.left` (sweeper.ts:85) never reads `lmbBlocked`.
  Checked: sweeper.ts:85, player.ts:96/524 (`lmbBlocked` is read only in `actions`/`gunPulling`).
  Impact: harmless and arguably fun, but the plan states a guarantee the code does not give. Fix the assumption text; no code change is needed.
- [Minor] The help in the main menu still describes the old gun.
  Scenario: menu.ts:107 says "your magnet grabs one gnome (the Magnet Gun from the shop grabs lots)" and does not mention C/Tab. T1 lists hud.ts, legend.ts and PLAN.md only.
  Checked: `grep -n "Magnet Gun" src/ui/menu.ts` → line 107.
  Recommendation: add "· switch with C or hold Tab" there, or note that the text is still true.
- [Minor] Hotbar labels `-`/`=` are hard-coded. On the plain Polish (214) layout the physical `Minus` key prints `'`, and `Equal` prints `+`. The key works, but the label lies.
  Checked: input.ts:15-16 uses `e.code` (works); plan `TOOL_KEYS` labels are literals.
  Recommendation: none if PP uses the Polish Programmers / Polish Pro layout (see Investigate first).
- [Minor] The `throw` at module load ships in the release build. A future 13th placeable then gives a white screen to the player instead of a dev error. `npm run build` does not run it (type-check only).
  Checked: plan step 3; CLAUDE.md "Run" (`build` = type-check + `dist/`).
  Recommendation (optional): `if (import.meta.env.DEV)` around the throw, or accept it because the smoke run catches it.

Not repeated here (already in plan-impact): the hint shown behind the shop on buy, gun scenarios that never call `setGear`, ordering against batch 2, PLAN.md:84.

Pre-mortem: A week later PP writes "the gun keeps disappearing" or "I grab only one gnome". The assumption that breaks first is that PP notices which gear he holds. Every switch now drops the ball. C passes through plain hands on every lap. Plain hands look like the old pre-gun magnet, with a narrow cone and no Coil reach. The signal to watch is the gun view model sliding out: it is the only cue, and it is 0.2 s at the screen edge. If PP reports this, decide first between a stronger cue (the HUD sack label already switches between `MAGNET GUN` and `MAGNET`) and "C toggles gun ↔ hands only". Do not add more gears to the cycle.
Inversion worth considering: do less. Keep the placeables on the wheel as well (b in open decision 1 widened to all tools) and only add Hands as a separate slice. Rejected by PP's own words "rzeczy do postawienia 1-0, narzędzia pod tab", so none to act on.
Investigate first: which macOS keyboard layout PP uses (Polish Pro / Programmers → `-`/`=` labels are right; plain Polish → labels are wrong).

## Plan (plan-senior, final)

Status: needs-decision (one `[spec silent]` item: the shape of C; everything else is settled, see "Decisions for PP")

PP's own decisions already in this file: decision 1 = **b** ("Robot niech bedzie na kole wyboru": the wheel keeps placeables from the 11th up, no `-`/`=` keys), decisions 2-5 = a. The final plan below is v0 rebuilt on top of 1 = b; the `TOOL_KEYS` table, the boot guard and every `-`/`=` text are gone.

**File set and order (never two implementers on one file):** this plan edits `src/player/sweeper.ts`, `src/player/player.ts`, `src/player/wheel.ts`, `src/ui/hud.ts`, `src/ui/shop.ts`, `src/main.ts`, `src/ui/legend.ts`, `src/ui/menu.ts`, `docs/PLAN.md`, `docs/ai-work/2026-10-20-gear-wheel.md`. It does NOT touch `src/data/upgrades.ts` or `src/ui/style.css`. It starts after batch 1 of `2026-10-20-plan-hud-right-stack.md` hands back (`player.ts`, `gnomes.ts`, `shop.ts`, `upgrades.ts`), runs alone, and hands back before the shop restyle (`2026-10-20-plan-shop-computer.md`: `shop.ts`, `style.css`) and before batch 2 of the HUD plan (`hud.ts`, `style.css`, `shop.ts`, `legend.ts`, `player.ts`, `docs/PLAN.md`). Shared files: `shop.ts` with the restyle; `hud.ts`, `shop.ts`, `legend.ts`, `player.ts`, `docs/PLAN.md` with batch 2. Batch 2 (left column) must keep the gear line from step 5 (it is now on for every gear, see H1).

### Resolutions
- R1: PP decision 1 = b vs v0 steps 3-6 (`TOOL_KEYS`, `-`/`=`, boot guard): Decision: wheel = owned hand tools first, then owned placeables from `TOOL_IDS[10]` on (today's `kind: 'tool'` slices with `free/owned` and the greyed `off` state stay). Rationale: PP's words override v0's assumption a; the hotbar (`i < 10`), the buy toast `key >= 10` branch (`shop.ts:215-216`) and `firstUse` `i >= 10` (`hud.ts:171`) are already right for an 11th tool and stay untouched, so `upgrades.ts` and `style.css` drop out of the file set. Checked: `wheel.ts:84-88`, `hud.ts:171`, `shop.ts:215-217`.
- R2: roaster pre-mortem ("the gun keeps disappearing", "I grab only one gnome") + roaster [Minor] "gun → hands takes 3 presses" vs v0 G5 (C cycles four gears): Decision: **C toggles the two magnet gears** (`hands ↔ magGun`); from the tractor or the blower C goes back to the magnet (`magGun` if owned, else `hands`); the tractor and the blower are taken from the Tab wheel only. Rationale: PP's literal complaint is the hands ↔ gun switch, and a 4-cycle makes the way back 3 presses with a camera lift in between (`sweeper.ts:56-58`); a cycle also makes C from the gun land on plain hands by habit (today C = tractor), which is the pre-mortem. The 4-cycle's argument "C reaches the tractor" loses to "hold Tab" (one flick, the way PP asked for hand tools: "narzedzia pod tab"). `next()` stays the name (it is still "what C gives"), 4 lines, no new state. This is a product rule: it goes to "Decisions for PP" as `[spec silent]` with recommendation a.
- R3: brief "make the current gear obvious": Decision: the gear line above the hotbar (`hud.ts:132-133`, today tractor/blower only) shows for every gear whenever more than one gear is owned, text `<GEAR>` + detail + ` · C: <what C gives>` derived from `sweeper.next()`, so the indicator can never disagree with the key. Rationale: the roaster's own cue (`MAGNET GUN` vs `MAGNET` in the sack panel) is a 4-letter difference in the corner; the gear line is centred, already styled, and costs 2 `lvl` lookups per frame. Hidden when only hands are owned (no noise before the first purchase). Checked: `hud.ts:367-373`, `style.css:45,55` (gear line at `bottom:112px` centred, sack panel bottom-left, hotbar bottom-centre: no overlap).
- R4: impact [Medium] hint played behind the shop on buy (roast refers to it, counted once): Decision: accepted. `Hud.firstUse` returns before `seen.push` when `ctx.paused` (the hint is neither shown nor consumed behind an overlay), and the LMB line `player.ts:526` stays, gated by `this.sweeper.gear === 'magGun'` instead of `lvl('magGun')`, so the first pull after the shop closes shows the hint. Rationale: the alternative "show on shop close" needs the shop to know about gear hints; the pause guard also covers boot (`main.ts:75` starts paused), where step 7's `setGear('magGun')` would otherwise burn the hint behind the menu. Checked: `style.css:161` (`.shop` `z-index: 20`), `style.css:98` (`.hud-hint` no z-index), `main.ts:276` (`hud.update` runs while paused), `hud.ts:165-175`.
- R5: impact [Medium] scratchpad scenarios assume "gun owned = hands pull": Decision: `scenario-gun-pull.js` (batch 1's D1-D13 check) gets `g.player.setGear('magGun')` after the upgrade line and is rerun as part of this plan's tests; `scenario-wheel.js` B1-B8 are folded into W1-W8 of the new scenario. Rejected for the other probes (`diag-mg.js`, `probe-*.js`, `line1-ball.js`, `scenario-tree*.js`, `scenario-prereqs*.js`, `scenario-volley-tricks.js`, `scenario-skill-tree.js`) because they are one-off diagnostics outside the repo (`tools/smoke/` is empty) and nobody reruns them. Checked: `ls tools/smoke` → empty.
- R6: impact [Medium] ordering against batch 2: Decision: accepted, stated in the file-set paragraph above with the order PP gave (batch 1 → this → shop restyle → batch 2) and the shared files.
- R7: impact [Low] G3 wording: accepted. G3 now says "reach and cone as before the purchase; pull acceleration (`player.ts:666`) and grip (`:721`) keep the Coil bonus for hands and gun" (`2026-10-19-magnet-gun.md:60`). No code change.
- R8: roaster [Minor] a Tab tap during placement cancels it: Decision: no change needed, resolved by fact. The wheel opens on `pl.placing ?? pl.sweeper.gear` (`wheel.ts:55-56`); a digit tool (fan) is not in the wheel, so `index = -1` and the release does nothing (`wheel.ts:67`); the robot is in the wheel and `pl.placing === it.id` skips `selectTool` (`wheel.ts:70-71`). W5 (explicit pick of the current gear while placing) still cancels, and that needs a mouse move past `DEAD`. Pinned by W7.
- R9: roaster [Minor] assumption 4 (blower ignores `lmbBlocked`): accepted. Assumption 4 reworded; the behaviour (ball drops, the blower blows it away in the same frame if LMB is still held) is intended and pinned by G8b. Checked: `sweeper.ts:85`.
- R10: roaster [Minor] menu help still describes the old gun: accepted, `menu.ts:107` gets "; <b>C</b> switches between them" (step 7, T1 grep).
- R11: performance APPROVE: nothing to resolve. New per-frame cost from R3: `sweeper.next()` in `Hud.update` = at most 2 `lvl` lookups; `owned()` = a 4-entry filter. Negligible.
- Rejected: roaster [Minor] `-`/`=` labels lie on the plain Polish layout, because the keys are gone (R1).
- Rejected: roaster [Minor] `throw` at module load in the release build, because the guard is gone (R1).
- Rejected: impact [Low] `docs/PLAN.md:84` "placed from the tool wheel", because with 1 = b the sentence stays true.
- Rejected: impact "regression: the wheel no longer shows the free/owned count", because the robot slice keeps it (R1).

### Chosen variant
The Magnet Gun becomes the fourth gear with the same id as its upgrade (`magGun`), listed in one `GEARS` table that feeds C, the Tab wheel and the HUD gear line. C toggles `hands ↔ magGun` and brings you back to the magnet from the tractor or the blower; the wheel shows every owned gear plus the placeables past the tenth (today the Cleaning Robot). Every gear switch drops what is held, cancels placement and blocks LMB until released; placing a tool with the gun out keeps the gun. Pros: one list, no mapping table, PP's two complaints fixed with one key each (C, Tab), the gear line names the gear and what C does. Cons: the tractor and the blower lose their C shortcut (Tab only); gun → hands always drops the ball (hands cannot hold a swarm, so this is the honest rule). Cost: `next()` and `owned()` are 4-entry filters, once per C press / Tab open plus 2 `lvl` lookups per frame for the gear line; the wheel `build()` scans 1 tool instead of 11 (performance table). Risk: the roast's pre-mortem (gear not noticed) is answered by the gear line and by C never landing on hands unless you were holding the gun; the remaining risk is the LMB-held switch to the blower blowing the dropped ball (G8b, intended). Ladder: rung 2 (`ORDER`, `next()`, the gear line, `WheelItem` all reused) and rung 5 for the four new lines (`GEARS`, `grabs`, `owned()`, the pause guard).

### Rejected variant(s)
- (b) v0 as written: C cycles four gears, placeables 11+ on `-`/`=` with a boot guard. Pros: everything on the keyboard, one key table. Cons: PP rejected the keys ("Robot niech bedzie na kole wyboru"); gun → hands is 3 presses through the tractor (camera lift) and blower; C from the gun lands on plain hands by habit, which is the pre-mortem. Rejected because of both.
- (c) Keep "hands = gun once owned" and add a holster key. Pros: smallest diff. Cons: a fifth state outside the gear list, Tab and C would disagree, and PP asked for Hands on the wheel. Rejected because the wheel must list hands as a gear.
- (d) C returns to the *last* magnet gear from the tractor/blower (new `lastGrab` field). Pros: exact memory. Cons: one more state field for the case "I was on plain hands, took the tractor, want plain hands back", which C gives with one extra press anyway. Rejected because "gun if owned, else hands" covers the common case without state.

### Behaviour matrix (final)
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| G1 | gun owned, gear `magGun`, swarm 3 | C | gear `hands`, `gun.visible` false within 0.2 s (`gunShow` 1 → 0), `swarm.length === 0`, LMB ignored until released | spec; R2 |
| G2 | gun owned, gear `hands`, LMB on a gnome | hold LMB | ONE gnome in `held`, `swarm.length === 0`, gun not visible, sack panel `MAGNET · <name>` | spec (hands = plain hands) |
| G3 | gun owned, gear `hands`, 10 gnomes in a 30° fan off-centre | hold LMB | at most one gnome (`gnomeTarget`, narrow cone `0.94 - 0.02 x Dish`), `magReach` = `7 + 1.2 x Dish` (no Coil bonus); pull acceleration and grip keep the Coil bonus | decision 4 = a; R7 |
| G4 | gun owned, gear `magGun` | hold LMB | `coneTargets()` batch into `swarm` as batch 1 left it; `gun.visible` true | batch 1 D1 unchanged |
| G5 | gun, tractor, blower owned, gear `hands` | C, C; Tab → tractor, C; Tab → blower, C | `hands → magGun → hands`; tractor → `magGun`; blower → `magGun` | R2 |
| G6 | nothing owned | C | gear stays `hands`, toast `Buy the Magnet Gun (Magnet tab) to switch hands and gun; the tractor and blower are on the Tab wheel.`, deny sound | today's `next() === null` branch; R2 |
| G7 | gun owned, nothing else | C x2 | `hands → magGun → hands` | R2 |
| G8 | gear `magGun`, swarm 5 | Tab → tractor | `swarm.length === 0`, each gnome `!held` (dropped through `ctx.gnomes.drop`), tractor visible | v0 "setGear drops" |
| G8b | gear `magGun`, swarm 5, LMB still held | Tab → blower, keep LMB | `swarm.length === 0` the same frame, no re-grab while LMB stays held, the dropped gnomes are ragdolled by the blower (`sweeper.ts:85` reads `mouse.left`, not `lmbBlocked`) | R9 |
| G9 | gear `magGun` | key 2 (trampoline owned) | `placing === 'trampoline'`, gear stays `magGun`, `gun.visible` false while placing, true again within 15 frames after Q | v0 "selectTool keeps the gun" |
| G10 | gear `tractor` | key 2 | gear `hands`, placing `trampoline` | today's `selectTool` |
| G11 | gear `magGun` | `state.upgrades.magGun = 0` (rebirth: not in `KEEP_TOOL_IDS`) | next frame gear `hands`, gun slides out | player.ts:396 unchanged |
| G12 | gun owned, fresh page load | boot | gear `magGun` after `restore`; `seenHints` does not gain `magGun` (boot is paused, R4) | decision 3 = a; R4 |
| G13 | gun not owned, shop open | buy Magnet Gun | gear `magGun`, toast `Magnet Gun bought! C or hold Tab switches between hands and the gun.`, `seenHints` without `magGun` while the shop is open; after `shop.close()` the first LMB shows the hint titled `Magnet Gun` | decision 2 = a; R4 |
| G14 | tractor owned, gun not owned | C from hands; Tab → tractor, C | hands: toast G6, gear stays `hands`; tractor: C → `hands` | R2 |
| H1 | gear line | per gear | nothing but hands owned: hidden; gun owned, gear hands: `HANDS · C: Magnet Gun`; gear gun: `MAGNET GUN · C: Hands`; tractor: `TRACTOR · plow 2.6 m · C: Magnet Gun` (or `· C: Hands` without the gun); blower: `BLOWER · 6.0 m · C: Magnet Gun`; tractor owned, no gun, gear hands: `HANDS · hold Tab`. Sack panel shown for hands and gun (`grabs`), hidden for tractor/blower; sack label `MAGNET GUN n gnomes · ball r m` only with gear `magGun` | R3 |
| W1 | gun, tractor, blower, robot owned, 3 digit placeables owned | hold Tab | `wheel.items.map(id)` = `['hands','magGun','tractor','blower','robot']`; robot slice has `count` `free/owned`; no digit placeable slices | decision 1 = b; R1 |
| W2 | nothing owned | hold Tab | one slice `hands`, icon `✋`; with the gun owned the hands slice stays `✋` and the gun slice is `🧲` | spec; R1 |
| W3 | gear `tractor`, hold Tab, release on 🧲 | release Tab | gear `magGun`, `wheel.open === false`, `timeScale` back to 1 | wheel release |
| W4 | placing `fan`, hold Tab, move to ✋, release | release Tab | `placing === null`, gear `hands` | today's B5 |
| W5 | placing `fan`, gear `magGun`, hold Tab, move to 🧲, release | release Tab | `placing === null`, gear `magGun` | decision 5 = a |
| W6 | wheel open | highlight | `.wslice.on` = current gear on open, or the robot while placing it; `.off` only on a sold-out robot | today's open index rule |
| W7 | placing `fan`, gear `magGun`; placing `robot` | Tab tap, no mouse move | fan: `index === -1`, release changes nothing (`placing === 'fan'`, gear `magGun`); robot: `index` = robot slice, release changes nothing (`placing === 'robot'`) | R8 |
| W8 | gear `magGun`, robot owned | hold Tab, release on 🤖 | `placing === 'robot'`, gear stays `magGun`, `gun.visible` false while placing | R1 + "selectTool keeps the gun" |
| K1 | `box..blackhole` owned (10) | keys 1-0 | `selectTool(TOOL_IDS[i])` as today; hotbar `k` = `1..0` | spec "Rzeczy do postawienia 1-0" |
| K2 | robot owned (`TOOL_IDS[10]`) | hotbar, buy | hotbar slot `k` empty; buy toast `Cleaning Robot bought! Open the tool wheel (hold Tab) to place it.`; first-use hint `hold <b>Tab</b> · LMB place ...`; no `Minus`/`Equal` binding | decision 1 = b |
| T1 | help box (H), legend (L), menu "How to play", `GEAR_KEYS`, PLAN.md | open | C line, Tab line, menu LMB line, tractor/blower hints updated as in step texts; `1-0` lines unchanged | spec (keys listed to the player); R10 |

Lists compared with code: gears 3 → 4 (`ORDER`); `lvl('magGun')` readers player.ts 186/192/526/534/600/765, hud.ts 349, wheel.ts 84 = 8, all in steps 2, 3, 5 (`:526` stays, gated by gear); `sweeper.gear` readers unchanged from v0 (contracts.ts:143 untouched); `next()` callers: hotkeys + new HUD gear line.

### Steps (edit order)
1. `src/player/sweeper.ts` — `export type Gear = 'hands' | 'magGun' | 'tractor' | 'blower';` `export const GEARS: { id: Gear; label: string; icon: string }[] = [{ id: 'hands', label: 'Hands', icon: '✋' }, { id: 'magGun', label: 'Magnet Gun', icon: '🧲' }, { id: 'tractor', label: 'Plow Tractor', icon: '🚜' }, { id: 'blower', label: 'Leaf Blower', icon: '🍃' }];` `const ORDER = GEARS.map((g) => g.id);` `owned(): Gear[] { return ORDER.filter((g) => g === 'hands' || lvl(g)); }` `get grabs(): boolean { return this.gear === 'hands' || this.gear === 'magGun'; }` `next()` body: `if (this.gear === 'magGun') return 'hands'; if (lvl('magGun')) return 'magGun'; return this.gear === 'hands' ? null : 'hands';` with the comment `// C: hands ↔ Magnet Gun; from the tractor or the blower C goes back to the magnet (gun if owned). null = nothing to switch to; the tractor and blower are taken from the Tab wheel.` `update()` unchanged. Red: G5, G7, G14 (scenario `C cycle`).
2. `src/player/player.ts` — `gunPulling`: `this.sweeper.gear === 'magGun' && !this.held && inp.mouse.left && inp.locked && !this.placing && !this.lmbBlocked`; `updateGun`: `const show = this.sweeper.gear === 'magGun' && !this.placing;`; `actions`: `const left = inp.mouse.left && this.sweeper.grabs && !this.lmbBlocked;` `if (left && inp.mouse.leftPressed && this.sweeper.gear === 'magGun') ctx.hud.firstUse('magGun');` `if (!lvl('magGun'))` → `if (this.sweeper.gear === 'hands')`; `magReach`: `(this.sweeper.gear === 'magGun' ? 0.6 * lvl('magPower') : 0)`; `minDot`: `this.sweeper.gear === 'magGun' ? Math.cos(...) : 0.94 - ...`; `hotkeys` C toast: `Buy the Magnet Gun (Magnet tab) to switch hands and gun; the tractor and blower are on the Tab wheel.`; `selectTool`: `if (!this.sweeper.grabs) this.setGear('hands');`; `setGear` body: `if (gear === this.sweeper.gear) return; this.dropAll(); this.cancelPlacement(); this.lmbBlocked = true; this.sweeper.gear = gear; ctx.hud.hideHint(); if (gear !== 'hands') ctx.hud.firstUse(gear);` comment `// Any switch drops what is held and cancels placement; LMB waits for a release.`; `lmbBlocked` comment `// after a gear switch LMB does nothing until released`. Digit loop unchanged. Red: G1-G4, G8, G8b, G9, G10, G11.
3. `src/player/wheel.ts` — import `GEARS` from `./sweeper` (keep `TOOL_IDS`, `UPGRADE_BY_ID`, `TOOL_ICONS`); `build()`: `const items: WheelItem[] = GEARS.filter((g) => g.id === 'hands' || lvl(g.id)).map((g) => ({ id: g.id, kind: 'gear', label: g.label, icon: g.icon, enabled: true }));` then `for (const id of TOOL_IDS.slice(10)) { ...today's tool slice... }` with the comment `// hand tools first, then the placeables past the tenth (no digit key)`; release: `else { pl.cancelPlacement(); pl.setGear(it.id as Gear); }` (drop the `if (it.id === 'hands')`); open index line unchanged. File header: `// GTA-style tool wheel: hand tools (hands, Magnet Gun, tractor, blower) and the placeables past the tenth.` Red: W1-W8.
4. `src/ui/shop.ts` — after `s.stats.bought++`: `if (id === 'magGun') { ctx.player.setGear('magGun'); ctx.hud.toast('Magnet Gun bought! C or hold Tab switches between hands and the gun.', 'good'); }`; the `key >= 10` / `key >= 0` toasts unchanged. Red: G13.
5. `src/ui/hud.ts` — import `GEARS` from `../player/sweeper`; `firstUse`: `if (ctx.paused || seen.includes(id)) return;` with the comment `// behind an overlay (shop, menu, boot) the hint is neither shown nor used up`; `GEAR_KEYS`: `magGun: '<b>C</b> or hold <b>Tab</b> · <b>hold LMB</b> pull · release <b>LMB</b> drop · <b>RMB</b> throw'`, `tractor: 'hold <b>Tab</b> · <b>WASD</b> drive · <b>C</b> back to the magnet'`, `blower: 'hold <b>Tab</b> · <b>hold LMB</b> blow · <b>C</b> back to the magnet'`; help box: `<b>C</b> hands / Magnet Gun · <b>hold Tab</b> tool wheel (hands, Magnet Gun, tractor, blower, tools past the 10th)`; sack panel: `const gun = p.sweeper.gear === 'magGun' && !h;` `this.sackEl.style.display = p.sweeper.grabs ? '' : 'none';`; gear line: `const gear = p.sweeper.gear; const nxt = p.sweeper.next(); const label = (g: Gear) => GEARS.find((x) => x.id === g)!.label; const detail = gear === 'blower' ? ` · ${p.sweeper.blowRange.toFixed(1)} m` : gear === 'tractor' ? ` · plow ${p.sweeper.plowWidth.toFixed(1)} m` : ''; const gl = p.sweeper.owned().length > 1 ? `${label(gear).toUpperCase()}${detail}${nxt ? ` · C: ${label(nxt)}` : ' · hold Tab'}` : '';` `this.gearEl.style.display = gl ? '' : 'none';` comment `// gear line above the hotbar: which hand tool is out and what C gives (hidden until a second gear is owned)`. Hotbar, wheel render, `firstUse` key text unchanged. Red: H1, G2, G13.
6. `src/main.ts` — after `ctx.machines.restore(state.placed);`: `if (lvl('magGun')) ctx.player.setGear('magGun'); // the gun is the default gear once owned (gear itself is not saved)`. Red: G12.
7. `src/ui/legend.ts` — `['C', 'hands / Magnet Gun; back to the magnet from the tractor or blower']`, `['hold Tab', 'tool wheel: hands, Magnet Gun, tractor, blower, tools past the 10th']`; `1-0` row unchanged. `src/ui/menu.ts:107` — `your magnet grabs one gnome (the <b>Magnet Gun</b> from the shop grabs lots; <b>C</b> switches between them)`. Red: T1.
8. `docs/PLAN.md` — rows LMB (`hands: ONE thing; the Magnet Gun is a hand tool taken with C or the Tab wheel`), C (`hands ↔ Magnet Gun; from the tractor / blower back to the magnet`), Tab (`hand tools: hands, Magnet Gun, tractor, blower; then placeables past the 10th`); `1-9, 0` row and line 84 unchanged. Note `docs/ai-work/2026-10-20-gear-wheel.md` (Problem / Summary / Work progress, with the rejected list from this section). Red: T1.

### Tests
Headless scenario `scenario-gear-wheel.js` in the session scratchpad `smoke/` (template `scenario-wheel.js`; dev server 5199, `?lowfx`), through `window.gnome`:
- G1-G4, G7: `state.upgrades.magGun = 1`, 10 gnomes in a 30° fan 5 m ahead; `player.setGear('magGun')`, LMB 20 frames → `swarm.length >= 2`, `gun.visible`; C → gear `hands`, sample `player['gun'].position.y` over 12 frames (rule 12: at least one value strictly between the rest y and rest y - 0.3, monotone down), `gun.visible === false` by frame 15, `swarm.length === 0`; LMB still held 5 frames → `held` null (blocked); release + LMB 20 frames → `held.gnome` set, `swarm.length === 0`; `player.magReach === 7 + 1.2 * magRange`; C → `magGun`, C → `hands`.
- G5, G6, G14: `tractor = blower = 1` with the gun → C sequence `hands, magGun, hands`; `setGear('tractor')` + C → `magGun`; `setGear('blower')` + C → `magGun`; all zero → toast text, gear `hands`; `tractor = 1, magGun = 0` → C from hands: toast, gear `hands`; `setGear('tractor')` + C → `hands`.
- G8, G8b: gun, swarm 5, `setGear('tractor')` → `swarm.length === 0`, every gnome `!held`; again swarm 5 with LMB held, `setGear('blower')` → `swarm.length === 0` the same frame, `swarm.length === 0` 10 frames later with LMB still held, at least one of the 5 ragdolled.
- G9, G10: `trampoline = 1`; gear `magGun`, key 2 → placing, gear `magGun`, `gun.visible` false; Q → `gun.visible` true within 15 frames; gear `tractor`, key 2 → gear `hands`.
- G11: `magGun = 0` with gear `magGun` → next frame gear `hands`.
- G12: save with `magGun = 1`, reload → gear `magGun` after boot, `seenHints` without `magGun`.
- G13: `money = 1000`, `shop.open()`, DOM click `[data-buy="magGun"]` → gear `magGun`, toast text, `seenHints` without `magGun`; `shop.close()`, LMB press → `.hud-hint .h-title` text `Magnet Gun`, opacity > 0 within 5 frames.
- H1: per gear read `.hud-gear` `textContent` and `display`; `.hud-sack` display for all four gears.
- W1-W8: `robot = 1`, Tab held 30 frames → `wheel.items.map((i) => i.id)`; DOM `.wslice` count equals items, robot slice has `.c`; `.on` index = current gear; mouse 100 px to a slice; release → gear / placing; placing + release on ✋ / 🧲 / 🤖; Tab tap (no move) while placing fan and while placing robot → nothing changes.
- K1, K2: `Digit1..Digit0` → `placing`; robot slot `.k` text `''`; `shop.buy('robot')` toast contains `Open the tool wheel (hold Tab)`; `Minus` → `placing` unchanged.
- T1: the grep lines below. One screenshot of the open wheel with five slices at the peak of the pop and one of the gear line with the gun out, checked by eye.
- Rerun `scenario-gun-pull.js` (batch 1 D1-D13) after adding `g.player.setGear('magGun')` after its upgrade line (R5).

### Review focus
1. Tab tap during placement must be a no-op for a digit tool (`index -1`) and for the robot (same id) → pinned by step 3's test W7.
2. Buying the gun with the shop open: the hint must not be used up behind the overlay and must show on the first LMB after close → pinned by step 5's test G13.
3. Boot with the gun owned starts paused: `setGear` at boot must not consume the hint or toast → pinned by step 6's test G12 (`seenHints` check).
4. Switch to the blower with LMB held and a full ball: the ball drops and the blower may blow it the same frame; no re-grab → pinned by step 2's test G8b.
5. Rebirth with Keep Tools keeps the tractor but not the gun: boot must land on `hands` (not tractor, not gun) → pinned by step 6's test G12 variant `tractor = 1, magGun = 0` → gear `hands`.

### Done when
All lines run locally (dev server 5199, headless scenario, grep), never prod.
- G1: scenario → `C: gear=hands gunShow samples [1, 0.7x, 0.4x, ..., 0] visible=false at frame<=15 swarm=0 held=null while LMB held`.
- G2: scenario → `hands+LMB: held.gnome=<id> swarm=0 panel="MAGNET · ..."`.
- G3: scenario → `hands reach=<7+1.2*dish> grabbed<=1 of 10`.
- G4: scenario → `magGun+LMB: swarm>=2 gun.visible=true`.
- G5: scenario → `C: hands,magGun,hands; tractor+C=magGun; blower+C=magGun` (changed from v0's 4-cycle by R2).
- G6: scenario → `nothing owned: gear=hands toast="Buy the Magnet Gun (Magnet tab) to switch hands and gun; the tractor and blower are on the Tab wheel."`.
- G7: scenario → `gun only: hands,magGun,hands`.
- G8: scenario → `setGear(tractor) with swarm 5: swarm=0 heldFlags=[false x5] tractor.visible=true`.
- G8b: scenario → `setGear(blower) LMB held, swarm 5: swarm=0 same frame, swarm=0 at +10 frames, ragdolled>=1`.
- G9: scenario → `magGun + key2: placing=trampoline gear=magGun gun.visible=false; Q: gun.visible=true@<=15`.
- G10: scenario → `tractor + key2: gear=hands placing=trampoline`.
- G11: scenario → `magGun=0: gear=hands next frame`.
- G12: scenario (reload) → `boot: gear=magGun seenHints without magGun`; variant `tractor=1 magGun=0` → `boot: gear=hands`.
- G13: scenario → `buy magGun: gear=magGun toast="Magnet Gun bought! C or hold Tab switches between hands and the gun." seenHints without magGun; after close + LMB: hint title "Magnet Gun" opacity>0`.
- G14: scenario → `tractor only: C from hands → toast, gear=hands; tractor + C → hands`.
- H1: scenario → `gear line: hands(no gun)=hidden; hands="HANDS · C: Magnet Gun"; magGun="MAGNET GUN · C: Hands"; tractor="TRACTOR · plow 2.6 m · C: Magnet Gun"; blower="BLOWER · 6.0 m · C: Magnet Gun"; tractor-no-gun hands="HANDS · hold Tab"; sack display hands/gun="" tractor/blower="none"`.
- W1: scenario → `wheel items=hands,magGun,tractor,blower,robot .wslice=5 robot .c="1/1"` (changed from v0 by decision 1 = b).
- W2: scenario → `wheel items=hands icon=✋; with gun: hands=✋ magGun=🧲`.
- W3: scenario → `release on magGun: gear=magGun open=false timeScale=1`.
- W4: scenario → `placing fan, release hands: placing=null gear=hands`.
- W5: scenario → `placing fan, gear magGun, release magGun: placing=null gear=magGun`.
- W6: scenario → `.wslice.on index == items.indexOf(gear); placing robot: .on == robot index`.
- W7: scenario → `tap Tab placing fan: index=-1 placing=fan gear=magGun; tap Tab placing robot: placing=robot`.
- W8: scenario → `release on robot: placing=robot gear=magGun gun.visible=false`.
- K1: scenario → `Digit1..Digit0: placing=<TOOL_IDS[i]> x10; hotbar k=1,2,3,4,5,6,7,8,9,0`.
- K2: scenario → `robot: slot.k=""; toast="Cleaning Robot bought! Open the tool wheel (hold Tab) to place it."; Minus: placing unchanged` (changed from v0 by decision 1 = b).
- K3: `grep -rn "TOOL_KEYS\|more placeable tools than hotbar keys" src` → 0 lines (v0's key table and guard are not shipped; decision 1 = b).
- K4: `grep -rn "'Minus'\|'Equal'" src` → 0 lines (no `-`/`=` bindings; decision 1 = b).
- T1: `grep -c "hands / Magnet Gun" src/ui/hud.ts src/ui/legend.ts` → `1` each; `grep -n "C switches between them" src/ui/menu.ts` → 1 line; `grep -n "back to the magnet" src/ui/hud.ts` → 2 lines; `grep -n "hands ↔ Magnet Gun" docs/PLAN.md` → 1 line; `grep -c "tool wheel (hold Tab)" src/ui/shop.ts` → `1` (the robot toast stays); `npm run build` → exit 0.
- Batch 1 regression: `node smoke.mjs ... scenario-gun-pull.js` (with `setGear('magGun')` added) → D1-D13 PASS.
Count: 30 lines for 26 matrix rows (K3, K4 and the batch 1 rerun are extra checks; G12 and K2 carry two checks each).

### Decisions for PP
1. [spec silent] Zakładam: C przełącza tylko ręce ↔ Magnet Gun, a z traktora i dmuchawy wraca do magnesu (pistolet, jeśli kupiony); traktor i dmuchawę bierze się tylko z koła pod Tab. | Dowód: dziś C krąży ręce → traktor → dmuchawa (`sweeper.ts:69-73`); z czterema narzędziami powrót z pistoletu do rąk to 3 naciśnięcia przez traktor (kamera skacze o 0.4 m), a z przyzwyczajenia C z pistoletem wyrzuci Cię na gołe ręce, które wyglądają jak stary magnes. | Jeśli źle (chcesz, żeby C nadal docierało do traktora): C krąży ręce → pistolet → traktor → dmuchawa, powrót z pistoletu do rąk to 3 naciśnięcia, Tab zostaje szybką drogą; zmienia się tylko 4-linijkowe `next()` i teksty podpowiedzi. | rekomendacja: a) przełącznik ręce ↔ pistolet, traktor i dmuchawa pod Tab.
Nothing else: decisions 1-5 are already answered by PP in this file (1 = b, 2-5 = a); no decision older than 60 days is used (all cited notes are from 2026-10-19/20).

PP (2026-10-20): "klawisz c -> obecne narzedzie rece i tyle tab do zmiany narzedzia". Final rule for C (replaces R2's "back to the magnet"): C toggles between the CURRENT tool and bare hands. Holding any gear other than hands (Magnet Gun, tractor, blower) → C = hands, and the game remembers that gear as `lastGear`. On bare hands → C = `lastGear` (the tool you had before; if none yet, the Magnet Gun if owned, else nothing). Choosing a gear on the Tab wheel sets it and `lastGear`. Tab is the only way to change which tool. The HUD gear line shows the C target from the same rule (e.g. `LEAF BLOWER · C: Hands`, `HANDS · C: Leaf Blower`).

### v0 → final
- added: C as a hands ↔ gun toggle with "back to the magnet" from the tractor/blower (R2); gear line for every gear with the C target (R3, H1); pause guard in `firstUse` + LMB hint line kept (R4, G12/G13); W7, W8, G8b, G14 rows and tests; `menu.ts` text (R10); `scenario-gun-pull.js` rerun with `setGear` (R5); file set and order against batch 1, the shop restyle and batch 2 (R6).
- dropped: `TOOL_KEYS`, `-`/`=` keys, the boot guard, the `upgrades.ts` and `style.css` edits, the wheel's `kind`/`count`/`enabled` deletion (PP decision 1 = b); the 4-gear C cycle (R2).
- moved to PP: one `[spec silent]` item, the shape of C (recommendation: toggle). Decisions 1-5 from v0 are closed by PP's own words in this file.
