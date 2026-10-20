# Plan: upgrade tree (Plow / Magnet / Factory paths) instead of a flat list

> **Orchestrator decisions (2026-10-20, PP asleep; this plan is final):** 1 a) Gears → Batches → Auto Crank edges; 2 a) robots stay in flat Tools; 3 a) Strong Arm + Trick Scope as Magnet roots, Steel Toes Plow root, Glue Factory root, leftovers in flat Movement; 4 a) mouse + existing close keys. Changed after the plan was written: Magnet Dish no longer requires the Magnet Gun (it also widens the hand magnet), so it is a Magnet root, not a child of the gun. Also tonight: Kicking Wheel $500, Auto Crank base $600.

Spec: hub item 10 (BOARD.md): "Upgrade tree (plow, magnet, factory paths) instead of a flat list. Done when: the plan exists; the shop shows the three paths as a tree with locked/unlocked nodes, buying still uses the same prices and ids, old saves keep their levels." Orchestrator brief 2026-10-20 (which upgrades per path, flat tabs stay, `requires` edges, node view inside the shop window, 1280x720 and 640x360, now/next preview, DOM only while open).
Trivial check: touches the shared data file (`upgrades.ts`, read by shop, legend, hud, wheel, player, machines, hole), the shop UI and CSS, and a player toast; new behaviour (tree view, parent gating of buys).

## Plan v0 (plan-author)

### Goal
The shop shows Plow, Magnet and Factory as node-and-line trees with locked / needs-parent / afford / maxed states; every other tab stays a flat list; ids, prices, levels and saves are unchanged.

### What exists tonight (reuse, do not rebuild)
- `src/data/upgrades.ts:12` `requires?: string` and `U(..., hole, requires)` (F11 agent, landed). Edges already set: `magPower`, `magRange` → `magGun`; `plowWidth` → `tractor`; `blowPower`, `blowRange` → `blower`; `crateSize` → `box`; `robotBed/Speed/Area` → `robot`.
- `src/ui/shop.ts:109` `missing(u)` (parent with level 0), `buy()` guard at `:116` (`this.missing(u)` returns early), `needs <Parent>` badge on flat rows at `:183`.
- `EFFECT` table (now/next preview), `badges()` (NEW/AFFORD), `data-desc` hover → `.shop-desc`, `data-buy` click → `buy()`, Esc/B/Tab/E close. All of it works for a node exactly as for a row, because a node carries the same `data-buy` and `data-desc` attributes.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | tab Plow / Magnet / Factory | open shop, click tab | `.shop-tree` with nodes placed by (column = depth, row) and one `<svg>` with one `<path>` per `requires` edge inside the same tab; no `.row` elements | brief: "node-and-line view inside the existing shop window" |
| 2 | node hole-locked (`u.hole > holeLevel`) | render | name `???`, cost cell `HOLE LVL n`, class `locked`, click → nothing (money unchanged) | shop.ts today for rows |
| 3 | node with `requires` parent at level 0, hole ok | render + click | real name shown (so the path is readable), badge `needs <Parent>`, class `needs`, no price, click → nothing | F11 (`plan-night-features.md` F11), brief: "locked/afford/new badges" |
| 4 | node unlocked, `wallet >= cost` | click | money `-= upgradeCost(u, L)`, `state.upgrades[id] = L + 1`, re-render, node shows `LVL L+1/max` and the next price, `AFFORD` badge before the click | BOARD "buying still uses the same prices and ids" |
| 5 | node unlocked, `wallet < cost` | click | `deny()` (money shake, deny sound), no state change | shop.ts today |
| 6 | node at `max` | render | `MAX`, no price, class `maxed`, click → nothing | shop.ts today |
| 7 | node unlocked since the last visit (hole level up between visits) | reopen | `NEW` badge on that node once; gone on the next open | polish-c (NEW badge) |
| 8 | hover a node | mouseover | `.shop-desc` = `u.desc (now: …, next: …)` for ids in `EFFECT`, else `u.desc`; hole-locked → `Feed the hole to find out.` | polish-c (now/next preview) |
| 9 | old save: child owned, parent 0 (e.g. `plowWidth: 2`, `tractor: 0`) | load + render | node `LVL 2/5` kept (no clamp, no refund), `needs Plow Tractor`, buying level 3 blocked until the tractor is bought | BOARD "old saves keep their levels" |
| 10 | flat tabs Movement, Tools, Combos, Bonuses, Land, Deep | click tab | rows exactly as today (`.row`, BUY button, `needs` badge on Bigger Crate / robot upgrades) | brief: "what stays in flat tabs" |
| 11 | tab bar | open | order `PLOW MAGNET FACTORY MOVEMENT TOOLS COMBOS BONUSES LAND [DEEP]`; no `PRODUCTS`; Deep only with shards/rebirths as today; default tab stays `Tools` | brief |
| 12 | 640x360 viewport | open, tab Factory | tree container 3 x 164 px nodes + gaps <= 560 px wide (fits `min(860px, 94vw)` = 602 px), 4 rows; vertical overflow scrolls inside `.shop-rows` like the flat list does today | brief: "fits 1280x720 and 640x360" |
| 13 | legend (L), Tools tab | open | groups follow the new `tab` values (Plow, Magnet, Factory, Movement, …), still 52 rows | legend.ts:200 groups by `u.tab` |
| 14 | C without tractor/blower | toast | text says `in the shop (Plow)` instead of `(Movement)` | player.ts:838 |
| 15 | hotbar, tool wheel, Keep Tools, digit keys | unchanged | `TOOL_IDS` still = Tools tab minus `NOT_PLACEABLE`; robot and its upgrades stay in Tools | upgrades.ts `TOOL_IDS`, hud.ts:267, wheel.ts:83, hole.ts:518 |
| 16 | `spec silent`: Running Shoes, Spring Socks, Gnome Boots, Coin Magnet, Laptop (Movement members the brief does not name) | render | stay in a flat `Movement` tab | enumeration check below |
| 17 | `spec silent`: Steel Toes (`kick`, Movement member not named) | render | root node of the Plow path (kicking is pushing by foot) | enumeration check |
| 18 | `spec silent`: Gnome Glue (`glue`, Products member not named) | render | root node of the Factory path | enumeration check |
| 19 | `requires` pointing at an id in another tab (data mistake) | render | the node is drawn as a root (no edge), the buy guard still applies; no exception | layout rule below |

Enumeration check (point 1.6): Movement has 16 ids, the brief names 10 (tractor, plowWidth, blower, blowPower, blowRange, magGun, magPower, magRange, scope, throw) → 6 unnamed: rows 16 and 17. Products has 6 ids, the brief names 5 → 1 unnamed: row 18. Tools: the brief asks "robots?" → open decision 2, resolved as row 15. `spec silent` rows: 3.

### Reach
- `src/data/upgrades.ts` `Tab` type and `tab` values: readers `src/ui/shop.ts` (`TABS`, filter by tab), `src/ui/legend.ts:200,202,225` (groups by `u.tab`; `'Combos'` literal stays), `src/data/upgrades.ts` `TOOL_IDS` (`tab === 'Tools'`, unchanged). No other reader of `tab`. `UPGRADES` order: `legend.ts` row order, `main.ts:40` cap clamp (order-free), layout order in the new tree.
- `state.upgrades` writers: `shop.ts:126` (buy), `hole.ts:518` (rebirth copies `TOOL_IDS + crateSize`), `state.ts` refunds (`charge`, `broom`), `main.ts:41-43` clamp to `max`. None keyed by tab; the tree changes none of them.
- Texts naming the Movement tab: `player.ts:838` toast (change), `goals.ts:40,50` (`Shop → Land`, `Shop → Tools`: unchanged tabs), `legend.ts:240` (Land tab: unchanged), `docs/PLAN.md:75-84` (update the shop section).
- Response shape to "the front": none (single-page game); the UI contract is the shop DOM read by headless scenarios (`[data-tab]`, `[data-buy]`, `.row`, `.badge`).

### Data
- No database. `localStorage` save keeps `upgrades: Record<id, level>`; ids and costs untouched, so loading an old save needs no migration (`tab` and `requires` are not saved).
- `UPGRADES` = 52 entries; per tree tab ≤ 6 nodes and ≤ 5 edges (Plow 6/3, Magnet 5/2, Factory 6/2). `render()` runs on open, tab click and buy only, not per frame; while hidden the DOM costs nothing. No per-frame work added.

### Node layout (the one decision the implementer cannot guess)
Nodes of a path = `UPGRADES.filter(u => u.tab === path)` in data order. `depth(u)` = 0 for a root (`!u.requires` or the parent is not in this path), else `depth(parent) + 1`. Rows: walk roots in data order; a root takes the next free row `r`; its children (data order) take rows `r, r+1, …` recursively (first child shares the parent's row); the next root starts at `maxRowUsed + 1`. Cell: `CW = 184` px, `CH = 66` px, node box 164 x 56 px at `left = col * CW`, `top = row * CH`. Edge path from the parent's right middle `(col*CW+164, row*CH+28)` to the child's left middle with a horizontal-vertical-horizontal elbow at `x = col*CW + 174`.

Result per path (data order after step 1):
- Plow: `kick` (r0); `tractor` (r1) → `plowWidth` (r1,c1); `blower` (r2) → `blowPower` (r2,c1), `blowRange` (r3,c1). 4 rows x 2 cols.
- Magnet: `magGun` (r0) → `magPower` (r0,c1), `magRange` (r1,c1); `throw` (r2); `scope` (r3). 4 rows x 2 cols.
- Factory: `factorySpeed` (r0) → `batch` (r0,c1) → `autocrank` (r0,c2); `value` (r1); `permit` (r2); `glue` (r3). 4 rows x 3 cols.

### Steps (edit order)
Start only when the F11 agent has released `upgrades.ts` and `shop.ts` (BOARD: F11 queued after land/balance).
1. `src/data/upgrades.ts` — `export type Tab = 'Plow' | 'Magnet' | 'Factory' | 'Movement' | 'Tools' | 'Combos' | 'Bonuses' | 'Land' | 'Deep'` (drop `'Products'`); `export const TREE_TABS: Tab[] = ['Plow', 'Magnet', 'Factory']`. Retag: `kick, tractor, plowWidth, blower, blowPower, blowRange` → `'Plow'`; `magGun, magPower, magRange, throw, scope` → `'Magnet'`; `value, factorySpeed, batch, autocrank, permit, glue` → `'Factory'`; `speed, jump, boots, magnetRange, laptop` stay `'Movement'`. Reorder lines to the data order listed under "Node layout" (`factorySpeed` before `value`; `kick` first in Plow). Add edges `batch → 'factorySpeed'`, `autocrank → 'batch'` (open decision 1; if "no", skip this sentence). No price, max, hole or id changes.
2. `src/ui/shop.ts` — `TABS = ['Plow', 'Magnet', 'Factory', 'Movement', 'Tools', 'Combos', 'Bonuses', 'Land', 'Deep']`. New `private tree(tab: Tab): string` implementing "Node layout": returns `<div class="shop-tree" style="width:${cols*CW-20}px;height:${rows*CH-10}px"><svg class="tree-lines" width="…" height="…">${paths}</svg>${nodes}</div>`. Node markup: `<div class="node${locked ? ' locked' : need ? ' needs' : maxed ? ' maxed' : afford ? ' afford' : ''}" style="left:…px;top:…px" data-buy="${u.id}" data-desc="${desc}"><span class="name">${locked ? '???' : u.name + needsBadge + this.badges(u.id, afford)}</span><span class="lv">LVL ${L}/${u.max}</span><span class="cost">${maxed ? 'MAX' : locked ? `HOLE LVL ${u.hole}` : need ? '' : price}</span></div>` where `locked`, `need = this.missing(u)`, `maxed`, `cost`, `wallet`, `price`, `afford`, `desc` are computed with the same five lines as the flat row (extract them into `private rowData(u)` returning `{ L, locked, need, maxed, price, afford, desc }` and use it in both branches). In `render()`: `if (this.tab === 'Land') … else if (TREE_TABS.includes(this.tab)) rows = this.tree(this.tab); else …flat rows…`. Click and hover handlers unchanged (`[data-buy]` on the node, `buy()` already refuses locked/needs/maxed). If the inline `style="background:#e05a5a"` on the `needs` badge is still there, replace it with the class rule from step 3.
3. `src/ui/style.css` — `.shop-tree { position: relative; margin: 8px auto; }`, `.tree-lines { position: absolute; inset: 0; pointer-events: none; }`, `.tree-lines path { fill: none; stroke: #4a5058; stroke-width: 3; }`, `.node { position: absolute; width: 164px; height: 56px; box-sizing: border-box; padding: 4px 8px; border: 2px solid #4a5058; border-radius: 6px; background: #2e333a; font-size: 14px; cursor: pointer; display: grid; grid-template-columns: 1fr auto; row-gap: 2px; }`, `.node .name { grid-column: 1 / 3; white-space: nowrap; overflow: hidden; }`, `.node:hover { background: rgba(255,255,255,.12); }`, `.node.afford { border-color: var(--good); }`, `.node.maxed { border-color: #3a6ad8; }`, `.node.locked, .node.needs { opacity: .55; cursor: default; }`, `.badge.needs { background: var(--bad); color: #fff; }`.
4. `src/player/player.ts:838` — toast `'Buy the Plow Tractor or the Leaf Blower in the shop (Plow).'`.
5. `docs/PLAN.md:75-84` — shop section: "Shop (Plow / Magnet / Factory trees + Movement, Tools, Combos, Bonuses, Land, Deep lists)", list the members per path and the edges.
6. `docs/ai-work/2026-10-20-upgrade-tree.md` — Problem / Summary / Work progress with the Done-when results.

### Tests
Headless scenario `scenario-tree.js` (scratchpad `smoke/`, `node smoke.mjs run-tree scenario-tree.js`, dev server 5199, `window.gnome` = ctx). Each line sets `gnome.state` directly, calls `gnome.shop.open()`, clicks `[data-tab="…"]`, reads the DOM and `gnome.state`, and prints one JSON per matrix row. Plus the regressions already used for the shop: `zz-scenario15-scope.js` (shop buys), the legend count line (52 rows), `npx tsc --noEmit`.

### Done when (one line per matrix row, all local)
1. tab Plow → `document.querySelectorAll('.shop-tree .node').length === 6`, `.tree-lines path` count 3, `.row` count 0; Magnet 5 nodes / 2 paths; Factory 6 / 2 (or 0 if open decision 1 = no).
2. `holeLevel = 1`, tab Plow → node `[data-buy="tractor"]` has class `locked`, name text `???`, cost `HOLE LVL 3`; `.click()` → `state.money` unchanged.
3. `holeLevel = 3`, `upgrades = {}`, money 10000, tab Plow → node `plowWidth` has class `needs`, badge text `needs Plow Tractor`, name `Wider Plow`; `.click()` → `state.money === 10000`, `upgrades.plowWidth` undefined.
4. money 2000, `upgrades = { magGun: 1 }`, tab Magnet → node `magPower` has `AFFORD` badge; `.click()` → `state.money === 1975`, `upgrades.magPower === 1`, node text contains `LVL 1/10` and `$37` (ceil(25 x 1.45)).
5. money 10, tab Magnet → `magGun.click()` → `state.money === 10`, `.shop-money` gains class `shake` within 1 frame.
6. `upgrades = { blower: 1, blowPower: 4 }`, tab Plow → node `blowPower` cost text `MAX`, class `maxed`; click → no change.
7. open at `holeLevel = 1`, close, set `holeLevel = 3`, open, tab Plow → node `tractor` has badge `NEW`; close, open → no `NEW` on it.
8. `upgrades = { magGun: 1, magPower: 2 }`, dispatch `mouseover` on node `magPower` → `.shop-desc` text ends with `(now: 1.2 m ball, 8.2 m reach, next: 1.4 m ball, 8.8 m reach)`; mouseover a `locked` node → `Feed the hole to find out.`.
9. localStorage save with `upgrades: { plowWidth: 2 }`, reload → `lvl('plowWidth') === 2`, node text `LVL 2/5`, class `needs`, click → `plowWidth` stays 2.
10. tab Tools → `.row` count 15, node count 0, row `crateSize` shows badge `needs Wooden Crate` when `box` = 0; tab Movement → 5 rows (`speed, jump, boots, magnetRange, laptop`).
11. `[data-tab]` texts in order = `PLOW, MAGNET, FACTORY, MOVEMENT, TOOLS, COMBOS, BONUSES, LAND` (+ `DEEP` when `shards > 0`); `document.querySelector('[data-tab="Products"]') === null`.
12. viewport 640x360 (`page.setViewport`), tab Factory → `.shop-tree` `offsetWidth <= 560`, every `.node` `getBoundingClientRect().right <= .shop-win right`; no horizontal scrollbar (`shopRows.scrollWidth <= shopRows.clientWidth`).
13. press L, Tools tab of the legend → `h3` texts include `Plow`, `Magnet`, `Factory`, no `Products`; upgrade rows = 52.
14. `upgrades = {}`, press C → toast text contains `in the shop (Plow)`.
15. `TOOL_IDS` from `gnome`-side check: hotbar renders `robot` with the wheel hint; `upgrades = { robot: 1 }` → `.hotbar .slot .n` contains `Cleaning Robot`; wheel items include `robot`.
16. tab Movement → rows exactly `speed, jump, boots, magnetRange, laptop` (`[data-buy]` ids).
17. tab Plow → node `kick` at `style.left === '0px'`, no incoming path.
18. tab Factory → node `glue` present, `style.left === '0px'`.
19. temporary test: in the scenario set `gnome`-side `UPGRADE_BY_ID.scope.requires = 'box'` (other tab) before `render()` → node `scope` drawn at column 0, path count unchanged, no exception in `LOGS:`; reset afterwards.

### Assumptions (numbered)
1. The F11 edges (`magPower`, `magRange`, `plowWidth`, `blowPower`, `blowRange`, `crateSize`, robot upgrades) are final; the tree adds at most the Factory chain of open decision 1.
2. `missing()` uses `lvl()` (money upgrades only); no Deep upgrade gets a `requires`, so the Deep tab stays flat and ungated.
3. A node is clickable as a whole (no BUY button) to fit 164 px; the existing `[data-buy]` click handler needs no change.
4. Old saves with a child above 0 and parent 0 keep the levels (no clamp, no refund); only the next level is gated. `main.ts:40` clamps only `> max`.
5. Three rows per tab are not enough: Plow/Magnet/Factory each have 4 rows; the shop scrolls vertically at 640x360 as it already does for Tools (15 rows).
6. Keyboard = Esc/B/E/Tab close as today; no arrow-key node navigation (open decision 4).
7. The legend needs no edit: it groups by `u.tab` at render time and compares counts, not names.

### Risks
- When the F11 agent is still editing `upgrades.ts`/`shop.ts`, then two agents overwrite each other, because both files are in both packages → the implementer starts after the F11 package is done (step 0).
- When open decision 1 is "yes", then a save with `autocrank: 3` and `batch: 0` shows Auto Crank as `needs Bigger Batches` for its next level; levels stay, nothing refunded (row 9 covers it).
- When a path grows to depth 4 later, then 4 x 184 = 736 px overflows 602 px at 640x360 → the layout is data-driven, so this is a data review item, not a code change now.

### Alternatives rejected
- (a) One big tree across all paths on a canvas/SVG with pan and zoom: rejected, the brief asks for "a simple node-and-line view inside the existing shop window"; three small trees with ≤ 6 nodes fit without panning and keep the tab, badge and hover code as is.
- (b) Keep the flat rows and only draw an indent/arrow for `requires` children: rejected, it is not a tree view (BOARD "shows the three paths as a tree with locked/unlocked nodes") and PP asked for "drzewko".
- (c) Move robots into the Plow or Factory path: rejected, `TOOL_IDS` (hotbar, wheel, digit keys, Keep Tools) is derived from `tab === 'Tools'`; moving them means a second explicit id list in four readers for no gameplay gain (open decision 2 records it).

### Ladder
- `Tab` union change + `TREE_TABS` export: rung 6 (minimum), required by "which tabs are trees" and by the legend grouping (row 13).
- `tree()` + `rowData()` in `shop.ts`: rung 6; required by rows 1-9. `rowData()` exists only so the node and the row share the same five computations (rung 2 within the file).
- SVG `<path>` for edges: rung 3 (platform); required by "node-and-line". No library.
- CSS rules: rung 6, one block; required by rows 1, 3, 6, 12.
- Toast text: rung 5, row 14.
- No new file, no new dependency, no new state field, no save migration.

### Open decisions (for PP / orchestrator tonight)
1. Factory chain `Gears → Batches → Auto Crank` (new gating, not in F11): a) add it, then Auto Crank needs Bigger Batches 1 ($500, hole 2) and Batches needs Gears 1 ($40); a Factory player who skips Gears pays $40 extra; b) no new edges, then the Factory tab is 6 roots in one column and the only "tree" is the F11 edges in Plow and Magnet. (recommendation: a, because every automation path in the night simulator buys Gears first anyway and the tab otherwise is a list drawn as boxes.) `Pewność: Likely`.
2. [spec silent] Zakładam: Cleaning Robot and Bigger Bed / Faster Motor / Wider Area stay in the flat Tools tab (as a `needs Cleaning Robot` group) | Dowód: `src/data/upgrades.ts` `TOOL_IDS = UPGRADES.filter(u => u.tab === 'Tools' …)`, read by `hud.ts:267`, `wheel.ts:83`, `player.ts:830`, `hole.ts:518` | Jeśli źle: a robot in a tree tab vanishes from the hotbar, the wheel and Keep Tools | Pewność: Confident | rekomendacja: a) keep them in Tools.
3. [spec silent] Zakładam: Strong Arm and Trick Scope are roots of the Magnet path (throwing by hand) with no edge between them; Steel Toes is a root of the Plow path; Gnome Glue a root of Factory; Running Shoes, Spring Socks, Gnome Boots, Coin Magnet, Laptop stay in a flat Movement tab | Dowód: `upgrades.ts:21-37, 62-69` (16 + 6 members vs 10 + 5 named) | Jeśli źle: an upgrade sits in the wrong tab and a player looks for it in the wrong place; no money or save effect | Pewność: Likely | rekomendacja: a) as assumed; b) `scope` requires `throw` ($15) and `tractor` requires `blower` ($150) for longer chains: not recommended, forced buys were not asked.
4. Arrow-key navigation between nodes (brief says "keyboard/mouse"): a) mouse click/hover + the existing Esc/B close only; b) add arrow keys + Enter to buy with a focused node. (recommendation: a, because the flat list has no key navigation today and the wheel/shop keys already overlap; b is a separate small task if PP wants it.)

### Self-check
- Every acceptance criterion (BOARD done-when + brief questions) has a step and a Done-when line: tree with locked/unlocked nodes (rows 1-3, 6), same prices/ids (row 4), old saves (row 9), flat tabs (10, 16), fits 640x360 (12), now/next (8), DOM only on open (Data section, no per-frame work).
- Each step names file, signature, values (`CW`, `CH`, class names, tab order, exact toast text).
- `state.upgrades` writers and `tab` readers listed with `file:line`.
- Lists compared with code: Movement 16 vs 10 named, Products 6 vs 5 named, Tools "robots?" → 3 `spec silent` rows; Done-when lines = 19 = matrix rows.
- Decisions relied on: F11 (2026-10-20), polish-c (2026-10-19), robots (2026-10-20), scope (2026-10-20): all under 60 days, nothing to re-ask.
- Plan shorter than the code: the tree renderer, layout, CSS and the scenario are about 150 lines; the plan describes them, it does not write them.
