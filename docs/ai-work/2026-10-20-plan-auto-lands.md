# Plan: auto-lands (the yard grows by itself with the hole level, always in the factory → hole direction)

Spec: PP, Slack via hub 2026-10-20 23:00: "11 land kupuje się automatycznie a raczej zmienia ci kilka poziomów dziury." PP, terminal 2026-10-20: "te landy jak bedziesz robil automatyczne to pamietaj aby zawsze mapa powiekszala sie w jednym kierunku tj w strone fabryka -> dziura -> wiekszy land zawsze w tamtym kierunku nie ze trzeba szukac gdzies dziury za domem." BOARD question 5 (hole 15-27 m from the factory, hand-only play ~5 h) unanswered: `spec silent`.
Trivial check: touches the save format (`land`, `version`, `placed` filter), the hole position formula read by 10 call sites, the yard bounds read by 9 files, the shop, goals and achievements.

## Plan v0 (plan-author)

### Goal
Land is no longer bought: at hole level 3 / 5 / 8 the yard becomes Garden / Neighbour's Lawn / Dark Forest by itself, the fence grows only forward and to the right (the factory → hole direction), and the hole always sits on the one straight line from the factory, further out with every land and level.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | level-up with no land change (1→2, 3→4, 5→6, 6→7, 8→12) | `Hole.levelUp` | `state.land` unchanged; hole moves 1.2 m further along DIR; 0.25 s tool glide and toast as today; `env.sliding === false` | today's behaviour, `hole.ts:234-255` |
| 2 | level-up 2→3 | `Hole.levelUp` | `state.land` 0→1; yard = x,z ∈ [-22, 42]; hole slides 1 s from DIR·2.4 to DIR·6.4 (dust, rumble, shake on arrival); tools ≤ 1.5 m from the old rim glide with it keeping their rim distance against the level-3 radius; tools under the new hole shrink away, toast "The hole moved! Tools in its way went back to your inventory." | spec "zmienia ci kilka poziomów"; `land.ts:15` hole 3; slide `environment.ts:408-418` |
| 3 | level-up 4→5 | same | land 1→2; yard [-22, 66]; hole DIR·12.8 | `land.ts:16` hole 5 |
| 4 | level-up 7→8 | same | land 2→3; yard [-22, 94]; hole DIR·20.4; achievement `land` ("Landlord") unlocks within 1.5 s | `land.ts:17` hole 8; `achievements.ts:40` |
| 5 | level-up while a land slide is still running (crate dump chain) | `Hole.levelUp` | `finishSlide()` first, then rule 1 or 2 for the new level; no exception | existing guard `hole.ts:237` |
| 6 | any land L, any level n | `Environment.holeCenterFor(n, L)` | centre = (0,0) + DIR · (4·L + 1.2·(n−1)), DIR = normalize(7.5, 13); distance from the factory (−7.5, −13) = 15 + 4·L + 1.2·(n−1); inside that land's rectangle by ≥ radius + 2 m; ≥ 8 m from desk (7.5, −13), house (0, −27.5), shovel (−20.4, 20.6) | PP "zawsze w tamtym kierunku"; today's anchor distances 15/19.2/23/26.7 m (`land.ts:11`) |
| 7 | level 12 on Dark Forest | formula | hole (12.6, 21.8), radius 6, inside [-22, 94] by 66 m, 35 m from the desk | row 6 |
| 8 | new game, rebirth, daily | `freshState` | `land` 0, Backyard [-22, 22]², hole (0,0): identical to today; Keep Tools filter (`hole.ts:523`, Backyard square) unchanged | `state.ts:77`, `hole.ts:506-528` |
| 9 | old save (`version` 1) with `land` < landFor(`holeLevel`), e.g. level 5, land 0 | `loadState` | `land` = 2; yard and hole at the formula spot; no money change | spec "automatycznie" |
| 10 | `spec silent` old save (`version` 1) with `land` ≥ 1 (bought) | `loadState` | money += sum of `LAND[1..land].cost` once (max $49 500), toast "Lands now come with the hole level: $X refunded."; save written as `version` 2; second load: no refund | precedent `state.ts:118-129` (Wind-up, Broom refunds) |
| 11 | old save with placed tools now outside the rectangle (e.g. z < −22 behind the house, Garden bought symmetric) or inside the new hole | `main.ts:104` restore | those tools are not placed (stay owned, count in the inventory); one toast "The yard changed shape: N tools went back to your inventory."; the rest restored | precedent `blueprints.ts:153` (skip tools in the hole), `hole.ts:521-524` |
| 12 | shop open | render | no LAND tab; "AVAILABLE: n" and tab counts exclude lands; no `land0..3` NEW badges | spec "kupuje się automatycznie" |
| 13 | legend L → Mechanics | render | land table: Land / Size / Hole level, no Price column; row of the current land highlighted | `legend.ts:219-220, 239` |
| 14 | goal milestone index 7 (today "Buy the Garden") | reach level 5 | text "Reach hole level 5: the yard grows into the Neighbour's Lawn", target 5 on `holeLevel`, reward $300, arrow to the hole; index unchanged so old saves' `goal` keeps meaning | `goals.ts:40` |
| 15 | `spec silent` every reader of the yard size (gnome walk/flee/teleport/parade targets, greedy escape to the nearest fence, crate kicked out → desk respawn, placement BLOCKED outside, robot out-of-yard/waypoint clamp/A* grid, tornado path, rain/bloom/UFO/visitor spawn points, prop spawn, fence walls/posts/rails, forest ring, fog) | any land ≥ 1 | all use the rectangle `env.min`/`env.max`; `env.half` no longer exists, so `npx tsc --noEmit` proves no site was missed | PP "mapa powiększa się w jednym kierunku"; call sites in Reach |
| 16 | `spec silent` hole distance per land (BOARD q5) | formula | 4 m per land, today's 15/19/23/27 m; one constant `LAND_STEP` | `land.ts:11` |
| 17 | `spec silent` daily challenge (`?daily`) | 5-min run | same code path: starts land 0, switches at level 3 if reached; no separate handling | no `land` in `daily.ts` |
| 18 | `spec silent` blueprint LOAD | K → LOAD | unchanged: places relative to the hole, skips tools in the hole, no fence check (as today) | `blueprints.ts:137-153` |
| 19 | `spec silent` trampoline `0.6·1.25^land`, combo cap `+0.5·land` | land switch | unchanged formulas; they now rise at level 3/5/8 by themselves | `machines.ts:723`, `hole.ts:56` |

### Reach
- `state.land` writers today: `shop.ts:262` (deleted), `state.ts:77` fresh, `state.ts:136` load spread, `hole.ts:510` rebirth via `freshState`. After: `state.ts` load (set to `landFor(holeLevel)`), `hole.ts levelUp`, `freshState`. Readers (unchanged): `hole.ts:56`, `machines.ts:723`, `legend.ts:220`, `shot.ts:70`, `achievements.ts:40`, `goals.ts:40` (rewritten), `environment.ts:189,337`, `shop.ts` (deleted).
- `Environment.holeCenterFor` callers: `environment.ts:149` (tuft/mushroom exclusion), `:213` rebuildHole, `:409` rebuildLand. `LAND[i].anchor` readers: `environment.ts:190` only → field deleted.
- `env.half` readers (all become `env.min`/`env.max` or a helper): `gnomes.ts:419, 470, 560, 632, 675, 683-684, 761, 773, 792, 797, 808-810`; `machines.ts:637, 658`; `player.ts:966`; `props.ts:48`; `robots.ts:150, 166, 272-274, 387-389, 436, 457-461` (+ the `lim` cell test below 461); `tornado.ts:86, 139-141`; `events.ts:76-77, 183-184, 256-259, 282-284`; `environment.ts:338-354` walls, `:357-381` fence, `:387-392` forest ring and house gap, `:342-343` fog, `:427-432` edgePoint. `hole.ts:523` uses `LAND[0].half` (Backyard square) and stays.
- Hole movers: level-up (`hole.ts:234`), land slide (`environment.ts:408`), load (`rebuildHole` in the constructor, slide no-op), blueprints (read `env.hole` live), daily (fresh state).
- Things on the old map when the hole or fence moves: machines via `Hole.carry` (crates and robots excluded, `hole.ts:264`); crates out of the yard → desk respawn (`machines.ts:658`); robot post steps out of the hole itself (`robots.ts:156-160`), robot out of the yard → post (`robots.ts:166`); props spawn fresh each boot (`props.ts:47`); mushrooms/coins spawn inside the current bounds.
- Secret letters (added 2026-10-21, `2026-10-21-secret-letters.md`): `LETTER_SPOTS` in `src/data/letters.ts` must be re-picked for the rectangle, and the letter fence rule in `props.ts` (`Math.max(|x|, |z|) > env.half + 1`) and the tree keep-out around the spots in `rebuildLand` move to `env.min`/`env.max`; L0 and L21 in `tools/smoke/scenario-letters.js` are the proof.
- Shop tab removal: `upgrades.ts:1` `Tab` union, `shop.ts:8, 148-149, 154, 199, 256-268, 316, 320-347, 353`, `icons.ts:21-22` (`TAB_ICONS.Land`, `LAND_ICONS`).
- Texts: `holeLevels.ts:31, 33, 36` ("land: Garden" → "the yard grows: Garden"), `data/achievements.ts:25` ("Buy all the land." → "Reach the Dark Forest."), `goals.ts:40`, `legend.ts:220, 239`, `docs/SPEC.md` (Dziura kotwice, Sklep zakładki, Ziemie), `docs/PLAN.md:47-52, 79, 89`, `CHANGELOG.md` (new top section, memory rule).
- Front/API: none (static SPA). Save file: `version` 1 → 2, `land` kept as a cache of `landFor(holeLevel)`, `placed` filtered on load.
- File overlaps with other agents (brief): `robots.ts` (6 lines here: sequence after that agent or hand them the lines), `hole.ts` (balance batch 10a edits `consume`; this plan edits `levelUp` + import), `events.ts` (balance batch; this plan edits 4 spawn-point lines), `environment.ts` is dirty in the working tree from the grass-shadow session (lines 17-25, 434-445; this plan edits other regions): the implementer waits for that commit before touching the file.

### Data
- No database. `localStorage` save `gnome-boozed-save-v1`: fields touched `version`, `land`, `money` (refund), `placed` (filtered on load).
- Cost: `clampTo`/`inside` are 4 comparisons, same as today's `Math.abs` clamp, run per gnome per decision (≤ 320 gnomes). Robot yard-wide grid: (max−min)/0.5 cells = 232² on Dark Forest, identical to today's 2·58/0.5. No new per-frame work.

### Steps (edit order)
1. `src/data/land.ts` — delete `anchor` from `LandTier` and the four tiers; add `export const LAND_STEP = 4;` (m the hole moves out per land) and `export function landFor(level: number): number` = highest `i` with `LAND[i].hole <= level`. Keep `half`, `hole`, `name`, `cost` (cost now only for the refund).
2. `src/world/environment.ts` — replace `half = 22` with `min = new THREE.Vector2(-22, -22)` (constant, the Backyard corner behind the factory and house) and `max = new THREE.Vector2(22, 22)`; `rebuildLand` sets `max.set(2·half − 22, 2·half − 22)`; add `inside(x, z, margin = 0): boolean`, `clampTo(v: THREE.Vector3, margin: number): THREE.Vector3` (x and z in place), `randomPoint(margin: number, y = 0): THREE.Vector3`; `edgePoint()` picks a point on one of the four rectangle sides with margin 1.5. `holeCenterFor(level, land)` = `new Vector3(0,0,0).addScaledVector(DIR, LAND_STEP·land + 1.2·(level−1))`, `const DIR = new THREE.Vector3(7.5, 0, 13).normalize()`. Walls, posts, rails from `min`/`max`; forest ring = outside the rectangle by ≥ 3 m within 40 m, house gap `Math.abs(x) < 10 && z < min.z && z > min.z − 12`; fog `near = longer side + 15`, `far = longer side + 180`; tuft exclusion = one segment `holeCenterFor(1, 0)` → `holeCenterFor(12, 3)` < 6.8 m; `rebuildLand`'s carry call gets `newR = holeLevel(ctx.state.holeLevel).radius` (the hole may grow in the same move, row 2).
3. `src/systems/hole.ts` `levelUp` — after `s.holeLevel++`: `const land = landFor(s.holeLevel); if (land !== s.land) { s.land = land; ctx.env.rebuildLand(); } else { ctx.env.rebuildHole(); /* existing carry + toast */ }`; keep shake, burst, shockwave, `hud.levelUp`, king, Deep toast, `saveState` as they are. Import `landFor`.
4. `src/core/state.ts` — `freshState`: `version: 2`. `loadState`: `const land = landFor(parsed.holeLevel ?? 1)`; `if ((parsed.version ?? 1) < 2 && (parsed.land ?? 0) > 0) { refund = LAND.slice(1, parsed.land + 1).reduce(sum cost); parsed.money += refund; loadNotes.push(\`Lands now come with the hole level: ${money(refund)} refunded.\`) }`; returned object: `land`, `version: 2` after the spread.
5. `src/main.ts:104` — before `restore`: `const keep = state.placed.filter((p) => ctx.env.inside(p.x, p.z, 0.5) && !(ctx.env.holeDist(p.x, p.z) < ctx.env.holeRadius + 0.6 && p.y < 1.5)); if (keep.length < state.placed.length) ctx.hud.toast(\`The yard changed shape: ${n} tools went back to your inventory.\`, 'info'); state.placed = keep;` (same predicate as `blueprints.ts:153`).
6. Yard readers (rows 15): `gnomes.ts` drop the `half` parameter of `decide`/`fleeFrom`, use `env.clampTo(target, 1.5 | 2)`, `env.randomPoint(3, 0.6)`, parade `clampTo(…, 2)`, greedy escape = nearest of the four fence lines from `min`/`max` (margin 0.5); `machines.ts:658` and `robots.ts:166` → `!env.inside(x, z, −0.5)`; `player.ts:966` → `!env.inside(centre.x, centre.z, 0.5)`; `props.ts:48` → `randomPoint(3, 0.5)`; `robots.ts:272-274, 387-389` → `env.clampTo(wp, 1.3)`; `robots.ts:436` margin = `Math.max(max.x − min.x, max.z − min.z)`; `buildGrid` bounds from `min`/`max`, blocked cells where `!env.inside(x, z, 1.3)`; `tornado.ts` L = half the shorter side − 2, `clampTo(pos, 1)`; `events.ts` rain `randomPoint(2, rand(14, 24))`, bloom `randomPoint(3)`, visitor `env.edgePoint()`, UFO `randomPoint(5, 12)`.
7. Shop: delete `'Land'` from `Tab` (`upgrades.ts:1`), from `TABS`, `TAB_ICONS`, `LAND_ICONS`, `buyLand`, `landItems`, the `[data-land]` click/hover branches, `unlockedIds` land part, `affordCount` land branch, the `tab === 'Land'` list branch.
8. Texts: `goals.ts:40` → `abs("Reach hole level 5: the yard grows into the Neighbour's Lawn", 5, () => ctx.state.holeLevel, 300, 'hole')`; `data/achievements.ts:25` desc "Reach the Dark Forest."; `holeLevels.ts:31/33/36` "the yard grows: Garden" / "…Neighbour's Lawn" / "…Dark Forest"; `legend.ts:219-220, 239` drop the price cell and header.
9. `tools/smoke/scenario-auto-lands.js` (harness of `scenario-esc.js`: `step`, `frames`, `window.__done`), see Tests.
10. `docs/SPEC.md` (Dziura: hole line and distances; Sklep: tabs without LAND; Ziemie: automatic at 3/5/8, rectangle growth, why), `docs/PLAN.md:47-52, 79, 89`, `CHANGELOG.md` top section, `docs/ai-work/2026-10-20-auto-lands.md` work note.

### Tests
Headless, dev server `npx vite --port 5199 --host 127.0.0.1`, `CDP_PORT=9373 node tools/smoke/smoke.mjs <scratchpad>/auto-lands tools/smoke/scenario-auto-lands.js`; `g = window.gnome`. Each step returns `ok=true …`.
- `01_formula`: for land 0..3, level 1..12: `|cross(c − factory, DIR)| < 0.01`, distance from the factory = 15 + 4L + 1.2(n−1) ± 0.05, `env.inside(c.x, c.z, radius + 2)` for that land's rectangle, ≥ 8 m from desk/house/shovel (rows 6, 7, 16).
- `02_levelup_garden`: `g.state.holeLevel = 2`, fan A placed at `holeCenterFor(3, 1)`, fan B 1 m outside the level-2 rim; `g.state.holeXp = g.hole.xpNeeded − 1`, `g.hole.consume(gnome)`; sample `env.hole` for 12 frames: distance from the start strictly increasing, arrival ≤ 1.5 s at the formula spot, `env.max.z === 42`, `env.min.z === −22`, fan A gone from `machines.list`, fan B rim distance 1.0 ± 0.3 against radius 2.4, toast text in the HUD, one screenshot at the slide's mid frame (rows 2, 15 fence).
- `03_levelup_plain`: level 3→4: `state.land` still 1, hole moved 1.2 ± 0.05 m, `env.sliding === false` (row 1).
- `04_lawn_forest`: 4→5 and 7→8: `land` 2 then 3, `max` 66 then 94, hole at DIR·12.8 then DIR·20.4; `achievements` includes `land` within 1.5 s (rows 3, 4); then a dump-driven double level-up during the slide: no exception (row 5).
- `05_bounds`: on Garden: placement ghost at (0, 0, 30) not blocked, at (0, 0, −23) blocked; gnome teleported to (0, 0.6, 40) has a walk target with `env.inside(t, 1.4)` after 2 s; crate kicked to z = −25 respawns by the desk; robot post at (0, 0, 30), gnome at (0, 0.6, 38): `stats.gnomesEaten` +1 within 40 s; tornado started: `pos` inside for 60 frames (row 15).
- `06_old_saves` (write localStorage, `location.reload`, wait for `window.gnome`): (a) `{version:1, holeLevel:5, land:0, money:100, upgrades:{fan:2}, placed:[fan at (−24,0,−30), fan at holeCenterFor(5,2)]}` → `land` 2, `money` 100, `machines.list.length` 0, toast "The yard changed shape: 2 tools…" (rows 9, 11); (b) `{version:1, holeLevel:8, land:3, money:0}` → `money` 49500, note shown, saved `version` 2, reload again → still 49500 (row 10); (c) `{version:2, holeLevel:8, land:3, money:0}` → 0.
- `07_fresh_daily`: `?daily` → `land` 0, `max` (22, 22), hole (0, 0) (rows 8, 17).
- `08_shop_legend_goal`: shop open: no `[data-tab="Land"]`, title count equals the sum of the other tabs; legend Mechanics: land table header has 3 cells; `state.goal` at index 7 completes when `holeLevel` reaches 5 and `money` +300 (rows 12, 13, 14).
- `09_blueprint_tramp`: blueprint SAVE/LOAD on Garden places the same count; trampoline launch speed factor = 0.6·1.25^land at land 1; `hole.comboCap` = 2.5 at land 1 (rows 18, 19).
- Regression: `tools/smoke/scenario-esc.js`, `tools/smoke/scenario-grass.js` pass; `npx tsc --noEmit` clean (row 15 proof).

### Done when
1. `03_levelup_plain → ok=true land=1 moved=1.2 sliding=false`
2. `02_levelup_garden → ok=true land=1 max=42 arrived<=1.5 fanA=gone fanB=1.0 toast=1`
3. `04_lawn_forest → … land=2 max=66 hole=DIR*12.8`
4. `04_lawn_forest → … land=3 max=94 hole=DIR*20.4 ach=land`
5. `04_lawn_forest → … chain=ok exceptions=0`
6. `01_formula → ok=true rows=48 offline=0 margin>=2 far>=8`
7. `01_formula → L12/land3=(12.6,21.8)`
8. `07_fresh_daily → ok=true land=0 max=22 hole=(0,0)` and `npx tsc --noEmit` (rebirth filter untouched)
9. `06_old_saves a → land=2 money=100`
10. `06_old_saves b → money=49500 version=2 second=49500; c → money=0`
11. `06_old_saves a → placed=0 toast="The yard changed shape: 2 tools went back to your inventory."`
12. `08_shop_legend_goal → landTab=0 available=sum`
13. `08_shop_legend_goal → legendCols=3`
14. `08_shop_legend_goal → goal7="Reach hole level 5…" done@5 +300`
15. `npx tsc --noEmit → (no output)` and `rg -n "env\.half" src → (no output)` and `05_bounds → ok=true`
16. `01_formula → dist(land L, level 1) = 15,19,23,27`
17. `07_fresh_daily → ok=true` (daily run)
18. `09_blueprint_tramp → blueprint=same`
19. `09_blueprint_tramp → tramp=0.75 cap=2.5`

### Assumptions (numbered)
1. "Kilka poziomów" = today's unlock levels 3 / 5 / 8 (`land.ts:15-17`), not new thresholds.
2. The yard grows from the fixed corner (−22, −22) toward +x and +z: that is the factory → hole diagonal (DIR = (0.50, 0.87)); the house stays just outside the back fence on every land, as on the Backyard today (`environment.ts:113, 392`).
3. The hole keeps its 1.2 m per level drift and gains 4 m per land (today's distances), so a land switch is a visible 4 m slide, not a jump across the map.
4. `state.land` stays in the save as a cache of `landFor(holeLevel)`; readers untouched.
5. Refund follows the removed-upgrade precedent; detection by `version` 1 + `land` ≥ 1.
6. No fence "grow" animation: the 1 s hole slide with dust and rumble is the cue, as on purchase today (Animation rule 3 satisfied by the slide; the fence rebuild is instant as today).

### Alternatives rejected
- (a) Keep the symmetric square fence and only re-aim the anchors: rejected, PP asked for growth in one direction and the symmetric square puts 36 m of yard behind the house on the Forest.
- (b) Hole position from level only (no per-land step): rejected, the land switch would be invisible except for a fence pop; the slide is the moment the player sees "the yard grew".
- (c) Keep the LAND tab as a read-only tree ("comes at level 3"): rejected, the legend already lists lands with their level; a tab with nothing to buy confuses "AVAILABLE: n".
- (d) Derive land everywhere via a getter and drop it from the save: rejected, 10 readers to edit for no behaviour gain.

### Ladder
- `landFor()` (rung 6, no existing level→tier helper): spec "zmienia ci kilka poziomów dziury".
- `LAND_STEP`, `DIR` (rung 5, one line each) replace four `anchor` tuples (rung 1, delete): "zawsze w tamtym kierunku".
- `env.min`/`env.max` + `inside`/`clampTo`/`randomPoint` (rung 6) replace `half` (delete): "mapa powiększała się w jednym kierunku". `edgePoint()` reused for the visitor (rung 2).
- Level-up reuses `rebuildLand()` slide and `carry` (rung 2).
- Refund via existing `version` field and `loadNotes` (rung 2); load filter reuses the blueprint predicate (rung 2).
- LAND tab, `buyLand`, `LAND_ICONS` (rung 1, delete): "kupuje się automatycznie".
- Scenario file on the existing smoke harness (rung 2). No new dependency.

### Open decisions (for PP, morning; only 1-3 change what the player sees)
1. Collision with the shop: the LAND tab sells lands today. a) remove the tab, the legend (L → Mechanics) keeps the land table with the level it comes at; b) keep the tab as a read-only "coming at hole level N" tree. (recommendation: a, nothing to buy there, and "AVAILABLE: n" would count nothing)
2. [spec silent] Zakładam: a save that paid for lands gets the money back once on load (up to $49 500) | Dowód: `state.ts:118-129` refunds removed upgrades the same way | Jeśli źle: a player who paid $49.5k keeps a yard everyone now gets free, or gets money PP did not want to give | Pewność: Likely | rekomendacja: a) refund, b) no refund (the player keeps what he paid for)
3. [spec silent, BOARD q5] Zakładam: the hole keeps today's distances 15 / 19 / 23 / 27 m from the factory (4 m per land), on one line | Dowód: `land.ts:11` | Jeśli źle: hand-only play stays ~5 h to level 12 (model); one constant `LAND_STEP` changes it (2 m → 15/17/19/21 m) | Pewność: Likely | rekomendacja: a) keep 4 m and judge after the XP-by-feeding change (10a) lands
4. [spec silent] Zakładam: the yard grows from the fixed corner behind the factory and house toward +x and +z, so on the Forest the fence runs from −22 to 94 on both axes | Dowód: DIR = (0.50, 0.87) from `environment.ts:192` | Jeśli źle: PP wanted only "forward" (+z) with the width centred | Pewność: Likely | rekomendacja: a) corner-fixed (literal "one direction")
5. [spec silent] Zakładam: daily challenge uses the same automatic switch (land 0 at start) | Dowód: no `land` in `daily.ts` | Jeśli źle: a 5-min daily run never reaches level 3 anyway | Pewność: Confident | rekomendacja: a) no special handling
6. [spec silent] Zakładam: blueprint LOAD stays as is (relative to the hole, skips tools in the hole, no fence check) | Dowód: `blueprints.ts:137-153` | Jeśli źle: a Forest blueprint loaded on the Backyard can put a tool outside the fence (true today too) | Pewność: Confident | rekomendacja: a) unchanged
7. [spec silent] Zakładam: trampoline `0.6·1.25^land` and combo cap `+0.5·land` keep their formulas and now rise automatically at 3/5/8 | Dowód: `machines.ts:723`, `hole.ts:56` | Jeśli źle: the balance batch wants different numbers | Pewność: Confident | rekomendacja: a) unchanged, the balance batch owns the numbers
8. [decision age] none: every decision this plan rests on is from 2026-10-19/20 (`land-and-balance`, `moving-hole-free-placement`, `plan-land-hole-trampoline-gun`), younger than 60 days.

### Self-check
- Every matrix row has a step and a test: rows 1-5 steps 2-3 / tests 02-04; 6-7 steps 1-2 / 01; 8 step 4 / 07; 9-11 steps 4-5 / 06; 12-14 steps 7-8 / 08; 15 step 6 / 05 + tsc; 16 step 1 / 01; 17 / 07; 18-19 / 09.
- Every step names a file, a signature or a value; no "handle edge cases" lines.
- `state.land`: all writers (3 after the change) and readers (10) listed; `env.half`: 25 sites in 9 files listed, removal enforced by `tsc`.
- Lists compared with code: 4 land tiers = 4 rows in the formula test; `state.land` readers = grep; `env.half` readers = grep; hole movers = 5 paths (level-up, slide, load, blueprints, daily). `spec silent` rows: 6. Done when lines: 19 = matrix rows 19.
- Decisions older than 60 days: none.
- Plan length ≈ the diff it describes (about 14 files, ~200 changed lines); the matrix and the call-site list are the part the implementer cannot derive alone.

## Review: impact (plan-impact)

Verdict: CONCERNS

Missing from the plan:
- [Medium] `src/world/environment.ts:151-166` grass tufts (`rand(-70, 70)` on both axes) and wild mushrooms (`d = rand(10, 70)` around the origin) are spread around (0,0), not around the yard. When the yard becomes the Dark Forest [-22, 94], then the strip x or z in 70..94 has no tufts and no wild mushrooms, and the forest ring beyond it is bare. Today every land, up to the Forest's 58, is covered. Meanwhile about a third of the 4000 tufts land behind the house, outside every fence. Fix: step 2 spreads tufts and wild mushrooms over the Forest rectangle plus the forest ring (`[min − 40, LAND[3] max + 40]`), not over ±70.
- [Medium] `src/ui/legend.ts:238` still says "Bought in the shop (Land tab). A bigger yard holds more gnomes and machines." Step 8 removes only the price cell and header (`:219-220, 239`). When the player opens L → Mechanics, then the legend tells him to buy land in a tab that no longer exists. Fix: add `:238` to step 8 with the new text (for example "Comes by itself at hole level 3 / 5 / 8; the yard grows toward the hole.").
- [Medium] In-flight plan `docs/ai-work/2026-10-20-plan-tutorial-goals.md` (final plan ready, PP answered "9. Od pierwszej minuty, grzybek pewny", BOARD.md:96) replaces both goal arrays in `goals.ts` with id-based lists and keeps the `garden` milestone "unchanged texts, conditions and rewards" (`plan-tutorial-goals.md:32`), meaning `state.land` and "Shop → Land". When that plan ships after this one, then the goal reads "Buy the Garden (Shop → Land)" again, completes by itself at level 3, and its arrow points at the shop. When it ships first, then row 14's argument "index unchanged so old saves' `goal` keeps meaning" no longer holds, because goals use `goalsDone` ids. Fix: name the order in Reach (file overlap `goals.ts`), and whichever plan ships second carries the `garden` → "Reach hole level 5" change.
- [Low] `src/systems/events.ts:276`: the UFO always enters at (80, 30, 0). On the Dark Forest [-22, 94] that point is inside the yard, 30 m up, so the UFO appears out of nowhere instead of flying in from outside the fence. Fix: in step 6, the entry point = `max.x + 22` (outside the fence) on the same z.
- [Low] `src/world/environment.ts:480`: fireflies at `Math.sin(a) * this.half * 0.9` around the origin. They are not in the Reach list and step 6 gives no formula. `tsc` forces an edit but not a correct one. When the land is the Forest, then the fireflies fill [-52, 52] and leave the far half of the yard dark. Fix: centre `(min + max) / 2`, spread `0.45 · (max − min)` per axis.
- [Low] `src/entities/gnomes.ts:508` (despawn when `Math.abs(p.x) > half + 30`) and `:797` read the local `half` from `:470`. `tsc` catches them, but `:508` is missing from the Reach line list. The new rule is "outside `[min − 30, max + 30]`", not `clampTo`.
- [Low] Overlap with `docs/ai-work/2026-10-20-plan-factory-bugs.md` R4 (`:231`). That plan adds a load filter inside `machines.restore` (`machines.ts:457`) for tools under the chute; this plan adds one in `main.ts:104` before `restore`. When both ship, then a save that loses tools to both filters shows a toast counting only this plan's part. The blueprint LOAD path (`blueprints.ts:156` → `restore`) gets R4 but not this filter, which matches row 18. Fix: put this filter next to R4 in `restore` behind a `fromSave` flag, or accept and say so in the plan.
- [Info] Reach line 43 says `environment.ts` is dirty from the grass-shadow session. `git status` now shows it clean (commit 722eb8a), so the wait is no longer needed.

Neighbours checked: draft/live: not affected (no draft split) | profiles / ladder: not affected (no accounts) | serve-cache: not affected (no backend) | auto-regeneration / delete-then-rebuild: affected, because `rebuildLand` (walls, posts, trees re-randomised) and the per-REPLAN robot `buildGrid` now run from `levelUp` inside `Hole.consume` (callers `gnomes.ts:499`, `machines.ts:651`, `:852`, `robots.ts:663`). This is the same context as today's `rebuildHole`, outside Rapier callbacks, so the change is safe | polling / imports: old save load covered (rows 9-11); rebirth affected for the better: `hole.rebirth` reloads the page, so a Keep Tools tool standing where the Backyard hole opens is now caught by the step 5 filter (toast text "The yard changed shape" fits loosely) | find_best / cohort: not affected | dimensions / formulas: affected, trampoline `machines.ts:723` and combo cap `hole.ts:56` covered by row 19 | text index / search: not affected | prompt context: not affected | widget / serving: GitHub Pages static build; when an old tab stays open across a deploy, its autosave writes `version: 1` with that tab's own pre-refund money, so the next load refunds once against that state, never twice | leaderboard (Supabase, in flight): not affected, it submits `totalEarned` and `holeLevel` only (`leaderboard.ts:311`), and the refund changes `money`, not `totalEarned` | daily: not affected, `blockSaves` keeps the daily run off the save | weather: not affected, rain follows the camera (`weather.ts:62, 128`) | offline earnings: removed (`2026-10-20-remove-offline.md`) | shop seen / NEW: the `seen` set is memory-only, so removing `land${i}` needs no migration | screenshot meta `shot.ts:70`: keeps `land`, still valid.
FE/BE: none (static SPA). Save contract: the `version` reader is only `state.ts`; `land` readers are listed in Reach and match grep.
Decisions: consistent with `docs/SPEC.md:42` (PP 2026-10-20, "albo nie losuj i daj je na stałe": fixed, plannable hole spots; the formula keeps them fixed). `docs/ai-work/2026-10-20-land-and-balance.md:29` (per-tier `anchor`) is superseded by PP's N8 order (BOARD.md:75-76), which the plan quotes. Consistent with `2026-10-20-plan-land-hole-trampoline-gun.md` (trampoline and combo per land unchanged).
Decisions older than 60 days: none (the oldest note in `docs/ai-work` is from 2026-10-19).
Regression vs current behaviour: today a land is bought at the desk, away from the hole. Now the 1 s slide fires on the level-up frame, while the player usually stands at the rim. Who stands on the slide path falls in (`player.ts:470` `fellIn`, coin fountain once per level). That is a scenario question for plan-roaster, not a missing caller. No other difference: `levelUp`'s carry, toast, shockwave and save stay on both branches.

## Review: performance (plan-performance)

Verdict: APPROVE

No database here, so "cost" = work per frame, per gnome decision, per level-up, at boot, and save size. All numbers below are computed from the code constants; nothing was timed (no profiler run, per brief).

| plan step | operation | shape | multiplicity | volume | cost | severity |
|---|---|---|---|---|---|---|
| 3 | `rebuildLand()` on a land level-up (walls, fence, forest ring, slide) | 4 wall bodies removed + 4 created; posts InstancedMesh ≤ 4·58+4 = 236; 8 rail meshes; forest ring ≤ 1400 `rand` tries, 700 trees + 300 bushes matrix upload | 3 times per run (levels 3, 5, 8), once per page boot | same tiers as today's purchase | one-frame spike, same work as today's "buy land" click; moves from a shop click to a level-up frame that already does shake + 80-particle burst + shockwave | none |
| 3 | old `fenceGroup.clear()` without `dispose()` | 8 `BoxGeometry` + 1 `MeshStandardMaterial` + 1 posts geometry orphaned per call | ≤ 3 per page session (rebirth does `location.reload()`, `hole.ts:534`) | ~ tens of KB GPU memory per session | negligible; `tex()` is cached (`textures.ts:7`), same material params reuse the compiled program | none |
| 2 | robot A* full-yard fallback `buildGrid(p, goal, 2·half)` → margin = longer side | grid clamped to `min`/`max`, `CELL` 0.5 | per robot replan when the local grid fails (`robots.ts:436`) | Garden 128², Lawn 176², Forest 232² = 53,824 cells | identical to today (64/88/116 m sides, same as today's 2·half) | none |
| 2, 6 | `inside` / `clampTo` / greedy-escape (4 fence lines) | 4 comparisons, same as today's `Math.abs` pair | per gnome decision; per gnome per frame for the out-of-world check (`gnomes.ts:508`, `inside(x, z, −30)`) | ≤ 320 gnomes | unchanged | none |
| 2 | boot tuft/mushroom exclusion `onHolePath` | today: 4 segments × 2 `holeCenterFor` (2 allocations each) per sample; plan: 1 segment | 4000 tufts + 120 mushrooms + rejections, once at boot | ~4100+ samples | ~4× cheaper than today | none |
| 6 | `randomPoint()` returning a new `Vector3` | 1 allocation per call | per gnome wander/teleport, rain/bloom/UFO spawn | same call sites already do `new THREE.Vector3(rand…)` (`gnomes.ts:761, 797`) | unchanged GC pressure | none |
| 2 | fog `near = longer side + 15` | fog only shades, no culling; camera far 900, shadow far 140 unchanged | per frame | — | no draw-call or fill-rate change | none |
| 4, 5 | `loadState` refund + `placed` filter | `LAND.slice(1, land+1)` sum; one `filter` over `placed` with `inside` + `holeDist` | once per load | `placed` = owned placed tools (tens) | O(tools), microseconds; save grows by 0 bytes (`version` 1 → 2) | none |
| 7 | shop LAND tab removal | deletes `landItems`, `affordCount` land branch | per shop render | 4 items fewer | slightly less work | none |

Findings: none.

No findings on: land-switch rebuild (3 per run, same work as today's purchase), GPU leak of the old fence (≤ 3 per session, reload on rebirth), robot grid size (232² on the Forest, identical), per-gnome bounds checks (4 comparisons, unchanged), boot tuft exclusion (cheaper), `randomPoint` allocations (same as today), fog, load-time refund and placed filter, save size, shop render.

Outside this lens (for `plan-impact`, not a cost issue): `environment.ts:480` fireflies read `this.half` and are not in the Reach list (`tsc` will force a choice, centred on (0,0) they cover only part of the Forest yard); tufts and mushrooms are sampled in [−70, 70], so on the Forest the strip 70..94 m has no grass tufts.

## Review: roast (plan-roaster)

Verdict: CONCERNS

Steel-man: The plan turns three shop purchases into three automatic level-up moments and reuses the slide, the `carry` glide and the load-time filter that already exist. It puts every hole spot on one line from the factory, which answers PP's "not behind the house" literally: today the Forest anchor (-24, -34) sits behind the house at z = -27.5. Strong points: `env.half` is deleted, so `tsc` finds every reader. The corner (-22, -22) stays fixed, so the Backyard square, the rebirth filter and the house gap do not move. The double level-up during a slide already has a guard (`hole.ts:237`). Falling gnomes collide with nothing (`gnomes.ts:442`), so gnomes already in the hole are still eaten when it slides away. Old-save land is derived from the level, not trusted.

Findings:
- [Major] When the new hole opens under a crate, the crate teleports in a loop forever and never goes back to the inventory.
  Assumption: row 2 says "tools under the new hole shrink away", so it assumes `carry` covers every placed tool.
  Scenario: Garden switch 2→3. The player placed a crate 1 m past the far rim of the level-2 hole, at DIR·4.2. The new hole covers DIR·4.0..8.8. The slide pulls the ground away, the crate falls in, and `respawn(m.home)` puts it back 1.5 m above the same spot. It falls again a few frames later, and this repeats until a reload. The far side of the hole on the factory → hole line is exactly where the hole now moves on every switch.
  Checked: `hole.ts:264` `carry` filters out `m.type === 'box'`; `machines.ts:424` `home: pos.clone()` is set once at placement, and a grep finds no other writer of a machine `home`; `machines.ts:639-657` an empty crate in the hole goes `respawn(m.home)`. Robots have the step-out (`robots.ts:155-160`), crates have nothing. The step 5 filter fixes it only after a reload.
  Impact: the crate flickers in the hole, the player cannot use it, and it never reaches the inventory.
  Recommendation: in `carry`, give crates the same move as the robot post: if the home lies within `newR + 0.6` of the new centre, push `home` and `pos` radially out of the new rim. The other option is the "gone" branch for crates too. Add a crate to test `02_levelup_garden`. The same bug exists on plain level-ups today with a smaller overlap.

- [Minor] When a level-up comes from a stream of shots (cannon, fans, a thrown salvo), the rest of the salvo lands on grass at 2→3, because the old and new holes do not overlap.
  Scenario: the shift is 5.2 m, and the radii 2.0 + 2.4 = 4.4 are smaller than 5.2. At 4→5 (2.8 + 3.2) and 7→8 the holes overlap. Crate and robot dumps eat their whole load at once (`machines.ts:648-651`, `robots.ts:663`), so only gnomes still in the air miss. Cannons aim at the live hole (`machines.ts:815`). Fans and trampolines further than 1.5 m from the rim stay put.
  Checked: `holeLevels.ts:12-13`, `environment.ts:284` slide lerp.

- [Minor] When the player stands where the hole slides, he falls in and gets the "BLEH" coin fountain once per level (`player.ts:470-496`). It is harmless. The tractor rides with the player, so it is the same path.

- [Minor] The refund can repeat when an old tab that was open during the deploy autosaves after the new build loaded the save.
  Scenario: tab A runs the old build with `version: 1` in memory. Tab B loads the new build, refunds $49 500 and saves `version 2`. Tab A then autosaves `version 1, land 3`. The next load of the new build refunds again. A single reload without a save in between does not double the refund, because loading is idempotent.
  Checked: `state.ts:67` `version: 1`, `state.ts:133-139` spread of `parsed`. This needs two tabs and a single-player save, so the recommendation is to accept it.

- [Minor] After a rebirth with Keep Tools, the step 5 load filter shows "The yard changed shape: N tools went back to your inventory." for tools that stood on the level-1 hole spot (0, 0). On land 1+ that spot is free ground, so tools there are plausible. The rebirth filter (`hole.ts:523`) checks only the square, not the hole, so the load filter catches them with the wrong text.

- [Minor] The test matrix has no row for tools 2-6 m from the rim. Every land switch leaves those contraptions aimed at an empty spot, and today the player picked the moment by buying. This happens 3 times per run, plus the full loss on an old Forest save: every tool around (-24, -34) is outside the new rectangle (x < -22) and goes to the inventory. This is accepted by design, but SPEC.md should say it.

Scenarios checked explicitly:
- State changes mid-step (second level-up during the slide): breaks the plan: no, because `finishSlide` and `finishGlides` run first (`hole.ts:237-238`).
- Level-up inside a gnome loop or `forEachNear`: breaks the plan: no. `rebuildLand` rebuilds only walls, trees and glides, and touches no gnome bodies. None of the `consume` callers sits inside a Rapier query callback (`gnomes.ts:499`, `machines.ts:651`, `:852` `forEachNear` is a plain array loop, `robots.ts:663`).
- Autosave during the slide, reload: breaks the plan: no. The level-up `saveState` runs after `s.land` is set. Tools that are gliding or "gone" are filtered on load by step 5.
- Save at a level boundary or mid-slide: breaks the plan: no, because land = `landFor(holeLevel)` and `rebuildHole` puts the hole at the formula spot.
- Old save with land above its level: cannot happen, because the shop required `LAND.hole`, and the derived land wins anyway.
- Rebirth with tools far away: breaks the plan: no, the square filter at `hole.ts:523` is unchanged, apart from the text in the Minor above.
- Daily: breaks the plan: no. It never saves and starts from a fresh state.
- Robot post under the new hole: breaks the plan: no, the step-out runs every frame and follows the sliding hole (`robots.ts:155-160`).
- Old build reading a `version 2` save: breaks the plan: no. The old spread keeps `version 2`, and it only shows the LAND tab with the lands already owned.

Pre-mortem: A week later PP writes "my crate is stuck jumping in the hole" or "the hole runs away too far, carrying by hand is boring". The crate is the first mechanical break: `carry` was trusted to cover "every tool", and crates were excluded from it on purpose for a different reason. The second is the q5 signal. The 5 h hand-only model on BOARD q5 assumed the player *buys* lands. Today a hand-only player can stay on the Backyard: at level 8 the hole is 15 + 8.4 = 23.4 m from the factory. After the plan it is forced to 15 + 12 + 8.4 = 35.4 m, 51 % further, with no way to opt out.
Inversion worth considering: `LAND_STEP = 0`. The yard still grows ahead of the hole, which is PP's literal request, but the hole only drifts 1.2 m per level, so level 12 sits at 28.2 m instead of 40.2 m. This answers q5 without touching balance. The cost is the one plan-author named: the land switch is only a fence change, not a slide. This is new evidence for open decision 3 (optional before, forced now), not a reopening.
Investigate first: does PP want a land switch every few levels to push the hole away (4 m per land), or only to make room ahead of it? This is open decision 3, and PP should read it with the "forced, no opt-out" numbers above.

## Plan (plan-senior, final)

Status: needs-decision (every step runs on the recommended answers; the implementer builds now, PP's "b" answers in the morning change one constant or one branch)

### Resolutions
- R1: roaster [Major] crate home under the new hole loops forever: Decision: accepted, `Hole.carry` gets a crate branch before the `box` filter: for every crate whose `home` lies within `newR + 1.0` of `newC`, `home` moves radially out to `newR + 1.0` (angle from `newC` to `home`, 0 when coincident), same shape as the robot post rule. Rationale: `carry` knows the final centre, so one push suffices; pushing at `respawn(m.home)` time (variant d) would push against the mid-slide hole and bounce several times. The crate body itself is not teleported: it falls in when the hole arrives and respawns at the pushed home, as today. Covers plain level-ups too (the overlap exists today). Checked: `hole.ts:264` (filter), `machines.ts:424` only `home` writer, `machines.ts:657` respawn, `robots.ts:156-160`.
- R2: impact [Low] load filter overlaps factory-bugs R4 (`machines.restore`) + roaster [Minor] rebirth filter wrong toast text: Decision: v0 step 5 moves from `main.ts` into `machines.restore`, next to R4's factory skip; `restore` returns the number skipped (factory, hole, outside the fence), `main.ts:104` shows one toast "N tools had no room (hole, fence or factory) and went back to your inventory." when > 0. Rationale: one place decides where a saved tool may stand, one count, one text that is right for load, rebirth and old Forest saves; blueprint LOAD (`blueprints.ts:156` → `restore`) ignores the return value as it ignores the hole skip today. Side effect accepted: blueprint LOAD now also skips tools outside the fence (row 18 updated); placing there by hand is BLOCKED anyway (`player.ts:966`). Checked: `machines.ts:457`, `blueprints.ts:153-156`, `hole.ts:523`.
- R3: impact [Medium] tutorial-goals ships first and keeps `garden` as "Buy the Garden (Shop → Land)": Decision: step 8 edits the `garden` entry of `MILESTONES` in its tutorial-goals shape (id `garden` kept, so `goalsDone` of old saves keeps meaning; text, target 5 on `holeLevel`, where `hole`). Rationale: the orchestrator fixed the order (tutorial first); the id is the stable key there, not the index. Assumption: if `goals.ts` still has the old array when this plan runs, edit index 7 instead; same position either way.
- R4: impact [Medium] tufts and wild mushrooms sampled in ±70: Decision: accepted, step 2 samples both over `[-62, 134]` on x and z (Forest rectangle + 40 m ring) and raises the counts to 8000 tufts / 240 mushrooms so density stays at today's level. Rationale: performance's table shows the boot exclusion is now one segment (4× cheaper per sample), so 2× samples still cost less than today; instanced, one draw call.
- R5: impact [Low] fireflies read `this.half`: accepted, centre `(min + max) / 2`, spread `0.45 · (max − min)` per axis (row 22).
- R6: impact [Low] UFO enters inside the Forest yard: accepted, entry `(max.x + 22, 30, 0)` (row 23).
- R7: impact [Low] `gnomes.ts:508` despawn missing from Reach: accepted, rule `!env.inside(x, z, −30)` (row 24).
- R8: impact [Medium] `legend.ts:238` says "Bought in the shop": accepted, folded into row 13, step 8.
- R9: impact [Info] `environment.ts` dirty: accepted, `git status` shows only `src/ui/leaderboard.ts` modified; the wait in Reach is dropped.
- R10: roaster [Minor] tools 2-6 m from the rim and old Forest saves lose their layout: accepted as a SPEC line (step 10) and as Review focus 2; no code.
- R11: roaster pre-mortem `LAND_STEP = 0` vs v0 decision 3: Decision: default stays `LAND_STEP = 4` (today's 15/19/23/27 m); the "forced, no opt-out" numbers go to PP as question 2. Rationale: PP answered BOARD q5 on 2026-10-20 morning ("nikt nie gra samymi rękami → zostaje bez zmian", `BOARD.md:109`); the roaster is right that the premise changed (forced lands, and 10a gives hands x1 XP, machines x0.25), so PP sees it again, but the constant is one line to flip and the slide (PP: "zmienia ci") needs a step > 0.
- R12: v0 open decision 1 (LAND tab): Decision: remove the tab (a). Rationale: "kupuje się automatycznie" leaves nothing to buy; a read-only tree would make "AVAILABLE: n" count nothing, and the legend already lists lands with their level. Not a PP question: it follows from the spec sentence.
- Rejected: roaster [Minor] salvo lands on grass at 2→3, because it costs 1-2 airborne gnomes once per run and the slide is the cue the player watches.
- Rejected: roaster [Minor] player on the slide path falls in, because `fellIn` pays a coin fountain and hurts nothing (`player.ts:470-496`).
- Rejected: roaster [Minor] double refund via a second old-build tab, because it needs two tabs open across a deploy on a single-player save and the loss is PP's money in a free game.
- Rejected: impact's "name the order with physical-loads/balance" beyond Reach line 43, because hole.ts regions differ (`consume` vs `levelUp`/`carry`) and the implementer sequences after the factory-bugs agent on `robots.ts` and `machines.ts` (step 5, 6).

### Chosen variant
v0 with the crate step-out in `carry`, the load filter inside `machines.restore` (one count, one toast), scenery spread over the Forest rectangle, and the `garden` milestone edited by id. Pros: `tsc` proves the `half` removal, the slide and `carry` are reused, one load filter for three reasons, old saves keep their goals. Cons: ~15 files, 3 in-flight overlaps (robots.ts, machines.ts, goals.ts) that force sequencing. Cost: no new per-frame work (performance table); land rebuild 3× per run as today's purchase; boot sampling 8000+240 points on one segment, cheaper than today's 4120 on four. Risk: crate loop (R1, pinned by test 02), old Forest layout loss (accepted, SPEC), hole 35 m at level 8 for hand feeding (PP question 2). Ladder: rung 1-2 for the shop, anchors and slide; rung 5-6 only for `landFor`, `LAND_STEP`, `DIR`, `inside`/`clampTo`/`randomPoint`.
### Rejected variant(s)
- (b) `LAND_STEP = 0` (roaster's inversion): pros: level 12 at 28 m, hand play unchanged; cons: the land switch is a fence pop without a slide, against PP's "zmienia ci" and Animation rule 3's cue; rejected because PP already answered q5 "zostaje" and the step is one constant PP can flip.
- (c) v0 step 5 filter in `main.ts` before `restore`: rejected because with factory-bugs R4 a save would show two counts for one event, the rebirth filter would get the "yard changed shape" text, and blueprint LOAD could still place outside the fence.
- (d) crate step-out at `respawn(m.home)` in `updateCrate`: rejected because the mid-slide hole keeps moving after the push, so the crate bounces 2-3 times before it rests.

### Behaviour matrix (final)
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| 1 | level-up with no land change (1→2, 3→4, 5→6, 6→7, 8→12) | `Hole.levelUp` | `state.land` unchanged; hole 1.2 m further along DIR; 0.25 s tool glide + toast as today; `env.sliding === false` | v0 |
| 2 | level-up 2→3 | `Hole.levelUp` | land 0→1; yard x,z ∈ [-22, 42]; hole slides 1 s from DIR·2.4 to DIR·6.4 (dust, rumble, shake); tools ≤ 1.5 m from the old rim glide keeping rim distance against radius 2.4; tools under the new hole shrink away; toast "The hole moved! Tools in its way went back to your inventory." | v0 |
| 3 | level-up 4→5 | same | land 1→2; yard [-22, 66]; hole DIR·12.8 | v0 |
| 4 | level-up 7→8 | same | land 2→3; yard [-22, 94]; hole DIR·20.4; achievement `land` within 1.5 s | v0 |
| 5 | level-up while a land slide runs (dump chain) | `Hole.levelUp` | `finishSlide()` first, then row 1/2; no exception | v0 |
| 6 | any land L, level n | `Environment.holeCenterFor(n, L)` | centre = DIR · (LAND_STEP·L + 1.2·(n−1)), DIR = normalize(7.5, 13); distance from the factory = 15 + 4L + 1.2(n−1); inside the rectangle by ≥ radius + 2; ≥ 8 m from desk, house, shovel | v0, R11 |
| 7 | level 12 on Dark Forest | formula | hole (12.6, 21.8), radius 6, inside [-22, 94], 35 m from the desk | v0 |
| 8 | new game, rebirth, daily | `freshState` | land 0, Backyard [-22, 22]², hole (0,0); rebirth square filter `hole.ts:523` unchanged | v0 |
| 9 | old save `version` 1, `land` < landFor(level) | `loadState` | land = landFor(level); yard and hole at the formula spot; money unchanged | v0 |
| 10 | `spec silent` old save `version` 1, `land` ≥ 1 | `loadState` | money += sum `LAND[1..land].cost` once (max $49 500), note "Lands now come with the hole level: $X refunded.", saved as `version` 2; second load no refund | v0, PP q1 |
| 11 | save with placed tools outside the rectangle, inside the hole, or inside the factory footprint (R4); rebirth Keep Tools with a tool on (0,0) | `machines.restore` | those tools are skipped (owned, not placed); `restore` returns the count; `main.ts` shows one toast "N tools had no room (hole, fence or factory) and went back to your inventory." | R2 |
| 12 | shop open | render | no LAND tab; "AVAILABLE: n" and tab counts exclude lands; no `land0..3` NEW badges | R12 |
| 13 | legend L → Mechanics | render | land table Land / Size / Hole level (no Price); paragraph "Comes by itself at hole level 3 / 5 / 8; the yard grows toward the hole."; current land highlighted | v0, R8 |
| 14 | `garden` milestone (`MILESTONES` id `garden`, old index 7) | reach level 5 | text "Reach hole level 5: the yard grows into the Neighbour's Lawn", `abs` target 5 on `holeLevel`, $300, where `hole`; id unchanged | R3 |
| 15 | `spec silent` every yard-size reader (gnome walk/flee/teleport/parade, greedy escape, crate out → desk, placement BLOCKED, robot out-of-yard/waypoint/A* grid, tornado, rain/bloom/visitor spawn, props, walls/posts/rails, forest ring, fog) | land ≥ 1 | all use `env.min`/`env.max`; `env.half` gone; `npx tsc --noEmit` clean | v0 |
| 16 | `spec silent` hole distance per land | formula | `LAND_STEP = 4`: 15 / 19 / 23 / 27 m at level 1 | R11, PP q2 |
| 17 | `spec silent` daily (`?daily`) | 5-min run | same path: land 0, switch at level 3 if reached | v0 |
| 18 | `spec silent` blueprint LOAD | K → LOAD | places relative to the hole; skips tools in the hole (as today) and, via `restore`, tools outside the fence or in the factory; no toast | R2 |
| 19 | `spec silent` trampoline `0.6·1.25^land`, combo cap `+0.5·land` | land switch | formulas unchanged, rise at 3/5/8 | v0 |
| 20 | crate whose `home` lies within `newR + 1.0` of the new centre (slide or plain level-up; may be the dumping crate) | `Hole.carry` | `home` moved radially to `newR + 1.0`; crate falls in once when the hole arrives and respawns at the new home; rests there, no second respawn | R1 |
| 21 | boot on any land | scenery | 8000 tufts and 240 wild mushrooms over x,z ∈ [-62, 134] minus the hole path (segment holeCenterFor(1,0)→(12,3), < 6.8 m); Forest strip 70..94 covered | R4 |
| 22 | night on any land | fireflies | centred on `(min + max) / 2`, spread `0.45 · (max − min)` per axis | R5 |
| 23 | UFO event on any land | spawn | mesh enters at `(max.x + 22, 30, 0)`, outside the fence | R6 |
| 24 | gnome beyond `[min − 30, max + 30]` on x or z, or y < −8 | `gnomes.update` | removed | R7 |

### Steps (edit order)
1. `src/data/land.ts` — delete `anchor` from `LandTier` and the four tiers (comment too); `export const LAND_STEP = 4;`; `export function landFor(level: number): number` = highest `i` with `LAND[i].hole <= level`. Keep `half`, `hole`, `name`, `cost`. Test: `01_formula` (rows 6, 7, 16).
2. `src/world/environment.ts` — `min = new THREE.Vector2(-22, -22)` (constant), `max = new THREE.Vector2(22, 22)`; `rebuildLand` sets `max.set(2·half − 22, 2·half − 22)`; `inside(x, z, margin = 0): boolean`, `clampTo(v: THREE.Vector3, margin: number): THREE.Vector3`, `randomPoint(margin: number, y = 0): THREE.Vector3`, `edgePoint()` on a rectangle side with margin 1.5; `static holeCenterFor(level, land = ctx.state.land)` = `new Vector3().addScaledVector(DIR, LAND_STEP·land + 1.2·(level−1))`, `const DIR = new THREE.Vector3(7.5, 0, 13).normalize()`; walls, posts, rails from `min`/`max`; forest ring outside the rectangle by ≥ 3 m within 40 m, house gap `Math.abs(x) < 10 && z < min.z && z > min.z − 12`; fog `near = longer side + 15`, `far = longer side + 180`; tufts `rand(-62, 134)` ×2, count 8000, mushrooms `rand(-62, 134)` ×2 (not polar), count 240, `onHolePath` = one segment `holeCenterFor(1, 0)` → `holeCenterFor(12, 3)` < 6.8; fireflies centre/spread per row 22; `rebuildLand` carry call gets `newR = holeLevel(ctx.state.holeLevel).radius`. Test: `02_levelup_garden` (fence), `01_formula`, `10_scenery`.
3. `src/systems/hole.ts` — `levelUp`: after `s.holeLevel++`: `const land = landFor(s.holeLevel); if (land !== s.land) { s.land = land; ctx.env.rebuildLand(); } else { ctx.env.rebuildHole(); carry + toast as today }`; keep shake, burst, shockwave, `hud.levelUp`, king, Deep toast, `saveState`. `carry`: before the `list` filter, `for (const c of ctx.machines.list) if (c.type === 'box') { const d = Math.hypot(c.home.x − newC.x, c.home.z − newC.z); if (d < newR + 1.0) { const a = d > 1e-3 ? Math.atan2(c.home.z − newC.z, c.home.x − newC.x) : 0; c.home.set(newC.x + Math.cos(a)·(newR + 1.0), c.home.y, newC.z + Math.sin(a)·(newR + 1.0)); } }`. Import `landFor`. Red test: `02_levelup_garden` with the dumping crate at DIR·4.2 → `home` distance from the new centre ≥ 3.4, one respawn, resting after 3 s (row 20); `03_levelup_plain`, `04_lawn_forest` (rows 1-5).
4. `src/core/state.ts` — `freshState`: `version: 2`. `loadState`: `const land = landFor(parsed.holeLevel ?? 1)`; `if ((parsed.version ?? 1) < 2 && (parsed.land ?? 0) > 0) { const refund = LAND.slice(1, parsed.land + 1).reduce((a, t) => a + t.cost, 0); parsed.money = (parsed.money ?? 0) + refund; loadNotes.push(\`Lands now come with the hole level: ${money(refund)} refunded.\`); }`; returned object: `land`, `version: 2` after the spread. Test: `06_old_saves` a, b, c (rows 9, 10), `07_fresh_daily` (rows 8, 17).
5. `src/entities/machines.ts` `restore(placed): number` — after the factory-bugs R4 skip (same loop, sequence after that agent): `continue` also when `!ctx.env.inside(p.x, p.z, 0.5)` or `(ctx.env.holeDist(p.x, p.z) < ctx.env.holeRadius + 0.6 && p.y < 1.5)`; count every skipped tool, return it. `src/main.ts:104`: `const n = ctx.machines.restore(state.placed); if (n) ctx.hud.toast(\`${n} tools had no room (hole, fence or factory) and went back to your inventory.\`, 'info');`. `blueprints.ts:156` unchanged (ignores the return). Test: `06_old_saves` a (row 11), `09_blueprint_tramp` (row 18).
6. Yard readers (row 15, 23, 24; sequence after the factory-bugs agent on `robots.ts`): `gnomes.ts` drop the `half` parameter of `decide`/`fleeFrom`, `env.clampTo(target, 1.5 | 2)`, `env.randomPoint(3, 0.6)`, parade `clampTo(…, 2)`, greedy escape = nearest of the four fence lines (margin 0.5), `:508` → `p.y < -8 || !env.inside(p.x, p.z, -30)`; `machines.ts:658`, `robots.ts:166` → `!env.inside(x, z, −0.5)`; `player.ts:966` → `!env.inside(centre.x, centre.z, 0.5)`; `props.ts:48` → `randomPoint(3, 0.5)`; `robots.ts:272-274, 387-389` → `env.clampTo(wp, 1.3)`; `robots.ts:436` margin `Math.max(max.x − min.x, max.z − min.z)`; `buildGrid` bounds from `min`/`max`, blocked where `!env.inside(x, z, 1.3)`; `tornado.ts` L = half the shorter side − 2, `clampTo(pos, 1)`; `events.ts` rain `randomPoint(2, rand(14, 24))`, bloom `randomPoint(3)`, visitor `env.edgePoint()`, UFO target `randomPoint(5, 12)`, UFO entry `mesh.position.set(ctx.env.max.x + 22, 30, 0)`. Test: `05_bounds`, `npx tsc --noEmit`, `rg "env\.half" src` empty.
7. Shop: delete `'Land'` from `Tab` (`upgrades.ts:1`), `TABS`, `TAB_ICONS`, `LAND_ICONS` (`icons.ts:21-22`), `buyLand`, `landItems`, `[data-land]` click/hover, `unlockedIds` land part, `affordCount` land branch, `tab === 'Land'` list branch (`shop.ts:8, 148-149, 154, 199, 256-268, 316, 320-347, 353`). Test: `08_shop_legend_goal` (row 12).
8. Texts: `goals.ts` `MILESTONES` entry id `garden` → `abs('garden', 'Reach hole level 5: the yard grows into the Neighbour\'s Lawn', 5, () => ctx.state.holeLevel, 300, 'hole')` (if the old array is still there: index 7, same values); `data/achievements.ts:25` desc "Reach the Dark Forest."; `holeLevels.ts:31/33/36` "the yard grows: Garden" / "…Neighbour's Lawn" / "…Dark Forest"; `legend.ts:219-220, 239` drop the price cell and header; `legend.ts:238` → "Comes by itself at hole level 3 / 5 / 8; the yard grows toward the hole. A bigger yard holds more gnomes and machines.". Test: `08_shop_legend_goal` (rows 13, 14).
9. `tools/smoke/scenario-auto-lands.js` (harness of `scenario-esc.js`): all level-ups forced by `g.state.holeXp = g.hole.xpNeeded − 0.01; g.hole.consume(gnome)` (any positive XP crosses `>=` at `hole.ts:214`, independent of 10a's per-gnome XP); steps as in Tests below.
10. `docs/SPEC.md` (Dziura: one line from the factory, 15/19/23/27 m, why; Sklep: no LAND tab; Ziemie: automatic at 3/5/8, rectangle growth toward the hole, tools 2-6 m from the rim stay where they are and old Forest layouts go back to the inventory, why), `docs/PLAN.md:47-52, 79, 89`, `CHANGELOG.md` top section (memory rule), `docs/ai-work/2026-10-20-auto-lands.md` work note, `BOARD.md` status line.

Tests (headless, `npx vite --port 5199 --host 127.0.0.1`, `CDP_PORT=9373 node tools/smoke/smoke.mjs <scratchpad>/auto-lands tools/smoke/scenario-auto-lands.js`; `g = window.gnome`): v0's `01`-`09` with these changes: `02_levelup_garden` level-up comes from a crate dump, the crate placed at DIR·4.2 (its home under the new hole), plus fan A at `holeCenterFor(3, 1)` and fan B 1 m outside the level-2 rim; assert the crate's `home` ≥ 3.4 m from the new centre, `machines.list` still holds the crate after 3 s and its body y > 0; `04_lawn_forest` adds a robot post at `holeCenterFor(5, 2)` before 4→5: post ≥ radius + gap from the new centre within 2 s, robot `state` not `rescue` after 20 s; `06_old_saves` (a) expects the new toast text and `restore` count 2, (b) adds `placed: [fan at (−24, −34)]` → `placed` 0, money 49 500, (d) `{version: 2, holeLevel: 3, land: 1}` → boot `env.sliding === false`, hole at DIR·6.4 ± 0.05; `09_blueprint_tramp` adds: a blueprint saved on the Lawn with a fan at hole + (0, 0, 30) loaded on the Garden → that fan not placed; new `10_scenery`: on the Forest count tufts with x or z in 70..94 > 0, fireflies centre within 2 m of `(min + max) / 2`, UFO started → `mesh.position.x` ≥ `max.x + 20` on frame 1, gnome teleported to (max.x + 35, 1, 0) removed within 2 s.

### Review focus
1. A dump at the rim causes the level-up and the dumping crate's own home lies under the new hole (roaster Major, worst case) → pinned by step 3's test `02_levelup_garden` (crate asserts).
2. Old Forest save (`land` 3, level 8) with tools around (−24, −34): refund $49 500 and every tool outside [-22, 94] back to the inventory in one toast (roaster Minor, impact R2) → pinned by step 5's test `06_old_saves` (b).
3. Robot post standing where the 4→5 hole arrives during the 1 s slide (roaster "no", untested) → pinned by step 3's test `04_lawn_forest` (post step-out, no rescue loop).
4. Autosave at a land boundary, reload: hole at the formula spot without a second slide (roaster "no", untested) → pinned by step 4's test `06_old_saves` (d).
5. Forest blueprint loaded on the Garden puts a fan beyond the fence (row 18 change) → pinned by step 5's test `09_blueprint_tramp`.

### Done when
1. `03_levelup_plain → ok=true land=1 moved=1.2 sliding=false`
2. `02_levelup_garden → ok=true land=1 max=42 min=-22 arrived<=1.5 fanA=gone fanB=1.0 toast=1`
3. `04_lawn_forest → … land=2 max=66 hole=DIR*12.8`
4. `04_lawn_forest → … land=3 max=94 hole=DIR*20.4 ach=land`
5. `04_lawn_forest → … chain=ok exceptions=0`
6. `01_formula → ok=true rows=48 offline=0 margin>=2 far>=8`
7. `01_formula → L12/land3=(12.6,21.8)`
8. `07_fresh_daily → ok=true land=0 max=22 hole=(0,0)` and `rg -n "LAND\[0\]\.half" src/systems/hole.ts → 1 line` (rebirth filter untouched)
9. `06_old_saves a → land=2 money=100`
10. `06_old_saves b → money=49500 version=2 second=49500; c → money=0`
11. `06_old_saves a → placed=0 restored=2 toast="2 tools had no room (hole, fence or factory) and went back to your inventory."`
12. `08_shop_legend_goal → landTab=0 available=sum`
13. `08_shop_legend_goal → legendCols=3 legendText="Comes by itself at hole level 3 / 5 / 8"`
14. `08_shop_legend_goal → goal garden="Reach hole level 5…" done@5 +300 where=hole`
15. `npx tsc --noEmit → (no output)` and `rg -n "env\.half" src → (no output)` and `05_bounds → ok=true`
16. `01_formula → dist(land L, level 1) = 15,19,23,27` and `rg -n "LAND_STEP = 4" src/data/land.ts → 1 line`
17. `07_fresh_daily → ok=true` (`?daily` run)
18. `09_blueprint_tramp → blueprint=same outsideFan=skipped`
19. `09_blueprint_tramp → tramp=0.75 cap=2.5`
20. `02_levelup_garden → crateHome>=3.4 crateRespawns=1 crateY>0 crateInList=true`
21. `10_scenery → tufts70..94>0 tuftCount=8000 shroomCount=240`
22. `10_scenery → firefliesCentreErr<=2`
23. `10_scenery → ufoEntryX>=max.x+20`
24. `10_scenery → farGnomeRemoved<=2s`
25. `04_lawn_forest → robotPostOut=true rescue=0` and `06_old_saves d → sliding=false hole=DIR*6.4`
26. `tools/smoke/scenario-esc.js`, `tools/smoke/scenario-grass.js` → pass

### Decisions for PP
1. [spec silent] Zakładam: a save that paid for lands gets the money back once on load (up to $49 500) | Dowód: `state.ts:118-129` refunds removed upgrades the same way | Jeśli źle: the implementer deletes the refund branch of step 4 and test 06 b | a) refund (built), b) no refund, the player keeps what he paid for | rekomendacja: a)
2. [decision age] kiedy dziura dojdzie do poziomu 8, wtedy stoi 35 m od fabryki (dziś gracz bez kupowania Landów miał 23 m, bo mógł zostać na Backyardzie), bo Landy przychodzą same i `LAND_STEP = 4`; decyzja PP z 2026-10-20 rano na pytanie 5 tablicy: „nikt nie gra samymi rękami → zostaje bez zmian" (`BOARD.md:109`), ale 10a daje rękom x1 XP, a maszynom x0,25; nadal aktualne? a) 4 m: 15/19/23/27 m (zbudowane) b) 2 m: 15/17/19/21 m (jedna stała `LAND_STEP`, poślizg dalej widoczny: 3,2 m) (rekomendacja: a, bo to Twoja odpowiedź z rana, a zmiana to jedna liczba po zagraniu)
3. [spec silent] Zakładam: the yard grows from the fixed corner behind the factory and house toward +x and +z (Forest fence −22..94 on both axes) | Dowód: DIR = (0.50, 0.87) from `environment.ts:192`; the house stays outside the back fence on every land | Jeśli źle: PP wanted only "forward" (+z) with the width centred; then `min.x` moves too (step 2, one formula) | rekomendacja: a) corner-fixed, literal "jeden kierunek"
4. [spec silent] Zakładam: daily challenge uses the same automatic switch (land 0 at start) | Dowód: no `land` in `daily.ts` | Jeśli źle: a 5-min run never reaches level 3 anyway | rekomendacja: a) no special handling
5. [spec silent] Zakładam: blueprint LOAD stays relative to the hole, skips tools in the hole and now also tools beyond the fence (R2) | Dowód: `blueprints.ts:137-156` → `restore` | Jeśli źle: PP wants a Forest blueprint to place everything on the Garden, even outside the fence | rekomendacja: a) skip, the player could not place there by hand either
6. [spec silent] Zakładam: trampoline `0.6·1.25^land` and combo cap `+0.5·land` keep their formulas and rise at 3/5/8 by themselves | Dowód: `machines.ts:723`, `hole.ts:56` | Jeśli źle: the balance batch owns the numbers | rekomendacja: a) unchanged

### v0 → final
- added: crate home step-out in `carry` (roaster Major), scenery over the Forest rectangle (tufts, mushrooms, fireflies, UFO entry), despawn rule, legend paragraph, `garden` edited by id on the tutorial-goals shape, tests 10 and the crate/robot/old-Forest/reload cases, 7 Done-when lines (19 → 26).
- dropped: v0 step 5 filter in `main.ts` (now inside `machines.restore` with one toast), the `environment.ts` wait, the LAND-tab question (decided: remove).
- moved to PP: hole distance as "nadal aktualne?" with the forced 35 m number; the five `[spec silent]` assumptions stay with defaults the implementer builds now.

## Refresh 2026-10-21 (plan-author)

Status: needs-decision (3 new questions L1-L3 below; final-plan questions 1-2 still open). Base: `main` at b6a6f82, tree clean. The `## Plan (plan-senior, final)` section stays the plan; this section lists what the code changed since, the corrected edit list, and the tests that must change.

### What in the final plan no longer matches the code
1. Letters (shipped 2026-10-21, `src/data/letters.ts`, `props.ts:41, 153`, `environment.ts:402`): `LETTER_SPOTS` N (−27, 24), M (−50, −20), E (30, −52) have x or z < −22, so with the fixed-corner rectangle they lie outside every fence for ever; O (38, 30) is already inside the Garden rectangle [−22, 42] although it is the Lawn's letter. The fence rule `props.ts:153` (`Math.max(|x|, |z|) > env.half + 1`) and `scenario-letters.js` L0, L2, L3, L7, L21 (`g.shop.buyLand`, `g.env.half`, `LAND[i].half`) break.
2. Goals use ids (tutorial-goals shipped): `goals.ts:55` `abs('garden', 'Buy the Garden (Shop → Land)', 1, () => ctx.state.land, 300, 'shop')`. R3's "if the old array is still there" branch is dead. Untouched, this goal completes by itself at level 3, pays $300 and points the arrow at the shop.
3. Robot stations (shipped 2026-10-24/25): `robots.ts:177` `stepOutPost` runs every frame, also broken (`machines.ts:807-813`), and sends the robot to the inventory when no spot has room (`poleBlocked`). The yard map cache `yardSig` (`robots.ts:545-561`) hashes `env.half`, the hole centre and radius; `buildYard` (`:777-791`) builds a square grid from `−half`; waypoint clamp `:332-334`, detour `:450-453`, out-of-yard `:230`. The final plan's robot line numbers (272-274, 387-389, 436, 457-461) are stale.
4. `machines.restore` (`:533-561`) already returns a count (factory footprint, narrow belt, robot pole) and `main.ts:106-107` pushes a load note "N tools are back in your inventory: no room there." R2's toast text and the "factory-bugs R4 overlap" are moot: step 5 adds two `continue` reasons and keeps that note.
5. `loadState` (`state.ts:128-155`) has four refund blocks now (Wind-up, Broom, per-tool Fuses, Piggy Bank); `version` is still 1 (`state.ts:74`). The Land refund block goes after the Piggy block, same shape.
6. Shop line numbers: `TABS` `shop.ts:9`, click `:153-154`, hover `:159`, `unlockedIds` `:204`, `buyLand` `:266-277`, `affordCount` `:324`, `landItems` `:329-355`, list branch `:366`; `legend.ts:219, 237-238`; `icons.ts:22-23`; `upgrades.ts:1`.
7. Scenery line numbers: tufts/mushrooms `environment.ts:152-176`, fog `:349-351`, walls `:355-362`, posts/rails `:364-383`, forest ring `:386-404` (house gap `:400`, letter keep-out `:402`), slide `:418-428`, `edgePoint` `:437-441`, fireflies `:499`.
8. Other yard readers moved: `gnomes.ts:443, 496, 534, 586, 658, 701, 709, 789, 801, 820-825, 836-838`; `machines.ts:847, 868`; `player.ts:1002`; `props.ts:58, 153`; `tornado.ts:86, 139-141`; `events.ts:77, 185, 258-274, 300, 304`. The visitor (`events.ts:256-274`) now spawns 7-10 m behind the player with a fence fallback that duplicates `edgePoint`.
9. Level-ups in tests: `scenario-balance.js:501` forces one with `s.holeXp = g.hole.xpNeeded − 0.5` + consume, `scenario-robot-stations.js:245` calls `g.hole.levelUp()` directly. Both still work (`hole.ts:86-93`). A crate dump pays full XP per gnome (`machines.ts:861`), so a multi-level chain inside one dump (row 5) is now common, not rare.
10. `hole.ts:280-304` `levelUp` also sets `maxLevelAt` at level 12 (FASTEST LVL 12 board) and starts the King at level 10: both stay on both branches of step 3. The rebirth filter moved to `hole.ts:577`.
11. Scenarios that set the land by hand: `scenario-perf.js:144` and `scenario-tree-expansion.js:526` (`g.state.land = 3; g.env.rebuildLand()`), `scenario-tree-expansion.js:158`, `scenario-endgame-boost.js:227, 262, 278` read `g.env.half`.
12. FASTEST LLV 12 board is live (`leaderboard.ts:12-14`, since 2026-10-25): auto-lands change the time to level 12 for everyone (question L3).
13. Texts: `docs/SPEC.md:29, 43, 193, 201, 217-227, 238, 240, 245`; `docs/PLAN.md:47, 49, 52, 79, 90`; `holeLevels.ts:13, 15, 18`; `data/achievements.ts:25`; `environment.ts:283` comment.
14. In-flight overlaps named in Reach and R9 (factory-bugs on `robots.ts`/`machines.ts`, dirty `environment.ts`) are gone: everything is committed.

### Letters: how the word stays completable
- The rule (PP 2026-10-21, `SPEC.md:245`): every letter lies at its spot from the first second; a letter of a land not reached yet lies beyond the fence; a switch never moves or removes a letter. With auto-lands the lands come in order at levels 3 / 5 / 8, so by level 8 all five are inside the fence and the word can always be finished; the player never has to buy anything.
- New spots for the fixed-corner rectangle (each ≥ 6.8 m from the one hole segment (0, 0) → (12.6, 21.8), ≥ 2 m inside its land, ≥ 5 m beyond the previous land's +x or +z fence, clear of the desk (7.5, −13), house (0, −27.5), factory (−7.5, −13) and shovel (−20.4, 20.6)):
  G (15, −15) land 0 unchanged (21 m from the hole line); N (36, −10) land 1 (14 m past the Backyard's +x fence, 36 m from the hole line); O (−8, 58) land 2 (16 m past the Garden's +z fence, 42 m from the segment end); M (86, 10) land 3 (20 m past the Lawn's +x fence); E (10, 88) land 3 (22 m past the Lawn's +z fence). `L0` in `scenario-letters.js` proves them with rectangle maths (below).
- `props.ts:153` → `const outside = !ctx.env.inside(t.x, t.z, −1) && Math.hypot(t.x − p.home.x, t.z − p.home.z) > 2;` (same meaning on a rectangle: 1 m past any side).
- `environment.ts:402` tree keep-out stays (it reads the spots). The forest ring (≥ 3 m outside the rectangle, within 40 m) covers N and O on the Backyard and M and E on the Lawn; on the Backyard M and E lie past the ring (62 m) on open tufted grass (row 21), in fog (near 37 m, far 202 m) but visible.
- Comment in `letters.ts:5-8` rewritten: "≥ 5 m beyond the previous land's +x or +z fence, so it lies in sight until the hole reaches that land's level".

### Robot stations when the land changes
- No new mechanism: `stepOutPost` already chases the hole every frame. On a 2→3 switch the hole travels 5.2 m in 1 s; a station on the path is pushed each frame to `keep = r + HOLE_GAP + ARRIVE_HOME + STATION_REACH` from the current centre and settles at `keep` from the final centre; when all 25 angles are blocked (`poleBlocked`), the robot goes to the inventory with the existing toast (`machines.ts:809-813`). Row 25 (new) and Review focus 3 cover it.
- `yardSig`: `add(env.half)` → `add(env.max.x); add(env.max.z)` (`min` is constant). During the slide the hole hash changes every frame, so the yard maps are rebuilt per frame for ≤ 1 s, 3 times per run; today's purchase slide does the same (Forest grid 53,824 cells, performance table).
- `buildYard`: `x0 = env.min.x`, `z0 = env.min.z`, `nx = Math.ceil((env.max.x − env.min.x) / CELL) + 1`, `nz` likewise, blocked where `!env.inside(x, z, 1.3)`. `updateRobot:230` → `!env.inside(t.x, t.z, −0.5)`; `:332-334` → `env.clampTo(wp, 1.3)`; `:450-453` → `env.clampTo(d, 1.3)` on the detour point.
- The yard only grows at a switch, so no station ends up outside. Old saves: step 5's rectangle check runs before `place`, so a station at x < −22 is never built and counts in the load note (row 28).

### Updated edit list and order
1. `src/data/land.ts` (final step 1) + `src/data/letters.ts` spots and comment.
2. `src/world/environment.ts` (final step 2, line numbers from item 7) + `src/entities/props.ts:153` (letter fence rule) + `:58` (`randomPoint(3, 0.5)`).
3. `src/systems/hole.ts` (final step 3; keep `maxLevelAt`, King timer, Deep toast).
4. `src/core/state.ts` (final step 4; refund block after the Piggy block at `:155`; `freshState` `version: 2`).
5. `src/entities/machines.ts` `restore` (`:536-541`): before the factory check add `if (!ctx.env.inside(p.x, p.z, 0.5) || (ctx.env.holeDist(p.x, p.z) < ctx.env.holeRadius + 0.6 && p.y < 1.5)) { inFactory++; continue; }` (rename the counter `skipped`); `main.ts:106-107` and its text unchanged; `blueprints.ts:154-159` unchanged (its own hole filter + `restore`). R2's toast text is dropped.
6. Yard readers (item 8 + robots per the section above): `gnomes.ts` (`decide`/`fleeFrom` lose the `half` parameter; `:443` parade `clampTo(…, 2)`; `:534` `p.y < −8 || !env.inside(p.x, p.z, −30)`; `:701, 838` `clampTo(…, 1.5)`; `:709-711` greedy escape = nearest of the four sides of `[min + 0.5, max − 0.5]`; `:789` `randomPoint(3, 0.6)`; `:825` `clampTo(…, 2)`); `machines.ts:868` `!env.inside(p.x, p.z, −0.5)`; `player.ts:1002` `!env.inside(centre.x, centre.z, 0.5)`; `tornado.ts:86` `L = Math.min(max.x − min.x, max.z − min.z) / 2 − 2`, `:139-141` `clampTo(pos, 1)`; `events.ts:77` `randomPoint(2, rand(14, 24))`, `:185` `randomPoint(3)`, `:258-274` `env.inside(x, z, 1.5)` and fallback `p = env.edgePoint()`, `:300` `mesh.position.set(env.max.x + 22, 30, 0)`, `:304` `randomPoint(5, 12)`; `robots.ts:230, 332, 450, 549, 777-791`.
7. Shop removal (item 6 line numbers) + `icons.ts:22-23` + `upgrades.ts:1`.
8. Texts: `goals.ts:55` → `abs('garden', 'Reach hole level 5: the yard grows into the Neighbour\'s Lawn', 5, () => ctx.state.holeLevel, 300, 'hole')` (id kept; `scenario-tutorial-goals.js:271` stays valid); `data/achievements.ts:25` "Reach the Dark Forest."; `holeLevels.ts:13, 15, 18` "the yard grows: …"; `legend.ts:219` (drop the price cell), `:237-238` (header without Price, paragraph from R8); `environment.ts:283` comment.
9. Tests (next section).
10. Docs: `SPEC.md` lines from item 13 (Dziura kotwice → one line from the factory 15/19/23/27 m; Sklep tabs without LAND; Ziemie automatic at 3/5/8, rectangle growth toward the hole, tools 2-6 m from the rim stay, old Forest layouts go back; Cele "Reach hole level 5"; Litery "ziemia przychodzi sama" instead of "po kupnie"), `PLAN.md` lines, `CHANGELOG.md` top section (one bullet, two sentences), `BOARD.md` status line, work note `docs/ai-work/2026-10-21-auto-lands.md`.

### Tests that must change
- `tools/smoke/scenario-letters.js`: `outside()` (`:65`) → `!g.env.inside(t.x, t.z, −1)` (optional second argument `maxOf(L) = 2 · LAND[L].half − 22` for L7); L0 (`:88-96`): hole-path distance over the one segment `holeAt(1, 0) → holeAt(12, 3)`; `inside = s.x >= −20 && s.z >= −20 && s.x <= maxOf(s.land) − 2 && s.z <= maxOf(s.land) − 2`; `beyond = s.land === 0 || s.x >= maxOf(s.land − 1) + 5 || s.z >= maxOf(s.land − 1) + 5`; L2/L3 (`:173-182`): replace `g.shop.buyLand(i)` with `g.state.holeLevel = LAND[i].hole − 1; g.hole.levelUp();` and `g.env.half === LAND[i].half` with `g.env.max.x === maxOf(i)`; L3 home asserts → `L('M').home.x === 86 && L('E').home.z === 88`; L7 (`:366`) `outside(p, maxOf(2))`; L21 (`:257`) `h = g.env.max.x`.
- `tools/smoke/scenario-tree-expansion.js:158`, `scenario-endgame-boost.js:227, 262, 278`: `g.env.half` → `g.env.max.x` (the tests place things near the +x fence, which still exists). `scenario-tree-expansion.js:526` and `scenario-perf.js:144`: set `s.holeLevel = 10` before `s.land = 3` (perf already does) so `landFor` and the cache agree.
- `tools/smoke/scenario-robot-stations.js`: no change (`Env.holeCenterFor(lv + 1)` keeps its signature; the load-note text stays).
- `tools/smoke/scenario-errors.js:56`, `scenario-tutorial-goals.js:271`: unchanged.
- New `tools/smoke/scenario-auto-lands.js` as in the final plan (steps 01-10, harness of `scenario-esc.js`, run with `FAKELOCK=1 URL_QUERY='' DEV_PORT=5199 CDP_PORT=9373 node tools/smoke/smoke.mjs <scratchpad>/auto-lands tools/smoke/scenario-auto-lands.js`), plus `11_letters_reach`: fresh state at level 1 → N, O, M, E `outside`, G inside; force 2→3 (`holeLevel = 2; holeXp = xpNeeded − 0.01; consume`) → N inside, `xzHome(N) < 1.5`, nothing moved; 4→5 → O inside; 7→8 → all five inside, every `xzHome < 1.5`; and `06_old_saves` (e): `{version: 1, holeLevel: 8, land: 3, upgrades: {robot: 1}, placed: [robot at (−30, 0, −30)]}` → `placedCount('robot') === 0`, load note "1 tool is back in your inventory: no room there.".

### Behaviour matrix (rows added to the final matrix)
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| 25 | `spec silent` robot station standing on the slide path at a land switch | `stepOutPost` each frame | station ends at `keep` from the final centre; robot never in `rescue`; no spot with room → robot to the inventory, existing toast | refresh |
| 26 | land switch with letters on the new land | `rebuildLand` | no letter moves; the new land's letter is inside the fence at its home (`xzHome < 1.5`); letters of later lands still beyond | PP 2026-10-21, refresh |
| 27 | letter thrown past any side of the rectangle and > 2 m from home | `props.update` | goes home with the gold burst (as today, rectangle sides) | refresh |
| 28 | old save with a robot station at x < −22 or z < −22 | `machines.restore` | never placed, counted in the load note "N tools are back in your inventory: no room there." | refresh, item 4 |

### Done when (added to the final list)
27. `scenario-auto-lands 11_letters_reach → L1 outside=N,O,M,E; after 2→3 inside=G,N moved=0; after 4→5 inside=G,N,O; after 7→8 inside=all homeErr<1.5`
28. `FAKELOCK=1 URL_QUERY='' node tools/smoke/smoke.mjs <out> tools/smoke/scenario-letters.js → L0, L2, L3, L7, L21 PASS` (rectangle maths, level-up instead of buyLand)
29. `scenario-auto-lands 06_old_saves e → robots=0 note="1 tool is back in your inventory: no room there."`
30. `scenario-auto-lands 04_lawn_forest → robotPostOut=true rescue=0` and `rg -n "g\.shop\.buyLand|env\.half" tools/smoke src → (no output)`
Line 11 of the final list changes to: `06_old_saves a → placed=0 restored=2 note="2 tools are back in your inventory: no room there."` (R2's toast text dropped, item 4).

### Open decisions (new; final-plan questions 1 and 2 stay as written)
[L1] Letter spots. Kiedy ziemie rosną z jednego rogu, wtedy litery N, M, E leżą na zawsze poza płotem, a O leży już w Garden, choć należy do Neighbour's Lawn; słowa nie da się złożyć. a) nowe miejsca: G (15, −15), N (36, −10), O (−8, 58), M (86, 10), E (10, 88); każda litera widać za płotem 14-22 m od niego, aż dziura dojdzie do poziomu 3 / 5 / 8 b) PP podaje inne miejsca (ten sam test L0 je sprawdza). (rekomendacja: a, bo spełnia zapisane reguły liter i nic więcej nie zmienia)
[L2] Cel „Buy the Garden (Shop → Land)" ($300, strzałka do sklepu). Kiedy ziemia przyjdzie sama na poziomie 3, wtedy ten cel zaliczy się sam, zapłaci $300 i pokaże strzałkę do sklepu, gdzie nic nie ma. a) tekst „Reach hole level 5: the yard grows into the Neighbour's Lawn", $300, strzałka do dziury, to samo id (stare zapisy nic nie tracą) b) cel znika z listy (gracz traci $300, cele poziomów 4 i 6 zostają). (rekomendacja: a, jak w planie finalnym R3)
[L3] Tablica FASTEST LVL 12. Kiedy ziemie przychodzą same, wtedy dziura na poziomie 8 stoi 35 m od fabryki zamiast 23 m, więc czasy do poziomu 12 po zmianie nie są porównywalne z wpisami sprzed niej. a) wpisy zostają (dziś tylko testowe) b) PP czyści tablicę `speed` przy wdrożeniu (zapis na produkcji, robi PP). (rekomendacja: a)
[decision age] none: every decision this refresh rests on is from 2026-10-19..25.

PP (2026-10-21): recommendations taken, may override. [L1] a (new letter spots), [L2] a (goal "Reach hole level 5…", $300, arrow to the hole, same id), [L3] a (FASTEST entries stay), [L4] = final question 1 a (one-time refund, max $49 500), [L5] = final question 2 a (`LAND_STEP = 4`), v0 question 1 (Land tab) a (tab removed, legend keeps the table). Final questions 3-6 taken as their defaults (a).

### Self-check (refresh)
- Every item in "no longer matches" has a step in the updated list (1→1-2, 2→8, 3→6, 4→5, 5→4, 6→7, 7-8→2/6, 9→tests, 10→3, 11→tests, 12→L3, 13→10, 14→none needed).
- New rows 25-28 each have a Done-when line (27-30); row 25 marked `spec silent`.
- Writers of `state.land` unchanged from the final plan; `env.half` readers re-grepped on b6a6f82: 25 sites in 9 src files + 7 in 4 scenarios, all listed.
- Lists compared with code: 5 letters = 5 spots (`letters.ts`), 4 land tiers, 4 refund precedents, 3 scenarios that set `land` by hand.
- This section is shorter than the diff it corrects (letters, goals, robots, restore, tests).
