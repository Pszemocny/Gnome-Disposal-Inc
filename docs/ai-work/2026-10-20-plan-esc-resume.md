# Plan: Esc resumes the game at once (pause menu, shop)

Spec: PP, terminal 2026-10-20: "zrob tak aby bedac w sklepie naciskajac esc wracalo do gry. Bedac w menu pauzy klikam esc i wracam do gry, nie musze nic dodatkowo klikac tylko od razu wracam do gry, tak samo w sklepie jeden esc wychodze ze sklepu i moge spowrotem chodzic."
Trivial check: the "play / not play" gate (`ctx.input.locked`) is read by 6 files (player, wheel, pound, factory, sweeper, main); changing what "playing" means is a shared input path plus a new player-visible state (free cursor), so not a single-file change.

## Plan v0 (plan-author)

### Goal
One Esc in the pause menu or in the shop puts the player back in the running game immediately; when the browser refuses to re-capture the mouse, the game still runs with a visible cursor (WASD walks, moving the mouse looks around) and the next click or W captures it.

### Why the extra click exists today
Browsers exit pointer lock on Esc and then refuse `requestPointerLock()` until a new user gesture. An Escape keydown is not a gesture (HTML spec: activation-triggering keys exclude Esc). `src/main.ts:153` reacts to the refusal with the blocking "Click to play" overlay, which also sets `ctx.paused = true` (`main.ts:125`). The shop's `close()` (`src/ui/shop.ts:193`) hits the same refusal. The fix is not "get the lock" (impossible from Esc) but "do not need the lock to play".

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | in game, locked; Esc keydown reaches the page (headless only) | `unlock()` | pause menu, `paused=true` (unchanged) | `main.ts:160`, note 2026-10-19 |
| 2 | in game, locked; browser eats Esc and exits the lock (Chrome/Brave/Firefox/Safari; also during a replay) | `pointerlockchange` → `showPause()` | pause menu (unchanged) | `main.ts:143` |
| 3 | pause menu; Esc; browser grants the lock | `resume()` + lock granted | game runs, locked, menu hidden, no hint, HUD not dimmed | PP quote "od razu wracam do gry" |
| 4 | pause menu; Esc; browser refuses the lock | `resume()` + `onLockError` | game runs AT ONCE (`paused=false`), menu hidden, HUD not dimmed, visible cursor, hint "Click or press W to capture the mouse" | PP quote "nie musze nic dodatkowo klikac" |
| 5 | free cursor (row 4); hold W | player moves | position changes without the lock | PP quote "moge spowrotem chodzic" |
| 6 | free cursor; mouse moves (movementX/Y) | yaw/pitch change | camera turns without the lock; stops at the window edge | brief: "mouse look while unlocked via mousemove movementX" |
| 7 | free cursor; LMB click on the canvas | `lock()` from the click | locked, hint hidden; that click fires NO game action (no grab, no throw, no kick) | brief: "the next click re-locks without also firing a game action" |
| 8 | free cursor; Esc | `showPause()` | pause menu, `paused=true` | SPEC.md:82 "Esc pauza" |
| 9 | free cursor; W/A/S/D/Space/Shift keydown `spec silent` | `lock()` from the keydown (a non-Esc key is a user gesture) | locked when granted; walking continues either way | Open decision 1 |
| 10 | free cursor; window loses focus (`blur`) `spec silent` | `showPause()` | pause menu, as when the browser drops the lock on blur today | Open decision 2 |
| 11 | shop open; Esc | `shop.close()` → `lock()` | shop closed, game runs (locked, or free cursor + hint on refusal); pause menu never shown | PP quote; note 2026-10-19 |
| 12 | shop open; B / E / Tab `spec silent` | same handler as row 11 | same as row 11 | `shop.ts:162` lists 4 close keys |
| 13 | shop open; click the close button | `shop.close()` → `lock()` from a click | locked directly (click is a gesture) | `shop.ts:150` |
| 14 | blueprints (K) open; Esc or K `spec silent` | `blueprints.close()` → `lock()` | closed, game runs, free cursor + hint on refusal | `blueprints.ts:56,88` |
| 15 | legend (L) open; Esc or L `spec silent` | `legend.close()` → `lock()` | closed, game runs, free cursor + hint on refusal | `legend.ts:112,134` |
| 16 | leaderboard opened from the pause menu; Esc `spec silent` | `leaderboard.close()` (capture, `stopPropagation`) | leaderboard closed, pause menu stays, game paused (unchanged) | `leaderboard.ts:146-152,194` |
| 17 | pause menu sub-page (Achievements, What's new); Esc | as row 3/4 | resume, no "back" step | note 2026-10-19 "Rejected: Achievements page … Esc resumes" |
| 18 | title screen; Esc | nothing | title stays | note 2026-10-19 |
| 19 | deep / rebirth screen; Esc | nothing | screen stays | `main.ts:158` |
| 20 | pause menu visible; mouse moves over the menu | deltas accumulate, cleared each frame | camera does NOT turn (look gated on `!ctx.paused`) | regression guard for step 1 |
| 21 | lock granted while an overlay is open (fast B/E after a close, or row 9 racing a hotkey) `spec silent` | `onLockChange(true)` sees `overlayOpen()` | exit the lock again, overlay stays, game stays paused | `main.ts:130-144` has no guard today |

`spec silent` rows: 9, 10, 12, 14, 15, 16, 21 (7). Rows 12, 14, 15, 16 need no code: they already go through the same `close()` → `lock()` → `onLockError` path and only change because `onLockError` stops pausing.

### Reach
- `ctx.paused` writers: `main.ts:125,134,147`, `shop.ts:174,192`, `legend.ts:122,134`, `blueprints.ts:76,88`, `hud.ts:342` (deep), `daily.ts:55`. Readers: `main.ts:178` (autosave), `215,271,278` (loop), `player.ts:407,435`, `wheel.ts:33`, `pound.ts:60`, `hud.ts:202` (firstUse), `replay.ts:45`. Free cursor counts as playing: autosave runs, replay records, first-use hints show. Intended.
- `ctx.input.locked` writer: `input.ts:49` only. Readers that gate play: `player.ts:396` (look), `407` (actions), `435` (move), `438` (jump), `wheel.ts:33`, `pound.ts:60`, `factory.ts:162` (hold E); readers that must keep `locked`: `input.ts:25` (mousedown), `player.ts:190` (gun fire; `mouse.left` is set only while locked anyway), `main.ts:154,160,169`.
- `mouse.dx/dy/wheel` writer: `input.ts:40-47`; cleared every frame by `endFrame()` at `main.ts:283`, which runs while paused too (so no camera jump on resume). Readers: `player.ts:399-400`, `wheel.ts:55-56`, placement distance in `player.ts`.
- HUD `dim` class writers: `main.ts:126,135,148`. Nothing else.
- `.click-to-play` element: `main.ts:119-128,133,149,161,164`, `style.css:278`. Reused as the hint.
- Overlays with their own Esc listeners, registered before main's (`main.ts:95`): shop, blueprints, legend (preventDefault → main ignores), leaderboard (capture + stopPropagation → main never sees it).
- No API, no backend, no save-format change.

### Data
- No persistent data touched. Runtime state only: `ctx.paused`, `ctx.input.locked`, mouse deltas. Save (`localStorage`) unchanged; autosave interval already keys on `!ctx.paused`.
- Cost: `mousemove` handler does two adds per event instead of an early return while unlocked; cleared once per frame. No measurable cost.

### Steps (edit order)
1. `src/core/input.ts:40-47` — `mousemove` and `wheel`: remove the `if (!this.locked) return` / `if (this.locked)` guards; always accumulate `dx`, `dy`, `wheel` (consumers gate on `ctx.paused`; `endFrame` clears every frame). Keep `mousedown` guard at line 25 unchanged (row 7). Comment on the mousemove line: "movementX works without the lock; the player gates on `ctx.paused`".
2. `src/player/player.ts` — line 396: `if (!ctx.paused && !(this.placing && inp.mouse.right) && !this.wheel.open)`; line 407: `const active = !ctx.paused;`; line 435: `if (ctx.paused) wish.set(0, 0, 0);`; line 438: `if (inp.hit('Space') && !ctx.paused)`. Line 190 unchanged.
3. `src/player/wheel.ts:33` — `if (this.open && ctx.paused) this.close();` (comment: "closes when the game pauses").
4. `src/player/pound.ts:60` — drop `inp.locked &&` from the condition (keeps `!ctx.paused`).
5. `src/entities/factory.ts:162` — `const holding = this.near && !ctx.paused && ctx.input.down('KeyE') && !ctx.player.lookAt.switch;`.
6. `src/main.ts`:
   a. Rename `clickToPlay` → `mouseHint`, text `'Click or press W to capture the mouse'`; `showClickToPlay` → `showMouseHint = () => mouseHint.classList.remove('hidden')` (no `paused`, no `dim`). Comment at 118: "the browser refuses pointer lock without a click after an Esc exit: the game runs with a free cursor and this hint until a click or a walk key captures it".
   b. `const resume = () => { menu.hide(); mouseHint.classList.add('hidden'); ctx.paused = false; ctx.hud.root.classList.remove('dim'); ctx.input.lock(); };`
   c. Esc listener (157-167): `if (ctx.input.locked) ctx.input.unlock(); else if (menu.visible && started) resume(); else if (!ctx.paused) showPause();` (the overlay branch at 161 goes away).
   d. `onLockChange(true)` (131): first line `if (overlayOpen()) return ctx.input.unlock();` (row 21: a lock granted after a close raced with a reopen must not unpause the overlay).
   e. Row 9 (Open decision 1, assumed yes): in the same keydown listener, before the Escape check: `if (!ctx.paused && !ctx.input.locked && !menu.visible && !overlayOpen() && WALK_KEYS.has(e.code)) ctx.input.lock();` with `const WALK_KEYS = new Set(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight']);` (only keys that never open an overlay). Drop on "no".
   f. Row 10 (Open decision 2, assumed yes): `window.addEventListener('blur', () => { if (started && !ctx.paused && !ctx.input.locked) showPause(); });` (while locked the browser drops the lock itself and row 2 handles it). Drop on "no".
   g. `onLockError` (153-155): unchanged condition, now calls `showMouseHint()`.
7. `src/ui/style.css:278` — `.click-to-play` becomes a non-blocking bottom pill: `position: fixed; left: 50%; bottom: 110px; transform: translateX(-50%); padding: 8px 16px; border-radius: 10px; background: var(--panel); border: 2px solid var(--accent); color: var(--accent); font: 700 20px var(--font); pointer-events: none; z-index: 25;` (class name kept; `pointer-events: none` so the click reaches the canvas handler at `main.ts:168`).
8. Headless harness in the scratchpad (`smoke/smoke.mjs` with `FULL=1`, `__cdp` queue, DPR=1, as described in `2026-10-19-esc-pause-shop.md`, "Work progress"; the previous copy is gone with its scratchpad) and `smoke/scenario-esc.js` covering every matrix row (Tests below). Refusal is simulated as on 2026-10-19: `requestPointerLock` rejects once and fires `pointerlockerror`.
9. Docs: `docs/SPEC.md:82` ("Esc pauza / zamyka sklep") and `:211` (replace the "Click to play" sentence with: Esc resumes at once; when the browser refuses to capture the mouse the game runs with a visible cursor and a click or W captures it); `CHANGELOG.md` new section line; `docs/ai-work/2026-10-20-esc-resume.md` (Problem / Summary / Work progress, browser table, Done-when PASS lines); `BOARD.md` status line.

### Tests
Headless scenario `scenario-esc.js` (full Chromium `--headless=new`, trusted CDP input), run with the dev server on 5199. Checks, in order (ids = matrix rows):
- r1 `02_esc_keydown_locked`: paused true, `.menu` shows "PAUSED".
- r2 `04_browser_exit`: `document.exitPointerLock()` → paused true, menu "PAUSED".
- r3 `03_esc_pause_granted`: paused false, locked true, menu hidden, hint hidden, hud not `.dim`.
- r4 `05_esc_pause_refused` (refusal armed): paused false, locked false, menu hidden, hint visible, hud not `.dim`.
- r5 `05b_walk_free`: hold W 20 frames → `player.body` x/z moved > 0.5 m.
- r6 `05c_look_free`: CDP `mouseMoved` with +200 px → yaw changed by a negative delta (sign per `player.ts:399`), and it did NOT change while the menu was visible (r20).
- r7 `08_click_free`: CDP click at the canvas centre → locked true, hint hidden, `player.held` undefined, no kick/throw started (`ctx.player` sack/kick timers at rest), `mouse.leftPressed` false on the next frame.
- r8 `06_esc_free`: paused true, menu "PAUSED".
- r9 `06b_walk_key_locks`: free cursor, CDP keyDown W (refusal disarmed) → locked true within 5 frames.
- r10 `06c_blur_free`: `window.dispatchEvent(new Event('blur'))` → paused true, menu "PAUSED".
- r11 `10_shop_esc` (refused and granted variants): shop false, paused false, menu hidden; refused → hint visible; granted → locked true.
- r12 `10b_shop_b`: B closes the shop, same assertions as r11, and the shop is not open on the next frame.
- r13 `10c_shop_close_btn`: CDP click on `[data-close]` → locked true.
- r14 `15_blueprints_esc`, r15 `16_legend_esc`: closed, paused false, hint visible (refused).
- r16 `17_leaderboard_esc`: menu still visible, paused true.
- r17 `18_ach_esc`: click Achievements, Esc → paused false.
- r18 `01_title_esc`: title stays, paused true. r19 `19_deep_esc`: `.deep` present → paused true.
- r20 covered in r6. r21 `20_overlay_race`: arm "grant" and open the shop in the same tick as `ctx.input.lock()` → after the grant `shop.isOpen` true, paused true, locked false.
Regression: `CDP_PORT=9373 MAXPOLL=2400 node smoke.mjs <out> scenario15.js` values as in the 2026-10-19 note; `npx tsc --noEmit` clean; one screenshot of the free-cursor hint checked by eye (CLAUDE.md rule 12 analogue for UI).

### Done when
1. `scenario-esc.js` → `02_esc_keydown_locked paused=true menu=PAUSED`
2. `scenario-esc.js` → `04_browser_exit paused=true menu=PAUSED`
3. `scenario-esc.js` → `03_esc_pause_granted paused=false locked=true menu=hidden hint=hidden dim=false`
4. `scenario-esc.js` → `05_esc_pause_refused paused=false locked=false menu=hidden hint=visible dim=false`
5. `scenario-esc.js` → `05b_walk_free moved>0.5`
6. `scenario-esc.js` → `05c_look_free yawDelta<0 yawDeltaPaused=0`
7. `scenario-esc.js` → `08_click_free locked=true hint=hidden held=undefined leftPressed=false`
8. `scenario-esc.js` → `06_esc_free paused=true menu=PAUSED`
9. `scenario-esc.js` → `06b_walk_key_locks locked=true` (`spec silent`)
10. `scenario-esc.js` → `06c_blur_free paused=true menu=PAUSED` (`spec silent`)
11. `scenario-esc.js` → `10_shop_esc shop=false paused=false menu=hidden` (refused: `hint=visible`; granted: `locked=true`)
12. `scenario-esc.js` → `10b_shop_b shop=false paused=false reopened=false` (`spec silent`)
13. `scenario-esc.js` → `10c_shop_close_btn locked=true`
14. `scenario-esc.js` → `15_blueprints_esc open=false paused=false hint=visible` (`spec silent`)
15. `scenario-esc.js` → `16_legend_esc open=false paused=false hint=visible` (`spec silent`)
16. `scenario-esc.js` → `17_leaderboard_esc lb=false menu=visible paused=true` (`spec silent`)
17. `scenario-esc.js` → `18_ach_esc paused=false`
18. `scenario-esc.js` → `01_title_esc menu=title paused=true`
19. `scenario-esc.js` → `19_deep_esc deep=true paused=true`
20. `scenario-esc.js` → `05c_look_free yawDeltaPaused=0` (same check as line 6, separate assertion)
21. `scenario-esc.js` → `20_overlay_race shop=true paused=true locked=false` (`spec silent`)

### Assumptions (numbered)
1. Per browser, what the player sees after Esc in the pause menu (inference, not measured in a real browser; both outcomes are handled by rows 3 and 4, so the plan does not depend on which one happens):
   - Chrome / Brave: refuses (Esc is not an activation key, and Chromium demands a gesture after a user Esc exit) → free cursor + hint; W or a click captures. Pewność: Likely (simulated on 2026-10-19, not measured).
   - Firefox: requires the call inside a user-generated event handler; a trusted Esc keydown probably counts → likely locked directly. Pewność: Unclear.
   - Safari: supports pointer lock, demands a gesture after an Esc exit, may refuse requests made shortly after the exit → free cursor + hint, then click/W. Pewność: Unclear.
   - All three exit the lock on Esc themselves and do not deliver that keydown to the page (row 2). Pewność: Confident for Chromium, Likely for the others.
2. `MouseEvent.movementX/Y` is delivered on plain `mousemove` in all three browsers (Safari 10.1+); if a browser delivered 0, looking waits for the lock but walking still works. Pewność: Likely.
3. A `keydown` of W/A/S/D/Space/Shift counts as transient user activation in Chromium, so `requestPointerLock()` from that handler is granted (row 9). Pewność: Likely. If wrong, the keydown just fires `pointerlockerror` again and the hint stays until a click.
4. In the headless harness the refusal is simulated (reject once + `pointerlockerror`), as on 2026-10-19. Rows 3 and 4 are both exercised; the real browser picks one.
5. `mouse.left` can only become true while locked (`input.ts:25`), so the re-lock click and any LMB held across an unlock never start a game action (row 7).
6. `endFrame()` runs every frame including paused frames (`main.ts:283` is outside the `!ctx.paused` block), so accumulating mouse deltas while unlocked never causes a camera jump on resume (row 20).

### Alternatives rejected
- (a) Keep the blocking "Click to play" overlay (today): rejected, it is exactly the extra click PP does not want.
- (b) `navigator.keyboard.lock(['Escape'])` so Esc never leaves the lock: rejected on 2026-10-19 (works only in element fullscreen; the game must not force fullscreen).
- (c) Open the pause menu on a different key than Esc so the lock is never lost: rejected, PP asked for Esc.
- (d) Request the lock again on every `mousemove` while free: rejected, `mousemove` is not a user gesture, it would only spam `pointerlockerror` and re-show the hint.
- (e) A new `ctx.playing` flag instead of `!ctx.paused`: rejected, `paused` already means "the loop does not run the game"; one more flag is one more thing to keep in sync.

### Ladder
- Steps 1-5 (gates on `!ctx.paused`, deltas without lock): rung 2 (reuse `ctx.paused`) and rung 3 (platform `movementX`); required by "moge spowrotem chodzic" and "nie musze nic dodatkowo klikac".
- Step 6a/6g (hint reuses the overlay element): rung 2; required by the brief: the player must see why the cursor is visible and what captures it.
- Step 6b/6c (`resume()`, Esc branches): rung 6, minimum code; required by "klikam esc i wracam do gry".
- Step 6d (overlay guard on grant): rung 5, one line; closes a race that exists today and that row 9 widens.
- Step 6e (walk key captures): rung 5, one condition; not in the spec, Open decision 1.
- Step 6f (blur pauses): rung 5, one listener; not in the spec, Open decision 2.
- Step 7 (CSS): rung 2, restyle of the existing rule.
- Step 8 (harness): CLAUDE.md "Tests" (headless CDP scenarios); no new dependency.
- No new dependency, no new file in `src/`.

### Open decisions (for PP)
1. [spec silent, row 9] Zakładam: when the mouse is free after Esc, pressing W/A/S/D/Space/Shift also captures the mouse (a letter key is a gesture, Esc is not), so the player who starts walking gets mouse look back without any click | Dowód: `main.ts:168` captures only on click today; `input.ts:13` sees every keydown | Jeśli źle: the player walks with a visible cursor until they click; a wrong guess costs nothing else | Pewność: Likely | rekomendacja: a) add it (step 6e); b) click only.
2. [spec silent, row 10] Zakładam: when the mouse is free and the window loses focus (alt-tab, click outside), the game pauses, like today when the browser drops the lock on blur | Dowód: `main.ts:143` pauses on lock loss; nothing pauses an unlocked running game | Jeśli źle: the game (and a daily-challenge timer) keeps running while the player is away | Pewność: Likely | rekomendacja: a) pause on blur (step 6f); b) keep running.
3. [spec silent, rows 12, 14, 15] Zakładam: B/E/Tab in the shop, K/L in blueprints/legend behave exactly like Esc there (close, game runs, free cursor on refusal) | Dowód: `shop.ts:162`, `blueprints.ts:56`, `legend.ts:112` share one handler per overlay | Jeśli źle: nothing to change, these keys already go through the same path | Pewność: Confident | rekomendacja: a) same as Esc, no extra code.
4. [spec silent, row 16] Zakładam: Esc in the leaderboard opened from the pause menu returns to the pause menu, not to the game | Dowód: `leaderboard.ts:146-152` stops the event before main's listener; `close()` (`:194`) does not lock or unpause | Jeśli źle: the player needs a second Esc to resume; one keystroke | Pewność: Confident | rekomendacja: a) leave it, the menu is where they came from.
5. [spec silent, row 21] Zakładam: a lock granted while an overlay is open (fast reopen after a close) is released again instead of unpausing the overlay | Dowód: `main.ts:130-144` unpauses on every grant; `shop.open` (`:175`) cannot cancel a pending request | Jeśli źle: the game runs behind an open shop | Pewność: Likely | rekomendacja: a) one guard line (step 6d).
6. Process: the headless harness was rebuilt from scratch for the third session; copy `smoke.mjs` into `tools/smoke/` this time (CLAUDE.md allows it "if they become permanent")? a) yes, commit it with this change; b) scratchpad only (rekomendacja: a).
7. [decision age] none: every decision this plan relies on is from 2026-10-19 (1 day old).

### Self-check
- Every acceptance criterion (Esc in pause → game; Esc in shop → game; no extra click; walking resumes) has a step (6b/6c, 11 via `onLockError`, 1-5) and a scenario check (r3/r4/r5/r6/r11).
- Every step names the file, line, exact condition or signature; no "handle edge cases" lines.
- `ctx.paused` and `input.locked`: all writers and readers listed in Reach with lines; the ones that keep `locked` are named with the reason.
- Lists compared with the code: shop close keys (4, `shop.ts:162`), overlays with Esc (4: shop, blueprints, legend, leaderboard), `locked` readers (7 gate sites + 3 that stay). 7 `spec silent` rows; 21 matrix rows = 21 Done-when lines.
- No decision older than 60 days involved.
- Plan vs code: production diff is about 30 lines plus a ~150-line scenario and the harness; the plan is longer than the production diff because 21 variants are enumerated, which is the point of the matrix.

## Review: performance (plan-performance)

Verdict: APPROVE

No database here; "cost" = work per frame in the game loop (`main.ts:200`, 60 fps cap) and per input event.

| plan step | operation | shape / index | multiplicity | volume (where measured) | cost | severity |
|---|---|---|---|---|---|---|
| 1 | `mousemove` accumulates `dx/dy` without the lock | 2 multiply-adds, no allocation | per mousemove event (~60-1000/s depending on mouse polling) | n/a | negligible; cleared once per frame by `endFrame()` (`input.ts:86-90`), which runs every frame incl. paused and replay frames (`main.ts:283`, after the `document.hidden` / 15.5 ms early returns, same as today) | none |
| 1 | `wheel` accumulates without the lock | 1 add | per wheel event | n/a | negligible; also accumulates while the Achievements page scrolls, cleared next frame, read only by `wheel.ts` behind `!ctx.paused` | none |
| 2-5 | gates switch from `inp.locked` to `ctx.paused` | boolean read swap | per frame, 7 sites | n/a | zero delta | none |
| 6c/6d | Esc listener branches, `overlayOpen()` guard on grant | 4 boolean reads + 1 `querySelector('.deep')` | per keydown / per lock change | n/a | same as today | none |
| 6e | walk keydown calls `ctx.input.lock()` while free | `requestPointerLock()` → on refusal 1 rejected promise + `pointerlockerror` + `classList.remove` | per keydown including OS auto-repeat: holding W ≈ 30 calls/s (typical repeat rate) until the browser grants | estimated, not measured | tiny CPU, but a refused request per repeat; the `!ctx.input.locked` guard does not stop it because the state stays unlocked while refused | Low |
| 6f | `blur` listener | 1 call | per focus loss | n/a | negligible | none |
| free-cursor state | loop runs the full game while unlocked | same work as locked play | per frame | n/a | no change vs. today's locked play; paused frames still render once (`redraw`) | none |

Findings:
- [Low] step 6e, lock spam on key repeat: when the mouse is free and the browser keeps refusing, holding W makes every auto-repeat keydown (~30/s) call `requestPointerLock()` again, each one rejected → fix: add `!e.repeat` to the step 6e condition (one request per real key press). Measured: no (estimated from typical OS repeat rate).

No findings on: mouse/wheel delta accumulation and per-frame clearing, the 7 gate swaps, Esc/lock-change branches, blur listener, hint as a CSS pill with `pointer-events: none` (no layout per frame, only class toggles on events), free-cursor game loop (identical to locked play).

## Review: impact (plan-impact)

Verdict: CONCERNS

Missing from the plan:
- [Medium] Recorded wheel behaviour changes without a line in the plan: `docs/ai-work/2026-10-20-plan-robots-wheel-blower.md:67` row B6 says "Tab while the shop is open or unlocked → no wheel". Steps 2 (`player.ts:407` `active = !ctx.paused`, which gates `this.wheel.update` at `:409`) and 3 (`wheel.ts:33`) make Tab open the wheel with a free cursor. When the player presses Tab right after Esc-resume, the wheel opens and slows the game to 0.25. The intent of B6 ("no wheel when not playing") still holds, because free cursor now counts as playing. Fix: name the change in Open decisions ("B6 'unlocked' becomes 'paused'") and add a matrix row "free cursor; hold Tab → wheel opens, mouse picks a slice" with a scenario check. Same for the wheel comment at `wheel.ts:31` ("closes ... when the mouse is unlocked") and `wheel.ts:45` ("While active (locked, not paused)"); both need new text.
- [Medium] The hint stays on top of the shop, blueprints and legend. Today no overlay can open while "Click to play" shows, because the game is paused. With the plan, B / E / K / L work with a free cursor, and `shop.open` (`shop.ts:171`), `blueprints.open` (`blueprints.ts:73`), `legend.open` (`legend.ts:~120`) do not hide the hint. The hint has z-index 25 and these panels are `.shop` (z-index 20, `style.css:224`), so "Click or press W to capture the mouse" floats over the open shop. Deep (z 50), leaderboard (z 60) and the menu (z 30) cover it. Fix: hide the hint in `onLockChange` is not enough (no lock change on open); either hide it where `ctx.paused` turns true (add `mouseHint.classList.add('hidden')` to each overlay open, or make the CSS rule `.click-to-play` hidden while any `.shop:not(.hidden)` is present via `body:has(.shop:not(.hidden)) .click-to-play { display: none }`), and add a matrix row "free cursor; B → shop open, hint hidden; Esc → hint back on refusal".
- [Low] `main.ts:123` `clickToPlay.addEventListener('click', () => ctx.input.lock())` becomes dead code after step 7 (`pointer-events: none`); step 6a should delete it, the canvas click handler (`main.ts:168`) takes over.
- [Low] `ctx.paused` readers missing from Reach (all benign, listed so the implementer does not have to re-grep): `hud.ts:421` (`.hud-left.paused` hides the left panel; with a free cursor it now stays visible, as wanted), `hud.ts:630` (load toasts), `hud.ts:632` (H help toggle), `shot.ts:52` (redraw before a screenshot), `shot.ts:73` (JSON field `paused`; with a free cursor it records `false`), `replay.ts:45` (already listed). `shot.ts:76` also dumps `document.body.innerText`, so a visible hint now appears in screenshot JSON; harmless, matches the screen.
- [Low] `docs/SPEC.md:70` says "mysz patrzy (pointer lock po kliknięciu)". Step 9 updates only `:82` and `:211`; line 70 also needs the free-cursor sentence (mouse looks without the lock until a click or W captures it).
- [Low] Comments that describe the old rule: `main.ts:118` ("one click here resumes") is covered by step 6a; `main.ts:152` ("asks for one click") and `main.ts:156` ("click-to-play → pause menu") are not named in step 6; rewrite both with steps 6c/6g.

Neighbours checked: draft/live: not affected (no such split in this game) | profiles/LEVEL 2/3: not affected (no accounts) | serve-cache: not affected (none) | auto-regeneration jobs: not affected (none) | polling/imports: not affected (no backend) | find_best/cohorts: not affected (none) | dimensions/formulas: not affected (none) | text index / admin search: not affected (none) | prompt context: not affected (none) | widget: not affected (none). Game-specific neighbours: tool wheel: affected (finding 1) | shop/blueprints/legend: affected (finding 2; their close → `lock()` path is unchanged and correct) | leaderboard: not affected (capture listener with `stopPropagation`, `leaderboard.ts:144-154`, z 60 covers the hint) | deep/rebirth: not affected (`hud.ts:342` sets `paused` itself, `unlock()` is a no-op when free, Esc guard on `.deep` stays at `main.ts:158`) | daily over: not affected (`daily.ts:55-56` sets `paused`, opens leaderboard; daily timer now runs with a free cursor, covered by Open decision 2) | replay: not affected (`replay.ts:45` stops on `paused`; Esc with a free cursor → `showPause` → replay stops, matches `SPEC.md:214` "I lub Esc przerywa") | sweeper/blower/gun: not affected (`sweeper.ts:111` and `player.ts:190` need `mouse.left`, set only while locked, `input.ts:25`) | placement ghost: affected as intended (`player.ts:918` mouse wheel distance now works with a free cursor; `:910-913` RMB rotate stays lock-only via `mouse.right`) | ground pound, factory hold E: covered by steps 4, 5 | input `keys` set: not affected (`input.ts:50` clears only on unlock; a grant from W keeps W held) | audio M / menu M listeners (`audio.ts:18`, `menu.ts:66`): not affected | save/autosave: not affected (format unchanged; `main.ts:178` now saves during free-cursor play, intended).
FE/BE: not applicable (no backend, no API; the only external call is the leaderboard, untouched).
Joby/crony/deploy: none; static build, no migration.
Decisions: consistent with `docs/ai-work/2026-10-19-esc-pause-shop.md` (Esc in shop never shows the pause menu; Achievements page: Esc resumes; `keyboard.lock` rejected) | consistent in intent with `docs/ai-work/2026-10-19-plan-broom-tractor.md:94` ("Sweeper must run only inside the `inp.locked && !ctx.paused` branch"; the branch becomes `!ctx.paused`, the sweeper follows it) | consistent with `docs/ai-work/2026-10-20-blueprints.md:29` and `2026-10-20-legend.md` (close keys, `preventDefault`, `pressed.delete`) | textual conflict with `docs/ai-work/2026-10-20-plan-robots-wheel-blower.md:67` B6 ("Tab while the shop is open or unlocked → no wheel"), finding 1; not a BLOCK because the decision's purpose (no wheel outside play) survives once free cursor counts as play, but PP should see it named.
Decisions older than 60 days: none (all related notes are from 2026-10-19 and 2026-10-20).
Regression vs current behaviour: none on the data path. `onLockChange(true)` still hides the hint, unpauses and runs the first-start intro (`main.ts:134-142`); `showPause` still hides the hint; title Play refusal still keeps the title (`onLockError` condition unchanged). Only visible difference beyond the asked one: the hint over overlays (finding 2).

## Review: roast (plan-roaster)

Verdict: CONCERNS

Steel-man: The plan stops trying to win a fight the browser always wins (no lock after an Esc keydown) and makes the lock optional: `!ctx.paused` becomes "playing", the mouse hint stops blocking, and every overlay close path inherits the fix through the one `onLockError` it already calls. Strengths: no new state flag; the re-lock click cannot act because `mousedown` stays gated on `locked` (`input.ts:25`); deltas cannot jump on resume because `endFrame()` runs on paused frames (`main.ts:283`); the overlay-race guard (6d) closes a hole that exists today; the shop, blueprints and legend already strip their closing key from `pressed` (`shop.ts:165`, `blueprints.ts:58`, `legend.ts:114`), so B/E/Tab/K/L cannot reopen the panel once `active` becomes `!ctx.paused`.

Findings:
- [Major] Held Esc (auto-repeat) toggles pause and resume about 30 times a second; in the shop it lands in the pause menu.
  Assumption: every Esc keydown is a separate, deliberate press.
  Scenario: shop open, the player holds Esc a bit longer than the OS repeat delay. Keydown 1: the shop handler closes the shop (`preventDefault`, main ignores it). Keydown 2 (`e.repeat === true`): the shop is closed, so its handler returns; main sees no `defaultPrevented`, no overlay, `!ctx.paused` → `showPause()`. Keydown 3 → `resume()`, keydown 4 → `showPause()`, and so on until release. The same happens in the game in a real browser: the first Esc exits the lock (eaten), the repeats reach the page and flip between pause and free cursor.
  Checked: main Esc listener `main.ts:157-167` has no `e.repeat` check; shop handler `shop.ts:160-166` returns once `isOpen` is false; `input.ts:13-18` does not filter repeats; the plan's step 6c keeps this shape.
  Impact: when the player holds Esc in the shop, the pause menu flickers and may stay open, breaking matrix row 11 ("pause menu never shown"); in the game the final state after release is random.
  Recommendation: first line of the main Esc listener `if (e.repeat) return;`; add a matrix row "Esc held" and a scenario step with CDP `Input.dispatchKeyEvent` `autoRepeat: true` after the shop close (expect shop=false, menu=hidden).
- [Minor] A lock granted late after the player paused again un-pauses the game.
  Assumption: no lock request is pending when the pause menu opens.
  Scenario: free cursor; the player presses W (step 6e requests the lock), then Esc or alt-tab (step 6f) before the grant arrives → `showPause()`; the grant fires `onLockChange(true)` → `menu.hide()`, `paused = false`. Same with Esc pressed twice fast in the pause menu when the browser grants the first `resume()` request late (Firefox/Safari, assumption 1 "Unclear").
  Checked: `main.ts:130-136` un-pauses on every grant; step 6d guards only `overlayOpen()`; a `menu.visible` guard is not possible because title Play requests the lock with the menu visible (`main.ts:108-111`).
  Impact: the second Esc is lost, the game runs instead of staying paused. Rare (grant is usually within a frame).
  Recommendation: one flag: `lock()` callers in main set `wantLock = true`, `showPause()` sets it false, `onLockChange(true)` with `!wantLock` calls `unlock()`; this also covers row 21, so 6d can merge into it.
- [Minor] Chromium may refuse the re-lock click right after an Esc exit, so the first click does nothing at all.
  Assumption: a click in free-cursor mode is always granted (row 7).
  Scenario: Esc (lock exit), Esc (resume, refused), then a click within about one second of the exit. Chromium is widely reported to refuse requests shortly after a user exit even with a gesture; the click is not passed to the game (`input.ts:25`), the hint stays, a second click works. Not verified in a real browser.
  Checked: `input.ts:25` gate, `main.ts:168` click handler, plan assumption 1 (simulated, not measured).
  Impact: PP sees "I still had to click twice" on the fast Esc-Esc-click path.
  Recommendation: measure in real Brave before shipping (see Investigate first); a held W retrying via auto-repeat (step 6e, no `e.repeat` filter there) would ride over the cooldown, so keep repeats allowed in 6e on purpose and say so in the comment.
- [Minor] In Firefox (and possibly Safari) Esc in the game may pause and resume in the same keystroke.
  Assumption: the Esc that exits the lock never reaches the page after `pointerlockchange` (assumption 1, "Likely" for non-Chromium).
  Scenario: if Firefox delivers that keydown after `pointerlockchange(false)` already ran `showPause()`, the listener sees `!locked && menu.visible && started` → `resume()`; if Firefox counts a trusted Esc as user input, the lock is granted and the pause menu never stays open.
  Checked: step 6c branch order; today's code has the same order but ended on the blocking overlay, so the effect was hidden; nothing in the plan tests a real Firefox.
  Impact: Firefox players cannot reach the pause menu with Esc.
  Recommendation: record `lastExit = performance.now()` in `onLockChange(false)` and ignore Esc in the resume branch for 200 ms after it; or verify in Firefox first.
- [Minor] Free-cursor look stops at the window edge, about 90 degrees each way from the centre on a 1440 px window (0.0022 rad/px at sensitivity 1, `player.ts:398`), and stops entirely when the cursor leaves the window.
  Assumption: PP reads "cursor visible, look limited" as "od razu wracam do gry".
  Checked: `player.ts:396-401`; plan row 6 states the edge stop but Open decisions do not show it to PP.
  Impact: PP turns, the view stops, he clicks, and calls it "still an extra click".
  Recommendation: add to Open decisions as "kiedy gracz po Esc obróci myszką do krawędzi ekranu, wtedy widok staje, aż kliknie; akceptujesz?".

Scenarios (explicit):
- State changes during the step (lock grant vs Esc/blur): breaks: yes, finding 2.
- Request made before a state change, granted after it: breaks: yes, same as finding 2 (row 21 guard covers overlays only).
- Step N fails after N-1: `resume()` un-pauses before `lock()`; a refusal leaves a running game with the hint, which is the target state. breaks: no.
- Same event twice: Esc auto-repeat breaks: yes, finding 1. Double click on canvas: second click while locked starts an action, as today. breaks: no. Double `onLockError` (promise catch + `pointerlockerror`, `input.ts:54,60`): `showMouseHint` is idempotent. breaks: no.
- Process dies mid-loop: page reload; no persisted state touched, autosave unchanged. breaks: no.
- Empty/edge state: title (not `started`) and deep screen keep their guards; leaderboard from pause stops propagation (`leaderboard.ts`); daily timer end while free (`daily.ts:55`) sets `paused`, `unlock()` is a no-op without a lock element. breaks: no.
- Swallowed error: `lock()` swallows both throw and rejection into `onLockError` (`input.ts:57-63`); the plan relies on exactly that. breaks: no.
- Old worker / new data: not applicable (static build, no saved shape change).

Pre-mortem: PP opens the 5300 build in Brave, presses Esc twice, the game runs with a cursor, he moves the mouse, the view turns and stops at the screen edge, he clicks, and within the post-exit window the click is refused, so nothing happens; he writes "nadal muszę klikać". The assumption that cracked first: "free cursor counts as back in the game" (finding 5), backed by the unmeasured browser table (assumption 1). The missed signal: every refusal path was simulated headless; no row was measured in a real Brave, Firefox or Safari.
Inversion worth considering: none beyond Open decision 1; dropping step 6e removes the only lock request during live play (and half of finding 2), but costs the held-W retry that rides over the Chromium cooldown.
Investigate first: (1) In real Brave: Esc, Esc, click within 1 s: granted or refused? (2) In Firefox: does the Esc that exits the lock reach the page as `keydown`, and in which order relative to `pointerlockchange`? (3) In Firefox and Safari: is `requestPointerLock()` from an Esc keydown in the pause menu granted (row 3) or refused (row 4)?

## Plan (plan-senior, final)

Status: needs-decision

### Resolutions
- R1: roaster [Major] held Esc (auto-repeat) flips pause/resume ~30x/s: Decision: accepted. First check of main's Esc listener is `e.repeat` → return. Rationale: `main.ts:157` has no repeat filter and `shop.ts:160` returns once the shop is closed, so repeat 2 lands in `showPause()`, exactly as the roaster traced; the fix is one condition. New matrix row 23. Checked: `main.ts:157-167`, `shop.ts:160-166`, `audio.ts:21` (the repo already filters `e.repeat` the same way).
- R2: performance [Low] "add `!e.repeat` to step 6e" vs roaster "keep repeats in 6e on purpose": Decision: keep repeats (roaster). Rationale: the performance cost is bounded (about 30 refused `requestPointerLock()` per second only while W is held AND the browser still refuses; each refusal is one rejected promise plus an idempotent `classList.remove`), while the benefit is the only no-click path across Chromium's short refusal window after a user Esc exit (inference from Chromium's mouse-lock controller behaviour, not measured here): a held W retries every ~33 ms and captures the mouse as soon as the window closes. With `!e.repeat` the player would have to release and press W again, or click. Rejected the performance fix for that scenario; the comment on step 6e says why repeats are allowed.
- R3: roaster [Minor] late grant un-pauses after Esc/blur (`wantLock` flag) vs v0 step 6d (`overlayOpen()` guard only): Decision: a `wanted` flag on `Input` plus the overlay and `.deep` guard; v0 step 6d is replaced, not kept beside it. Rationale: the roaster is right that 6d alone leaves the "W requests, Esc pauses, grant arrives" hole; the cheaper guard `menu.visible && started` fails because `menu.ts:54` shows the title screen after "Back" when `playTime <= 1` even though `started` is already true, and Play from there would be released by the guard (hard stuck). The flag has to live on `Input`, not in `main.ts` as the roaster wrote, because the shop, blueprints and legend call `ctx.input.lock()` themselves (`shop.ts:193`, `blueprints.ts:88`, `legend.ts:134`) and a main-only flag would reject those grants. The overlay guard stays because an overlay opened while a request is pending does not clear the flag. Checked: `main.ts:108-114,136-137,150`, `menu.ts:54`, `shop.ts:193`, `input.ts:57-64`. New matrix row 25.
- R4: roaster [Minor] Firefox may deliver the exiting Esc keydown after `pointerlockchange(false)` → resume in the same keystroke: Decision: accepted, 200 ms guard. `onLockChange(false)` records `lastExit = performance.now()`; the resume branch requires `performance.now() - lastExit > 200`. Rationale: nobody here can drive a real Firefox, the cost is one variable and one condition, and the failure mode (Firefox players never reach the pause menu) is worse than the side effect (a second Esc within 200 ms of the first is ignored). Headless note: the harness runs at ~5 fps (200 ms per frame), so scenario steps that press Esc in the pause menu wait 2 frames after the exit. New matrix row 26.
- R5: roaster "Investigate first" (measure Brave/Firefox/Safari before shipping): Decision: no pre-ship measurement. Rationale: no agent in this chain has a real browser; PP asked to push as soon as it is ready; rows 3 and 4 both end in a running game, so the unknown only picks the path, and R2 (W-repeat) covers the Chromium post-exit window the roaster's pre-mortem is built on. The ai-work note (step 9) lists the three questions as "simulated, not measured" and PP's playtest on 5300 is the measurement. Rejected because the plan does not depend on the answer.
- R6: roaster [Minor] free-cursor look stops at the window edge, PP may read it as "still an extra click": Decision: no code change (no browser lets the page look past the edge without the lock); the consequence goes to PP inside decision 1, together with its mitigation (W or a click captures). Rejected as a code item because the only alternative is the blocking overlay PP asked to remove.
- R7: impact [Medium] wheel opens with a free cursor, textual conflict with `2026-10-20-plan-robots-wheel-blower.md:67` B6 ("unlocked → no wheel"): Decision: accepted as intended behaviour; B6 "unlocked" becomes "paused" (its purpose "no wheel outside play" survives because free cursor is play). Steps 2 and 3 already do it; step 3 rewrites the comments at `wheel.ts:31` and `wheel.ts:46`; new matrix row 22 with a scenario check; listed for PP as `[spec silent]` 6. Checked: `wheel.ts:33,46,58-59` (the wheel reads `mouse.dx/dy`, which step 1 now accumulates while free).
- R8: impact [Medium] the hint floats over the shop/blueprints/legend (z 25 over z 20): Decision: accepted via one CSS rule in step 7: `body:has(.shop:not(.hidden)) .click-to-play { display: none; }`. Rationale: all four overlays carry the class `shop` (`shop.ts`, `blueprints.ts:43`, `legend.ts:101`, `leaderboard.ts:104`) and hide with `.hidden` (`style.css:222`), and `:has` is already used in this stylesheet (`style.css:193`), so one rule beats four `classList.add` calls in four `open()` methods (rung 3 over rung 6). New matrix row 24. Checked: `style.css:193,222,224,278`.
- R9: impact [Low] `clickToPlay` click listener becomes dead after `pointer-events: none`: Decision: accepted, step 6a deletes `main.ts:123`. Checked: `main.ts:123,168-170`.
- R10: impact [Low] `SPEC.md:70` "pointer lock po kliknięciu", comments `main.ts:152,156`, extra `ctx.paused` readers (`hud.ts:421,630,632`, `shot.ts:52,73,76`): Decision: accepted; SPEC line 70 added to step 9, the two comments rewritten in steps 6c/6g, the readers added to Reach as benign (no code).
- R11: author Open decision 6 (copy the harness into `tools/smoke/`): Decision: yes, settled here, not for PP. Rationale: CLAUDE.md "Tests" allows it "if they become permanent" and this is the third rebuild of the same harness; a process question, not a player-visible one. Step 8 writes `tools/smoke/smoke.mjs` and `tools/smoke/scenario-esc.js`.
- R12: author Open decisions 3, 4, 5 (`[spec silent]`, all "no code" or already in a step): stay in "Decisions for PP" in their format per the 2026-10-19 rule (the question is "does PP want this", not "how does it work"), compressed to one line each.
- Rejected: roaster "6d can merge into `wantLock`" because the main-only flag would reject the shop's own grant (`shop.ts:193`); the flag lives on `Input` instead (R3).
- Rejected: performance "`!e.repeat` on walk keys" because it removes the only no-click retry across the Chromium post-exit window (R2).

### Chosen variant
(a) "Free cursor counts as playing": the lock becomes optional, every play gate switches from `inp.locked` to `!ctx.paused`, mouse deltas accumulate without the lock, the blocking "Click to play" overlay becomes a non-blocking pill, and the Esc listener gets `e.repeat`, a 200 ms post-exit guard and a `wanted` flag against late grants. Pros: no new game state beyond one boolean on `Input`; every overlay close path inherits the fix through the `onLockError` it already calls; the re-lock click cannot fire an action (`input.ts:25` stays). Cons: look stops at the window edge until W or a click captures; the browser table is simulated, not measured. Cost: zero per frame (performance table: boolean swaps, two adds per `mousemove`, cleared once per frame); W-repeat worst case ~30 refused requests/s only while held and refused. Risk: held Esc (R1, closed), late grant (R3, closed), Firefox Esc order (R4, guarded), Chromium post-exit click refusal (R2 mitigates; PP's playtest measures). Ladder: rung 2 (`ctx.paused`, `movementX`, existing overlay element and CSS `:has`) for steps 1-5, 7; rung 5 (one condition each) for 6c-6f; rung 6 only for `resume()` and the `wanted` flag.
### Rejected variant(s)
- (b) Keep the blocking "Click to play" overlay (today): pros: lock always present while playing; cons: it is exactly the extra click PP rejected ("nie musze nic dodatkowo klikac"). Rejected because it does not handle the brief.
- (c) `wantLock` flag in `main.ts` only (roaster's shape): pros: no change in `input.ts`; cons: the shop, blueprints and legend request the lock themselves and their grants would be released. Rejected because it breaks rows 11-15.
- (d) v0 step 6d alone (`overlayOpen()` guard, no flag): pros: one line; cons: "W requests, Esc pauses, grant arrives" un-pauses the game (row 25); the `menu.visible && started` patch sticks on the title after "Back" within the first second (`menu.ts:54`). Rejected because it does not handle row 25.
- (e) `!e.repeat` on walk keys (performance): rejected in R2.

### Behaviour matrix (final)
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| 1 | in game, locked; Esc keydown reaches the page (headless only) | `unlock()` | pause menu, `paused=true` (unchanged) | v0 |
| 2 | in game, locked; browser eats Esc and exits the lock (also during a replay) | `pointerlockchange` → `showPause()`, `lastExit` recorded | pause menu (unchanged) | v0 + R4 |
| 3 | pause menu; Esc (>200 ms after the exit); browser grants the lock | `resume()` + grant (`wanted=true`) | game runs, locked, menu hidden, no hint, HUD not dimmed | v0 |
| 4 | pause menu; Esc; browser refuses the lock | `resume()` + `onLockError` | game runs AT ONCE (`paused=false`), menu hidden, HUD not dimmed, visible cursor, hint "Click or press W to capture the mouse" | v0 |
| 5 | free cursor; hold W | player moves | position changes without the lock | v0 |
| 6 | free cursor; mouse moves | yaw/pitch change | camera turns without the lock; stops at the window edge | v0 + R6 |
| 7 | free cursor; LMB click on the canvas | `lock()` from the click | locked, hint hidden; that click fires NO game action | v0 |
| 8 | free cursor; Esc | `showPause()` (`wanted=false`) | pause menu, `paused=true` | v0 |
| 9 | free cursor; W/A/S/D/Space/Shift keydown, repeats included `spec silent` | `lock()` from the keydown | locked when granted; walking continues either way; refused repeats only re-show the hint | v0 + R2, PP decision 1 |
| 10 | free cursor; window `blur` `spec silent` | `showPause()` | pause menu | v0, PP decision 2 |
| 11 | shop open; Esc | `shop.close()` → `lock()` | shop closed, game runs (locked, or free cursor + hint); pause menu never shown | v0 |
| 12 | shop open; B / E / Tab `spec silent` | same handler as row 11 | same as row 11 | v0 |
| 13 | shop open; click the close button | `shop.close()` → `lock()` from a click | locked directly | v0 |
| 14 | blueprints (K) open; Esc or K `spec silent` | `blueprints.close()` → `lock()` | closed, game runs, free cursor + hint on refusal | v0 |
| 15 | legend (L) open; Esc or L `spec silent` | `legend.close()` → `lock()` | closed, game runs, free cursor + hint on refusal | v0 |
| 16 | leaderboard from the pause menu; Esc `spec silent` | `leaderboard.close()` (capture) | leaderboard closed, pause menu stays, paused | v0 |
| 17 | pause menu sub-page (Achievements, What's new); Esc | as row 3/4 | resume, no "back" step | v0, note 2026-10-19 |
| 18 | title screen; Esc | nothing | title stays | v0 |
| 19 | deep / rebirth screen; Esc | nothing | screen stays | v0 |
| 20 | pause menu visible; mouse moves over the menu | deltas accumulate, cleared each frame | camera does NOT turn | v0 |
| 21 | lock granted while an overlay is open `spec silent` | `onLockChange(true)` sees `overlayOpen()` → `unlock()` | overlay stays, game stays paused | v0 (6d) + R3 |
| 22 | free cursor; hold Tab `spec silent` | `wheel.update` (gate `!ctx.paused`) | tool wheel opens, game slows to 0.25, mouse picks a slice; B6 "unlocked" reads "paused" | impact R7, PP decision 6 |
| 23 | shop open or in game; Esc held past the OS repeat delay | first keydown handled, every `e.repeat` ignored | shop closed, game runs, pause menu never flickers; in game: one pause, no toggling | roast R1 |
| 24 | free cursor with hint; B (or E/K/L) opens an overlay; Esc closes it, refused | CSS `body:has(.shop:not(.hidden))` hides the pill | hint hidden while the overlay is open; back after the refused close | impact R8 |
| 25 | free cursor; W requests the lock; Esc or blur before the grant; grant arrives `spec silent` | `showPause()` sets `wanted=false`; `onLockChange(true)` sees `!wanted` → `unlock()` | pause menu stays, `paused=true`, `locked=false` | roast R3 |
| 26 | lock just exited (Firefox-like: Esc keydown arrives within 200 ms after `pointerlockchange(false)`) | resume branch skipped (`lastExit`) | pause menu stays, `paused=true` | roast R4 |

### Steps (edit order)
1. `src/core/input.ts` — add field `wanted = false;` (comment: "set by lock(), cleared by main's showPause(); a grant that arrives after the player paused again is released"); `lock()` first line `this.wanted = true;`; `mousemove` (40-44): delete `if (!this.locked) return;`, keep the two adds (comment: "movementX works without the lock; the player gates on `ctx.paused`"); `wheel` (45-47): `this.mouse.wheel += Math.sign(e.deltaY);` without the `locked` test. `mousedown` guard at 25 unchanged (row 7). Red test: `tools/smoke/scenario-esc.js` "05c_look_free" → yaw changes with a free cursor; "08_click_free" → `held=undefined`, `leftPressed=false`.
2. `src/player/player.ts` — 396: `if (!ctx.paused && !(this.placing && inp.mouse.right) && !this.wheel.open)`; 407: `const active = !ctx.paused;`; 435: `if (ctx.paused) wish.set(0, 0, 0);`; 438: `if (inp.hit('Space') && !ctx.paused)`. Line 190 unchanged. Red test: "05b_walk_free" → `moved>0.5`; "05c_look_free" → `yawDeltaPaused=0`.
3. `src/player/wheel.ts` — 33: `if (this.open && ctx.paused) this.close();`; comment 31: "Also closes the wheel (no selection) when the game pauses."; comment 46: "While playing (not paused; the mouse may be free): Tab opens, the mouse picks, releasing Tab takes the slice." Red test: "21_wheel_free" → `wheel=true timeScale<1`.
4. `src/player/pound.ts:60` — `if (ctrl && !grounded && !onTractor && this.cd <= 0 && !ctx.paused)`. Covered by the gate swap; no separate check (same `!ctx.paused` as row 5).
5. `src/entities/factory.ts:162` — `const holding = this.near && !ctx.paused && ctx.input.down('KeyE') && !ctx.player.lookAt.switch;`. Covered by the gate swap.
6. `src/main.ts`:
   a. Rename `clickToPlay` → `mouseHint`, `className = 'click-to-play hidden'` kept, text `'Click or press W to capture the mouse'`; DELETE line 123 (`clickToPlay.addEventListener('click', ...)`); `showClickToPlay` → `const showMouseHint = () => mouseHint.classList.remove('hidden');` (no `paused`, no `dim`). Comment at 118: "the browser refuses pointer lock without a click after an Esc exit: the game runs with a free cursor and this hint until a click or a walk key captures it".
   b. `const resume = () => { menu.hide(); mouseHint.classList.add('hidden'); ctx.paused = false; ctx.hud.root.classList.remove('dim'); ctx.input.lock(); };`
   c. `let lastExit = 0;` next to `started`. Esc listener (157-167) becomes: `if (e.code !== 'Escape' || e.repeat || e.defaultPrevented || overlayOpen() || document.querySelector('.deep')) return; if (ctx.input.locked) ctx.input.unlock(); else if (menu.visible && started && performance.now() - lastExit > 200) resume(); else if (!ctx.paused) showPause();`. Comment replaces 156: "Esc: locked → unlock (pause via onLockChange); pause menu → resume at once; free cursor → pause. Repeats ignored (held Esc must not toggle). The 200 ms guard skips the exiting Esc when a browser delivers it after pointerlockchange. Overlays handle their own Esc (preventDefault)."
   d. `onLockChange`: `if (locked) { if (overlayOpen() || !ctx.input.wanted || document.querySelector('.deep')) return ctx.input.unlock(); ...rest unchanged... } else { lastExit = performance.now(); if (!overlayOpen() && !document.querySelector('.deep')) showPause(); }`. Comment: "a grant that lands after an overlay opened or after the player paused again is released, the game stays paused".
   e. `showPause()`: add `ctx.input.wanted = false;` as the first line (before `ctx.paused = true`).
   f. Walk keys (PP decision 1, assumed a): `const WALK_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight']);` and in the same keydown listener, before the Escape check: `if (!ctx.paused && !ctx.input.locked && !menu.visible && !overlayOpen() && WALK_KEYS.has(e.code)) ctx.input.lock(); // repeats on purpose: a held W retries across the browser's short refusal window after an Esc exit`. Drop on "b".
   g. Blur (PP decision 2, assumed a): `window.addEventListener('blur', () => { if (started && !ctx.paused && !ctx.input.locked) showPause(); });` (comment: "while locked the browser drops the lock itself and onLockChange pauses"). Drop on "b".
   h. `onLockError` (153-155): condition unchanged, body `showMouseHint()`; comment replaces 152: "a refused lock outside the menus (Esc in the pause menu, closing an overlay) keeps the game running with a free cursor and shows the hint, never the pause menu".
   Red tests: "03_esc_pause_granted", "05_esc_pause_refused", "06_esc_free", "06b_walk_key_locks", "06c_blur_free", "22_esc_held", "24_late_grant", "25_esc_after_exit_200ms", "20_overlay_race".
7. `src/ui/style.css:278` — `.click-to-play { position: fixed; left: 50%; bottom: 110px; transform: translateX(-50%); padding: 8px 16px; border-radius: 10px; background: var(--panel); border: 2px solid var(--accent); color: var(--accent); font: 700 20px var(--font); pointer-events: none; z-index: 25; }` and a new line `body:has(.shop:not(.hidden)) .click-to-play { display: none; }` (comment: "the pill never sits on an open shop, blueprints, legend or leaderboard: they all carry .shop"). Red test: "23_hint_under_shop" → `hintHiddenWhileShop=true hintAfterEsc=visible`.
8. `tools/smoke/smoke.mjs` (FULL=1 full Chromium `--headless=new`, `__cdp` queue, DPR=1, focus emulation, as in the 2026-10-19 note) and `tools/smoke/scenario-esc.js` with every check below; refusal simulated as on 2026-10-19 (`requestPointerLock` rejects once and fires `pointerlockerror`); repeats via CDP `Input.dispatchKeyEvent` with `autoRepeat: true`; row 26 by dispatching Esc in the same tick as `document.exitPointerLock()`'s `pointerlockchange`; every pause-menu Esc otherwise waits 2 frames after the exit.
9. Docs: `docs/SPEC.md:70` ("mysz patrzy; po Esc kursor bywa wolny, wtedy mysz nadal obraca widok do krawędzi okna, a klik albo W przechwytuje kursor"), `:82` (Esc pauza / wraca do gry / zamyka sklep), `:211` (replace the "Click to play" sentence: Esc wraca do gry od razu; gdy przeglądarka odmówi przechwycenia kursora, gra biegnie z widocznym kursorem, a klik lub W go przechwytuje; koło narzędzi działa też z wolnym kursorem); `CHANGELOG.md` new section line; `docs/ai-work/2026-10-20-esc-resume.md` (Problem / Summary / Work progress, browser table marked "simulated, not measured" with the roaster's three questions, B6 "unlocked → paused" note, Done-when PASS lines); `BOARD.md` status line.

### Review focus
1. Chromium refuses the re-lock click within its post-exit window (roast finding 3; headless cannot produce it) → pinned by step 6f's test "06b_walk_key_locks" run with refusal armed for 3 auto-repeat keydowns and disarmed on the 4th → `locked=true hint=hidden`, proving the held-W retry path works when the first requests fail.
2. A refused grant must never call `showPause()` through `onLockChange(false)` twice in a row for one keystroke (double `onLockError`: promise catch + event, `input.ts:54,60`) → pinned by step 6h's test "05_esc_pause_refused" asserting `menu=hidden` on the frame after the refusal.
3. Lock released by the `wanted` guard must not itself open the pause menu while the title screen is up (title Play never has `wanted=false`) → pinned by step 6d's test "01_title_esc" plus a "00_title_play" check: click START → `locked=true paused=false`.
4. The placement ghost's wheel distance (`player.ts:918`) now reacts to the mouse wheel with a free cursor; the Achievements page scroll must not move it while paused → pinned by step 1's test "05c_look_free" extended with a `wheel` event while the menu is visible → placement distance unchanged.
5. Daily timer keeps running with a free cursor while the player is away (impact: `daily.ts:55`) → PP decision 2; pinned by step 6g's test "06c_blur_free".

### Done when
1. `scenario-esc.js` → `02_esc_keydown_locked paused=true menu=PAUSED`
2. `scenario-esc.js` → `04_browser_exit paused=true menu=PAUSED`
3. `scenario-esc.js` → `03_esc_pause_granted paused=false locked=true menu=hidden hint=hidden dim=false`
4. `scenario-esc.js` → `05_esc_pause_refused paused=false locked=false menu=hidden hint=visible dim=false`
5. `scenario-esc.js` → `05b_walk_free moved>0.5`
6. `scenario-esc.js` → `05c_look_free yawDelta<0 yawDeltaPaused=0`
7. `scenario-esc.js` → `08_click_free locked=true hint=hidden held=undefined leftPressed=false`
8. `scenario-esc.js` → `06_esc_free paused=true menu=PAUSED`
9. `scenario-esc.js` → `06b_walk_key_locks locked=true` (`spec silent`)
10. `scenario-esc.js` → `06c_blur_free paused=true menu=PAUSED` (`spec silent`)
11. `scenario-esc.js` → `10_shop_esc shop=false paused=false menu=hidden` (refused: `hint=visible`; granted: `locked=true`)
12. `scenario-esc.js` → `10b_shop_b shop=false paused=false reopened=false` (`spec silent`)
13. `scenario-esc.js` → `10c_shop_close_btn locked=true`
14. `scenario-esc.js` → `15_blueprints_esc open=false paused=false hint=visible` (`spec silent`)
15. `scenario-esc.js` → `16_legend_esc open=false paused=false hint=visible` (`spec silent`)
16. `scenario-esc.js` → `17_leaderboard_esc lb=false menu=visible paused=true` (`spec silent`)
17. `scenario-esc.js` → `18_ach_esc paused=false`
18. `scenario-esc.js` → `01_title_esc menu=title paused=true`
19. `scenario-esc.js` → `19_deep_esc deep=true paused=true`
20. `scenario-esc.js` → `05c_look_free yawDeltaPaused=0` (same check as line 6, separate assertion)
21. `scenario-esc.js` → `20_overlay_race shop=true paused=true locked=false` (`spec silent`)
22. `scenario-esc.js` → `21_wheel_free wheel=true timeScale<1` (`spec silent`, row 22)
23. `scenario-esc.js` → `22_esc_held shop=false menu=hidden paused=false` (row 23; 6 Esc keydowns, 5 with `autoRepeat:true`, after the shop is open)
24. `scenario-esc.js` → `23_hint_under_shop hintHiddenWhileShop=true hintAfterEsc=visible` (row 24)
25. `scenario-esc.js` → `24_late_grant menu=visible paused=true locked=false` (`spec silent`, row 25: arm "grant late", W keydown, Esc, then deliver the grant)
26. `scenario-esc.js` → `25_esc_after_exit_200ms menu=PAUSED paused=true` (row 26)
Plus, unchanged from v0: `npx tsc --noEmit` → no output, exit 0; `CDP_PORT=9373 MAXPOLL=2400 node tools/smoke/smoke.mjs <out> scenario15.js` → values as in the 2026-10-19 note, LOGS empty; one screenshot of the free-cursor pill checked by eye; LOGS empty in the esc run. Local only (dev server 5199), never 5300 before the push.

### Decisions for PP
PP (2026-10-20): "1.a 2. a." → 1a (walk keys and click capture the cursor, step 6f), 2a (free-cursor game pauses on blur, step 6g); items 3-6 accepted as recommended (PP did not object). Orchestrator addition, as told to PP: while the game runs with a free cursor, the cursor is hidden over the canvas (`cursor: none`), shown again whenever any overlay or menu is open.
1. [spec silent, wiersz 9 + R6] Zakładam: po Esc, gdy przeglądarka nie odda kursora, gra biegnie od razu, a kursor jest widoczny; mysz obraca widok, ale widok staje, gdy kursor dojdzie do krawędzi okna; naciśnięcie W/A/S/D/Space/Shift (także trzymane) albo klik przechwytuje kursor i obracanie wraca w pełni | Dowód: żadna przeglądarka nie odda kursora po samym Esc (`main.ts:118` komentarz, nota 2026-10-19); `input.ts:13` widzi każdy keydown | Jeśli źle: gracz chodzi z widocznym kursorem, aż kliknie; nic więcej | rekomendacja: a) W/A/S/D/Space/Shift też przechwytuje (krok 6f); b) tylko klik, wtedy po Esc trzeba kliknąć, żeby obracać się dalej niż do krawędzi.
2. [spec silent, wiersz 10] Zakładam: kiedy kursor jest wolny i okno traci fokus (alt-tab, klik poza grę), wtedy gra się pauzuje, tak jak dziś, gdy przeglądarka zabiera lock | Dowód: `main.ts:143` pauzuje przy utracie locka; nic nie pauzuje gry bez locka | Jeśli źle: gra i licznik daily biegną, gdy gracza nie ma | rekomendacja: a) pauza przy blur (krok 6g); b) gra biegnie dalej.
3. [spec silent, wiersze 12, 14, 15] Zakładam: B/E/Tab w sklepie, K w schematach, L w legendzie działają jak Esc tam (zamyka, gra biegnie, wolny kursor przy odmowie) | Dowód: jeden handler na overlay (`shop.ts:162`, `blueprints.ts:56`, `legend.ts:112`) | Jeśli źle: nic do zmiany w kodzie | rekomendacja: a) tak samo jak Esc.
4. [spec silent, wiersz 16] Zakładam: Esc w rankingu otwartym z menu pauzy wraca do menu pauzy, nie do gry | Dowód: `leaderboard.ts:146-152` zatrzymuje zdarzenie; `close()` (`:194`) nie odpauzowuje | Jeśli źle: gracz naciska Esc drugi raz | rekomendacja: a) zostaje.
5. [spec silent, wiersze 21, 25] Zakładam: kiedy lock przyjdzie po tym, jak gracz już otworzył sklep albo znowu zapauzował, wtedy gra go oddaje i zostaje zapauzowana (nie biegnie za otwartym sklepem ani za menu) | Dowód: `main.ts:130-136` dziś odpauzowuje przy każdym grancie | Jeśli źle: gra biegnie za sklepem | rekomendacja: a) oddać lock (krok 6d).
6. [spec silent, wiersz 22] Zakładam: koło narzędzi (Tab) działa też z wolnym kursorem po Esc, bo wolny kursor to gra; wcześniejszy zapis B6 „Tab bez locka → brak koła" (plan robots-wheel-blower z 2026-10-20) zmienia się na „Tab w pauzie → brak koła" | Dowód: `wheel.ts:33` zamyka koło, gdy brak locka; krok 2 i 3 zmieniają bramkę na `!ctx.paused` | Jeśli źle: po Esc Tab nie otwiera koła, aż gracz kliknie | rekomendacja: a) koło działa z wolnym kursorem.
7. [decision age] none: every decision this plan relies on is from 2026-10-19 or 2026-10-20.

### v0 → final
- added: step 1 `wanted` flag on `Input` (R3), `e.repeat` filter and 200 ms post-exit guard in the Esc listener (R1, R4), CSS `:has` rule hiding the pill under overlays (R8), wheel comments and B6 rename (R7), matrix rows 22-26 with Done-when lines 22-26, harness committed to `tools/smoke/` (R11), SPEC line 70 and two comments (R10).
- dropped: v0 step 6d `overlayOpen()`-only guard (replaced by the flag + guard in 6d), the dead `clickToPlay` click listener (R9), performance's `!e.repeat` on walk keys (R2), the roaster's real-browser pre-measurement (R5).
- moved to PP: nothing new as a yes/no beyond v0's decisions 1 and 2; decision 1 now carries the edge-stop consequence (R6); decision 6 (wheel with a free cursor) added as `[spec silent]`; v0 decision 6 (harness location) settled here.
