# Esc opens and closes the pause menu, Esc closes the shop

Interpretation: PP asked in the terminal: "niech escape wchodzi do menu pauzy i wychodzi z niego, to samo ze sklepu". Esc in the game opens the pause menu, Esc in the pause menu goes back to the game, Esc in the shop goes back to the game (never into the pause menu). Small change, final plan given by the orchestrator, no plan round.

Gotowe, gdy:
1. in game, Esc → pause menu visible, `ctx.paused === true`
2. in the pause menu, Esc → back in the game (`ctx.paused === false`, menu hidden), either locked directly or via the one-click overlay
3. B (with Laptop) or E at the desk opens the shop; Esc → shop closed, back in the game (or the overlay), the pause menu NOT shown
4. no exceptions; `npx tsc --noEmit` clean; regression `scenario15.js` passes

## Problem

Esc in the pause menu did nothing: the only way back was the RESUME button. Esc in the shop closed the shop and asked for pointer lock again; when the browser refused, the error handler opened the pause menu, so the player landed in the pause menu instead of the game.

## Summary

Ladder: step 2 (reuse). The existing `onLockChange`/`onLockError` flow in `main.ts` and the shop's own Esc handler (`preventDefault`) already did most of it; the change is one Esc listener, one overlay element and one changed condition. `input.ts`, `menu.ts` and `shop.ts` are unchanged.

- `src/main.ts`:
  - new "Click to play" overlay (`.click-to-play`); one click calls `ctx.input.lock()`. While it shows, the game is paused and the HUD dimmed.
  - `onLockError` (browser refused the lock): when no menu and no shop is open, show the overlay instead of the pause menu. When a menu is open (title Play refused), it stays as it is.
  - Esc listener: ignored while the shop is open, after the shop already handled it (`defaultPrevented`) and on the deep/rebirth screen. Locked (only where the key reaches the page) → unlock, which opens the pause menu through `onLockChange`. Overlay visible → pause menu. Pause menu (after START) → hide it, show the overlay, ask for the lock; a granted lock hides the overlay and resumes. Title screen: Esc does nothing.
  - `showPause` hides the overlay; `onLockChange(true)` hides it.
- `src/ui/style.css`: `.click-to-play` (z-index 25: above the shop, below the menu and the deep screen).

What Esc does now:
- in the game: pause menu (Brave exits the lock itself and the page gets `pointerlockchange`, as before).
- in the pause menu: back to the game when the browser grants the lock; when it refuses (Chromium after an Esc exit), the "Click to play" overlay, one click resumes.
- on the overlay: pause menu again.
- in the shop: shop closes, back to the game, or the overlay when the lock is refused; never the pause menu.

Rejected:
- `navigator.keyboard.lock(['Escape'])`: works only in element fullscreen (Fullscreen API, not F11), and the game must not force fullscreen on the player.
- Achievements page inside the pause menu: Esc resumes the game too (same as RESUME), no separate "back" on Esc; nobody asked for it.

## Browser facts measured (Chrome for Testing 1243, `--headless=new`, CDP trusted input)

- The headless shell (default harness binary) has no pointer lock: `requestPointerLock` rejects with `WrongDocumentError`. Full Chromium in `--headless=new` grants it after a trusted click, but only with a focused page (`Page.bringToFront` + `Emulation.setFocusEmulationEnabled`) and a real viewport (`DPR=1` metrics override; without it the window was 640x217).
- Headless has no browser UI, so a trusted Esc while locked reaches the page as `keydown Escape` and the lock stays. Real Chromium/Brave eats that Esc and exits the lock. The scenario mimics Brave with `document.exitPointerLock()`.
- Headless granted `requestPointerLock` from the Esc keydown (no user activation) after a script exit. The refusal Brave gives after a user Esc exit cannot be produced headless; the scenario simulates it by making `requestPointerLock` reject once and firing `pointerlockerror`.
- Baseline before the change (same scenario): Esc in game (key reaches page) → nothing; after a browser exit → pause menu; Esc in the pause menu → nothing, menu stays (3 tries).

## Work progress

Harness (`scratchpad/smoke/smoke.mjs`): `FULL=1` runs full Chromium in `--headless=new`; the page may push `{method, params}` to `window.__cdp`, the harness sends them in order and bumps `window.__cdpDone`. Scenario: `scratchpad/smoke/scenario-esc.js`.

Commands:
- `FULL=1 DPR=1 CDP_PORT=9372 MAXPOLL=800 node smoke.mjs <out> scenario-esc.js` → RESULT below, LOGS empty
- `npx tsc --noEmit` → no output, exit 0
- `CDP_PORT=9373 MAXPOLL=2400 node smoke.mjs <out> scenario15.js` → fan ratio 0.91, massive y 1.25, beam and arc true, green arc eaten 1, crate 9 inside lifts, rain only specials, hoop bullseye true, parade 16/16; LOGS empty

Checks:
- [PASS] 1 Esc in game → pause — `02_esc_in_game_keydown`: paused true, menu "PAUSED"; `04_browser_esc_in_game` (Brave-like exit): paused true, menu "PAUSED".
- [PASS] 2 Esc in pause → game — `03_esc_in_pause`: paused false, locked true, menu hidden (lock granted directly in headless). Refused path: `05`: overlay true, menu hidden, paused true; `06` Esc on overlay → menu "PAUSED"; `07` refused again → overlay; `08` click overlay → paused false, locked true.
- [PASS] 3 shop + Esc — `09` B → shop true; `10` Esc → shop false, locked true, paused false, menu false. `11` B + Esc with refused lock → shop false, overlay true, menu false; `12` click → locked. `13` E at the desk → shop true; `14` Esc → shop false, locked true, menu false.
- [PASS] 4 no exceptions (LOGS empty in both runs), `npx tsc --noEmit` clean, `scenario15.js` values match the earlier runs.

Self-check: only the asked behaviour; no new dependency; the overlay follows the existing DOM-over-canvas pattern (`menu`, `shop`); no files outside the owned list.

Uncertain: the real Brave refusal is simulated, not measured. If Brave grants the lock from Esc (it should not after an Esc exit), Esc in the pause menu resumes directly; if it refuses, the player sees "Click to play". Either way the pause menu does not stay or flicker.
