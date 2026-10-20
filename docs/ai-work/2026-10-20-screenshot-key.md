# Screenshot key (P)

Interpretation: P saves the whole screen as PNG plus a JSON of the game state to `logs/shots/` on the dev machine. Plan: `docs/ai-work/2026-10-20-plan-screenshot-key.md`, steps 1-6. PP then answered the open question (2026-10-20): "Nie da sie tutaj zrobic zrzutu i w tym problem dlatego potrzebuje pelnego screena ekranu niech interfejs bedzie czescia gry a nie osobno". So the PNG = WebGL frame + the DOM UI layer (HUD, toasts, shop, menus) drawn on top, same size.

## Problem

PP plays on another device over the LAN and cannot take an OS screenshot there. He needs one key that saves what he sees, so he can show the agent what went right or wrong.

## Summary

- `vite.config.ts`: `shotLog()` middleware (dev and preview), `POST /__shots/<id>.png|json` writes `logs/shots/<name>`, 64 MB cap → 413, any other path → `next()`.
- `src/ui/shot.ts` (new): on P, right after `renderer.render`, copies the WebGL frame into a 2D canvas (with the booze CSS filter applied), then draws the DOM layer on top with `html-to-image`, then POSTs PNG and JSON. Toast says `📸 saved <id>` or the real reason (`HTTP <status>` with the file name, or `no dev server`).
- `src/main.ts`: `shot.update(now)` before `ctx.input.endFrame()`.
- `src/ui/hud.ts` + `style.css`: toast container moved to `document.body`, `position: fixed; z-index: 35; pointer-events: none`, so toasts show over the shop and menus.
- `src/ui/style.css` `.menu`: added `align-items: safe center` after `align-items: center`. Reason: the screenshot copies computed styles, where the card's `margin: auto` becomes `0px`, so a tall pause card was cut at the top in the PNG. In the live page nothing changes (margin auto already did this); the plain `center` stays as the fallback for browsers without `safe`.
- `package.json`: `html-to-image` 1.11.13 (exact pin, MIT, last release 2025-04), loaded with `import()` on the first P only.
- `CHANGELOG.md`: one bullet under "next build".

### Ladder

- Server handler: rung 2 (copy of `errorLog()`).
- Frame grab, `fetch`, `innerText`, 2D canvas `filter`: rung 3 (platform).
- DOM → image: rung 4 (new dependency). Why the repo cannot do it itself: the HUD, shop and menus are HTML+CSS, and the browser has no API to rasterise DOM into a canvas. The only working routes are tab capture (`getDisplayMedia`, needs https on the LAN and a share prompt; rejected in the plan, variant b) or re-creating the DOM as SVG `foreignObject` with every computed style and web font inlined. That second route is what `html-to-image` does (~12.5 KB chunk); writing it by hand would be several hundred lines of the same code. Lazy `import()` keeps it out of the main chunk.
- Fonts: `getFontEmbedCSS` once on the first press, cached; when Google Fonts cannot be fetched it returns `''` and the shot uses `skipFonts` (system fonts) instead of failing. Verified: with every `fetch` rejected the font load logs "Error loading remote css" and the flow still reaches the toast.
- A failed UI layer never loses the shot: the 3D frame is saved alone and the JSON gets `uiError`.

### Deviations from the plan

- PP's answer to Decisions for PP 1 replaced variant a) with "whole screen": `drawUi` and the dependency are added (coordinator brief).
- Done-when 10 expected `404` for `GET /__shots/x.png`; Vite dev answers `200` with `index.html` (SPA fallback, same as `GET /__errors`). The matrix row ("`next()`, nothing written") holds.
- `.menu` CSS line (above), not in the plan; needed for a correct pause-menu PNG.

### Assumptions

1. Toast container no longer dims with `.hud.dim` (it is outside `.hud`); toasts were the one thing that should stay readable over menus.
2. The JSON `build` field is `/src/ui/shot.ts` on dev, `assets/index-<hash>.js` in release (same trick as `crash.ts`).

### Rejected

- No `activeElement` guard (plan R2: the leaderboard listener already stops every key).
- No help/legend/menu key-list entry for P (plan R11).
- `logs/shots` growth and LAN POST access (plan: home LAN dev folder, PP deletes by hand).

## Work progress

Dev server 5199 restarted once for the middleware (`lsof -ti tcp:5199 -sTCP:LISTEN` → kill → `npx vite --port 5199 --host 127.0.0.1 --strictPort`).
Scenario: `<scratchpad>/smoke/shot.js` (run with `URL_QUERY=''` so the Graphics select is enabled; `?rows=11` + `DPR=2` for the Retina row). Test PNG/JSON deleted from `logs/shots` afterwards.

### Done when

1. [PASS] row 1 — `row1: {"uiError":null,"png":true,"pngBytes":414765,"json":{"fps":60,"money":0,"holeLevel":1,"gear":"hands","tool":null,"buffs":[],...},"hudHasClickToPlay":false,"toast":"📸 saved 2026-10-20T12-51-41-056"}`
2. [PASS] row 2 — `row2: {"focusedSlider":true,"quality":"high","paused":true,"png":true,"pngBytes":240801,"toastTop":true,"toast":"📸 saved ..."}`
3. [PASS] row 3 — `row3: {"png":true,"hudHasShop":true,"toastTop":true,"toastClickThrough":true,"tabClickWorks":true}`
4. [PASS] row 4 — `row4: [{"focused":true,"files":0,"toast":null,"inputValue":"p"},{"focused":false,"files":0,"toast":null}]`
5. [PASS] row 5 — `row5: {"replay":true,"png":true,"pngBytes":427475}`
6. [PASS] row 6 — `row6: {"files":2,"ids":["2026-10-20T12-51-58-871"]}`
7. [PASS] row 7 — `row7: [{"toast":"📸 not saved (no dev server)","errors":0},{"toast":"📸 not saved (2026-10-20T12-52-02-404.png HTTP 404)"}]`
8. [PASS] row 8 — `curl ... --data-binary @65mb.bin .../__shots/big.png` → `413`, `grep -c big` → `0`; scenario `row8: {"toast":"📸 not saved (2026-10-20T12-52-03-671.png HTTP 413)"}`
9. [PASS] row 9 — `curl ... '/__shots/..%2Fx.png'` → `404`, `ls logs | grep -c x.png` → `0`; also `/__shots/a.txt` → `404`
10. [PASS] row 10 (see deviation) — `curl .../__shots/x.png` → `200` with body `<!doctype html>` (Vite SPA fallback), `ls logs/shots` → no such directory (nothing written)
11. [PASS] row 11 — `DPR=2 ... ?rows=11` → `{"pixelRatio":2,"canvas":"5120x2880","png":true,"pngBytes":19019605,"status":204}`
12. [PASS] row 12 — `row12: {"json":{"buffs":["booze"]}}`; the PNG shows the booze colour shift (checked by eye)
13. [PASS] row 13 — `row13: {"files":4,"ids":["2026-10-20T12-52-00-888","2026-10-20T12-52-01-153"],"distinct":true}`
14. [PASS] row 14 — `row14: {"png":true,"json":false,"toast":"📸 not saved (2026-10-20T12-52-04-437.json HTTP 500)"}`
15. [PASS] changelog — `grep -c "P saves a screenshot" CHANGELOG.md` → `1`
16. [PASS] tsc — `npx tsc --noEmit` → `exit=0`
17. [PASS] PNG by eye — row 1 PNG: textured garden, not black, not flipped.
18. [PASS] money counter in PNG — row 1 PNG shows `$0` top right, HOLE LVL 1, goal panel, controls box (by eye).
19. [PASS] toast in PNG — row 1 PNG shows "Visible test toast" and the goal toast (by eye).
20. [PASS] open shop in PNG — row 3 PNG shows the GNOME-OS SHOP window with tabs and items, toasts over it (by eye).
21. [PASS] pause menu in PNG — after the `.menu` fix the P shot of the pause menu matches a CDP `Page.captureScreenshot` of the same state (PAUSED title, Resume, buttons, sliders; compared side by side). Before the fix the card top was cut.
22. [PASS] main chunk size — `vite build` before/after the UI layer: `index-*.js` 5,189,254 → 5,191,543 bytes (+2.24 KB raw, of which about 1.6 KB is Vite's one-time dynamic-import helper), gzip 1,913.25 → 1,914.16 kB (+0.9 KB). `html-to-image` is a separate 12.5 KB chunk. Within ±2 KB gzip; raw is 0.24 KB over.
23. [PASS] timing (GPU, 640x360 window) — key arrival → toast: first press 360 ms, later presses 182-333 ms (`ms: [360,182,333,254,265,258,233,255,260]`).

### Self-check

- Only requested things: server handler, shot module, hook, toast layering, changelog, plus the UI layer and the `.menu` line that PP's answer requires.
- Patterns: handler copies `errorLog()`; `BUILD` copies `crash.ts`.
- Not checked: timing at 1080p/Retina on PP's real device (headless window is 640x360); the 5120x2880 run saved fine but its time was not measured.
