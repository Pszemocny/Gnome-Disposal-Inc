# HUD bottom row: hotbar, magnet panel, gear line

Interpretation: the left-column batch (`2026-10-20-hud-right-stack.md`, "batch 2: A", Odrzucone) left two bottom-row overlaps. PP's HUD rule: "wszystko rob tam [...] tak aby nic na siebie nie nachodzilo". Fix them: at 1280x720, 1920x1080 and 640x360, with 10 placeable tools owned and the Magnet Gun in hand, the hotbar, the gear line, the magnet panel, the left column and the help line do not overlap and the hotbar stays inside the window. Trivial: one production file (`src/ui/style.css`), no data path.

Gotowe, gdy:
- `CDP_PORT=9381 node smoke.mjs <out> scenario-bottom-row.js` → `S_1280.pass:true` (10 slots, `overlaps:[]`, `inside:true`, also with the widest magnet panel texts), same with the Cleaning Robot owned (11 slots)
- same → `S_1920.pass:true`
- same → `S_640.pass:true` and `S_640_robot.pass:true`

## Problem

- 1280x720: hotbar `[283..997]`, magnet panel `[16..295]` → they overlap (slot 1 under the panel).
- 640x360: hotbar `[-37..677]` (wider than the window), overlaps the magnet panel and the help line.
- 1920x1080: fine.

## Summary

- `src/ui/style.css` only. `.hud-hotbar` is no longer centred with `translateX(-50%)`: it spans `left: 324px; right: 324px` (16 + panel max 300 + 8) and centres its slots inside; `.slot` is `flex: 0 1 66px; aspect-ratio: 1; min-width: 0`, so slots shrink when the row is short (1280x720: 58 px with 10 tools, 52 px with 11; 1920: 66 px). `.hud-sack` gets `max-width: 300px`.
- `max-width: 700px`: magnet panel `max-width: 210px` (the column width), label 12 px, key hint hidden; hotbar `left: 234px; right: 12px; bottom: 20px` (right of the column / panel, above the help line), gap 3 px, icon 18 px, key and count 9 px (640x360: 37 px slots, 33 px with the robot).
- Ladder: rung 3 (flexbox shrink, `aspect-ratio`, the existing 700 px breakpoint and the column's 210/234 px numbers). No JS.
- Decision: slots shrink instead of wrapping to a second row, because a second row would reach the gear line and the first-use hint above the hotbar. The magnet panel loses the key hint at ≤ 700 px: with it the panel wrapped to 97 px and went under the column (`sackxcolumn` in the first green run); the H card lists the same keys.
- `scenario-broom.js` moved to scratchpad `smoke/obsolete/` (tests the Push Broom PP removed on 2026-10-20, "Wywal miotłę"; cannot pass by design).
- `BOARD.md` (Interfejs: one line + one decision), `CHANGELOG.md` (`## next build (not on 5300 yet)`).

Odrzucone:
- Crash box (error overlay, `min(560px, 92vw)` wide, bottom left, z 100) still covers the bottom row when an error shows (`crashHits` at all sizes): it is the error overlay and must stay on top (same decision as the left-column batch).
- H controls card covering the hotbar at 640x360 when opened: accepted in the left-column batch (player opens and closes it); the scenario closes it.

## Work progress

- First green run: 1280/1920 pass, 640 `overlaps ["sackxcolumn"]` (panel 97 px tall from wrapped label and hint) → hint hidden at ≤ 700 px.

### Gotowe, gdy — evidence

`CDP_PORT=9381 MAXPOLL=600 node smoke.mjs br-green scenario-bottom-row.js` (dev 5199), `LOGS:` only STEP lines:
- [PASS] 1280 — `S_1280 {"slots":10,"slotW":58,"hotbar":{"l":324,"r":956},"sack":{"l":16,"r":295},"worst":[{"r":307},{"r":304}],"overlaps":[],"inside":true,"pass":true}`; `S_1280_robot {"slots":11,"slotW":52,"overlaps":[],"inside":true,"pass":true}`
- [PASS] 1920 — `S_1920 {"slots":10,"slotW":66,"overlaps":[],"inside":true,"pass":true}`
- [PASS] 640 — `S_640 {"slots":10,"slotW":37,"hotbar":{"l":234,"t":303,"r":628,"b":340},"sack":{"l":16,"t":279,"r":226,"b":344},"column":{"b":266},"help":{"t":342},"overlaps":[],"inside":true,"pass":true}`; `S_640_robot {"slots":11,"slotW":33,"overlaps":[],"inside":true,"pass":true}`
- Screenshots checked by eye: `bottom-1280.png` (panel and slot 1 apart, gear line above), `bottom-1920.png`, `bottom-640-robot.png` (11 small slots right of the panel, icons and counts readable, help line below).
- [PASS] tsc — `npx tsc --noEmit` → exit 0; `grep -rn "Math.min(1, dt" src | wc -l` → 0
- [PASS] regression (`CDP_PORT=9381`, no exceptions): `scenario-left-stack.js` 17 pass / 0 false; `scenario-gear-wheel.js` all pass flags true, 0 false; `scenario-shop-computer.js` 21/21 PASS; `shot.js` rows 1-14 as before (`toastTop:true`, `toastClickThrough:true`). The 17 files `shot.js` wrote to `logs/shots/2026-10-20T14-58-*` deleted; `logs/errors.log` empty.

- Red: `scenario-bottom-row.js` (scratchpad `smoke/`), out `br-red/`: `S_1280 overlaps ["hotbarxsack"]`, `S_640 overlaps ["hotbarxsack","hotbarxhelp"] inside:false`, `S_1920 pass:true`; with the robot (11 slots) the same at 1280 and 640.
