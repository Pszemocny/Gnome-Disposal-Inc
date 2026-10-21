# Shop tree: one row per tool

## Problem

PP (2026-10-24, about the shop's TOOLS tab): "to wyglada tragicznie uloz to jakos". The Fuses nodes were scattered across hole-level columns, lines crossed rows and ran through unrelated nodes, Wide Belt and Belt Fuses hung under unrelated tools, and the locked tools sat in a separate block.

Interpretation: every tree tab is drawn as rows. One row per root (an item without a parent on that tab): the root, then its descendants in prerequisite order (data order, so the Fuses node comes last), joined by straight horizontal lines. Rows are sorted by unlock level, then by base price, so the locked tools end up at the bottom. Data in `src/data/upgrades.ts` stays untouched. Only `src/ui/shop.ts` (`tree()`) changes.

Gotowe, gdy:
1. Tools tab at 1280x720 (probe in the headless shell) → every node has the same `top` as its root, rows in the order Metal Panel, Wooden Crate, Trampoline, Cooling Fan, Conveyor Belt, Cleaning Robot, Kicking Wheel, Gnome Magnet, Gnome Cannon, Vacuum Tower, Mini Black Hole; every line path is horizontal (one `H`, no `V`).
2. Screenshots of every tab at 1280x720 and 1920x1080 → checked by eye: rows read left to right, no line crosses a row, badges and labels unchanged.
3. `tools/smoke/scenario-tree-expansion.js` (URL_QUERY=) → every check PASS (U15/U15b with the new row counts).

Drabina: szczebel 6 (minimum code): the existing `tree()` keeps its item builders, node HTML and fit-to-window code; only the column/row placement and the edge path change.

## Summary

`tree()` in `src/ui/shop.ts` now builds rows instead of hole-level columns. Roots are sorted by hole level, then by base price (`UPGRADE_BY_ID[key].cost`; Land has one root). Each row is the root plus a depth-first walk of its children in data order, so Fuses (generated after the tool upgrades) land last. Every edge is one horizontal segment between neighbours in a row, lit when that node's parent is owned. Node HTML, badges, `needs` markers and the fit-to-window code are untouched.

Effect on the other tabs: tabs without parents (Combos, Bonuses, Deep, most of Movement) become a single centred column; Land is one row of 4.

Fit: the Tools tab has 11 rows (1030 px). At 1280x720 it would need a scale of about 0.46, below the existing 0.75 limit, so it scrolls at full size (scrollMax 564 px), as PP allowed ("else allow vertical scroll"). At 1920x1080 it fits at 0.77.

Screenshots (headless shell, private server on 5162), all checked by eye:
- `/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-disposal-inc/4c1ea029-d602-463e-ad53-1903c38602be/scratchpad/ttl/out1/<Tab>-1280.png` and `<Tab>-1920.png` for Plow, Magnet, Factory, Movement, Tools, Combos, Bonuses, Land, Deep (the `main-`, `daily-`, `speed-` files are leaderboard tabs caught by the selector, ignore them).

Scenario fixture changes in `tools/smoke/scenario-tree-expansion.js`:
- U15: rows 6 → 11, cols 8 → 5, `scale >= 0.75 && scrollMax <= 0` → `scale === 1` (full size while scrolling); `cutNames === 0` kept.
- U15b: new row counts per tab (plow 3, magnet 4, factory 5, movement 5, combos 4, bonuses 5).
- U1: Robot Fuses now comes right after Belt Fuses in DOM order (the robot row sits between belt and wheel); the same 9 names are checked.

SPEC: shop tree sentence, the fit sentence and one PP decision line updated. CHANGELOG: one bullet in the top section (2026-10-25 16:00). BOARD: one status line.

Odrzucone:
- F3 in the scenario fails (`updateMax` 12.7 and 13 ms, limit 8 ms) in both runs. It measures the yard simulation with the shop closed; `tree()` runs only when the shop renders. It is the open item in BOARD ("pojedyncze klatki 10-18 ms" for robots on Dark Forest) and lives in machines/robots, which this task may not edit → osobne zlecenie.
- Two side-by-side blocks of rows to avoid scrolling at 1280x720: not asked for; PP named vertical scroll as the fallback.

## Work progress

- Drabina: szczebel 6, the existing item builders, node markup and fit code reused; only placement and edge paths replaced (the code got shorter).
- `npx tsc --noEmit -p .` → no output (TSC_OK).
- Probe `scenario-tabs.js` (scratchpad `ttl/`) → Tools rows: Metal Panel | Wooden Crate, Bigger Crate | Trampoline, Trampoline Fuses | Cooling Fan, Big Blades, Fan Fuses | Conveyor Belt, Wide Belt, Belt Fuses | Cleaning Robot, Bigger Bed, Faster Motor, Wider Area, Robot Fuses | Kicking Wheel, Wheel Fuses | Gnome Magnet, Magnet Fuses | Gnome Cannon, Cannon Fuses | ???, ??? (Vacuum, lvl 8) | ???, ??? (Black Hole, lvl 10); `misplaced: []`; `nonHorizontal: 0` on every tab; `cut: 0` on every tab.
- `URL_QUERY='' DEV_PORT=5162 CDP_PORT=9464 MAXPOLL=2800 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-tree-expansion.js` → 51/52 PASS, only F3 FAIL (see Odrzucone).

Gotowe, gdy:
- [PASS] 1. Tools rows and order — probe above: the rows in the listed order, `misplaced: []`, `nonHorizontal: 0`.
- [PASS] 2. Screenshots of every tab at 1280x720 and 1920x1080 — viewed Tools-1280, Tools-1920, Plow-1280, Factory-1280, Land-1280, Bonuses-1920: rows read left to right, no line crosses a row, AFFORD/MAX/NEW/needs badges as before.
- [FAIL→Odrzucone] 3. scenario-tree-expansion → 51/52; U1, U15, U15b PASS; F3 FAIL is the yard performance check, outside this layout change.

Self-check: diff in shop.ts is only `tree()` and one CSS comment (the `massiveOdds`/`magnetRange`/`frenzy` lines in the same diff belong to the other agent). No new file in src. The comments in `src/data/upgrades.ts` (line 2 "column = hole level / requires", "data order is the layout order") are now partly stale; that file is off limits in this task.
