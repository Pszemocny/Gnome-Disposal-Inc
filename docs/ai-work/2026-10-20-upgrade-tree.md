# Upgrade tree: Plow / Magnet / Factory paths in the shop (2026-10-20, night)

Plan: `docs/ai-work/2026-10-20-plan-upgrade-tree.md` (final), with the orchestrator decisions at its top: 1 a) Gears → Batches → Auto Crank edges; 2 a) robots stay in the flat Tools tab; 3 a) Strong Arm and Trick Scope are Magnet roots, Steel Toes is the Plow root, Gnome Glue a Factory root, the rest of Movement stays flat; 4 a) mouse plus the existing close keys. Magnet Dish has no `requires` any more, so it is a Magnet root, and the Magnet tab has 1 edge, not 2.

Interpretation: change `src/data/upgrades.ts` (tabs, order, two new edges), `src/ui/shop.ts` (tree view) and `docs/PLAN.md`. `src/ui/style.css` and `src/player/player.ts` belong to other agents tonight: the CSS lives in a `<style>` element the shop appends, the toast line is listed below for the orchestrator.

## Problem

When a player opens the shop, all upgrades of a path (plow, magnet, factory) sit in long flat lists across two tabs, so the player cannot see which upgrade opens which, because the `requires` edges only showed as a red "needs X" badge on a row.

## Summary

`src/data/upgrades.ts`:
- `Tab` is now `Plow | Magnet | Factory | Movement | Tools | Combos | Bonuses | Land | Deep` (no `Products`); new export `TREE_TABS = ['Plow', 'Magnet', 'Factory']`.
- Plow: Steel Toes, Plow Tractor → Wider Plow, Leaf Blower → Turbo Fan + Long Nozzle. Magnet: Magnet Gun → Magnet Coil, Magnet Dish, Strong Arm, Trick Scope. Factory: Factory Gears → Bigger Batches → Auto Crank, Premium Gnomes, Gnome Permit, Gnome Glue. Movement keeps Running Shoes, Spring Socks, Gnome Boots, Coin Magnet, Laptop.
- New edges: `batch` requires `factorySpeed`, `autocrank` requires `batch`. No id, price, max or hole level changed.
- The lines are grouped in tab order (Plow, Magnet, Factory, Movement, Tools, ...), so the legend lists them in the shop's tab order too. The Auto Crank comment now says "about $154k" for 12 levels (base $600 since tonight; it said $309k).

`src/ui/shop.ts`:
- Tabs in order PLOW, MAGNET, FACTORY, MOVEMENT, TOOLS, COMBOS, BONUSES, LAND, DEEP; default tab stays Tools.
- `rowData(u)`: the level, lock, needs, max, price, afford and description that a flat row and a tree node both show (was inline in the row code).
- `tree(tab)`: nodes 164 x 56 px on a 184 x 66 px grid; column = depth along `requires`, the first child sits on its parent's row, the next root starts below the last used row; one SVG elbow line per edge. A parent from another tab is not drawn, so its child becomes a root (the buy guard still applies). Node states: `locked` (`???`, `HOLE LVL n`), `needs` (real name, red `needs <Parent>` badge, no price), `maxed` (`MAX`, blue border), `afford` (green border, `AFFORD` badge), `NEW` badge as in the list. The whole node is the buy button (`data-buy`), hover fills the description line (`data-desc`), both through the existing handlers; `buy()` already refuses locked, needs and maxed.
- Badges on a node sit on its top border, so the name and level stay readable; the content of a locked or needs node is dimmed, its badges are not.
- The `needs` badge got a class rule (`.badge.needs`, red) instead of the inline colour on the flat row.
- Tab buttons are a bit narrower (`padding 8px 10px`; below 700 px wide 12 px font), because nine tabs with Deep wrapped into two lines at 1280x720 and eight tabs wrapped at 640x360, which hid most of the tree.
- The tree is built only in `render()` (open, tab click, buy); nothing runs per frame.

`docs/PLAN.md`: the shop section lists the three paths with their edges and the new Movement tab.

Ladder: rung 2 for everything the node shows (same badges, hover, click handler, `missing()`, `buy()`); rung 3 for the lines (inline SVG, no library); rung 6 only for the layout walk (about 20 lines) and the CSS block. No new file, dependency, state field or save migration.

### Line for the orchestrator (player.ts is owned by another agent tonight)

`src/player/player.ts`, inside `if (inp.hit('KeyC'))` (line 845 tonight):
- old: `ctx.hud.toast('Buy the Plow Tractor or the Leaf Blower in the shop (Movement).', 'info');`
- new: `ctx.hud.toast('Buy the Plow Tractor or the Leaf Blower in the shop (Plow).', 'info');`

## Gotowe, gdy (plan "Done when", run locally)

Command: `CDP_PORT=9361 MAXPOLL=2400 node smoke.mjs run-tree scenario-tree.js` (session scratchpad `smoke/`, dev server 5199). Result `LOGS:` empty.

- [PASS] 1 counts — Plow `nodes 6, paths 3, rows 0`; Magnet `nodes 5, paths 1` (1, not 2: Magnet Dish is a root after the orchestrator decision); Factory `nodes 6, paths 2`.
- [PASS] 2 hole-locked — tractor at hole 1: `cls "node locked", name "???", cost "HOLE LVL 3"`, click → money 10000.
- [PASS] 3 needs parent — `cls "node needs", name "Wider Plow", tags "needs Plow Tractor"`, click → money 10000, `plowWidth` undefined.
- [PASS] 4 buy — before `AFFORD`; after `money 1975, lvl 1`, node `Magnet CoilLVL 1/10$37`.
- [PASS] 5 deny — money stays 10, `.shop-money` has `shake` after 1 frame.
- [PASS] 6 maxed — Turbo Fan `cost "MAX", cls "node maxed"`, click → money and level unchanged.
- [PASS] 7 NEW — hole 1 → 3: tractor tags `NEW`; reopened: no `NEW`. (The scenario resets the shop's seen-set to "a fresh session at hole 1", because earlier steps had already seen hole 12.)
- [PASS] 8 hover — `... (now: 1.2 m ball, 8.2 m reach, next: 1.4 m ball, 8.8 m reach)`; locked node → `Feed the hole to find out.`
- [PASS] 9 old save — `{ plowWidth: 2 }`, tractor 0, booted in an iframe from localStorage: `loaded 2`, node `Wider PlowLVL 2/5needs Plow Tractor`, class `needs`, click → still 2, money unchanged.
- [PASS] 10 flat tabs — Tools `rows 15, nodes 0`, `Bigger Crateneeds Wooden Crate`; Movement 5 rows.
- [PASS] 11 tab order — `PLOW,MAGNET,FACTORY,MOVEMENT,TOOLS,COMBOS,BONUSES,LAND`, with shards `...,DEEP`; no `Products` tab.
- [PASS] 12 640x360 — `vw 640, treeW 532, maxNodeRight 579 <= winRight 621, scrollW 581 = clientW 581`.
- [PASS] 13 legend — Tools tab `h3`: `Keys, Plow, Magnet, Factory, Movement, Tools, Combos, Bonuses, Deep`, `.lg-up` 52.
- [FAIL, handed over] 14 toast — text is still `... in the shop (Movement).`, because `player.ts` is not my file tonight; the exact line is above. Passes once the orchestrator applies it.
- [PASS] 15 tools — `TOOL_IDS` = 11 ids ending with `robot` (no `robotBed`), hotbar slot `Cleaning Robot`, wheel items `hands, robot`.
- [PASS] 16 Movement — `speed,jump,boots,magnetRange,laptop`.
- [PASS] 17 Steel Toes — `left 0px, top 0px`, no path ends at it (`M164 94H174V94H184`, `M164 160H174V160H184`, `M164 160H174V226H184`).
- [PASS] 18 Gnome Glue — `left 0px`.
- [PASS] 19 parent in another tab — `scope.requires = 'box'` on the game's module instance: scope at `left 0px`, paths still 1, badge `needs Wooden Crate`, click → not bought, no exception; reset afterwards.

Regressions:
- `scenario-prereqs-tree.js` (copy of `scenario-prereqs.js` with the new tab names, nodes as buy buttons, Magnet Dish pair removed, Factory pairs added, Auto Crank base 600) → every pair `moneyKept true, levelKept true` before and `paid == price` after, incl. `batch` (needs Factory Gears) and `autocrank` (needs Bigger Batches); Auto Crank L11 `$51.9k = 51899`; Glue max 3, old save with 5 loads as 3. `LOGS:` empty. The old `scenario-prereqs.js` clicks `[data-tab="Products"]` and Magnet Coil as a `.row`, so it no longer fits the shop.
- `zz-scenario15-scope.js` → same values as before (fan ratio 0.99, green arc throw eaten 1, crate 10 inside, hoop bullseye true, parade 16). `LOGS:` empty.
- `scenario-legend-wired.js` (copy of `scenario-legend.js` that uses `gnome.legend`; the old one creates a second `Legend` while main.ts already creates one, so it reads the wrong `.legend` element) → `upgrades 52 = UPGRADES 52`, gnomes 12, mushrooms 6, L/Esc open and close. `LOGS:` empty.
- `npx tsc --noEmit` → exit 0, no output. `grep -n "Math.min(1, dt" src/ui/shop.ts src/data/upgrades.ts` → nothing (no animation added).

Screenshots (`CDP_PORT=9362 MAXPOLL=2400 node smoke.mjs run-tree-shots scenario-tree-shots.js`, checked by eye), in `<scratchpad>/smoke/run-tree-shots/`: `1280-Plow.png`, `1280-Magnet.png`, `1280-Factory.png`, `1280-Tools.png`, `640-Plow.png`, `640-Magnet.png`, `640-Factory.png`, `640-Tools.png`, `640-Factory-deep.png` (Tools tab with the Deep tab visible). Measured: tabs fit one line at both sizes, also with Deep; the tree area is 435 px high at 1280x720 (the whole tree fits) and 127 px at 640x360 (about two node rows, the rest scrolls, like the flat list). First pass: the `needs Plow Tractor` badge wrapped into two lines and covered the name, and the dim state also dimmed the badges; fixed with `nowrap` badges on the top border and dimming only the node content.

## Rejected

- Arrow-key navigation between nodes: orchestrator decision 4 a).
- Moving robots into a tree tab: decision 2 a); `TOOL_IDS` depends on the Tools tab.
- Updating `docs/PLAN.md` line 127 ("Shop + Movement/Products/..."): it is the history of milestone 2, not the current shop.

## Uncertain

- At 640x360 the tree shows about two node rows at a time and scrolls, because the shop window keeps its header, description and footer; the flat Tools list shows one to two rows there as well.
- Auto Crank now needs Bigger Batches and Bigger Batches needs Factory Gears: a save with Auto Crank levels and no Batches keeps its levels but cannot buy the next Auto Crank level until Batches is bought (plan risk, accepted with decision 1 a).
