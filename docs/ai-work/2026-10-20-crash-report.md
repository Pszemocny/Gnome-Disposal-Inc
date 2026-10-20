# Crash report box (2026-10-20)

PP: no plan ("bez planu"). Mini-roast: none (no job, migration, cache or queue).

Gotowe, gdy:
1. A per-frame method throws once → the box is visible with the message, `localStorage['gnome-boozed-errors']` has 1 entry, `g.time` still advances.
2. An unhandled promise rejection → the counter shows "+1 more" and a second entry is saved.
3. `webglcontextlost` dispatched on the canvas → the box says the graphics context was lost.
4. Screenshot of the box checked by eye.
5. `npx tsc --noEmit` → exit 0.

## Problem

The release build crashed for PP and nothing showed on screen. The game had no error capture. The loop calls `requestAnimationFrame(frame)` first, so an error inside a frame only goes to the browser console. If it repeats every frame, the game looks frozen. A lost WebGL context was not handled either.

## Summary

- New file `src/ui/crash.ts`: `installCrashReport()` listens to `window` `error` and `unhandledrejection`. `watchCanvas(canvas)` listens to `webglcontextlost`.
- The first event shows a small fixed box (bottom left, above every menu): "The game hit an error", the message, the first 8 stack lines, the build and the time, a Copy button and a close button. Later events only bump a "+N more" counter.
- Build id: the URL of the main script (`import.meta.url`). In the release build it is `assets/index-<hash>.js`, so it names the build without any Vite config change.
- The last 5 errors (message, stack, time, url) go to `localStorage['gnome-boozed-errors']` inside try/catch.
- Copy uses `navigator.clipboard.writeText`; if it is missing or refused, the text gets selected so Ctrl+C works.
- `main.ts`: install at module load (before boot), watch the canvas right after it is created. Nothing else in the game changes. The context-lost listener does not call `preventDefault`, so the browser behaves as before.
- The box has no key handlers and never calls pointer lock. Clicks on it do not reach the canvas, so they do not lock the pointer.
- Ladder: step 3 (platform events, `navigator.clipboard`, `localStorage`, `import.meta.url`), then minimum code for the box.

Odrzucone:
- Restoring the WebGL context after a loss: not asked; the box tells the player to reload.
- Animation rules 3/12 for the box: it is a DOM debug panel, not a game object.

## Work progress

Scenarios (scratchpad `smoke/crash.js`, `smoke/crash2.js`), run with `CDP_PORT=9395 MAXPOLL=240` on the 5199 dev server.

- [PASS] 1 — `crash.js` → `"frame_throw":{"visible":true,"text":"Uncaught Error: test boom in frame ...","saved":1,"timeAdvanced":true}`
- [PASS] 2 — `crash.js` → `"rejection":{"more":"+1 more","saved":2,"last":"test rejection"}`
- [PASS] 3 — `crash2.js` (context lost as the first event, title menu open) → `"visible":true,"text":"The graphics context was lost (WebGL context lost). Reload the page. ...","menuVisible":true,"closed":true,"saved":1`
- [PASS] 4 — screenshots `crash-out/crash-1.png` (in game) and `crash2-out/ctxlost-over-menu.png` (over the title menu): box readable at the bottom left, above the menu, Copy and × visible.
- [PASS] 5 — `npx tsc --noEmit` → `tsc exit 0`
- Build id: `npx vite build` into the scratchpad (not `release`) keeps `new URL(import.meta.url).pathname` inside `assets/index-DGkNw5Pc.js`, so the release box shows the hashed bundle name. In dev it shows `/src/ui/crash.ts`.

Self-check: only `src/ui/crash.ts` (new), two lines in `src/main.ts` plus the import, and a `.crash` block in `src/ui/style.css`. No key handlers, no pointer lock calls, no `preventDefault`. Not checked: the Copy button against a real clipboard (headless has no user gesture); the select fallback is the same code path either way.

# Saving errors to a file on the dev machine (2026-10-20)

PP: no plan ("bez planu"): "add saving of errors, for now it can be anywhere, whatever is simplest". Mini-roast: not needed (no job, migration, cache or queue).

Gotowe, gdy:
1. Headless on dev 5199: a frame throws once → `logs/errors.log` gets one new line with that message.
2. Preview of a scratchpad build on 5310: `curl -X POST` JSON to `/__errors` → one line appended; a body over 20 KB → rejected, nothing written; `GET /__errors` → nothing written.
3. `npx tsc --noEmit` → exit 0.

## Problem

The crash box only keeps the last 5 errors in the player's `localStorage`. PP plays on another device, so we cannot read them.

## Summary

- Ladder: step 3 (platform). `navigator.sendBeacon` on the client, Node `fs.appendFileSync` in a Vite plugin middleware. No new dependency.
- Log file: `logs/errors.log` in the project root, one JSON line per error: `time`, `ua`, `url`, `message`, `stack`, `build`. `logs/` is in `.gitignore`.
- `vite.config.ts`: plugin `error-log` adds the same middleware to the dev server and to `vite preview`. Only `POST .../__errors` is handled (any base path). Body over 20 KB → 413, bad JSON → 400, nothing written. Everything else goes on to Vite.
- `src/ui/crash.ts`: every reported error is also sent with `navigator.sendBeacon(BASE_URL + '__errors')`, at most 20 per page load, message cut to 2000 and stack to 8000 characters so one beacon stays under the cap. The call sits in try/catch. A beacon has no response and fires no event, so a missing endpoint (GitHub Pages) stays silent and cannot loop.

Odrzucone:
- Type-checking `vite.config.ts`: `tsconfig.json` only includes `src`, and the project has no `@types/node` (the old config already used `process` untyped). Adding a dependency for that was not asked.

## Work progress (error log)

- [PASS] 1 — scratchpad `smoke/tmp-errlog.js`, `CDP_PORT=9396 MAXPOLL=240` on dev 5199 → log went from 1 to 2 lines, last line `"message":"Uncaught Error: errlog-test-1792488572634"` with stack, url and HeadlessChrome user agent.
- [PASS] 2 — scratchpad build `errlog-build`, `npx vite preview --port 5310 --strictPort` → `post: 204 lines=3` (was 2), `big: 413 lines=3` (30 KB body), `get: 200 lines=3`, `badjson: 400 lines=3`. Preview stopped (`5310 free`).
- [PASS] 3 — `npx tsc --noEmit` → `tsc exit 0`.
- The test lines were removed afterwards; `logs/` is empty.

Self-check: three files touched (`vite.config.ts`, `src/ui/crash.ts`, `.gitignore`) plus this note. Port 5300, `release`, `machines.ts` and `player.ts` not touched. Not checked: a real GitHub Pages 404 (by spec a beacon reports nothing to the page).

