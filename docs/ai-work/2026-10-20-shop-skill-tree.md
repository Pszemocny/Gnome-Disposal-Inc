# Shop as a skill tree with graphics

## Problem

PP, 2026-10-20: "Wez tam popros kogos aby przerobil sklep na takie drzewko umiejetnosci moze jakies bardziej fancy z grafikami". PP picked icon option b: 3D model pictures for the tools, emoji for the stat upgrades. Deep as a tree, Land as a chain and a fallback icon for unknown ids were applied as recommended (PP did not object).

Interpretation: every shop tab (Land and Deep too) becomes a skill tree of round badges; ids, prices, levels and saves stay the same. Executed: `## Plan (plan-senior, final)` in `docs/ai-work/2026-10-20-plan-shop-skill-tree.md`.

Superseded decisions: `2026-10-20-plan-upgrade-tree.md:11` ("every other tab stays a flat list") and `2026-10-20-upgrade-tree.md:3` decision 2 a) ("robots stay in the flat Tools tab": robots stay in Tools, the tab is now a tree).

## Summary

- `src/ui/icons.ts` (new): emoji table for every upgrade (+ `fuses` for the next agent), tab and land icons, `MODELS` (every placeable tool through `machineVisual`, plus tractor, blower, Magnet Gun), `warmThumbnails()` renders each model once per session on its own short-lived `WebGLRenderer` (disposed and context lost in `finally`), so the game renderer is never touched. A builder that throws or draws nothing keeps its emoji.
- `src/ui/shop.ts`: one `tree()` for every tab. Column = hole-level tier, pushed right of the parent; rows packed, the first child keeps its parent's row. Lines light up blue when the parent is owned. Node states: afford (green ring + CSS pulse), owned (blue), maxed (gold), locked (grey + lock), needs (dashed). Purchase pop = Web Animations (outBack up, outBack back, 300 ms), so it plays beside the pulse. The description panel is rebuilt from the hovered id after every render (fresh level and price), the scroll position survives a buy, the tree scales down to fit a narrow window.
- `src/data/upgrades.ts`: the unused `TREE_TABS` export removed (plan step 5).
- `docs/PLAN.md`: shop section rewritten.

Ladder: icons table rung 2 (the `TOOL_ICONS` pattern), thumbnails rung 4 (installed three renderer, canvas `toDataURL`), CSS states/pulse and WAAPI pop rung 3, the ~30-line tier layout rung 6.

## Work progress

Scenarios (session scratchpad `smoke/`, dev server 5199, Metal headless, `CDP_PORT=9384`): `scenario-skill-tree.js` (new, 20 steps), `scenario-skill-tree-fresh.js` (new, first open of the session), `scenario-tree.js` (rewritten for the tree DOM, counts now derived from `UPGRADES`, so a new row such as `fuses` does not break them), `scenario-tree-shots.js` (all tabs), plus the flat-DOM readers moved to `.node` (`scenario-prereqs-shot.js`, `scenario-polish-c.js`, `scenario-robots2.js`, `scenario13.js`, `scenario-scope.js`) and `scenario-tractor.js` (old Movement tab → Plow).

Measured: first open of the session 142-144 ms on the GPU (Metal headless, dev build; the 5300 build was not touched by rule), 2339 ms on SwiftShader; second open 0.7 ms. Under the plan's 400 ms rule, so the thumbnail pass stays in the first `open()`. `CH` = 80 (84 left Tools scrolling at 1280x720).

### Done when
- [PASS] 1 counts per tab — `scenario-tree.js` → `1_counts:PASS` (all 9 tabs, rows 0, paths Plow 3, Magnet 1, Factory 2, Tools 4, Land 3).
- [PASS] 2 Land chain — `scenario-skill-tree.js` → `02_24_land_chain:PASS` (land 1, money 500).
- [PASS] 3 layout — `03_layout:PASS` (blackhole 648px, robotArea 240px = 3 x CH 80, crateSize 108px, autocrank 324px, glue 216px 0px).
- [PASS] 4 hole-locked (grayscale, HOLE LVL 3, money kept) — `04_05_locked_needs:PASS`; also `scenario-tree.js 2_hole_locked:PASS`.
- [PASS] 5 needs parent (cost empty, no level) — `04_05_locked_needs:PASS`.
- [PASS] 6 buy + pop — `06_26_31_pop:PASS` ($25 → money 1975, pips 1, $37, pop animation present).
- [PASS] 7 deny shake — `scenario-tree.js 5_deny:PASS`.
- [PASS] 8 maxed — `scenario-tree.js 6_maxed:PASS`.
- [PASS] 9 lit edges — `09_10_lit_edges:PASS`.
- [PASS] 10 dashed vs solid — `09_10_lit_edges:PASS` (`strokeDasharray` none only on lit paths).
- [PASS] 11 NEW once — `scenario-tree.js 7_new_badge:PASS`.
- [PASS] 12 hover description — `12_hover_desc:PASS` (`<b>Magnet Coil</b>`, `LVL 2/10`, now/next text, `.ico`, `data-desc` without `<`, locked text).
- [PASS] 13 thumbnails — `13_thumbs:PASS` (box PNG, naturalWidth = 52 x pixel ratio, crateSize 📐, 11 pictures on Tools).
- [PASS] 14 open time — `scenario-skill-tree-fresh.js 14_first_open:PASS` (142 ms), `14_second_open:PASS`; `grep -c "update(" src/ui/shop.ts` → 0.
- [PASS] 15 pips — `15_pips:PASS` (kick 5 dots, 2 lit; value `0/20`).
- [PASS] 16 tabs — `scenario-tree.js 11_tab_order:PASS` (`.tl` order, every button has `.ti`), `16_tabs_640:PASS` (label hidden, default Tools).
- [PASS] 17 fit at 640x360 — `17_fit_640:PASS` (scale 0.7x, origin 0 0, no sideways scroll).
- [PASS] 18 1280x720 — `18_38_fit_1280:PASS` (transform none, no scroll either way, CH 80).
- [PASS] 19 keys — `scenario-shop-reopen.js` → `openedByB: true, afterCloseB: false, afterEsc: false`; `FULL=1 DPR=1 scenario-esc.js` → `13_E_at_desk shop:true`, `14_esc_in_shop_desk shop:false locked:true`.
- [PASS] 20 tool toast — `20_tool_toast:PASS` (`Press 2 to place it`, hotbar Trampoline).
- [PASS] 21 legend — `scenario-legend-wired.js` → `upgrades 52, UPGRADES 52`, 12 h3 unchanged; `scenario-tree.js 13_legend:PASS`.
- [PASS] 22 old save — `scenario-tree.js 9_old_save:PASS` (pips 2, needs, click keeps 2).
- [PASS] 23 Deep — `23_deep:PASS` (5 nodes at 0px, 💎 1, shards 2, no `.deep` class).
- [PASS] 24 Land paths 3 — `02_24_land_chain:PASS`.
- [PASS] 25 unknown id — `25_unknown_id:PASS` (🔧, column right of robot).
- [PASS] 26 pop curve — `06_26_31_pop:PASS` samples every 50 ms over 0..300 ms: peak ≥ 1.1 between 100 and 200 ms, 1 at 300 ms (asserted); screenshot `pop-peak-150ms.png` checked by eye (Magnet Coil badge visibly larger).
- [PASS] 27 pulse stops when hidden — `27_hidden_stops_pulse:PASS`.
- [PASS] 28 shake within a frame — covered by line 7.
- [PASS] 29 land size + NEW — `29_land_size_new:PASS`.
- [PASS] 30 a builder throws — `scenario-skill-tree-fresh.js 30_37_failed_builders:PASS` (zz undefined, 14/14 real pictures, scissor false, game renders after close).
- [PASS] 31 pop while still affordable — `06_26_31_pop:PASS` (class afford, 2 animations).
- [PASS] 32 description fresh after buys — `32_33_spree_640:PASS`.
- [PASS] 33 scroll kept — `32_33_spree_640:PASS` (10 buys over 3 upgrades at 640x360, scrollTop 100 and current level/price after each).
- [PASS] 34 unknown tab — `34_unknown_tab:PASS`.
- [PASS] 35 rain exposure — `35_exposure:PASS`: crate mean luminance 43 with exposure 0.2 on the game renderer, 43 without (`zz-fresh-noexp.js`). The plan's ≥ 80 does not fit a brown crate; the check is "same as without rain".
- [PASS] 36 leaderboard tabs — `36_leaderboard_tabs:PASS` (`8px 10px` at 1280).
- [PASS] 37 empty model — `30_37_failed_builders:PASS` (zzEmpty undefined, badge 🔧).
- [PASS] 38 magnet without drop ring — eye check of `1280-Tools.png`: the Gnome Magnet badge shows the crane, no yellow ring.
- [PASS] 39 regressions — `scenario-tree`, `scenario-prereqs-tree`, `scenario-prereqs-shot`, `scenario-polish-c`, `scenario-robots2`, `scenario13`, `scenario-scope`, `scenario-tractor`, `scenario-blower`, `scenario-magnet-gun`, `zz-scenario15-scope`, `scenario-shop-reopen`, `scenario-legend-wired`, `scenario1`, `scenario-esc` (FULL=1 DPR=1), `scenario-robots`, `scenario-crate-price`: `LOGS:` empty in every run, shop steps as expected. Not shop: `scenario13` step `obstacles` reads `g.env['obstacleBodies']`, which no longer exists; `scenario-robots2 c17` expects MAX at robot level 4, the cap is 12 now.

### Deviations from the plan
- `CH` 80 instead of 84 (allowed by R13), plus smaller shop chrome on the tree tabs: tab type 14 px / padding 8px 6px (the icon + label tabs wrapped to two lines at 1280 and ate 50 px), head padding 8 px, rows padding 4 px. Measured, not estimated.
- Tags sit on the top rim of the badge, not above the node: above the node they covered the name of the node one row up.
- An edge that skips a column (Bigger Batches → Auto Crank over Gnome Glue) runs in the gap under the row, so it does not look like it goes through Gnome Glue.
- Pop: outBack per keyframe (up in 150 ms, back in 150 ms). With one easing over the whole 300 ms the peak came at 50 ms and the badge sank to 0.96.
- Box of a model = visible meshes only (`Box3` counts hidden children, e.g. the 12 m robot area ring); hidden parts are also not disposed, because the robot hats share one geometry with the robots in the world.
- `.shop-desc` does not shrink (`flex: none`) and uses 12 px under 700 px: a long description overflowed upward over the tree at 640x360.
- Done when 35 threshold, see the line above. First-open time measured on the 5199 dev server with Metal, because the 5300 build is off limits for agents.

### Rejected
- `scenario-prereqs.js`: superseded by `scenario-prereqs-tree.js` (same steps on the tree tabs, already in the scratchpad); not rewritten, `scenario-prereqs-tree.js` ran instead.
- `scenario13` `obstacles` and `scenario-robots2 c17` expectations: not shop code, → separate task if wanted.
