# Esc resumes the game at once (pause menu, shop)

Interpretation: PP (terminal, 2026-10-20): "Bedac w menu pauzy klikam esc i wracam do gry, nie musze nic dodatkowo klikac [...] tak samo w sklepie jeden esc wychodze ze sklepu i moge spowrotem chodzic." Implemented `## Plan (plan-senior, final)` of `2026-10-20-plan-esc-resume.md` with PP's decisions 1a (walk keys and a click capture the mouse) and 2a (blur pauses a free-cursor game), items 3-6 as recommended, plus the orchestrator's addition: the cursor is hidden over the canvas while the game runs, shown whenever a menu or overlay is open.

## Problem

Browsers exit pointer lock on Esc and refuse to take it again until the next real click or key (Esc does not count as a user gesture). The game treated "no lock" as "not playing": after Esc in the pause menu or in the shop the player got a full-screen "Click to play" and had to click.

## Summary

Ladder: rung 2 (reuse `ctx.paused` as the only "playing" gate, the existing hint element, CSS `:has`) and rung 3 (`movementX` works without the lock); rung 6 only for `resume()` and the `wanted` flag.

What the player gets:
- Esc in the pause menu (also on Achievements / What's new) resumes at once. Esc in the shop, blueprints or legend closes them and the game runs.
- When the browser refuses the lock, the game runs anyway with a free cursor, hidden over the game. A small pill "Click or press W to capture the mouse" sits at the bottom. The mouse turns the view up to the window edge. A click captures the mouse and does nothing else; W/A/S/D/Space/Shift (held W too) capture it as well.
- Free cursor: Esc opens the pause menu; switching window pauses; the Tab tool wheel works.
- Held Esc does not toggle pause (repeats ignored). A lock that arrives after the player opened an overlay or paused again is released, the game stays paused. An Esc arriving within 200 ms after the lock exit (Firefox order) is ignored, so the pause menu is reached.
- Esc in the leaderboard opened from the pause menu goes back to the pause menu (unchanged).

Code: `src/core/input.ts` (`wanted`, deltas and wheel without the lock), `src/player/player.ts`, `wheel.ts`, `pound.ts`, `src/entities/factory.ts` (gates on `!ctx.paused`), `src/main.ts` (hint, `resume`, Esc/walk-key/blur listeners, grant guard, cursor), `src/ui/style.css` (pill, hidden under `.shop` overlays). Harness committed: `tools/smoke/smoke.mjs` (focus emulation built in for `FULL=1`) and `tools/smoke/scenario-esc.js`.

Plan robots-wheel-blower B6 ("Tab without lock → no wheel") now reads "Tab while paused → no wheel" (PP decision 6).

Browser table: simulated, not measured. Headless cannot produce the real refusal; the scenario simulates it (reject + `pointerlockerror`). Open questions for PP's playtest on 5300: (1) does Chrome/Brave grant the lock to a W keydown right after an Esc exit, or only after its short refusal window? (2) does Firefox grant the lock from the Esc keydown in the pause menu (then it resumes locked)? (3) does Safari refuse requests shortly after the exit (then the pill shows until a click or W)? Every answer ends in a running game; the answer only picks locked vs free cursor.

Rejected:
- Plan text `held=undefined`: the field is `null` when nothing is held; the scenario prints `held=none` (same meaning).
- CLAUDE.md "Tests" still points to the scratchpad harness: not in this brief; `tools/smoke/` is mentioned here and in BOARD.md.

## Work progress

Commands (dev server `npx vite --port 5199 --host 127.0.0.1`, never 5300):
- `FULL=1 DPR=1 CDP_PORT=9372 MAXPOLL=1600 node tools/smoke/smoke.mjs <scratchpad>/esc2 tools/smoke/scenario-esc.js` → 27 result lines below, `LOGS:` empty. Rerun after the `nowrap` CSS line (`esc3`): every line identical except `05b moved=7.54`; `LOGS:` empty.
- `npx tsc --noEmit` → no output, exit 0.
- `CDP_PORT=9373 MAXPOLL=2400 node tools/smoke/smoke.mjs <scratchpad>/reg15s zz-scenario15-scope.js` → fan ratio 1.01, massive y 1.18 arc true, arc green at 0.15 eaten 1, crate inside 10 y 1.18, rain only specials, hoop bullseye true, parade 16/16; `LOGS:` empty. Same values as the latest baseline (`2026-10-20-hud-right-stack.md`). Plain `scenario15.js` reports `arc:false` / `greenAtPitch:null`, the known cause: the arc only shows with the Trick Scope (`2026-10-20-flee-boom-combo.md`); scenario15 forces `input.locked = true` and `paused = false`, so the gate change does not touch it.
- `grep -rn "Math.min(1, dt" src` → 0 lines.

First run: 17, 18, 21, 24 failed because of the scenario (a simulated refusal left over from step 18 and the leaderboard button below the 360 px viewport). Fixed in the scenario (each step resets the simulation; buttons scrolled into view); no game code changed between runs.

Done when:
- [PASS] 1 — `02_esc_keydown_locked paused=true menu=PAUSED`
- [PASS] 2 — `04_browser_exit paused=true menu=PAUSED`
- [PASS] 3 — `03_esc_pause_granted paused=false locked=true menu=hidden hint=hidden dim=false`
- [PASS] 4 — `05_esc_pause_refused paused=false locked=false menu=hidden hint=visible dim=false menuNextFrame=hidden cursor=none`
- [PASS] 5 — `05b_walk_free moved=7.75 locked=false paused=false`
- [PASS] 6 — `05c_look_free yawDelta=-0.440 yawDeltaPaused=0 menuWhilePaused=PAUSED ghostDistPaused=7->7`
- [PASS] 7 — `08_click_free locked=true hint=hidden held=none leftPressed=false (before: paused=false locked=false hint=visible)`
- [PASS] 8 — `06_esc_free paused=true menu=PAUSED`
- [PASS] 9 — `06b_walk_key_locks locked=true hint=hidden refusalsLeft=0` (3 refused W keydowns incl. 3 auto-repeats, the 4th granted)
- [PASS] 10 — `06c_blur_free paused=true menu=PAUSED`
- [PASS] 11 — `10_shop_esc shop=false paused=false menu=hidden hint=visible | granted: opened=true shop=false paused=false menu=hidden locked=true`
- [PASS] 12 — `10b_shop_b shop=false paused=false reopened=false opened=true hint=visible`
- [PASS] 13 — `10c_shop_close_btn locked=true shop=false paused=false`
- [PASS] 14 — `15_blueprints_esc open=false paused=false hint=visible opened=true`
- [PASS] 15 — `16_legend_esc open=false paused=false hint=visible opened=true`
- [PASS] 16 — `17_leaderboard_esc lb=false menu=visible paused=true opened=true`
- [PASS] 17 — `18_ach_esc paused=false page=ACHIEVEMENTS menu=hidden`
- [PASS] 18 — `01_title_esc menu=title paused=true`
- [PASS] 19 — `19_deep_esc deep=true paused=true`
- [PASS] 20 — `05c_look_free ... yawDeltaPaused=0` (separate assertion, same run)
- [PASS] 21 — `20_overlay_race shop=true paused=true locked=false` (event log: grant arrived and was released at once)
- [PASS] 22 — `21_wheel_free wheel=true timeScale=0.25 (before: paused=false locked=false)`
- [PASS] 23 — `22_esc_held shop=false menu=hidden paused=false opened=true locked=true` (1 Esc + 5 auto-repeats)
- [PASS] 24 — `23_hint_under_shop hintHiddenWhileShop=true hintAfterEsc=visible hintBefore=visible`
- [PASS] 25 — `24_late_grant menu=visible paused=true locked=false (before: paused=false locked=false)`
- [PASS] 26 — `25_esc_after_exit_200ms menu=PAUSED paused=true wasLocked=true`
- [PASS] extra — `npx tsc --noEmit` exit 0; regression values above; LOGS empty in both runs; extra `00_title_play locked=true paused=false` (review focus 3).
- [PASS] screenshot — `esc-05-free-cursor-pill.png` checked by eye: pill at the bottom centre over the game, HUD not dimmed, no menu. First version wrapped onto two lines at 640 px; `white-space: nowrap` added.

Review round 1 (plan `2026-10-20-fix-plan-esc-resume-r1.md`, package P1):
- F1 RESUME in the pause menu now calls `resume()` (like Esc); the title Play still calls plain `lock()`. `26_resume_btn_refused`: red `paused=true menu=PAUSED hint=hidden dim=true`, after fix `paused=false menu=hidden hint=visible dim=false | granted: locked=true menu=hidden hint=hidden` [PASS].
- F2 pill moved under the hole bar (`top: 89px`, hole bottom measured at 81 px at both sizes); narrow window: centred on the hole bar, max 240 px, two lines, 16 px (own media rule after the base rule, the shared narrow block comes earlier in the file and would lose the cascade). `27_pill_clear`: red 640 `gear=4507 hint=1054 left=4184`, 1280 `gear=4809 hint=1513`; after fix 1280 all 0 [PASS], 640 `hint=7603`, rest 0 [FAIL]: at 360 px height the first-use hint (bottom 150 px, ~97 px tall) reaches up to about y 113, into the pill (89-149). Decision (orchestrator): accept the overlap at 360 px height only, like the banner overlap and the 640 px rule in SPEC: both are short-lived (the pill goes at the first walk key or click, the hint after a few seconds) and there is no free row at that height; hiding the hint instead would make the player miss it. Done-when 27 now expects 0 at 1280x720 and 0 for gear/hole/left/money/hotbar at 640x360. [PASS] on that expectation.
- F3 `Input` drops the first `mousemove` after the pointer left the page (`mouseout` with no `relatedTarget`, `mouseenter` on the document). `28_reenter_delta`: red `jump=-1.390`, after fix `jump=0.000 after=0.044` [PASS].
- F4 the canvas capture listens to `mousedown` (any button) instead of `click`. `29_right_btn_free`: red `locked=false hint=visible`, after fix `locked=true hint=hidden held=none rightPressed=false` [PASS]; `08_click_free` unchanged `leftPressed=false` [PASS].

Self-check:
- Only the plan's steps plus the orchestrator's hidden cursor (one line in the frame loop: `cursor: none` whenever the game is not paused; menus and overlays pause, so the cursor shows there).
- Nothing duplicated: gates reuse `ctx.paused`; the hint reuses the old overlay element and class.
- Tests drive trusted CDP input through the real page and read game state; refusal and late grant are simulated at `requestPointerLock`.
- `docs/ai-work/2026-10-20-plan-supabase-leaderboard.md` was already modified before this task; not touched.
