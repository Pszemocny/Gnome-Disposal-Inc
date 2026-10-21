# Esc in the shop lands in the game in real Chrome; mouse pill removed

Interpretation: PP (terminal, 2026-10-24): "wywal ten napis press w to capture the mouse. W sklepie jak klikam esc to mam wracac do gry a nie wlaczac pauze". He plays the GitHub Pages build in real Chrome/Brave, where headless tests pass. Two changes: (1) the "Click or press W to capture the mouse" pill goes; the free-cursor state stays (the game runs, a click or a walk key captures the mouse). (2) One Esc in the shop, blueprints or legend always lands in the running game, never in the pause menu, in the event order of a real browser.

Gotowe, gdy:
1. `FAKELOCK=1 ... scenario-esc.js`, new step `32_overlay_esc_chrome` (`__fakeLock.escExits = true`: a trusted Esc while locked never reaches the page and drops the lock, like Chrome) → for shop by B, shop opened from the game frame (the E-at-desk path), blueprints, legend: tap Esc and held Esc (1 + 5 repeats) each give `open=false paused=false menu=hidden`.
2. Same step, a later Esc in the running locked game (Chrome order) still pauses → `laterEsc menu=PAUSED paused=true`.
3. `grep -rn "click-to-play\|capture the mouse" src tools/smoke docs/SPEC.md` → no lines.
4. `FAKELOCK=1 ... scenario-esc.js` and `scenario-intro-pressf.js` → every other line as before (no `hint=` fields), `LOGS:` empty; intro all PASS, 0 FAIL.

## Problem

Chrome and Brave exit pointer lock on an Esc keydown themselves and do not pass that keydown to the page. The game re-captures the mouse when an overlay closes (`close()` calls `lock()`). Chrome grants that request at once, without a user gesture, because the game itself released the lock when the overlay opened (Chromium only demands a gesture after a lock the user ended). So the grant lands while the Esc key that closed the shop is still down.

When the player holds Esc a little (macOS starts key repeat after about 225-500 ms), the next repeated Esc keydown hits a locked page: the browser eats it and drops the lock. The page sees `pointerlockchange(false)` with no overlay open, and `onLockChange` opens the pause menu. In headless the repeats reach the page as `e.repeat` and are ignored, so `22_esc_held` passed.

Reproduced with the shim: `escExits = true`, shop open, Esc + 5 auto-repeat keydowns → see Work progress (red).

## Summary

Ladder: rung 2 (the existing `onLockChange` and Esc listener in `main.ts`), one flag. An Esc keydown that closed an overlay (`defaultPrevented`, not a repeat) marks "this Esc press closed an overlay" until its keyup or a window blur. A lock lost while that press is held does not pause; the game keeps running with a free cursor. The mark covers one press only, so a fresh Esc in the game pauses as before.

Pill: the element, its three CSS rules and main's `onLockError` handler (it only showed the pill) are removed; `Input.onLockError` stays as a no-op hook. Scenario lines that read the pill are gone: `hint=` fields in `scenario-esc.js`, steps `23_hint_under_shop` and `27_pill_clear` (they tested only the pill), the `hint` part of check 6 in `scenario-intro-pressf.js`, `hintHidden` in factory step 16 and the hint frame count in factory step 31. SPEC and the top CHANGELOG section updated, BOARD.md status line added.

Why this order and not another candidate from the brief (each checked in code):
- `open()` sets `isOpen = true` before `unlock()`, in the shop, blueprints and legend, so the async `pointerlockchange(false)` after opening always sees the overlay and does not pause.
- Late grant while an overlay is open is already released (`20_overlay_race`).
- A refused re-lock goes to `onLockError`, which never paused (it only showed the pill).
- `blur` pauses only a free-cursor game that is not paused; the shop pauses the game, so it does not fire there.
- The 200 ms `lastExit` guard only affects Esc in the pause menu.
So the only order that reaches the pause menu is a lock taken during the Esc press and lost to the same press.

Rejected:
- Not re-locking at all when an overlay closes by Esc (the cursor would stay free until a click or W every time): it would also fix the bug, but makes every shop visit end with a free cursor where Chrome would give the lock back at once.
- Old CHANGELOG builds (2026-10-20) still mention the pill: they describe released builds, history stays as it was.
- Tab does not open the shop (it is the tool wheel; Tab only closes the shop), so "Tab opening" is covered by the two real openings: B and E at the desk (the frame path, `g.shop.open()` inside a frame, same call as `player.ts`).

Uncertain: not measured in real Chrome. A short tap (released before key repeat starts) already worked in the shim before the fix; if PP still sees the pause menu after a quick tap, Chrome drops the lock on some other event and the note on the exact keys pressed decides the next step.

## Work progress

Dev server: `npx vite --port 5169 --host 127.0.0.1 --strictPort --config <scratchpad>/slb/vite.nohmr.config.mjs`, stopped after the runs. Ladder: rung 2 (existing listeners), one flag.

- Red (before the fix, new step only): `FAKELOCK=1 DPR=1 DEV_PORT=5169 CDP_PORT=9381 MAXPOLL=2000 node tools/smoke/smoke.mjs <out>/red tools/smoke/scenario-esc.js` → `32_overlay_esc_chrome shopBTap opened=true open=false paused=false menu=hidden | shopBHeld opened=true open=false paused=true menu=PAUSED | shopFrameTap ... menu=hidden | shopFrameHeld ... paused=true menu=PAUSED | blueprintsTap ... menu=hidden | blueprintsHeld ... paused=true menu=PAUSED | legendTap ... menu=hidden | legendHeld ... paused=true menu=PAUSED | laterEsc menu=PAUSED paused=true`.
- Green: same command, `<out>/green` → `32_overlay_esc_chrome shopBTap opened=true open=false paused=false menu=hidden | shopBHeld opened=true open=false paused=false menu=hidden | shopFrameTap ... menu=hidden | shopFrameHeld ... menu=hidden | blueprintsTap ... menu=hidden | blueprintsHeld ... menu=hidden | legendTap ... menu=hidden | legendHeld ... menu=hidden | laterEsc menu=PAUSED paused=true`. All 30 other lines equal to the red run minus the removed `hint=` fields (`05b moved=7.12`, wall time). `LOGS:` empty.
- `FAKELOCK=1 DPR=1 DEV_PORT=5169 CDP_PORT=9383 MAXPOLL=1400 node tools/smoke/smoke.mjs <out>/intro tools/smoke/scenario-intro-pressf.js` → 29 PASS, 0 FAIL (the scenario has 29 checks now, another session added them), `PASS 6 intro=false titleHidden=true paused=true calls=refused | wanted true->true newCalls=0 | locked=true paused=false`, `LOGS:` empty.
- `FAKELOCK=1 DPR=1 DEV_PORT=5169 CDP_PORT=9384 MAXPOLL=2400 node tools/smoke/smoke.mjs <out>/factory tools/smoke/scenario-factory.js` → `16_lock_fallback calls=[{"unadjustedMovement":true},undefined,undefined] locked=true rawAfter=false lockedAgain=true`, `31_esc_during_raw_reject PASS A.locked=true B.escAfterRequestMs=254 B.paused=true B.locked=false`, 0 ERR, `LOGS:` empty.
- `npx tsc --noEmit` → exit 0. `grep -rn "Math.min(1, dt" src` → 0 lines.

Gotowe, gdy:
- [PASS] 1 — green run: all eight Tap/Held lines `open=false paused=false menu=hidden`.
- [PASS] 2 — green run: `laterEsc menu=PAUSED paused=true`.
- [PASS] 3 — `grep -rn "click-to-play\|capture the mouse" src tools/smoke docs/SPEC.md` → no lines (exit 1).
- [PASS] 4 — esc run: other lines unchanged, `LOGS:` empty; intro 29 PASS, `LOGS:` empty.

Self-check: my diff is `main.ts` (pill out, `escClosed` flag, keyup listener, one line in blur), three CSS rules out of `style.css`, the scenario edits above, SPEC/CHANGELOG/BOARD lines and this note. `shop.ts` needed no change. The rest of the dirty tree (machines, player, hole, intro, menu, shop tree layout and others) belongs to other sessions; not touched.
