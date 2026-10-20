# Magnet Gun: many gnomes at once, weight only for throwing (2026-10-19)

Plan: `docs/ai-work/2026-10-19-plan-magnet-gun.md`, section "Plan (plan-senior, final)".

## Gotowe, gdy (from the plan)

1. without `magGun`: hold LMB on a 3 kg gnome → it rises above y 1.0 within 3 s
2. without `magGun`: only one gnome is ever held
3. with `magGun`: 10 gnomes in front, hold LMB 3 s → at least 6 held (Coil 0); with Magnet Coil 2 → at least 10 (capacity 12)
4. with `magGun`, swarm of 0.5 kg and 3 kg gnomes, player turns 180° in 0.5 s → more 3 kg than 0.5 kg gnomes slipped off
5. RMB with a swarm → all held gnomes become `ragdoll` with speed ≈ J/mass (0.5 kg ≈ 30 m/s, 3 kg ≈ 5 m/s, ±20%)
6. shop Movement tab shows "Magnet Gun"; buying it sets `upgrades.magGun = 1`
7. crate: look at the crate, LMB → `held` crate, as before; HUD panel shows the crate
8. no exceptions in the logs of any scenario

## Problem

PP: "magnes musi być do kupienia i ściągać mnóstwo gnomów na raz, waga ma być tylko do rzucania, podnosić można każde (magnes olewa wagę, ale te cięższe łatwiej z niego spadają)". The magnet must be a shop purchase and pull lots of gnomes at once. Weight only matters for throwing. Any gnome can be lifted, but heavier ones slip off the magnet more easily.

## Summary

- `src/player/player.ts`
  - Hands (no purchase) still carry one thing: a gnome, the crate or a prop.
  - The pull is now an acceleration: force = mass x acceleration, capped at 45 m/s² x (1 + 0.15 x Magnet Coil). Every weight class lifts the same. The king stays excluded.
  - `tooHeavy` and `magnetPower` are gone.
  - New `swarm: { g, caught }[]` for the Magnet Gun. `held` stays the single carry.
  - With `magGun`, holding LMB pulls one gnome every 0.08 s from a cone (25° + 3° per Magnet Dish, range 7 + 1.2 x Dish) until the swarm reaches capacity. Capacity is `gunCap` = 6 + 3 x Magnet Coil.
  - Swarm gnomes fly to evenly spread spots on a small sphere (Fibonacci layout, radius 0.35 x cbrt(n)) 2.2 m in front of the camera. They collide with each other, so the ball jostles.
  - Slip rule: grip distance `1.6 x (1 + 0.15 x Coil) / mass^0.7`, plus a random slip chance of `0.03 x mass²` per second. A slipped gnome becomes `ragdoll` and cannot be re-grabbed for 1 s.
  - The crate or a prop goes to the single carry on an LMB press when the swarm is empty.
  - RMB throws everything. Each gnome gets the same impulse `J`, plus a ±0.06 spread when several gnomes fly. The resulting speed is J / mass. Releasing LMB drops everything. `noGrabUntil` and `throwPos` work as before through `gnomes.drop(g, impulse)`.
  - Readers updated:
    - the beam goes to the swarm centre
    - the throw arc shows a 1.2 kg gnome flying from the swarm centre with the swarm's mean velocity
    - the look raycast and the placement ray skip every held body (`isHeldBody`)
    - `dropAll()` releases the swarm too
    - new getter `holdsGnome`
- `src/systems/hole.ts`: the combo freeze reads `player.holdsGnome`, so a swarm also keeps the combo alive.
- `src/entities/machines.ts`: no change needed. The crate respawn still clears `player.held`, and the crate is only ever in `held`.
- `src/data/upgrades.ts`:
  - new `magGun` "Magnet Gun" (Movement, max 1, $300, hole level 1)
  - Magnet Coil: "+3 gnomes in the Magnet Gun and a stronger grip (needs the Magnet Gun)"
  - Magnet Dish: the description mentions the wider gun beam
- `src/ui/shop.ts`: the Magnet Coil preview shows `N gnomes` instead of `lifts X kg`.
- `src/ui/hud.ts`:
  - The magnet panel shows `MAGNET GUN n/cap` and the total worth when the gun is owned and no single item is carried.
  - Otherwise the panel shows the single item with its weight class, `weight X kg` and its worth.
  - The "lift" number and the "TOO HEAVY" badge are gone.
  - The help panel line mentions the Magnet Gun.
- `src/ui/menu.ts`: the how-to-play line no longer says "Heavy gnomes need a stronger magnet". It now mentions the Magnet Gun and says "Heavy gnomes fly shorter".
- `src/ui/style.css`: removed the unused `.mag-row .heavy` rule.
- `src/systems/goals.ts`: unchanged. "Use the magnet: hold LMB while looking at a gnome" is still true.
- `docs/PLAN.md`: controls table (LMB, RMB) and the Movement shop line.

Ladder: shelf 2 throughout. The swarm reuses `gnomes.hold/drop`, `coneTarget`, `grabbable` and the existing spring, now as one `pull()` shared by hands and gun. New code exists only for the swarm loop and the slip rule.

Deviations from the plan:
- The slip "lag" is measured from the ball (distance to the ball centre minus the ball radius), not from the gnome's own spot. Reason: with the per-spot lag, gnomes shoving each other in the ball pushed massive gnomes about 1 m off their spot. All massive gnomes fell off while the player stood still (first run: 13 of 13 dropped, ball shrank from 7 to 3).
- A slipped gnome gets `noGrabUntil = now + 1 s`. Without it, the gun catches it again within 0.08 s while LMB is held, so slipping would be invisible.
- Magnet Coil also raises the pull acceleration (+15% per level), for hands and gun. This is the "stronger grip" from the plan and keeps the old "snappier" feel.
- `menu.ts`, the help line in `hud.ts` and `style.css` are outside the plan's file list. They contained the replaced rule ("Heavy gnomes need a stronger magnet", the TOO HEAVY style), so the change touches them.

Rejected: none.

Uncertain:
- When a mixed swarm is thrown, the gnomes still overlap in the ball for the first physics step. At release a 0.5 kg gnome has 30-33 m/s. After one frame some tiny gnomes have only 11-15 m/s, because they hit the heavier ones next to them. This is real physics, not the formula. If PP sees tiny gnomes flying short after a mixed throw, this is the reason.
- Another agent changed `src/entities/machines.ts` (conveyor, note `2026-10-19-conveyor.md`, all lines PASS) during this task. The regression runs and the release build include that change.

## Work progress

Scenario `<scratchpad>/smoke/scenario-magnet-gun.js`, run `CDP_PORT=9361 MAXPOLL=1800 node smoke.mjs run-mg scenario-magnet-gun.js`. The scenario starts with `upgrades = {}` because the Chrome profile keeps the save of earlier runs. One earlier run started with `magGun: 1` from that save, so test 1 measured a swarm. Two runs hung because Vite reloaded the page after the other agent's edit to `machines.ts`; both were rerun.

Final run:
`{"1_no_gun_massive_lifts":{"mass":3,"heldByHand":true,"y":1.27,"roseAbove1At":0.25,"lost":null},"2_no_gun_only_one":{"maxHeld":1,"swarm":0},"3a_gun_coil0":{"held":6,"swarm":6,"cap":6,"hud":"MAGNET GUN 6/6"},"3b_gun_coil2":{"held":12,"swarm":12,"cap":12,"hud":"MAGNET GUN 12/12"},"4_slip_on_turn":{"tinyHeld":15,"massiveHeld":11,"tinySlipped":2,"massiveSlipped":11},"5_throw_swarm":{"held":4,"states":["ragdoll"],"swarmAfter":0,"tinyAtRelease":[32.26,33.15,29.68],"massiveAtRelease":[5.13],...},"6_shop_buy":{"hasMagnetGun":true,"magGun":1,"money":700},"7a_crate_no_gun":{"heldCrate":true,"y":1.27,"hud":"MAGNET · Crate 0/12"},"7b_crate_with_gun":{"heldCrate":true,"swarm":0,"y":1.27,"hud":"MAGNET · Crate 0/12"},"8_combo_freeze_swarm":5}`, `LOGS:` empty.

- [PASS] 1 — 3 kg gnome by hand above y 1.0 after 0.25 s, at y 1.27 after 3 s, still in hand.
- [PASS] 2 — 6 gnomes in front, LMB 3 s without the gun: at most 1 held at any frame.
- [PASS] 3 — Coil 0: 6 held (cap 6); Coil 2 with 15 gnomes: 12 held (cap 12). HUD shows `MAGNET GUN 6/6` / `12/12`.
- [PASS] 4 — 3 trials, Coil 2: 0.5 kg slipped 2 of 15, 3 kg slipped 11 of 11 during the 180° turn in 0.5 s. A diagnostic run showed the heavy gnomes fall first (0.15-0.25 s into the turn) and a tiny one only at 0.5 s.
- [PASS] 5 — all thrown gnomes `ragdoll`, swarm empty; speed right after the impulse: 0.5 kg 29.7-33.2 m/s (J/m = 30.4), 3 kg 5.13 m/s (J/m = 5.07). An earlier run: 0.5 kg 28.9-31.3, 3 kg 4.93.
- [PASS] 6 — Movement tab lists "Magnet Gun"; BUY → `upgrades.magGun = 1`, money 1000 → 700.
- [PASS] 7 — crate held by hand without and with the gun (`heldCrate: true`, swarm 0, crate at y 1.27), HUD `MAGNET · Crate 0/12`.
- [PASS] 8 — `LOGS:` empty in the Magnet Gun run and in all 9 regression runs.
- Extra: a swarm keeps the combo (combo 5 still 5 after 2 s).
- Screenshot `run-mg/mg-swarm.png`: 6 gnomes in a ball, beam to the centre, panel `MAGNET GUN 6/6 · 6 gnomes · worth $6`.

Regression (fresh profiles, `mgreg/`), all with `LOGS:` empty:
- `scenario-polish-A.js`: drop impact dust 1 at 0.83 s, squash 0.15, magnet struggle bubble + wiggle, 1 scream at 15.46 m/s, statue hop 0.44 → 0.65. Same as the polish-a note.
- `scenario-polish-b.js`: rim 1.114 → 1 at 0.2 s, 0 coins inside the hole at levels 1/6/12, shockwave moved all ≥ 1 m, swirl `ffffff` vs `e5cbff`, rays on/off. Same as the note.
- `scenario-polish-c.js`: arrow/marker `11 m`, afford row and badge, 0 locked rows with afford, magnet panel with a 2 kg gnome `heavy` + `$1.6`, help toggles.
- `scenario15.js`: fan ratio 0.92, massive lifts at base (y 1.27), beam and arc, green arc → eaten 1, crate with 10 inside lifts (y 1.27), rain only specials, hoop bullseye true, parade 16 via the factory. The old `tooHeavy` field is gone from the output (getter removed).
- `scenario13.js`: shop tools at level 1, hole moves (4.8 m), eats only at the new place, player falls in, placement, RMB rotates the tool, blocked over the hole and when overlapping, G moves a machine.
- `scenario12.js`: crate caught 8/8, held (y 1.27) with 8 inside.
- `scenario10.js`:
  - `3_massive_drags` now lifts (y 1.27, no TOO HEAVY). This is the intended change from the plan; the scenario was not edited.
  - Hand lift, one at a time, release, combo freeze, king not grabbable, crate, auto release when far: as before.
  - The shop list contains "Magnet Gun".
  - Some numbers differ from the arcade note: throw 12.51 / 7.54 / charged 22.57, kick ratio 0.39, bullseye 0, no `tiny` key in tier odds. These come from earlier rounds: 1.2 kg normal gnomes, the vertical hoop that needs a crossing, the tiny class. This change did not touch the throw formula; J/m = 15 x 1.0145 / 1.2 = 12.7.
- `scenario1.js`: full run to level 12, no exceptions.
- `scenario8.js`: loop keeps running, greedy and shadow gone.

Build and release:
- `npx tsc --noEmit` → no output, exit 0.
- `npm run build` → ok (only the existing chunk-size warning).
- `npx vite build --outDir release --emptyOutDir` → `release/assets/index-CTfOIWX1.js`.
- `curl http://192.168.0.38:5300/` → serves `assets/index-CTfOIWX1.js`, which contains "Magnet Gun".

Self-check:
- Rapier and removed gnomes: no body change inside a Rapier query callback. The swarm loop calls `drop()` from a plain loop. Swarm entries whose gnome is no longer `held` (for example falling into the hole) are removed before their body is touched, and `release`/`throwHeld` skip them through `heldGnomes()`.
- Every reader of `player.held` (hud, hole, machines, player rays) was checked. The two readers of `tooHeavy`/`magnetPower` (hud) were removed.
