# Push Broom and Plow Tractor (2026-10-19)

Plan: `docs/ai-work/2026-10-19-plan-broom-tractor.md`, section "Plan (orchestrator, final)" points 1-7 plus point 8 "Roast fixes" (point 8 wins where they differ). The plan stands in for plan-senior.

## Gotowe, gdy (from the plan, with the roast fixes)

1. the king in front of the broom and the plow is not pushed (moves less than 0.5 m)
2. tractor owned without the broom: C equips the tractor
3. shop buy of `broom` → Movement tab lists "Push Broom", `upgrades.broom = 1`
4. C without the broom (and without the tractor) → toast text contains "Push Broom", nothing equipped
5. broom: 5 awake gnomes in a row 1 m in front, hold LMB and walk forward 3 s → at least 4 of them moved at least 3 m along the walk direction
6. broom equipped: LMB on a gnome does not grab it (`held` stays null)
7. tractor (owned): C twice → tractor; drive forward 3 s into gnomes at lateral offsets 0, ±1.0, ±1.6 m → `plowWidth` 0 (2.6 m): the ±1.6 m ones are not pushed; `plowWidth` 1 (3.4 m): they are; blade mesh width follows
8. weights: a 0.5 kg and a 3 kg gnome in front of the plow end up within 1 m of each other after 2 s of driving
9. C from tractor → hands, LMB grabs again
10. `npx tsc --noEmit` clean, no exceptions in any scenario log; regression `scenario15.js`, `scenario-polish-c.js`, `scenario-magnet-gun.js` still pass

## Problem

PP (Slack): "niech doda grabie albo zmiotke i jako upgrade traktorek ze spychem gdzie upgrade poszerza spych". Add a rake or a broom; as its upgrade a small tractor with a plow blade; a further upgrade widens the blade. The tools are bought and shown like the existing ones.

Why the broom and not the rake: a broom pushes things away from you, a rake pulls them towards you. The game is about getting gnomes into a hole in front of you, so pushing is the useful direction, and the tractor's plow blade also pushes. Broom → plow is one mechanic that grows (same push, wider and faster). A rake would be a different mechanic that the tractor then replaces.

## Summary

- New `src/player/sweeper.ts` (class `Sweeper`, owned by the player):
  - `gear`: hands / broom / tractor, not saved (a new game starts with hands).
  - `next()`: C cycles only through owned items, so the tractor works without the broom (roast fix).
  - Broom: view model on the camera, sways while LMB is held. Box 0.3..1.5 m ahead, 1.4 m wide, feet to 1.2 m. Push speed `max(3.5, player speed + 1.5)`.
  - Tractor: model in the scene under the player (body, 4 spinning wheels, blade scaled to the width). Box from the capsule front (0.35 m) to 2.05 m ahead, width `2.6 + 0.8 x plowWidth`, height 0.9 m. Pushes whenever the player moves faster than 0.5 m/s, at `max(0, forward speed) + 1`.
  - Push: collect gnomes first (`forEachNear`, free gnomes only), then `ragdoll(g, 3)` and steer the horizontal velocity towards the forward direction (`k = min(1, 12 dt)`), lift 0.5 m/s only near the ground. Velocity, not impulse, so every weight is pushed the same. The king is skipped. `thrownBy`, `throwPos`, `bounced`, `bullseye` are cleared, so a pushed gnome pays no trick shot and no UFO hit.
  - Swish: the existing `audio.whoosh()` every 0.35 s while the broom touches gnomes. No change to `audio.ts`.
- `src/player/player.ts` (hooks only):
  - `eye` adds `sweeper.lift` (0.4 m on the tractor), and the camera now uses `eye`, so placement, targeting and repair aim from the seat.
  - Tractor: speed x1.25, no sprint, no footsteps or head bob.
  - KeyC in `hotkeys()` (works while placing). No owned item → toast "Buy the Push Broom in the shop (Movement)." and the deny sound.
  - `setGear()`: broom/tractor out → `dropAll()` + `cancelPlacement()`; back to hands → LMB is ignored until released.
  - `selectTool()` puts the broom/tractor away when a placement starts (digits and G).
  - LMB grab and the empty magnet beam only with hands. The push runs only when the input is locked and the game is not paused.
  - Upgrades gone (rebirth, reset) → back to hands.
- `src/data/upgrades.ts`: `broom` ($60), `tractor` ($1500, hole 3), `plowWidth` ($700, x1.7, 5 levels, hole 3), all in Movement.
- `src/ui/shop.ts`: preview line for Wider Plow (`2.6 m blade` → `3.4 m blade`).
- `src/ui/hud.ts`: line above the hotbar `BROOM (C)` / `TRACTOR · plow 3.4 m (C)`, magnet panel hidden while the broom/tractor is out, LMB magnet prompts hidden, help line `C broom / tractor`.
- `src/world/models.ts`: `broomGeometry`, `tractorGeometry`, `tractorWheelGeometry`, `plowBladeGeometry`.
- `docs/PLAN.md`: controls row C, Movement shop line.

Ladder: shelf 2. The push reuses `forEachNear` + `isFree`, `ragdoll()`, `dropAll()`, `cancelPlacement()`, `whoosh()`, `U(...)`, `EFFECT`, `build()`. New code only for the box test, the steering and the models.

Deviations from the plan:
- The Plow Tractor description no longer says "(needs the Push Broom)", because roast fix 3 lets it work alone.
- No footsteps and no head bob on the tractor (not in the plan; footsteps on a tractor seat sound wrong).
- Tractor model details (steering wheel, exhaust) were made smaller after the first screenshot, after the scenario runs. Only geometry changed; `tsc` clean after it.

Rejected:
- Engine hum: `audio.ts` has no loop helper, the plan says to skip it then.
- Confirm before driving into the hole at max level: rejected in the plan (walking in has the same effect).

Uncertain:
- Driving straight into the King with the tractor shoves him 4.71 m in 1 s. Walking into him by hand shoves him 4.57 m. This comes from the player capsule (the character controller pushes bodies it touches), not from the plow. It is the same as today on foot, so I did not change it.
- With the 640x360 test window the HUD line `TRACTOR · …` sits in the middle of the view; at 1280x720 it is just above the hotbar.

## Work progress

Scenario `<scratchpad>/smoke/scenario-broom.js`, run `CDP_PORT=9381 MAXPOLL=4000 node smoke.mjs run-broom scenario-broom.js`. Runs along +x at z = 12 (hole at 0,0, yard half 22). First run: the king tests stood him upright, so his centre (1.3 m) was above both boxes and the guard was not tested; the plow drive-into number was the capsule. The second run lays the king down (centre 0.54 m above the feet, inside both boxes) and strafes beside him. The weight test spawned the two gnomes 0.8 m apart sideways (end distance 1.01 m, along-track 0.08 m); the second run spawns them 0.6 m apart.

Final run, `LOGS:` empty:
- [PASS] 1 — king lying 1.2 m ahead, broom LMB 2 s: moved 0 m. King lying 1.6 m ahead, tractor strafing 1 s: moved 0 m; a normal gnome in the same spot moved 0.66 m (control, so the box does reach that spot).
- [PASS] 2 — only `tractor` owned, C → gear `tractor`; eye 1.15 m above the capsule centre (0.75 on foot).
- [PASS] 3 — Movement tab lists "Push Broom"; BUY → `upgrades.broom = 1`, money 1000 → 940.
- [PASS] 4 — no items, C → toast "Buy the Push Broom in the shop (Movement).", gear `hands`.
- [PASS] 5 — 5 awake gnomes 1.0-1.5 m ahead, LMB + W 3 s: moved 7.75 / 21.29 / 21.87 / 21.25 / 9.73 m, 5 of 5 at least 3 m (player moved 20.97 m).
- [PASS] 6 — broom out, LMB on a gnome 1.5 s: `held` null, max held 0, magnet panel `display: none`, beam hidden, prompt empty, HUD `BROOM (C)`.
- [PASS] 7 — C twice → `broom`, `tractor`. Width 2.6: offsets 0 / ±1.0 moved 21.6-21.7 m, ±1.6 moved 0 m. Width 3.4: all five moved 24.4-24.8 m. Blade scale 2.6 → 3.4. HUD `TRACTOR · plow 2.6 m (C)` / `3.4 m`.
- [PASS] 8 — 0.5 kg and 3 kg, 2 s of driving: 17.49 m and 17.37 m along, 0.69 m apart (along-track difference 0.12 m).
- [PASS] 9 — tractor, C → `hands`, LMB on a gnome → held by hand; eye back to 0.75 m.
- [PASS] 10 — `npx tsc --noEmit` → no output, exit 0 (also after the model tweak). `LOGS:` empty in all runs. Regression on 9382-9384:
  - `scenario15.js`: fan ratio 0.94, massive lifts (y 1.25), beam and arc, green arc → eaten 1, crate with 10 inside lifts, rain only specials, hoop bullseye true, parade 16.
  - `scenario-polish-c.js`: arrow/marker `11 m`, afford row and badge, 0 locked rows with afford (4 locked rows now: Tractor and Wider Plow are new), magnet panel, combo ring, help toggles.
  - `scenario-magnet-gun.js`: hand lift 3 kg (y 1.25), one at a time, gun 6/6 and 12/12, slip 2 of 15 tiny vs 10 of 10 massive, throw 29-31 m/s vs 5.3 m/s, shop Magnet Gun, crate held, combo 5.

Extra checks in the same run:
- LMB held while C puts the broom away: 0 held while still pressed, 1 held after a fresh press.
- Digit 2 with the broom out: placing `trampoline`, gear `hands`.
- A gnome with `throwPos`, `thrownBy: player`, `bullseye` swept: all cleared.

Screenshots: `run-broom/broom-sweep.png` (broom bottom right, gnomes flying ahead), `run-broom/plow-w1.png`, `run-tlook/tractor-view.png`.

Self-check:
- Rapier: no body change inside a query callback; `forEachNear` fills a list, bodies change after. No gnome reference is kept across frames.
- Only the owned files were edited; `main.ts`, `gnomes.ts`, `coins.ts`, `props.ts`, `machines.ts` untouched.
- No new dependency, no CSS file change (the HUD line uses an inline style).
