# Sound and mouse settings in a cookie, M mutes

Interpretation: the orchestrator's night task is the plan (PP Slack: "Dodaj zapisywanie ustawień dźwięku i myszy w cookies", BOARD items PP-F and Hub 2 "M toggles mute"). Volume, mute, mouse sensitivity and invert Y live in a cookie, apart from the game save, and survive "Reset save".

Gotowe, gdy:
1. set volume 0.3 and sensitivity 1.8 in the menu, reload → both the same; the written cookie string contains `SameSite=Lax` and `max-age=31536000`
2. "Reset save" (two clicks) → money/upgrades reset, volume 0.3 and sensitivity 1.8 still there
3. M → muted (master gain 0, toast "Sound off"), M again → gain back to the volume; mute survives a reload
4. sensitivity 2 doubles the yaw change for the same mouse movement; invert Y flips the pitch direction
5. corrupted cookie `gnome_settings=%7Bbad` → defaults, no exception
6. no exceptions; `npx tsc --noEmit` clean; one screenshot of the settings in the menu

## Problem

Volume and sensitivity were stored inside the game save, so "Reset save" wiped them. There was no mute key and no invert Y.

## Summary

- `src/core/settings.ts` (new): `prefs` = `{ volume, muted, sensitivity, invertY }`, read once from the cookie `gnome_settings` at module load (bad JSON or wrong types fall back to defaults, numbers clamped), `saveSettings()` writes it with `max-age=31536000; path=/; SameSite=Lax`, `adoptSaveVolume()` copies the save's old volume once when there is no cookie yet.
- `src/core/audio.ts`: master gain = muted ? 0 : volume; `setVolume`/`setMuted` write the cookie; a window keydown listener toggles mute on M (not in text fields, not on key repeat) and shows the toast "Sound off"/"Sound on".
- `src/core/input.ts`: mouse `dx`/`dy` are scaled by the sensitivity and `dy` flipped when invert Y is on, so `player.ts` stays untouched.
- `src/core/state.ts`: `settings.volume` in the game state mirrors the cookie (main.ts still reads it at boot), `settings.sensitivity` is pinned to 1 because `player.ts` still multiplies by it and the scaling now happens in `input.ts`. Shadows stay in the save.
- `src/ui/menu.ts`: slider "Mouse sensitivity" 0.25-3, checkbox "Invert Y", volume slider, checkbox "Mute (M)" (kept in sync when M is pressed with the menu open). No new CSS needed: the existing `.settings label` / `.cb` styles cover it.
- No wiring line in `main.ts` needed: the cookie is read when `settings.ts` is first imported (by `state.ts`).

Ladder: rungs 2/3. Reused the menu, `hud.toast`, the existing settings styles; `document.cookie` from the platform, no cookie library.

Deviation from the task: the task said to scale the deltas in `input.ts` and leave `player.ts` alone, but `player.ts` already multiplies by `state.settings.sensitivity` (look and ghost rotation). Scaling in both places would square it, so the save's copy is pinned to 1.

Rejected:
- ~~Typing the secret code GNOMERAIN contains an M, so it toggles mute once (with a toast). Not handled.~~ Fixed by the orchestrator (zero follow-ups): `audio.ts` toggles mute 0.4 s after an M only when no other letter came within 0.4 s before or after it. `scenario-mute-word.js`: typing GNOMERAIN keeps the mute state, M alone mutes, M again unmutes, toasts "Sound off|Sound on", `LOGS:` empty.
- Sensitivity is still multiplied in `player.ts` by the save's copy (kept at 1); removing that multiplication is in the orchestrator's wiring package.
- Invert Y also flips the vertical mouse rotation of a tool ghost while placing it (player.ts uses the same `dy`). Kept: invert Y means the vertical mouse axis is flipped everywhere.

## Work progress

Test: `CDP_PORT=9358 MAXPOLL=2400 node smoke.mjs run-settings scenario-settings.js` (scratchpad `smoke/`), one run over 5 page loads (stages re-injected with `Page.addScriptToEvaluateOnNewDocument`, results kept in `sessionStorage`). First run showed migration 0.7 instead of 0.45: the test's dynamic `import('/src/core/state.ts')` got a second module instance after HMR, so its `blockSaves()` did not stop the unload autosave; the test now also sets `g.state.settings.volume`. Second run, all stages:

- [PASS] 1 — menu input vol 0.3 / sens 1.8 → after reload `prefs {volume:0.3, sensitivity:1.8}`, sliders "0.3"/"1.8"; written cookie `gnome_settings=%7B...%7D; max-age=31536000; path=/; SameSite=Lax`
- [PASS] 2 — save with money 5000, fan 2 → after Reset save (two clicks) money 0, upgrades {}, prefs volume 0.3, sensitivity 1.8, muted true
- [PASS] 3 — M: gain 0.3 → 0, toast "Sound off", menu checkbox checked; M again: gain 0.3, toast "Sound on"; muted=true after reload, gain 0 after `ensure()`
- [PASS] 4 — movementX 50: dyaw -0.11 at sensitivity 1, -0.22 at 2 (ratio 2); movementY 20: dpitch -0.044 normal, +0.044 inverted
- [PASS] 5 — cookie `gnome_settings=%7Bbad` → prefs `{volume:0.7, muted:false, sensitivity:1, invertY:false}`, no error
- [PASS] 6 — harness LOGS empty (no exception), `npx tsc --noEmit` → exit 0, screenshot `smoke/run-settings/settings-menu.png` shows Mouse sensitivity, Invert Y, Volume, Mute (M), Shadows
- Extra: migration — save with volume 0.45 and no cookie → prefs volume 0.45, cookie written once.

Self-check: only the owned files changed; no new CSS, no main.ts line; `prefs` is the single source for volume, mute, sensitivity, invert Y.

