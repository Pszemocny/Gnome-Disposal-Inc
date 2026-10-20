# Shop as a dark monitor window with the buyable count

## Problem

PP, 2026-10-20: "zrob ten sklep wiekszym ekranem bardziej komputerowy styl. Dodaj tam ilosc mozliwych do kupienia rzeczy." and "ciemny monitor w sklepie". The shop window was 860 px wide with small nodes; the only count of buyable things was the green badge per tab.

Plan: `docs/ai-work/2026-10-20-plan-shop-computer.md`, section `## Plan (plan-senior, final)`, executed as written except the deviations below.

## Summary

- The shop is a dark monitor window: `min(1600px, 96vw)` x `92vh`, title bar `GNOME-OS SHOP` with an `AVAILABLE: n` pill (green when n > 0, grey `AVAILABLE: 0` otherwise; n = the sum of the visible tab badges, Deep counts only when its tab is shown), taskbar-style tabs, system monospace chrome, faint scanlines (`::after`, `pointer-events: none`), a status bar with the last buy message.
- Power-on: one Web Animation (`id: 'crt'`, 250 ms, `scaleY(.02)` → `1.03` → `none`, outCubic) started from `open()` only, so a buy or a tab click (which re-render the window) never replays it.
- Tree: node 120 x 90, badge 60 px, thumbnails rendered at 60 px (`icons.ts`), cell 150 x 94. All tabs fit 1280x720 without scrolling; a tree a little too tall (k ≥ 0.75) shrinks to fit (1024x600), a much taller one (640x360) scrolls as before.
- Description panel has a fixed 64 px height, so a long description cannot add a scrollbar after the fit.
- Buy messages go through `say()`: the HUD toast still fires and the status bar shows the same text; buys without a toast show `<name> bought (LVL n/max)`.
- Shop CSS stays in the module `CSS` string in `shop.ts`, every new rule under `.shop.skill`; `style.css`, the legend, leaderboard and blueprints are untouched.
- Ladder: rung 3 (CSS, Web Animations, system monospace font) for the look, rung 5 for the constants, rung 6 for the fit-height branch, the pill pop guard and `say()`/`msg`.

### Measured tab breakpoint

Nine labelled tabs wrap at 950 px viewport width and below (sweep 1280 → 700 in 20 px steps, then pixel by pixel; Chromium, macOS ui-monospace). Rule: `@media (max-width: 950px) { .shop.skill .tab .tl { display: none; } ... }`. The leaderboard keeps the old `.shop:not(.legend) .tab` rules byte for byte.

### Accepted as is (from the plan)

- R11: thumbnails are 60 px at DPR 1; the thumbnail renderer keeps its own pixel ratio from the quality setting (1.5x on medium = 90 px for a 54 px slot), no second ratio source.
- R12: scanline moiré at a fractional DPR is not checked; PP's Mac is DPR 2.

### Fast-buy timing (10 buys in a row, 1280x720, `scenario-shop-fastbuy.js`, 5 runs)

- Before: 10.6-12.8 ms per 10 buys, median 1.26 ms per buy.
- After: 11.8-13.4 ms per 10 buys, median 1.32 ms per buy. No change a player can notice.

### Deviations from the plan

1. `.pips` row height 6 → 7 px with the 7 px dots (the plan changed only the dots; a 6 px row would cut them by 1 px).
2. `10_pop` buys the Leaf Blower instead of Steel Toes: Steel Toes leaves the total unchanged at $10000, so no pop is expected there; the blower maxes and unlocks two children, so the total changes.
3. `20_msg` expects 2 HUD toasts, not 3: Running Shoes has no toast by design (R8), only Trampoline and the Land tier do. The plan's "Speed" is the `speed` upgrade, named Running Shoes.
4. `scenario-tree.js` needed two more literal changes than the plan listed: `17_kick_root` (`+ 26` → `+ 30`) and `18_glue_root` (`216px` → `300px`).
5. Three regression scenarios were stale for reasons outside this change and got fixture fixes: `scenario-tree.js` `14_toast` expected the old C-without-tool toast (the gear-wheel batch changed it; now checks `Leaf Blower in the shop`); `scenario-leaderboard.js` and `scenario-blueprints.js` built a second instance but read the first overlay, which `main.ts` now creates (leaderboard uses `g.leaderboard`, blueprints reads its own, last, panel).

### Rejected

- Scaling the tree above 1 on big screens (1920x1080 shows Tools at k = 1 with empty space around it): the plan caps k at 1, nobody asked for upscaling.

### Not checked / risk

- HUD toasts now show above the shop (screenshot batch), so at 640x360 a buy toast covers part of the tree for 4.8 s; the status bar duplicates the message. This is the HUD's layering, not changed here.
- The 950 px breakpoint is measured with macOS ui-monospace; on Windows (Consolas) labels may be a little wider or narrower.

## Work progress

### Gotowe, gdy (Done when, final plan)

All runs: `FULL=1 DPR=1 CDP_PORT=9398 node smoke.mjs <out> <scenario>` against `npx vite --port 5199`.

- [PASS] 1 `01_win` — `scenario-shop-computer.js` → `{"w":1229,"h":662,"rowsH":482,"pass":true}`
- [PASS] 2 `02_tools` — `{"transform":"none","sw":1221,"cw":1221,"sh":482,"ch":482,"node":[120,90],"ico":60,"name":"13px","pass":true}`
- [PASS] 3 `03_tabs_fit` — `{"n":9,"of":9,...}` every tab `ok:true,k:1,dx:0,dy:0`
- [PASS] 4 `04_640` — `{"fitW":567,"clientW":591,"sw":591,"transform":"matrix(0.555882, ...)","tl":"none","scrollRange":125,"pass":true}`
- [PASS] 5 `05_1024` — `{"transform":"matrix(0.763949, ...)","k":0.763949,"sh":372,"ch":372,"pass":true}`
- [PASS] 6 `06_head` — title `GNOME-OS SHOP`, avail and money present, `.x` click → `open:false`, `pass:true`
- [PASS] 7 `07_total` — `{"text":"AVAILABLE: 38","sum":38,"cls":"shop-avail on","pass":true}`
- [PASS] 8 `08_zero` — `AVAILABLE: 0`, no `on`, color `rgb(109, 122, 136)`, `pass:true`
- [PASS] 9 `09_deep` — total with Deep minus total without = Deep badge, `pass:true`
- [PASS] 10 `10_pop` — `{"before":"AVAILABLE: 38","after":"AVAILABLE: 39","buyAnims":1,"tabAnims":0,"firstAnims":0,"pass":true}`
- [PASS] 11 `11_foot` — `Gnomes eaten: 0 · Best combo: 0` + `.shop-msg` + `Esc / B to close`, monospace, opacity 1, `pass:true`
- [PASS] 12 `12_overlay` — `::after` `pointer-events: none`, CDP click through it bought `magGun` (1), status `Magnet Gun bought! ...`, `pass:true`; `1280-Tools.png` checked by eye: names, prices, badges readable.
- [PASS] 13 `13_crt_on` — samples `[0.02,0.413,0.724,0.966,1.022,1.013,1.007,1.003,1.001,1]`, final `none`, reopen makes a new animation, `pass:true`; `crt-100ms.png` checked by eye.
- [PASS] 14 `14_tabs` — 9 tabs on one line at 1280, 1024, 800; badge inside tab; active border `rgb(95, 208, 255)`; `labelsWrapAt: 950`, shown at 951, hidden at 950, `pass:true`
- [PASS] 15 `15_thumbs` — `naturalWidth 60, img 54, desc ico 40`, `pass:true`
- [PASS] 16 `16_legend` — legend window 980 px, `::after` `none`, 0 animations, Fredoka, `pass:true`
- [PASS] 17 regressions — `scenario-skill-tree.js` 20/20 pass; `scenario-tree.js` 19/19; `scenario-shop-badges.js` 7/7; `scenario-skill-tree-fresh.js` 3/3; `scenario-shop-reopen.js` `pass:true`; `scenario-esc.js`, `scenario-legend-wired.js`, `scenario-prereqs-tree.js` (no `pass` fields) read step by step: B/E open the shop, Esc closes it, legend L/Esc, prereqs and prices as expected; `LOGS:` empty in all; `npx tsc --noEmit` → exit 0.
- [PASS] 18 `18_no_replay` — `{"winAnims":[0,0,0,0,0,0],"kick":1,"pass":true}`
- [PASS] 19 `19_desc` — `{"descH":[64,64],"fits":[true,true],"pass":true}`
- [PASS] 20 `20_msg` — `["Trampoline bought! Press 2 to place it.","Running Shoes bought (LVL 1/5)","You bought Garden! More room for gnomes and machines.",""]`, 2 matching HUD toasts, `pass:true`
- [PASS] 21 `21_siblings` — `{"pad":"8px 10px","pass":true}`; `scenario-leaderboard.js` and `scenario-blueprints.js` (no `pass` fields) read step by step after the fixture fix: board opens from the pause menu, top 10 sorted, HTML shown as text; blueprints K opens, Esc closes, save/load positions exact.

Extra: `scenario-gear-wheel.js` all sub-checks `G*pass/W*pass/K*pass: true`; `shot.js` row3 (P in the shop) `png:true, hudHasShop:true, tabClickWorks:true`. Screenshots at 640x360 (`640-Tools.png`), 1280x720 (`1280-Tools.png`), 1920x1080 (`1920-Tools.png`) checked by eye.

### Self-check

- Only what the plan asks: one new helper (`say`), two fields (`total`, `msg`), one new span pair in the head and foot, CSS under `.shop.skill`. No new dependency.
- Reuse: `pop()` for the pill, `affordCount()` for the total (same source as the tab badges), Web Animations as in `pop()`.
- Animation rules: the power-on is time-based with an ease, the pill pop reuses `pop()` (outBack), no `Math.min(1, dt` added.
- Files: `src/ui/shop.ts`, `src/ui/icons.ts`, `docs/PLAN.md`, `CHANGELOG.md`, this note; scenarios in the session scratchpad (`scenario-shop-computer.js`, `scenario-shop-fastbuy.js`, edits to `scenario-skill-tree.js`, `scenario-tree.js`, `scenario-leaderboard.js`, `scenario-blueprints.js`).
