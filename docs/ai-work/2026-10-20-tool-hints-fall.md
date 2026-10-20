# First-use tool hints (Hub 1) and fall-in pays once per level (F5) (2026-10-20)

Interpretation: the orchestrator's night envelope is the plan. Hub 1 without the mouse-wheel tool cycling (replaced by the Tab wheel, PP's GTA-V request; the mouse wheel keeps the placement distance). F5 exactly as in `2026-10-20-plan-night-features.md`, with one change of the flag name (see Summary).

## Gotowe, gdy

1. Selecting the trampoline the first time shows a hint containing "Trampoline" and "R turn"; selecting it again (same save, after a reload too) shows nothing.
2. C to the tractor the first time shows the tractor hint; the robot (via the wheel) shows its hint.
3. An old save without `seenHints` loads and shows hints normally.
4. Falling in twice at the same hole level: money grows the first time only; the second time the toast text appears; at the next level it pays again.
5. Hint opacity sampled over >= 10 frames rises with an ease and falls back to 0.
6. Regression `zz-scenario15-scope.js`, `scenario-wheel.js`; no exceptions; `npx tsc --noEmit` clean; one screenshot of a hint.

Enumeration check (Grep): selection paths are `hotkeys` digits → `selectTool`, G (move a tool) → `selectTool`, wheel → `selectTool` / `setGear`, C → `setGear`. Gears: `hands | tractor | blower` (`sweeper.ts`); hands gets no hint, the Magnet Gun hint fires on its first LMB. Tools: every id in `TOOL_IDS` (11, robot without a digit key).

## Problem

PP (BOARD "Hub 1"): new players do not know a tool's keys. Each tool and gear should explain itself once, the first time it is picked. Economy plan F5: walking into the hole below level 12 paid 15 x valueScale coins every 3 s, a repeatable fountain ($5/s at level 1).

## Summary

- `src/core/state.ts`: `seenHints: string[]`, kept through a rebirth like `seenIntro`; old saves get `[]` from `freshState` in `loadState`.
- `src/ui/hud.ts`: one table `HINTS` (what to do, per tool / gear id; a missing id falls back to `UPGRADE_BY_ID[id].desc`), keys built from the tool's digit (`TOOL_IDS` index, "hold Tab" for the robot) plus the placement keys, or the gear keys for tractor / blower / Magnet Gun. `firstUse(id)` shows the card once per save and records the id; `hideHint()` fades it out early. Card pops in with `outBack` scale and `outCubic` opacity over 0.25 s, holds until 4 s, sinks and fades with `inQuad` over 0.3 s (animated in `Hud.update`, like the big text).
- `src/ui/style.css`: `.hud-hint` card, bottom centre above the hotbar (bottom 150 px, above the gear label at 112 px).
- `src/player/player.ts`: `selectTool` → `firstUse(type)`; `setGear` → `firstUse(gear)` for tractor / blower; first LMB press with the Magnet Gun → `firstUse('magGun')`. Next action closes the hint: placing a tool, cancel (Q, shop / blueprints / legend open), gear change, throw.
- F5 in `fellIn`: flag `fall<level>-run<rebirths>` in `state.secrets`. First fall at a level pays the fountain and shows the old BLEH toast; later falls only spit the player out with "The hole already paid you for this level.". The achievement unlock stays on every fall (it is idempotent).
- Ladder: rung 2 for everything (the big-text animation pattern in `Hud.update`, `ease.ts`, `state.secrets`, `UPGRADE_BY_ID`, `TOOL_IDS`); no new helper.

### Deviation from the plan text
- Flag `fall<level>-run<rebirths>` instead of `fall<level>`: `state.secrets` survives a rebirth (`freshState(keep)`), so a plain `fall<level>` would never pay again in later runs. With the run number the fountain pays once per level per run.

### Rejected
- Mouse-wheel tool cycling (BOARD Hub 1): replaced by the Tab wheel per the envelope.
- A hint for "Hands": not asked; hands are the default.
- `hideHint()` within the first 0.25 s of a pop (placing a tool a quarter second after picking it) jumps the card to full opacity before the 0.3 s fade; rare and short, not worth a second timer.
- At the 640x360 test window the card touches the placement prompt line; at normal window sizes the prompt sits at the screen centre, far above. Not changed.

## Work progress

Scenario `<scratchpad>/smoke/scenario-hints-fall.js` (rendering skipped between screenshots, 60 fps game time; the reload is what boot does: `saveState` → `loadState` → `ctx.state`).

- Run `run-hints1`: F5 green; "again" showed a hint because the last fade frame left opacity 1.1e-15 (float). Fixed by writing the fade as `1 - time left / HINT_FADE`; `run-hints3` probe → opacity exactly 0. `run-hints2` / `run-hints3` died midway (page reload by Vite while other agents edited files, no exception); `run-hints4` full.

Kompletność (run `run-hints4`, `LOGS:` empty):
- [PASS] 1 — `Digit2` → placing `trampoline`, hint "Trampoline · 2 or hold Tab · LMB place · R turn · …· Bounces gnomes the way it faces." (`hasName true, hasR true`); again → `""`; after save+load → `""`; `seenHints ["trampoline"]`.
- [PASS] 2 — C → gear `tractor`, hint "Plow Tractor · C or hold Tab · WASD drive …"; C → `blower`, "Leaf Blower …"; wheel (Tab, item `robot`, release) → placing `robot`, hint "Cleaning Robot · hold Tab · LMB place …"; Magnet Gun first LMB → "Magnet Gun · hold LMB pull …", second → `""`.
- [PASS] 3 — save written without `seenHints`, `loadState` → fan hint shown ("Cooling Fan · 4 or hold Tab …"), `seenHints` afterwards only `["fan"]`.
- [PASS] 4 — level 2: first fall 3 coins, money +22.5, toast BLEH; second fall 0 coins, money +0, toast "The hole already paid you for this level."; level 3: 3 coins, money +30, BLEH; flags `fall2-run0, fall3-run0`.
- [PASS] 5 — rise per frame from the key press `0.187, 0.35, 0.489, 0.606, 0.848, 0.899, 0.936, 0.963, 0.981, 0.992, 0.998, 1 …` (18 samples, shrinking steps = ease out); after Q `0.75, 0.556, 0.478, 0.395, 0.306, 0.21, 0.108, 0, 0 …` (24 samples).
- [PASS] 6 — `zz-scenario15-scope.js` (`hints-reg15`) → fan ratio 0.99, arc green at 0.05 and eaten 1, crate 10 inside, hoop bullseye true, parade 16/16; `scenario-wheel.js` (`hints-regwheel`) → B1-B8 values as in the robots note; both `LOGS:` empty. `npx tsc --noEmit` → exit 0. Screenshot `run-hints4/hint-trampoline.png` checked by eye (card above the hotbar, yellow keys).

Self-check: only owned files changed (`player.ts`, `hud.ts`, `state.ts` one field, `style.css` the card). No new `Math.min(1, dt`. Every timed value goes through `outBack` / `outCubic` / `inQuad`. No body touched in a Rapier callback.
