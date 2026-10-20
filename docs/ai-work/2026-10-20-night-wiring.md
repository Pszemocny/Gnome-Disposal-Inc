# Night wiring: new modules into the game loop, shop reopen fix (orchestrator, 2026-10-20)

## Problem

The night packages (`moods`, `offline`, `slowmo`, `weather`, `strike`, `blueprints`, `legend`, `leaderboard`) were built as standalone modules that do not touch `main.ts`, so several agents could work at once. They had to be wired into `src/main.ts` / `src/core/context.ts`, plus a few lines in files other agents owned during the night. The blueprints agent also suspected that closing the shop with B or E reopened it in the next frame.

## Summary

- `src/core/context.ts`: fields `moods`, `offline`, `slowmo`, `weather`, `strike`, `blueprints`, `legend`, `leaderboard`.
- `src/main.ts`:
  - creation after the shop (blueprints and legend before main.ts's Esc listener, so their own Esc handlers run first), `offline.boot()` after the machines are restored, the leaderboard after the title menu;
  - one `overlayOpen()` helper (shop, blueprints, legend) used by the four pause/Esc/click guards;
  - `dt = realDt x wheel.slow(realDt) x slowmo.scale`; `slowmo.update(realDt)` (real time, or the freeze never ends), `stats.playTime`, `codeCd`, `hud.update` and `offline.update` on real time; `offline.update` outside the pause block so menu time is not "away";
  - `strike.update(dt)` right after `gnomes.update`, `weather/moods/blueprints/legend` after contracts.
- `src/systems/events.ts`: `EVENTS` exported for the legend.
- `src/player/player.ts`: the rebirth (`fellIn`) offers the leaderboard before resetting the run; the save-copy sensitivity factor is gone (the cookie setting is applied once, in `input.ts`).
- `src/ui/hud.ts`: the controls panel lists K blueprints, Z undo, L legend, M mute; the corner hint says "H controls · L legend".
- `src/ui/shop.ts` (bug, red test first): when the shop closed on B or E, the same keydown was also in the game's `input.pressed`, so `hotkeys()` reopened the shop in the next frame. The close handler now removes that key from `input.pressed` after the event (`queueMicrotask`).

## Work progress

- `npx tsc --noEmit` clean after each step.
- `scenario-wiring.js` (real loop): all modules present; slow-mo game/real time ratio 0.09 over 12 frames after a BULLSEYE, then scale 1; DOWNPOUR banner; K and L open and close (Esc) without the pause menu; a craving is active; `LOGS:` empty.
- `zz-scenario15-scope.js` regression: all 8 steps as before, `LOGS:` empty.
- `scenario-shop-reopen.js`: red before the fix (`afterCloseB: true`), green after (`openedByB: true, afterCloseB: false, afterEsc: false`), `LOGS:` empty.
- STRIKE note: a 1.2 kg gnome usually knocks only one standing gnome in; heavy and massive gnomes knock 2-3 (bowling-ball physics). Kept as is: it gives heavy gnomes a job. Rejected: counting a pin when it starts falling instead of when it is eaten (would also count pins that roll out again).
