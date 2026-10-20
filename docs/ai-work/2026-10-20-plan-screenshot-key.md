# Plan: screenshot key

Spec: PP (Slack, 2026-10-20): "klawisz robi zrzut ekranu i zapisuje plik PNG na dysk; tak tylko lokalnie na potrzeby tego zebym ci mogl pokazac co poszlo dobrze co zle". Brief adds: a JSON next to the PNG (hole level, money, gear, tool, fps, build id, time), a short "saved" toast, works while paused / in the shop if cheap.
Trivial check: a new client file plus a server endpoint (data path: PNG and JSON written to disk on the dev machine), reachable from every game state, so not single-file.

## Plan v0 (plan-author)

### Goal
Pressing P in the playtest build writes `logs/shots/<id>.png` and `logs/shots/<id>.json` on this computer and shows a toast, in any game state.

### Behaviour matrix
| state / input | action | expected outcome | source |
|---|---|---|---|
| 1. in game (pointer locked), dev 5199 or preview 5300 | press P | `logs/shots/<id>.png` (the rendered frame) + `<id>.json`; toast `📸 saved <id>` (kind `good`) | PP quote; brief "toast" |
| 2. paused (pause menu, title menu, click-to-play): no frame is rendered while paused (`main.ts` `if (!ctx.paused \|\| redraw)`) | press P | one frame rendered on demand, then the same files + toast | brief "works while paused" |
| 3. shop / blueprints / legend open (`overlayOpen()` in `main.ts`, all set `ctx.paused`) | press P | same as row 2; the toast may sit behind the overlay (`.shop` z-index 20, `.hud` none), the files still land | brief "in the shop too" |
| 4. leaderboard name input focused (`leaderboard.ts:112`) `spec silent` | type a P | nothing saved, the letter goes into the field | audio.ts:19 does the same for M |
| 5. instant replay playing (`replay.ts`, live game frozen) `spec silent` | press P | the replay frame is saved like row 1 (no special code) | — |
| 6. key held (auto-repeat) | hold P 1 s | exactly one shot (`Input.pressed` adds a code once per physical press, `input.ts:15`) | — |
| 7. endpoint missing (GitHub Pages: POST → 404/405) or network error `spec silent` | press P | toast `📸 not saved (no dev server)` (kind `bad`); no download, no crash entry | PP "tylko lokalnie" |
| 8. server: `POST /__shots/<id>.png` body > 10 MB | — | 413, nothing written | mirrors `MAX_BODY` in `error-log` |
| 9. server: name not matching `^[\w-]{1,40}\.(png\|json)$` (e.g. `../x.png`) | — | 400, nothing written | path safety |
| 10. server: `GET /__shots/x.png` or any other path | — | handed to the next middleware (Vite 404), nothing written | mirrors `error-log` |

### Reach
- `src/main.ts:195-258` frame loop: new hook `shot.update(now)` right before `ctx.input.endFrame()` (after `renderer.render`, so the WebGL buffer still holds this frame; `preserveDrawingBuffer` stays default `false`, `main.ts:53`). Only caller of `shot`.
- `ctx.input.hit('KeyP')`: P is unused (grep `KeyP` in `src` → none; bound keys: WASD, Shift, Space, J, F, E, B, C, K, Z, L, H, M, X, G, Q, R, T, V, I, Tab, 1-0, Esc). `Input` listens on `window`, so `hit` also works while paused and over the shop; `shop.ts:146` deletes only Esc/B/Tab/E from `pressed`.
- `vite.config.ts`: second handler next to `errorLog()`; `configureServer` and `configurePreviewServer` both get it (preview on 5300 serves `release`, same as `/__errors`).
- Reads only: `ctx.state.money/holeLevel/land/stats.playTime`, `ctx.player.sweeper.gear` (`hud.ts:378`), `ctx.player.placing` (`player.ts:72`), `ctx.paused`, `document.body.innerText` (visible HUD, menu, shop and crash-box text in reading order), `ctx.hud.toast` (`hud.ts:201`). No field is written.
- `logs/` is gitignored (`.gitignore`), so `logs/shots/` needs nothing.
- Shared files touched by other implementers: none (`player.ts`, `hud.ts`, `style.css`, `hole.ts`, `robots.ts`, `shop.ts` untouched).

### Data
- Files on the dev machine: `logs/shots/<id>.png` (1080p frame, roughly 1-4 MB) and `logs/shots/<id>.json` (< 8 KB; `innerText` cut to 4000 chars). `id = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)` → `2026-10-20T21-15-30`.
- Cost per press: one `canvas.toBlob` (PNG encode, tens of ms, off the main thread in Chromium), two `fetch` POSTs, one extra `renderer.render` only when paused. Volume: a human key press, no cap needed (row 6).
- Server buffers the body in memory like `error-log`; cap 10 MB (PNG) via the same chunk loop.

### Steps (edit order)
1. `vite.config.ts` — add `function shotLog(): Plugin` (name `shot-log`) with the same shape as `errorLog()`: handler matches `req.method === 'POST'` and `req.url.split('?')[0].match(/\/__shots\/([\w-]{1,40}\.(?:png|json))$/)`; no match → `next()`; body cap `10 * 1024 * 1024` → 413 (same loop as `error-log`); on `end`: `mkdirSync(join(root, 'logs', 'shots'), { recursive: true })`, `writeFileSync(join(root, 'logs', 'shots', name), Buffer.concat(chunks))`, 204. Register in `plugins: [errorLog(), shotLog()]`. (Rows 1, 8, 9, 10; row 9 is the regex, a `..` never matches `[\w-]`.)
2. new `src/ui/shot.ts` — `export const shot = { update(now: number): void }`. Inside: `stamps: number[]` ring of the last 61 `now` values (fps = `Math.round((stamps.length - 1) * 1000 / (last - first))`); `const BUILD = new URL(import.meta.url).pathname` (same trick as `crash.ts:4`); `update`: push stamp; `if (!ctx.input.hit('KeyP')) return`; `if (document.activeElement instanceof HTMLInputElement) return` (row 4); `if (ctx.paused) ctx.renderer.render(ctx.scene, ctx.camera)` (rows 2, 3); build `state = { time, build: BUILD, url: location.href, fps, money, holeLevel, land, gear: ctx.player.sweeper.gear, tool: ctx.player.placing, paused: ctx.paused, playTime: ctx.state.stats.playTime, hud: document.body.innerText.slice(0, 4000) }`; `ctx.renderer.domElement.toBlob(async (blob) => { ... })` posting `${id}.png` then `${id}.json` with `fetch(`${import.meta.env.BASE_URL}__shots/${name}`, { method: 'POST', body })`; `ok` on both → `ctx.hud.toast(`📸 saved ${id}`, 'good')`, otherwise (not ok, throw, null blob) → `ctx.hud.toast('📸 not saved (no dev server)', 'bad')` (row 7). The whole callback is in try/catch so a failed shot never reaches `crash.ts`.
3. `src/main.ts` — `import { shot } from './ui/shot';` and `shot.update(now);` on the line before `ctx.input.endFrame();` (`main.ts:257`). Two lines, nothing else.

### Tests
No unit framework; headless CDP scenarios in the session scratchpad (`smoke/shot.js`) on the private dev server 5199, which has the same middleware as preview. The scenario clears `logs/shots/`, dispatches `Input.dispatchKeyEvent` for P (code `KeyP`), waits 20 frames, then reads `logs/shots/`.
- Row 1: start the game (lock), press P → one `.png` starting with bytes `89 50 4E 47`, size > 10 KB, one `.json` with `money`, `holeLevel`, `gear`, `tool`, `fps` (number > 0), `build`, `time`, `hud` (contains the money text); toast element `.toast.good` text starts with `📸 saved`.
- Row 2: open the pause menu (Esc / exit lock), press P → files exist; png > 10 KB (a cleared buffer compresses to a few hundred bytes).
- Row 3: `ctx.shop.open()`, press P → files exist, `hud` in the JSON contains a shop tab title.
- Row 4: `ctx.leaderboard` open with the first-name input focused, press P → no new files, the input value is `P`.
- Row 5: trigger the replay (`KeyI` with recorded frames), press P → files exist.
- Row 6: `keyDown` with `repeat: true` x5 without `keyUp` → exactly one pair of files.
- Row 7: `window.fetch = () => Promise.reject()`, press P → `.toast.bad` text `📸 not saved (no dev server)`, no entry in `localStorage['gnome-boozed-errors']`.
- Rows 8-10: `curl` against 5199: 11 MB body → 413; `/__shots/..%2Fx.png` and `/__shots/a.txt` → 400 or 404, `ls logs/shots` unchanged; `GET /__shots/x.png` → 404, unchanged.
- Screenshot of the saved PNG opened by eye once (not black, not flipped; `toBlob` on a WebGL canvas gives the correct orientation).

### Done when
1. `node smoke.mjs <dir> shot.js` row 1 → `{"png":true,"pngBytes":>10240,"json":{"fps":>0,"money":...},"toast":"📸 saved ..."}`
2. row 2 (pause menu) → `{"paused":true,"png":true,"pngBytes":>10240}`
3. row 3 (shop open) → `{"png":true,"hudHasShop":true}`
4. row 4 (leaderboard input focused) → `{"files":0,"inputValue":"P"}`
5. row 5 (replay playing) → `{"replay":true,"png":true}`
6. row 6 (5 repeated keydowns) → `{"files":2}`
7. row 7 (fetch rejects) → `{"toast":"📸 not saved (no dev server)","errors":0}`
8. `curl -s -o /dev/null -w '%{http_code}' -X POST --data-binary @11mb.bin http://127.0.0.1:5199/__shots/big.png` → `413`; `ls logs/shots | grep -c big` → `0`
9. `curl ... -X POST --data-binary @x.png 'http://127.0.0.1:5199/__shots/..%2Fx.png'` → `404` (no match, Vite) ; `ls logs` → no `x.png`
10. `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5199/__shots/x.png` → `404`; `ls logs/shots` unchanged
Plus `npx tsc --noEmit` → exit 0 (gate, not a row).

### Assumptions (numbered)
1. `canvas.toBlob` called inside the same rAF callback right after `renderer.render` reads the frame reliably without `preserveDrawingBuffer` (WebGL clears the buffer only after compositing).
2. PP presses the key on the device that plays; the file lands on this computer, which is what "pokazac" needs. The id is the device's clock in UTC.
3. `document.body.innerText` honours `hidden`/`display:none`, so the JSON lists only visible text (HUD, menu, shop, crash box).
4. The P key reaches the page under pointer lock in Brave/Chrome like the other letter keys do.
5. Preview on 5300 is started with `npx vite preview --outDir release`; `configurePreviewServer` middlewares run there (already proven by `/__errors`).

### Alternatives rejected
- (a) DOM-to-image (SVG `foreignObject` of `document.body` drawn onto a canvas, or html2canvas): external stylesheet must be inlined, fonts and emoji do not load inside the SVG image, Firefox/Safari taint the canvas; a library needs a lazy import and a written reason; 40+ fragile lines for text that `innerText` already gives in the JSON.
- (b) `getDisplayMedia`: a permission prompt on every press and it needs a user gesture outside pointer lock.
- (c) Burning HUD text into the PNG with a 2D canvas: +10 lines; the JSON next to the file holds the same text and the agent opens both anyway (open decision 2).
- (d) `preserveDrawingBuffer: true` plus a `keydown` listener (no loop hook): works from any state but costs GPU memory bandwidth on every frame for a key pressed a few times per session.
- (e) Browser download fallback on GitHub Pages: PP said local only; a download on a phone is awkward (open decision 1).
- (f) `navigator.sendBeacon` like `crash.ts`: no response, so no "saved / not saved" toast; and the 64 KB beacon limit is below a PNG.

### Ladder
- `src/ui/shot.ts` (new): rung 6, required by "klawisz robi zrzut ekranu i zapisuje plik PNG".
- `canvas.toBlob`, `fetch`, `document.body.innerText`, `document.activeElement`: rung 3 (platform).
- `shotLog()` in `vite.config.ts`: rung 2, copies the `errorLog()` shape ("zapisuje plik na dysk" on this computer).
- JSON sidecar fields and fps ring: brief "attach a small JSON ... (hole level, money, gear, tool, fps, build id, time)".
- Toast: brief "show a short saved toast"; `ctx.hud.toast` exists (rung 2).
- Not added (rung 1): help-line entry in `hud.ts:165`, cooldown, download fallback, text burn-in, new dependency.

### Open decisions (for PP)
1. [spec silent] On GitHub Pages (no dev server) the key only shows "not saved". a) leave it so (PP: "tylko lokalnie"), b) also download the PNG in the browser (+4 lines, awkward on a phone). Recommendation: a.
2. The PNG shows the 3D view only; money, toasts and prompts are in the JSON next to it. a) keep PNG clean + JSON, b) also draw the first 12 HUD lines on the PNG (+10 lines). Recommendation: a; the agent reads both files.
3. [spec silent] Zakładam: typing P in the leaderboard name field does not take a shot | Dowód: `src/ui/leaderboard.ts:112`, `src/core/audio.ts:19` (M uses the same guard) | Jeśli źle: a shot per P in a name, and a toast over the form | Pewność: Confident | rekomendacja: a) guard on `activeElement`.
4. [spec silent] Zakładam: replay playback (`src/systems/replay.ts:51`) and the DEEP screen (`.deep`) are captured like any other frame with no extra code | Dowód: `main.ts:252-255` renders the replay frame through the same `renderer.render` | Jeśli źle: a black PNG in those states | Pewność: Likely | rekomendacja: a) no special case, row 5 test proves it.
No `docs/ai-work` decision older than 60 days is involved (the oldest related note is 2026-10-19).

### Self-check
- Every criterion has a step and a test: rows 1-7 → steps 2-3 + scenario; rows 8-10 → step 1 + curl. Yes.
- Every step names file, signature, regex, cap, toast text, id format. Yes.
- Fields written: only files under `logs/shots/`; no game state written. Readers listed in Reach.
- Lists compared with code: key list (all `inp.hit`/`keydown` sites), game states (`overlayOpen()`, pause, click-to-play, replay, deep, leaderboard input), destinations (dev, preview, Pages). 3 rows `spec silent` (4, 5, 7). Done when lines = 10 = matrix rows.
- Old decisions: none older than 60 days.
- Plan shorter than the code: the code is about 60 lines (shot.ts ~35, vite.config.ts ~25, main.ts 2); this plan is longer in words but the matrix and tests are the part the implementer cannot decide alone.

## Review: impact (plan-impact)

Verdict: CONCERNS

Missing from the plan:
- [High] `src/core/settings.ts:50` sets the pixel ratio up to 2 on quality High (`Math.min(2, devicePixelRatio)`). When PP plays on a Retina screen with High, the canvas is about 2x2 the window (e.g. 5120x2880, ~15 Mpx), so the textured PNG can pass the 10 MB cap. Then the server answers 413 and the toast says "not saved (no dev server)", which is false. Fix: raise the cap (e.g. 40 MB) or scale the shot down on the client; and make the toast say the real reason (status code) instead of "no dev server" for any non-ok answer.
- [High] Step 2 guard `document.activeElement instanceof HTMLInputElement` also matches the pause-menu range sliders and checkboxes (`src/ui/menu.ts:93-96`, sensitivity, Invert Y, volume, mute). When PP moves a slider in the pause menu and then presses P, no shot is taken, because focus stays on the slider. Row 2 then fails silently. Fix: copy the type filter from `src/core/audio.ts:19-20` (skip `range`, `checkbox`, `radio`, `button`), or drop the guard: see next line.
- [Low] Row 4 works for a different reason than the plan says. `src/ui/leaderboard.ts:144-154` stops every keydown in the capture phase while the leaderboard is open, so `Input` never sees P there, focused or not. Side effect: no shot is possible while the leaderboard is open at all (not a matrix row). Fix: add the row "leaderboard open, input not focused → nothing saved" or accept it in one line.
- [Medium] `CHANGELOG.md` "next build" section: every build lists what changed and what to test, shown in the menu ("What's new"), per `docs/ai-work/2026-10-20-changelog-menu.md` ("PP needs to see, inside each build, what changed and what to test"). The plan has no step for it. Fix: add one bullet "P saves a screenshot + JSON to logs/shots on the dev machine (dev/preview only). Test: press P in game, paused, in the shop".
- [Low] Key lists: the plan names only the help panel `src/ui/hud.ts:162` as not updated; the legend key table `src/ui/legend.ts:20-37` (has `M mute`, `I replay`) and the menu hint `src/ui/menu.ts:109` also list keys. Leaving P out is fine for a dev-only key, but say so for all three, not one. `hud.ts` is being edited by another implementer now, so not touching it is also the safe choice.
- [Low] The booze buff tints the canvas with a CSS `filter` (`src/main.ts:278`), which `toBlob` does not capture. When PP shoots during booze, the PNG shows plain colours. Fix: add `buffs` (active buff ids) to the JSON, or accept in one line.
- [Low] JSON reads `ctx.player.placing` (`player.ts:72`), `ctx.player.sweeper.gear` (`sweeper.ts:26`) and `ctx.hud.toast` (`hud.ts:201`) from files other implementers edit right now. A rename there breaks `shot.ts`; `npx tsc --noEmit` catches it, so run it after their merges, not only after this change.

Neighbours checked: render order: affected, hook after `renderer.render` (`main.ts:282`) and before `endFrame` (`main.ts:285`) is the only spot where the buffer still holds the frame; when paused and `redraw` is true the frame renders twice, harmless | paused frames: affected, `pressed` survives early-return frames (`document.hidden`, 60 fps cap) because `endFrame` runs only at the end, so P is not lost | replay: not affected, `replay.ts:85-89` only moves the camera and instance buffers, the main render draws it | input/typed codes: not affected, P enters `typed` but no `consumeTyped` word has a P (`main.ts:263,268`) | other key handlers: not affected, shop/legend/blueprints/menu delete or react only to their own keys; leaderboard see above | audio M heuristic: negligible, a P within 0.4 s of M cancels that mute | crash.ts: not affected if the toBlob callback and fetch are inside try/catch as step 2 says; an uncaught rejection would land in `logs/errors.log` | quality/pixel ratio: affected, see first finding | icons renderer (`icons.ts:62`): not affected, separate renderer | .gitignore: not affected, `logs/` already ignored | GitHub Pages (`deploy.yml:30`, `VITE_BASE`): not affected, `BASE_URL` prefix and the any-base regex match the `/__errors` pattern | vite.config.ts: affected only by the new plugin; editing it restarts the 5199 dev server other implementers may be using, tell them | CHANGELOG: affected, see above.
FE/BE: client POSTs `BASE_URL + '__shots/<id>.png|json'`, server regex `/\/__shots\/([\w-]{1,40}\.(?:png|json))$/` on the path, any base: consistent. Client must treat 413 separately from 404/405 (see first finding).
Decisions: consistent with `docs/ai-work/2026-10-20-crash-report.md` (same plugin shape, dev and preview only, "Only POST .../__errors is handled (any base path)"); `docs/ai-work/2026-10-20-changelog-menu.md` asks for a changelog entry, see finding.
Decisions older than 60 days: none
Regression vs current behaviour: none (new path; P was unbound).

## Review: roast (plan-roaster)

Verdict: CONCERNS

Steel-man: The plan copies a pattern that already works (`errorLog()` in `vite.config.ts`, proven on preview 5300) and adds one hook in the frame loop right after `renderer.render`. That avoids the cost of `preserveDrawingBuffer` and still works while paused. Strong points: P really is free (no `KeyP` in `src`); `Input.pressed` gives exactly one shot per physical press; the filename regex blocks `..`; `logs/` is already gitignored; the try/catch keeps a failed shot out of `crash.ts`; the JSON sidecar with `innerText` is a cheap way to capture the DOM text.

Findings:
- [Major] When PP wants to show a UI bug (a toast over the money counter, a broken shop layout, a cut-off prompt, the booze blur), the PNG shows only the 3D world, because all of that is DOM or CSS over the canvas.
  Assumption: "the PNG plus the `innerText` JSON together show what PP saw" (open decision 2: "money, toasts and prompts are in the JSON").
  Scenario: PP opens the shop, sees overlapping cards, presses P. The PNG holds the frozen 3D frame behind the shop. The JSON holds the shop text in reading order, with no position, size, overlap or colour. The same happens with the booze effect: `canvas.style.filter` (`main.ts:279`) is CSS and never reaches the drawing buffer, so a "booze looks wrong" shot shows a clean frame.
  Checked: `main.ts:280-283` (while paused, the canvas holds one frozen frame and "menus are DOM over the canvas"); `main.ts:279` (booze is a CSS filter on the canvas); `hud.ts:201-206` (toasts are DOM).
  Impact: PP said "pokazać co poszło dobrze co źle". For anything in the HUD, the shop or the menus, the file cannot show it. PP finds out only after the first such shot.
  Recommendation: rewrite open decision 2 with its real consequence, for example: "kiedy błąd jest w HUD, sklepie albo menu (nachodzenie, układ, kolory), wtedy PNG go nie pokaże, bo to warstwa strony, nie gry; JSON da tylko tekst". Add option c) to the decision: the OS screenshot (Cmd+Shift+4 on the Mac, Win+Shift+S on Windows) for UI bugs, and P for the 3D world plus the state JSON. See "Investigate first".
- [Major] When PP opens the pause menu, moves the volume or sensitivity slider (or clicks the Mute or Invert Y checkbox) and then presses P, nothing is saved and no toast appears, because focus stays on that `<input>` and the guard in step 2 rejects every `HTMLInputElement`.
  Assumption: the guard "does the same as M" (`audio.ts:19`).
  Scenario: Esc → pause menu → drag "Volume" → P. `document.activeElement` is `input[type=range]`, so `shot.update` returns before the toast. Row 2 fails silently, and the smoke test for row 2 does not touch a slider, so it stays green.
  Checked: `menu.ts:93-96` (range and checkbox inputs in the pause menu); `audio.ts:20` excludes `range`, `checkbox`, `radio` and `button` from "typing", while plan step 2 checks only `instanceof HTMLInputElement`.
  Impact: a silent no-shot in the very state that row 2 promises.
  Recommendation: copy the `typing` expression from `audio.ts:20` word for word. Row 2's scenario should focus the volume slider before it presses P.
- [Major] When PP plays on the Retina Mac or on a 4K screen with quality "high", the PNG can exceed the 10 MB cap. Then the shot is lost and the toast says "no dev server", which is the wrong reason.
  Assumption: "1080p frame, roughly 1-4 MB" (Data).
  Scenario: quality high, `devicePixelRatio` 2, a 2560x1440 window → a 5120x2880 drawing buffer (14.7 MP, 59 MB raw RGBA). A textured, antialiased, tone-mapped frame does not compress to under 10 MB. Even a 1512x982 MacBook window gives 3024x1964 (5.9 MP), which is near the cap. The server answers 413 and calls `req.destroy()` (copied from `error-log`). The browser then sees either a 413 or a network error, and both fall into the generic "not saved (no dev server)" branch.
  Checked: `settings.ts:50` (`setPixelRatio(min(2, devicePixelRatio))` on high); `vite.config.ts:15-19` (413 + `req.destroy()`). The byte size is my estimate, not a measurement.
  Impact: PP presses P at the bug moment, gets a false "no dev server" message and loses the shot. The bug moment does not come back.
  Recommendation: either set the cap from the real worst case (for example 64 MB; it is a local, human-pressed endpoint) or encode `image/jpeg` at 0.9 (2-4x smaller, enough for "show me"). In both cases the toast must name the HTTP status (`📸 not saved (413)`) instead of guessing "no dev server". Add a "Done when" line that runs on a 2x pixel ratio and records `pngBytes`.
- [Minor] When P is pressed twice in the same second (the id has seconds only), the second pair silently overwrites the first, because `writeFileSync` replaces the file. Add milliseconds or `-2` to the id. Checked: plan Data, id `.slice(0, 19)`.
- [Minor] When the PNG POST succeeds and the JSON POST fails, the toast says "not saved" although the PNG is on disk. The message should say which file failed.
- [Minor] When P is pressed in the shop, the toast sits behind `.shop` (z-index 20, the plan says so itself), so PP gets no feedback in the state where he most likely needs it. Pressing P again creates duplicate files, and the next JSON `hud` also contains the earlier "📸 saved" toasts.
- [Minor] `logs/shots/` grows without a limit (5-15 MB per shot), and anyone on the LAN can POST 10 MB files to it. This is acceptable on a home LAN; I note it so that nobody treats it as an accident later.
- Checked and does not break the plan: drawing-buffer timing. `toBlob` takes the bitmap synchronously at call time, inside the same rAF task as `renderer.render`, before compositing clears the buffer, so a blank PNG is unlikely. The paused branch renders again first. Row 2 checks `pngBytes > 10240`, which catches a blank frame. Pointer lock: `Input` listens on `window`, the same as the other letters. P is not part of the cheat words (`BOOZE`, `GNOMERAIN`, `main.ts:263-268`). The game has no touch input (no `touchstart` in `src`), so the playing device always has a keyboard.

Pre-mortem: A week later PP writes "the screenshot does not show what I see". The first shot that matters is a UI problem in the shop or the HUD, or the booze look, and the PNG shows a clean 3D frame behind it. The second most likely cause is the Retina "no dev server" false negative at the moment of the bug. The signal that the team missed is in open decision 2: "PNG shows the 3D view only" was framed as a convenience for the agent, not as "the shot does not show the screen".

Inversion worth considering: do nothing in code. If PP plays on this same Mac, Cmd+Shift+3/4 already saves a full screenshot with the DOM to the Desktop, and the agent can read it through `pp-find`. The P key would then only be worth it for the state JSON, which the OS screenshot cannot give.

Investigate first: Which device does PP play the playtest on: this Mac (then the OS screenshot covers the PNG part) or another computer on the LAN (then the file must travel, and the key is justified)? And which quality setting and window size does PP use (this decides whether the 10 MB cap holds)?

## Review: performance (plan-performance)

Verdict: CONCERNS

| plan step | operation | shape / size | multiplicity | volume (where measured) | cost | severity |
|---|---|---|---|---|---|---|
| 1 + Data | `POST /__shots/<id>.png`, 10 MB cap | canvas = CSS size x pixel ratio (`settings.ts:50`: low 1, medium min(1.5, DPR), high min(2, DPR)), not "1080p" | 1 per press | PNG of this game: 1.0-1.8 bytes/px (measured on 6 earlier headless shots in this session's scratchpad: 1280x720 → 1.45-1.62 MB, 2000x1299 → 2.57 MB) | 1080p DPR 1: 2-4 MB OK; MacBook DPR 2 high (3024x1964, 5.9 Mpx): 6-11 MB, at the cap; 2560x1440 monitor DPR 2 medium (3840x2160, 8.3 Mpx): 8-15 MB; high (5120x2880, 14.7 Mpx): 15-26 MB → 413 every time | Medium |
| 2 | `canvas.toBlob` on the WebGL canvas | synchronous GPU readback of the drawing buffer at the call, then PNG encode | 1 per press | 2-15 Mpx (estimated from the row above) | one hitch on the press frame; Chromium may encode PNG on the main thread in idle slices, so with the game running at 60 fps the encode can land as a longer stall a moment later. Dev-only, once per press | Low |
| 2 | idle hook `shot.update(now)` | `stamps` push + `hit('KeyP')` set lookup | every frame | 61-element array | negligible (one push and one drop per frame) | none |
| 2 | `renderer.render` when paused | one extra frame | 1 per press while paused | same as a normal frame | one frame, already paid 60x per second in play | none |
| 2 | `document.body.innerText` | forces one layout | 1 per press | DOM of HUD/menu/shop | a few ms once | none |
| 1 | server `Buffer.concat` in memory | body buffered whole | 1 per POST | up to the cap | trivial on the dev machine | none |

Findings:
- [Medium] PNG size cap vs real canvas size: when PP plays on a Retina screen with quality "high", or on a 1440p/4K monitor with DPR 2, the PNG is 8-26 MB, so the server answers 413 and the toast says "not saved (no dev server)", because the plan sizes the PNG as a 1080p frame (1-4 MB) and ignores `setPixelRatio` up to 2. Fix: raise the shot cap to 64 MB (localhost/LAN dev middleware only, `error-log` keeps its own 20 KB), and make the bad toast name the status (`📸 not saved (HTTP 413)` vs `(no dev server)`), so a too-big shot is not reported as a missing server. Add one Done-when line: on a 2x canvas (`page.setViewport` with `deviceScaleFactor: 2` and quality high, or `renderer.setPixelRatio(2)` in the scenario) row 1 still saves → `{"png":true}` and the server log shows no 413. Measured: partly (bytes per pixel from 6 real game PNGs; canvas sizes computed from `settings.ts:50`, not captured from PP's device).
- [Low] Plan Data says the PNG encode runs "off the main thread in Chromium": this is not certain (Chromium encodes async PNG in idle slices on the main thread, with a forced finish after a timeout), so the press can cost a visible stall of tens to a few hundred ms on 8-15 Mpx. Acceptable for a dev key pressed a few times per session; no code change, only drop the claim from the plan. The frame content is still correct, because the readback happens synchronously at the `toBlob` call. Measured: no (not measured on PP's device).

No findings on: idle per-frame cost of the hook (one array push, one Set lookup), extra render only when paused, `innerText` once per press, server memory per POST, LAN upload of a few MB once per press, auto-repeat (one shot per physical press, row 6).

PP (2026-10-20) on the open question: "Nie da sie tutaj zrobic zrzutu i w tym problem dlatego potrzebuje pelnego screena ekranu niech interfejs bedzie czescia gry a nie osobno". → The P shot must include the DOM UI. Orchestrator decision: PNG = WebGL frame + DOM-to-image render of the UI layer on top (small library, lazy-loaded on first P); rewriting the HUD into WebGL is rejected as days of work for the same picture. Tab capture (option c) stays rejected (needs https on the LAN).

## Plan (plan-senior, final)

Status: needs-decision (one question: what the PNG must show; steps 1-6 do not depend on it, option b or c would add a step 7)

### Resolutions
- R1: impact [High] + roast [Major] + performance [Medium] PNG over the 10 MB cap on Retina / 4K, false "no dev server" toast (one finding, Major): Decision: cap `64 * 1024 * 1024` for `/__shots` (own constant `MAX_SHOT`, `error-log` keeps 20 KB); PNG stays PNG; the bad toast names the file and the HTTP status (`📸 not saved (<id>.png HTTP 413)`), "no dev server" only when `fetch` throws. Rationale: PP asked for "plik PNG" word for word, so JPEG (roast's alternative) cuts something PP asked for; the worst case from performance is 26 MB (5120x2880 high), well under 64 MB, and the endpoint is a local, human-pressed middleware, so the cap only guards against a runaway body. Checked: `src/core/settings.ts:50` (pixel ratio up to 2 on high), `vite.config.ts:5` (20 KB belongs to `/__errors`).
- R2: impact [High] + roast [Major] `instanceof HTMLInputElement` guard also blocks the pause-menu sliders and checkboxes: Decision: no `activeElement` guard at all (the brief's variant, copying `typing` from `audio.ts:20`, is rejected as dead code). Rationale: the only text inputs in the app are the two leaderboard name fields (`src/ui/leaderboard.ts:112-113`), and while the leaderboard is open its capture-phase listener stops every keydown before `Input` sees it (`src/ui/leaderboard.ts:144-154`), so no text input can ever reach `shot.update`; a guard would protect nothing today (ladder rung 1) and the `typing` copy would still be code for a case that cannot happen. Row 4 is rewritten to the real reason. Checked: `src/ui/leaderboard.ts:144-154`, `rg "<input" src` → only `menu.ts:93-96` (range/checkbox/select) and `leaderboard.ts:112-113`.
- R3: roast [Major] the PNG shows only the 3D world, HUD/shop/menu/booze are DOM or CSS: Decision: accepted as a limit of the chosen variant, stated to PP as the one question (Decisions for PP 1) with the tab-capture option the orchestrator asked me to evaluate. Rationale: tab capture (`getDisplayMedia`) is unavailable on PP's playtest device today, see "Rejected variant (b)"; burning text into the PNG does not show layout either. Until PP chooses otherwise, the JSON carries `buffs` (impact [Low]) so a booze shot is at least labelled. Checked: `docs/ai-work/2026-10-20-crash-report.md:55` ("PP plays on another device"), `docs/ai-work/2026-10-19-magnet-gun.md:106` (playtest URL `http://192.168.0.38:5300/`), `src/main.ts:278` (booze is `canvas.style.filter`).
- R4: roast [Minor] toast behind `.shop` (z-index 20), no feedback in the shop: Decision: move the toast container out of `.hud` to `document.body` and make it `position: fixed; z-index: 35; pointer-events: none` (step 4). Rationale: `.hud` is `position: fixed` (`style.css:17`), which is a stacking context on its own, so no z-index on `.hud-toasts` can lift it above the shop (20), click-to-play (25) or menu (30) without lifting the whole dimmed HUD; one line in `hud.ts:150` plus one CSS line fixes every toast, including the existing "Sound off" from M in the menu. Side effect (product-visible, small): purchase toasts (`shop.ts:217-238`) and achievement toasts now show over the shop and the pause menu; `.deep` (50) and `.crash` (100) still cover them. `hud.ts` is being edited by another implementer: edit only that one line with Edit, run `npx tsc --noEmit` after both merges (impact [Low]).
- R5: roast [Minor] same-second overwrite: Decision: accepted, id keeps milliseconds: `new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23)` → `2026-10-20T21-15-30-123`. Rationale: one character of slice, no counter state.
- R6: roast [Minor] PNG saved but JSON failed, toast says "not saved": Decision: accepted, the toast names the failing file (R1 format). Rationale: the two POSTs run in sequence; the first non-ok answer or throw decides the message, so the text is always true.
- R7: impact [Medium] `CHANGELOG.md` entry: Decision: accepted, step 5. Rationale: `docs/ai-work/2026-10-20-changelog-menu.md` ("PP needs to see, inside each build, what changed and what to test") covers every build, dev-only keys included, because PP has to know the key exists to press it.
- R8: impact [Low] leaderboard open blocks P: Decision: accepted as row 4 (merged with the old row 4). Rationale: same mechanism as R2.
- R9: impact [Low] booze filter not in the PNG: Decision: accepted, JSON gets `buffs: ctx.buffs.list().map((b) => b.def.id)`. Rationale: one field, and the real fix is Decisions for PP 1. Checked: `src/systems/buffs.ts:62-66`.
- R10: performance [Low] "PNG encode off the main thread" claim: Decision: accepted, claim dropped; a stall of tens to a few hundred ms on a 15 Mpx canvas once per press is fine for a dev key. No code.
- R11: impact [Low] key lists (help `hud.ts:162`, legend `legend.ts:20-37`, menu hint `menu.ts:109`): Decision: none of the three gets a P entry. Rationale: dev-only key, PP learns it from the changelog line (R7); `hud.ts` and `legend.ts` are other implementers' files right now.
- Rejected: roast [Minor] `logs/shots/` grows without limit and anyone on the LAN can POST, because it is a home LAN dev folder under gitignored `logs/` and PP deletes it by hand; noted, no code.
- Rejected: roast [Minor] the next JSON `hud` text contains earlier "📸 saved" toasts, because those toasts were on the screen PP saw, so the JSON is right to list them.
- Rejected: roast "Investigate first: which device, which quality": the device question is answered by `crash-report.md:55` (another device over the LAN); the quality question no longer matters with a 64 MB cap covering the worst case (R1).
- Rejected: author alternative (e) browser download on GitHub Pages, because PP said "tylko lokalnie"; stays as a [spec silent] assumption for PP.

### Chosen variant
(a) Frame-loop hook after `renderer.render`: P → `canvas.toBlob` PNG of the WebGL frame + JSON sidecar (state, fps, build, visible DOM text, active buffs) → two POSTs to a Vite middleware that writes `logs/shots/<id>.png|json` on this computer → toast with the real result. Pros: copies the proven `errorLog()` shape, works on PP's LAN device over plain http, no permission prompt, no dependency, about 65 lines. Cons: the PNG never shows DOM (HUD, toasts, shop, menus) or the booze CSS filter; those are text in the JSON only. Cost (performance): 2-4 MB per press at 1080p DPR 1, 6-26 MB on Retina/4K high; one GPU readback plus a PNG encode stall of tens to a few hundred ms on the press frame; per-frame idle cost one array push and one Set lookup; server buffers up to 64 MB per POST. Risk (roast): PP's first UI-layout shot shows a clean 3D frame (R3, covered by the PP question); a Retina shot lost to 413 (closed by R1); silent no-shot after a slider (closed by R2). Ladder: rung 2 (`errorLog()` shape, `ctx.hud.toast`), rung 3 (`toBlob`, `fetch`, `innerText`), rung 6 only for `shot.ts`.

### Rejected variant(s)
- (b) Tab capture (`getDisplayMedia({ video: true, preferCurrentTab: true, selfBrowserSurface: 'include' })` on the first P, stream kept open, later presses grab a frame): pros: a true picture of the whole tab, DOM HUD and booze filter included. Cons and why rejected: `navigator.mediaDevices` exists only in a secure context, and PP's playtest device reaches the build over `http://192.168.0.38:5300/` (`docs/ai-work/2026-10-19-magnet-gun.md:106`, `crash-report.md:55`), which is not secure (only `localhost` and https are), so on PP's device the API is `undefined` and every press would take the fallback; making it work needs https on the LAN (`@vitejs/plugin-basic-ssl`, a new dependency, plus a certificate warning to click through on each playtest device), Chrome still shows a share picker on the first P (it leaves pointer lock and adds a "sharing this tab" bar for the whole session), the open stream copies every composited frame for the rest of the playtest (a running cost on a game that already drops frames on `high`), and iPad Safari has no `getDisplayMedia` at all. Kept as option c) in Decisions for PP 1, as a separate task if PP wants it.
- (c) HUD text burned onto the PNG (2D canvas copy + `fillText` of the first 12 `innerText` lines, +10 lines): pros: one file instead of two. Cons: a second full-size canvas (up to 59 MB RGBA on 5120x2880) per press, the text still has no position, size, overlap or colour, so a layout bug stays invisible; rejected because the JSON already holds the same text. Kept as option b) for PP.
- (d) OS screenshot only (roast inversion, Cmd+Shift+4 / Win+Shift+S): pros: zero code, shows everything. Cons: the file lands on PP's playtest device, not here, and carries no state JSON; rejected because PP plays on another device (`crash-report.md:55`). It stays the right tool for a layout bug under option a), the PP question says so.
- (e) JPEG 0.9 instead of PNG (roast): 2-4x smaller; rejected because PP asked for PNG and the 64 MB cap removes the size problem.

### Behaviour matrix (final)
| state / input | action | expected outcome | decided by |
|---|---|---|---|
| 1. in game (pointer locked), dev 5199 or preview 5300 | press P | `logs/shots/<id>.png` (rendered frame) + `<id>.json` (`time, build, url, fps, money, holeLevel, land, gear, tool, paused, playTime, buffs, hud`); toast `📸 saved <id>` (`good`), visible | v0 + R9 |
| 2. paused (pause menu, title menu, click-to-play), also with a pause-menu slider or checkbox focused, also right after changing Graphics in the menu | press P | one frame rendered on demand, same files + toast visible over the menu | v0 + R2 + R4 |
| 3. shop / blueprints / legend open | press P | same as row 2; toast visible over the overlay; `hud` in the JSON holds the overlay text | v0 + R4 |
| 4. leaderboard open (name input focused or not) | press P | nothing saved, no toast; with the input focused the letter goes into the field | R2, R8 |
| 5. instant replay playing | press P | the replay frame is saved like row 1 | v0 |
| 6. key held (auto-repeat) | hold P 1 s | exactly one pair of files | v0 |
| 7. endpoint missing (GitHub Pages 404/405) or `fetch` throws | press P | toast `📸 not saved (<id>.png HTTP 404)` or `📸 not saved (no dev server)` (`bad`); no download, no entry in `localStorage['gnome-boozed-errors']` | v0 + R1 |
| 8. server: `POST /__shots/<id>.png` body > 64 MB | — | 413, nothing written; client toast `📸 not saved (<id>.png HTTP 413)` | R1 |
| 9. server: name not matching `^[\w-]{1,40}\.(png\|json)$` (e.g. `../x.png`) | — | `next()` → Vite 404, nothing written | v0 |
| 10. server: `GET /__shots/x.png` or any other path | — | `next()`, nothing written | v0 |
| 11. pixel ratio 2, quality high (Retina / 4K) | press P | PNG 6-26 MB saved, 200-level answer, no 413 | R1 |
| 12. booze buff active | press P | PNG shows plain colours (CSS filter not captured); JSON `buffs` contains `"booze"` | R9 |
| 13. two presses within one second | press P twice | two pairs of files, ids differ in the millisecond part | R5 |
| 14. PNG POST ok, JSON POST not ok (status 4xx/5xx) | press P | PNG on disk; toast `📸 not saved (<id>.json HTTP <status>)` | R6 |

### Steps (edit order)
1. `vite.config.ts` — `const MAX_SHOT = 64 * 1024 * 1024;` and `function shotLog(): Plugin` (name `shot-log`), same handler shape as `errorLog()`: `const m = req.method === 'POST' ? req.url?.split('?')[0].match(/\/__shots\/([\w-]{1,40}\.(?:png|json))$/) : null; if (!m) return next();`; chunk loop with `MAX_SHOT` → 413 + `req.destroy()`; on `end`: `mkdirSync(join(root, 'logs', 'shots'), { recursive: true }); writeFileSync(join(root, 'logs', 'shots', m[1]), Buffer.concat(chunks)); res.statusCode = 204; res.end();` (import `writeFileSync`). `plugins: [errorLog(), shotLog()]`, registered for `configureServer` and `configurePreviewServer`. Rows 8-11; red test: `curl` lines 8-10 below → currently `404` for everything, and a 65 MB body is not refused with 413.
2. new `src/ui/shot.ts` — `export const shot = { update(now: number): void }`. Module state: `const stamps: number[] = []` (keep the last 61 `now` values; `fps = stamps.length > 1 ? Math.round((stamps.length - 1) * 1000 / (stamps[stamps.length - 1] - stamps[0])) : 0`), `const BUILD = new URL(import.meta.url).pathname` (as `crash.ts:4`). `update(now)`: push the stamp; `if (!ctx.input.hit('KeyP')) return;` `if (ctx.paused) ctx.renderer.render(ctx.scene, ctx.camera);` `const id = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);` `const state = { time: new Date().toISOString(), build: BUILD, url: location.href, fps, money: ctx.state.money, holeLevel: ctx.state.holeLevel, land: ctx.state.land, gear: ctx.player.sweeper.gear, tool: ctx.player.placing, paused: ctx.paused, playTime: ctx.state.stats.playTime, buffs: ctx.buffs.list().map((b) => b.def.id), hud: document.body.innerText.slice(0, 4000) };` `ctx.renderer.domElement.toBlob((blob) => void send(id, blob, state))`. `async function send(id, blob, state)`: whole body in `try { ... } catch { toast('📸 not saved (no dev server)', 'bad') }`; `if (!blob) throw` ; for `[[`${id}.png`, blob], [`${id}.json`, JSON.stringify(state)]]` in order: `const r = await fetch(`${import.meta.env.BASE_URL}__shots/${name}`, { method: 'POST', body }); if (!r.ok) return ctx.hud.toast(`📸 not saved (${name} HTTP ${r.status})`, 'bad');` then `ctx.hud.toast(`📸 saved ${id}`, 'good')`. No `activeElement` guard (R2). Rows 1-7, 12-14; red test: `smoke/shot.js` row 1 → today `files: 0`.
3. `src/main.ts` — `import { shot } from './ui/shot';` and `shot.update(now);` on the line directly before `ctx.input.endFrame();` (`main.ts:285`, after `renderer.render`). Two lines.
4. `src/ui/hud.ts:150` — `this.toasts = h('div', 'hud-toasts', document.body);` (was `this.root`); `src/ui/style.css:106` — `.hud-toasts { position: fixed; right: 16px; bottom: 100px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; max-width: 420px; z-index: 35; pointer-events: none; text-shadow: 0 2px 0 rgba(0,0,0,.45); }`. Rows 2-3 (toast visible); red test: row 3 scenario `document.elementFromPoint(toastCenter)` → today an element inside `.shop`.
5. `CHANGELOG.md`, section `## next build (not on 5300 yet)` — bullet: `- P saves a screenshot: logs/shots/<time>.png (the 3D view) and .json (money, hole level, gear, tool, fps, visible text) on the dev machine, dev/preview builds only; the PNG does not include the HUD, shop or menus (they are page layers). Test: press P in game, paused, in the shop; a toast says saved or why not.` Checked by `rg "P saves a screenshot" CHANGELOG.md`.
6. Scenario `<scratchpad>/smoke/shot.js` (CDP, dev server 5199, `window.gnome`): clear `logs/shots/`, `Input.dispatchKeyEvent` `KeyP`, wait 20 frames, read `logs/shots/`; one function per row below; `npx tsc --noEmit` after step 4 and again after the other implementers' `hud.ts` merge. Work progress goes into this file under `## Work progress` (Problem / Summary already above).

### Review focus
1. Graphics changed in the pause menu then P: `applyQuality` + the synthetic `resize` clears the canvas (`menu.ts:80` comment), so the paused branch must re-render before `toBlob` → pinned by step 2's row 2 test: select `quality=high` in the menu, press P, `pngBytes > 10240`.
2. Toast stacking after step 4: a toast fired while the shop is open must be the top element at its own centre, and `pointer-events: none` must keep shop buttons clickable through it → pinned by step 4's row 3 test: `elementFromPoint` on the toast centre has class `toast`, and a click on a shop tab under the toast column still switches the tab.
3. `innerText` and hidden layers: the JSON `hud` must not list `Click to play` while it is `.hidden`, and must list the shop tab title when the shop is open (assumption 3 of v0) → pinned by step 2's row 1 test (`hud` does not contain `Click to play`) and row 3 (`hudHasShop`).
4. JSON POST failing after the PNG landed → pinned by step 2's row 14 test (scenario wraps `window.fetch`: first call passes through, second returns `{ ok: false, status: 500 }`).
5. Retina worst case: 2x pixel ratio on quality high, PNG size and no 413 → pinned by step 1's row 11 test (`DPR=2` smoke run, `renderer.getPixelRatio() === 2`, server answers 204).

### Done when
1. `node smoke.mjs <dir> shot.js` row 1 → `{"png":true,"pngBytes":>10240,"json":{"fps":>0,"money":...,"buffs":[]},"hudHasClickToPlay":false,"toast":"📸 saved ..."}`
2. row 2 (pause menu, Volume slider focused, Graphics set to high before P) → `{"paused":true,"png":true,"pngBytes":>10240,"toastTop":true}`
3. row 3 (shop open) → `{"png":true,"hudHasShop":true,"toastTop":true,"tabClickWorks":true}`
4. row 4 (leaderboard open; once with the first-name input focused, once not) → `{"files":0,"inputValue":"P"}` and `{"files":0}`
5. row 5 (replay playing) → `{"replay":true,"png":true}`
6. row 6 (5 repeated keydowns, no keyup) → `{"files":2}`
7. row 7 (`window.fetch = () => Promise.reject()`) → `{"toast":"📸 not saved (no dev server)","errors":0}`; and (`fetch` returns `{ok:false,status:404}`) → `{"toast":"📸 not saved (<id>.png HTTP 404)"}`
8. `curl -s -o /dev/null -w '%{http_code}' -X POST --data-binary @65mb.bin http://127.0.0.1:5199/__shots/big.png` → `413`; `ls logs/shots | grep -c big` → `0`; row 8 in the scenario (`fetch` stub returning 413 for the png) → `{"toast":"📸 not saved (<id>.png HTTP 413)"}`
9. `curl -s -o /dev/null -w '%{http_code}' -X POST --data-binary @x.png 'http://127.0.0.1:5199/__shots/..%2Fx.png'` → `404`; `ls logs` → no `x.png`
10. `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5199/__shots/x.png` → `404`; `ls logs/shots` unchanged
11. `DPR=2 node smoke.mjs <dir> shot.js` row 11 (quality high, `renderer.getPixelRatio()` → `2`) → `{"png":true,"pngBytes":>2000000,"status":204}`
12. row 12 (type `BOOZE`, then P) → `{"json":{"buffs":["booze"]}}`
13. row 13 (two P presses 3 frames apart) → `{"files":4}` with two distinct ids
14. row 14 (`fetch` wrapper: png passes, json returns `{ok:false,status:500}`) → `{"png":true,"json":false,"toast":"📸 not saved (<id>.json HTTP 500)"}`
15. `rg -c "P saves a screenshot" CHANGELOG.md` → `1`
16. `npx tsc --noEmit` → exit 0 (gate)
17. One saved PNG from row 1 opened by eye: not black, not flipped, textured garden (gate, as v0)

### Decisions for PP
1. Co ma pokazywać zrzut z klawisza P? a) tylko widok 3D w PNG plus plik tekstowy obok (pieniądze, poziom dziury, narzędzie, fps, widoczne napisy); wtedy błąd w HUD, sklepie albo menu (nachodzenie, układ, kolory, efekt booze) NIE będzie widoczny na obrazku, bo to warstwa strony nad grą; na taki błąd robisz zrzut systemowy na urządzeniu, na którym grasz (Mac: Cmd+Shift+4, Windows: Win+Shift+S) i wysyłasz go na Slacka. b) jak a), ale pierwsze 12 linii napisów wpalone w PNG; wtedy widzisz tekst na obrazku, ale nadal bez układu i kolorów, więc błąd układu dalej niewidoczny. c) prawdziwy zrzut całej karty przeglądarki (z HUD, sklepem, booze); wtedy gra musi chodzić po https na LAN (nowa zależność, ostrzeżenie o certyfikacie do przeklikania na każdym urządzeniu), przy pierwszym P w każdej sesji przeglądarka pokaże okno „udostępnij tę kartę" i wyrzuci z celownika, pasek „udostępniasz" zostaje na cały test, a przechwytywanie kosztuje klatki przez całą grę; na iPadzie nie działa wcale. (rekomendacja: a, bo działa od razu na Twoim urządzeniu po http i pokazuje świat 3D plus stan gry, a błędy układu i tak najszybciej łapie zrzut systemowy; c) to osobne zadanie, gdy uznasz, że zrzuty UI są Ci potrzebne częściej niż raz na jakiś czas)
2. [spec silent] Zakładam: na GitHub Pages (bez serwera dev) klawisz pokazuje tylko „not saved", nic nie pobiera | Dowód: PP „tylko lokalnie" | Jeśli źle: brak zrzutu na Pages, 4 linie do dodania | rekomendacja: a) zostaje tak
3. [spec silent] Zakładam: przy otwartej tablicy wyników P nic nie zapisuje (litera idzie do pola imienia) | Dowód: `src/ui/leaderboard.ts:144-154` zatrzymuje każdy klawisz, gdy tablica jest otwarta | Jeśli źle: zrzut tablicy wymaga wyjątku w tym listenerze | rekomendacja: a) bez wyjątku
4. [spec silent] Zakładam: odtwarzanie powtórki (`replay.ts`) i ekran DEEP (`.deep`) są zapisywane jak każda klatka, bez dodatkowego kodu; na ekranie DEEP toast jest schowany pod czarną planszą (z-index 50 > 35), pliki i tak lądują | Dowód: `main.ts:282` renderuje powtórkę tą samą ścieżką | Jeśli źle: czarny PNG w tych stanach | rekomendacja: a) bez wyjątku, wiersz 5 to sprawdza
No `docs/ai-work` decision older than 60 days is involved.

### v0 → final
- added: step 4 (toasts out of `.hud`, visible over shop and menus), step 5 (CHANGELOG bullet), matrix rows 11-14 (Retina 2x, booze in JSON, millisecond ids, JSON-fails-after-PNG), real HTTP status in the bad toast, 64 MB cap, `buffs` field, 7 more "Done when" lines (10 → 17).
- dropped: the `activeElement` input guard (dead code: the leaderboard already stops every key), the "encode off the main thread" claim, the 10 MB cap, the seconds-only id.
- moved to PP: one question (what the PNG must show: 3D only / text burned in / true tab capture with https), with the fact that tab capture cannot run on PP's http LAN device today; v0 open decision 2 is folded into it, open decisions 1, 3, 4 stay as [spec silent] assumptions.
