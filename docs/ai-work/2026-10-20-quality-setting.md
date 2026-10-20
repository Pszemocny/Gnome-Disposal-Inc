# Graphics quality setting Low / Medium / High (2026-10-20)

Interpretation: the orchestrator's night task is the plan (BOARD "Hub 8"). A `quality` field joins the settings cookie (default medium). `?lowfx` forces Low for the session and never writes the cookie. The "Shadows" checkbox goes away; an old save with shadows off becomes Low once.

Gotowe, gdy (from the task):
1. The menu offers Low/Medium/High; the choice survives a reload (cookie) and "Reset save" does not clear it.
2. Low: `renderer.getPixelRatio() === 1`, `shadowMap.enabled === false`; Medium: <= 1.5, shadows on, map 1024; High (DPR=2): <= 2, map 2048, type PCFSoft.
3. `?lowfx` gives Low without changing the saved choice.
4. Triangles per frame on Medium within 250-450 k in the start view (`URL_QUERY=''`).
5. Switching Medium → High → Low at runtime throws no exception and renders the next frame.
6. `npx tsc --noEmit` clean; one screenshot of the menu.

## Problem

Graphics cost was fixed: pixel ratio 1.5 and 1024² shadows for everyone, a "Shadows" checkbox kept in the game save, and `?lowfx` only as a URL switch. Slow machines had no "Low" in the menu, fast ones no "High".

## Summary

- `src/core/settings.ts`: `quality: 'low' | 'medium' | 'high'` in `prefs` (bad or missing value → medium). `lowfx` = `?lowfx` in the URL. `applyQuality(renderer, scene)`: pixel ratio (Low 1, Medium min(1.5, DPR), High min(2, DPR)), shadows on unless Low, shadow map 1024 or 2048 on the sun (found with `scene.traverse`, `DirectionalLight` with `castShadow`; old map disposed, three builds the new one on the next shadow pass), `shadowMap.needsUpdate`, material recompile (same loop the old Shadows checkbox used). `adoptSaveShadows()`: a save with `shadows: false` and a cookie without `quality` becomes Low once.
- `src/core/state.ts`: `settings.shadows` removed from the type and the fresh state; `loadState` passes the old value to `adoptSaveShadows` and drops it (gone with the next save).
- `src/main.ts`: the `?lowfx` / pixel ratio / shadow lines at renderer creation removed; one `applyQuality(renderer, ctx.scene)` right after `ctx.env = new Environment()`, because the sun exists only from there. 60 fps cap and the paused-frame logic untouched.
- `src/ui/menu.ts`: "Shadows" checkbox replaced by a "Graphics" select Low/Medium/High. Change → cookie, `applyQuality`, then a `resize` event so the existing handler in `main.ts` redraws the frozen frame behind the pause menu (a new pixel ratio clears the canvas). Under `?lowfx` the select shows Low and is disabled, so the saved choice cannot change. `saveState` import dropped (no setting lives in the save any more).
- Everything applies at once, so no "after reload" note in the menu was needed.

Ladder: rung 2/3. The cookie module, the menu's input handler, the resize redraw and three's own map rebuild (`shadow.map = null`) already existed; no new file in `src`, no CSS.

Deviations from the task:
- High uses `PCFShadowMap`, not `PCFSoftShadowMap`. Fact: three r186 removed it; `WebGLShadowMap.js:99-101` warns "PCFSoftShadowMap has been removed. Using PCFShadowMap instead." and resets the type on the first shadow pass. Softness comes from `shadow.radius` (2, set in environment.ts). Side effect: the radius is in shadow-map texels, so High's edge is half as wide in metres as Medium's (sharper, finer detail).
- One line in `main.ts` outside the renderer block (the `applyQuality` call after the environment), since the sun does not exist at renderer creation.

Rejected:
- Raising `shadow.radius` on High to keep the same soft edge as Medium: not in the task, and the light belongs to environment.ts.
- A "takes effect after reload" note: no part of the setting needs a reload (antialias stays as is).

## Work progress

Scenario `<scratchpad>/smoke/scenario-quality.js` (new, staged over 5 page loads like `scenario-settings.js`). `<scratchpad>` = `/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-boozed/844ac005-e3c6-4341-b0ea-34b547159d26/scratchpad`.

First run: the switch block read the quality from a second module instance (dynamic import after Vite HMR), and the migration stage lost its old save to the unload autosave. The test now reads the cookie directly and sets `g.state.settings.shadows = false` too (same trick as the settings note). Second run:

`URL_QUERY='' DPR=2 CDP_PORT=9391 MAXPOLL=2400 node smoke.mjs run-quality scenario-quality.js` → `LOGS:` empty, no `errors`.

Kompletność:
- [PASS] 1 — `s0_boot.options: ["Low","Medium","High"]`, no Shadows checkbox; after choosing High and reloading `s1_reload_high: {prefs: "high", selected: "high"}`, cookie `..."quality":"high"`; after Reset save (two clicks) `s2_after_reset: {money: 0, prefs: "high", selected: "high"}`.
- [PASS] 2 — Low `{pr: 1, shadows: false}`; Medium `{pr: 1.5, shadows: true, map: 1024, mapTex: 1024}`; High at DPR 2 `{pr: 2, shadows: true, map: 2048, mapTex: 2048}`. Type is 1 (`PCFShadowMap`) on all levels, not PCFSoft: see deviation (three r186 has no PCFSoft).
- [PASS] 3 — `?lowfx` with saved High: `s3_lowfx: {pr: 1, shadows: false, selected: "low", disabled: true, prefs: "high", cookieQ: "high"}`.
- [PASS] 4 — Medium start view: `triangles: 374523, calls: 60`.
- [PASS] 5 — switches high → low → medium → high from the pause menu: each `pausedDraw: 1` (frozen frame redrawn), `framesAfter: 5` after resuming, cookie follows (`cookieQ` high/low/medium/high), `LOGS:` empty.
- [PASS] 6 — `npx tsc --noEmit` → exit 0; screenshot `<scratchpad>/smoke/run-quality/quality-menu.png` (pause menu, "Graphics: High").
- [PASS] migration — old save `shadows: false` + cookie without quality → `s4_migrated: {prefs: "low", volumeKept: 0.5, pr: 1, shadows: false}`, save settings `{volume: 0.5, sensitivity: 1}` (no shadows key).
- [PASS] regression — `CDP_PORT=9392 node smoke.mjs run-quality-loop scenario-perf-loop.js` → `title.framesIn3s: 0`, `pause.framesIn3s: 0`, `hz120.renderedPerSecond: 61`, `hz144: 60`, `LOGS:` empty.

Self-check: only the four owned files changed (the project is not a git repository; edits read back one by one). No `settings.shadows` or `lowfx` left outside settings.ts and menu.ts (grep). Every new line has a sentence in the task behind it; the disabled select under `?lowfx` enforces "without changing the saved choice".
