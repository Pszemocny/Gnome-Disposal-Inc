# Fake pointer lock for smoke tests

## Problem

PP (verbatim): "poszukaj jakiegos obejscia aby testy mogly sterowac mysza ale nie przejmowalo to kontrolera mojego".
Smoke scenarios that need pointer lock ran with `FULL=1` (full Chromium, `--headless=new`). On macOS that grabs and warps PP's real system cursor. The headless shell never touches the cursor, but it has no pointer lock (`requestPointerLock` rejects with `WrongDocumentError`, `2026-10-19-esc-pause-shop.md`).

Interpretation: add `FAKELOCK=1` to `tools/smoke/smoke.mjs`. It runs the headless shell and emulates the pointer lock API inside the page, so the scenarios that used `FULL=1` give the same lines without moving the real cursor. Test tooling only, no file in `src/`.

Gotowe, gdy:
1. `FAKELOCK=1 ... smoke.mjs <out> tools/smoke/scenario-esc.js` → every result line equals the accepted FULL=1 line in `2026-10-20-esc-resume.md` / `2026-10-20-factory-bugs.md` (only `05b_walk_free moved=` may vary, it is wall-time), `LOGS:` empty.
2. `FAKELOCK=1 ... smoke.mjs <out> tools/smoke/scenario-factory.js` → rows 15-21 and 31-32 (the lock and mouse rows) equal the accepted FULL=1 lines in `2026-10-20-factory-bugs.md`; `20_cdp_look dYaw=-0.440 locked=true` proves CDP mouse moves reach the game.
3. `FAKELOCK=1 ... smoke.mjs <out> tools/smoke/scenario-intro-pressf.js` → 25 PASS lines like `2026-10-21-intro-pressf.md`, incl. 5, 6, 11 (lock in the top page and in iframes).

Ladder: rung 3 (platform): `Page.addScriptToEvaluateOnNewDocument` runs the shim in every frame before the game's scripts; the scenarios' own refusal wrappers stay as they are and call the shim as `orig`.

## Summary

- `tools/smoke/smoke.mjs`: `FAKELOCK=1` keeps the headless shell and injects a shim with `Page.addScriptToEvaluateOnNewDocument` (every frame, iframes too, before the game's scripts). `requestPointerLock` (any options, incl. `{unadjustedMovement}`) sets a per-document fake `pointerLockElement`, fires `pointerlockchange` and resolves; `exitPointerLock` clears it and fires `pointerlockchange`. Hooks: `__fakeLock.refuse(n)` rejects the next n requests with `NotAllowedError` + `pointerlockerror`; `__fakeLock.escExits = true` makes a trusted Esc keydown drop the lock and never reach the page (Chrome/Brave). Default: Esc reaches the page, like headless did with `FULL=1`. Focus emulation now runs for `FAKELOCK` too.
- The scenarios keep their own refusal / hold wrappers; they wrap the shim as `orig`, so no scenario logic changed. Their `Run:` lines now say `FAKELOCK=1`.
- `CLAUDE.md` "Tests": one sentence, `FAKELOCK=1` instead of `FULL=1`, because full Chromium moves PP's cursor.
- CDP mouse moves reach the game without a real lock: Chromium fills `movementX/Y` from the previous position (`20_cdp_look dYaw=-0.440 locked=true`, same as FULL=1).

Known limits of the emulation (accepted, the scenarios do not depend on them): no user-activation check (a real browser can refuse a request without a gesture), no ~1 s re-lock cooldown after an exit (the scenarios wait `gap()` anyway), the lock is not dropped on window blur or when the element leaves the page, and clicks while locked hit the element under the point, not the locked canvas. A scenario that tests one of these needs `FULL=1` while PP is away.

Rejected:
- SPEC.md / BOARD.md: test tooling only, nothing changes for the player.
- One-off crash in the first factory run (`TypeError: Cannot set properties of undefined (setting 'slot')` in `Gnomes.remove`, called by the scenario's `clearYard`, then 79 Rapier `recursive use of an object` errors): a gnome was in `gnomes.list` while its type's slot array was empty. Not reproduced in two more runs (a probe logging such gnomes found none). Not lock code; another session was editing `src/` (machines, robots, mushrooms, hole) on the same dev server at the time. Rejected (orchestrator): the crash came from the scenario's own `clearYard` during a hot reload of half-edited files, never from a game path, and did not repeat on a stable tree; the error log in Supabase will show it if real players ever hit it.

## Work progress

Dev server: `npx vite --port 5175 --host 127.0.0.1 --strictPort --config <scratchpad>/slb/vite.nohmr.config.mjs`, stopped after the runs. Out dirs under `<scratchpad>/fakelock/`.

- `FAKELOCK=1 DPR=1 DEV_PORT=5175 CDP_PORT=9391 MAXPOLL=1600 node tools/smoke/smoke.mjs <out>/esc tools/smoke/scenario-esc.js` → 32 result lines, `LOGS:` empty. Every line equal to the accepted FULL=1 lines (`2026-10-20-esc-resume.md`, round 1 lines 26-29, and `2026-10-20-factory-bugs.md` row 22), incl. `05b_walk_free moved=7.54` (FULL=1 range 6.17-7.83). The event log shows the same order as a real lock: `rPL called`, `lockchange locked=true`, `rPL resolved`.
- `FAKELOCK=1 DPR=1 DEV_PORT=5175 CDP_PORT=9392 MAXPOLL=1400 node tools/smoke/smoke.mjs <out>/intro tools/smoke/scenario-intro-pressf.js` → 25 PASS, `LOGS:` empty. Same lines as `2026-10-21-intro-pressf.md`, incl. 5 (lock in an iframe), 6, 8, 11. Only difference: `PASS 20 ... y=5.0` vs `y=6.9` (respawn height after the fall, sampled at a frame that depends on timing).
- `FAKELOCK=1 DPR=1 DEV_PORT=5175 CDP_PORT=9395 MAXPOLL=2400 node tools/smoke/smoke.mjs <out>/factory3 tools/smoke/scenario-factory.js` → 29 result lines, `LOGS:` empty. Lock and mouse rows 15-21, 23, 31, 32 equal to FULL=1. Differences, none from the lock:
  - `18_jump_logged` and `23_slow_frame` lines carry a new `"shake":0` field (the game now writes shake into the beacon, see `31_shake_in_lines` in the Esc scenario).
  - `31 B.escAfterRequestMs=253` vs 257 (wall time).
  - Physics noise: `04 at=3.21` vs 3.20, `08 stuck=1 worst=0.44 kingY=1.32` vs `stuck=0 worst=0.17 kingY=1.75` (a gnome bounced back onto the chute top, the case listed under Uncertain in `2026-10-20-factory-bugs.md`; the probe run before had `stuck=0 worst=0.17`), `10 gnomeAt=0.97,2.01` vs 0.95,2.00, `28 kingBefore=0.400` vs 0.417, `30 at=-3.07,1.92` vs -3.14,1.71, `27 chuteY` new field.
  - First run (`<out>/factory`) crashed, see Rejected.
- Hook probe `<scratchpad>/fakelock/tmp-hooks.js` (same command, `MAXPOLL=100`) → `play: locked=true paused=false ev=change:true`, `refuse: err=NotAllowedError ev=error locked=true`, `default Esc: seen=Escape locked=false` (the game pauses and unlocks), `resume: locked=true paused=false`, `escExits: seen= locked=false ev=change:false`.

Gotowe, gdy:
- [PASS] 1 — esc run above: all lines equal, `LOGS:` empty.
- [PASS] 2 — factory3 run above: lock rows equal, `20_cdp_look dYaw=-0.440 locked=true`, `LOGS:` empty.
- [PASS] 3 — intro run above: 25 PASS incl. 5, 6, 11, `LOGS:` empty.

Self-check: diff in my files is `smoke.mjs` (header + shim + focus line), three `Run:` comment lines, one sentence in `CLAUDE.md`, this note. The `seenIntro` lines in two scenarios and the "Changelog" section in `CLAUDE.md` were already there or came from another session; not touched. No file in `src/`.
