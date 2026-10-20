# Cleaning robots, tool wheel, leaf blower (2026-10-20)

Plan: `docs/ai-work/2026-10-20-plan-robots-wheel-blower.md`, all 16 steps (C robots 1-6, B tool wheel 7-11, A leaf blower 12-16), final with the "Orchestrator decisions" block. Two extra items from the orchestrator: Magnet Gun reach grows with Magnet Coil, and the tractor side-push question.

Interpretation (1-3 sentences): build exactly the plan; the code changed after it was written, so C cycles hands → tractor → blower (owned only, the Push Broom is gone), and Keep Tools / level-up rules are whatever `hole.ts` does tonight (another agent owns it). Robots are `Machine`s of type `robot`; the wheel is a new `ToolWheel` on the player; the blower is a third gear of the `Sweeper`.

## Gotowe, gdy

The plan's "Done when" list (C1-C22, B1-B8, A1-A9 = 39 lines) plus:
- Magnet Gun: with Coil 0 a gnome 8.5 m away is not pulled, with Coil 5 it is.
- Tractor side push: a test says why a normal gnome beside the strafing tractor moved 0.04 m tonight vs 0.66 m in the broom note; fix if regression, else explain.

## Problem

PP (Slack 2026-10-20): "Dodaj dmuchawę jako narzędzie i może koło wyboru narzędzi jak z GTA V. I niech doda jeszcze roboty sprzątające, które w jakimś obszarze zbierają krasnale na pakę i kiprują do dziury", "niech nie będą super drogie". Plus "Magnet Gun mógłby mieć większy zasięg na odległość z każdym levelem" (Magnet Coil).

## Summary

### C: Cleaning Robot (`src/entities/robots.ts` new, `machines.ts`, `upgrades.ts`, `hud.ts`, `shop.ts`, `models.ts`)
- A robot is a `Machine` of type `robot`: placement ghost, BLOCKED rules, X, G, save/restore, hotbar and available counts come from `Machines`. `m.pos` is the home post (saved); the truck is a dynamic body (dominance 1, rotations locked, mass 150, no friction against the ground so its speed is exact).
- State machine: idle → seek → pick → (seek …) → drive → tip → return → idle. Nearest free non-King gnome inside the area around the post; the scoop picks a gnome within 1.1 m of a point 0.9 m in front of the truck; the gnome is stashed (puff + thud on the contact frame) and shown as hats in the bed; flags cleared (`thrownBy = 'machine'`, no trick shot later). Full bed, or cargo and 4 s without a target → drive to the live hole centre, stop at hole radius + 1.3, face the hole, tip: bed dips (-0.08 rad), rises to 1.05 rad (`outCubic`, 0.3 s), the whole load goes to `hole.consume` on the frame the rise ends, the bed drops back with `outBack` (0.4 s) → return to the post.
- Steering without pathfinding: heading `damp`ed to the waypoint, turn in place above 1.2 rad error; hole guard removes velocity towards the hole once the next step would come within 1 m of the edge; waypoints clamped inside the fence; stuck (< 0.3 m in 1.5 s) → 3 m sidestep to a random side; a target that caused two sidesteps is skipped for this trip; the player within 2.5 m in front → wait.
- Fell into the hole / out of the yard → back at the post with the cargo. Broken by a saboteur → stands still (velocity 0), resumes after repair. X → cargo drops at the post, robot back in the inventory, post removed. G → move with the area ring on the ghost.
- Home post: a thin post with a teal ball and a faint ring of the work-area radius (scales with Wider Area).
- Not in the plan, needed because of tonight's `hole.ts`: level-ups no longer remove tools under the new hole; tools near the rim glide, and the `carry` code skips robots on purpose. So the robot itself moves its post out when the hole covers it (post goes to hole radius + 1.6 m on the same bearing), and an idle truck that is more than 1 m from its post drives back to it. Without this a post inside the hole would leave the truck circling the guard forever.
- 11th tool: no digit key. Hotbar slot shows no number; the buy toast says "Open the tool wheel (hold Tab) to place it."; digit keys are limited to 10. Side effect: buying Bigger Crate no longer says "Press 0 to place it" (old bug: `indexOf` -1 → key 0); every non-placeable Tools upgrade gets no placement toast now.

### B: Tool wheel (`src/player/wheel.ts` new, `player.ts`, `main.ts`, `hud.ts`, `style.css`)
- Hold Tab: wheel opens (CSS pop 0.15 s), items = Hands (🧲 icon with the Magnet Gun) + owned gears (tractor, blower) + owned placeable tools with `free/owned`; sold-out tools greyed. Mouse moves a virtual cursor (clamped 140 px, 24 px dead zone); slice 0 at the top, clockwise, each slice centred on its icon. Camera frozen while open. Release Tab: gear → `setGear` (Hands while placing also cancels the placement), tool → `selectTool` (its sold-out toast), the tool already being placed is left alone.
- Game speed while open: `damp` to 0.25, back to 1 after release (lambda 16, snaps to 1 above 0.99), on real frame time. Unlock or pause closes it without a choice and restores speed at once.
- Tab no longer opens the shop (B, and E at the desk, still do).
- `main.ts` (owned by the contracts/slowmo agents too): the line `const dt = …` became `const realDt = …;` + `const dt = realDt * ctx.player.wheel.slow(realDt);`. The slowmo agent later appended `* ctx.slowmo.scale` and switched a few timers to `realDt`; both scales multiply.

### A: Leaf Blower (`sweeper.ts`, `models.ts`, `upgrades.ts`, `shop.ts`, `hud.ts`, `player.ts`)
- Gear `blower`, C cycles hands → tractor → blower (owned only), none owned → toast "Buy the Plow Tractor or the Leaf Blower in the shop (Movement).". View model bottom right (slides in 0.2 s with `outCubic`, sways with walking, trembles and tips up while blowing).
- LMB held: every free non-King gnome in a 25° cone along the view within range is ragdolled, trick flags cleared, pushed with `60 m/s² x (1 + 0.25 x Turbo Fan) x (1 - 0.6 x d / range)` along the view (never downwards) + 0.3 lift, same for every weight; whoosh every 0.35 s, wind particles. LMB does not grab with the blower; the Magnet Gun hides.
- HUD line `BLOWER · 6.0 m (C)`.

### Magnet Gun reach
- `Player.magReach = 7 + 1.2 x Magnet Dish + 0.6 x Magnet Coil` (Coil only with the Magnet Gun, its description says it needs the gun), used for the beam, the aim cone and the slip distance. Coil description and shop preview (`now: 0.8 m ball, 7.0 m reach`) updated.

### Prices and reasoning (orchestrator decision 8 a, PP "niech nie będą super drogie")
- Cleaning Robot $400 x1.6 (400, 640, 1024, 1638), max 4, hole level 2. One robot clears about one gnome per 1-1.5 s near its post in the tests (5 gnomes picked in 4.3 s, trip and tip about 5 s more), so a full bed of 5 at hole 2-3 (x1.5-x2) pays its price within minutes of play; same tier as Conveyor ($250) and Kicking Wheel ($900).
- Bigger Bed $150, Faster Motor $120, Wider Area $150, x1.6, 4 levels each, hole level 2. Full set (4 robots $3702 + all levels $3887) is $7589 (the plan said about $6.4k; recomputed), about one Gnome Cannon ($6000 for the first) and spread over the whole run.
- Leaf Blower $150 (max 1), Turbo Fan $80 x1.6, Long Nozzle $100 x1.6, 4 levels each: below the Magnet Gun ($300) and the Fan ($200).

### Odstępstwa (from the plan)
1. Blower push: plan `45 x (1 - d/range)` along the view direction. Measured: 3 gnomes 3 m ahead moved 1.78 / 1.42 / 1.42 m (A2 needs ≥ 2), and at 7.5 m the plan's tail is 7 m/s², below grass friction (about 14 m/s²), so A5 cannot reach 1 m. Now 60 m/s², falloff to 40 % at the end of the range, and a downward view never presses gnomes into the grass.
2. Wheel speed-up lambda 16 instead of 12, snap to 1 above 0.99: with 12 the speed was 0.993 after 20 frames at 60 fps (B3 needs 1).
3. Slice index rounds to the nearest slice (icons sit on slice centres) instead of `floor`; same result for the plan's B2 check (right = 1 of 4).
4. Bigger Bed / Faster Motor / Wider Area need hole level 2 like the robot (plan gave no level); at hole 1 they would sell upgrades for a robot nobody can buy yet.
5. C13: the plan expected the robot to go back to the inventory when the hole moves under its post. Tonight's `hole.ts` skips robots in `carry` (they stay placed), so the robot moves its own post out (see Summary). C13 now checks: post moved out to radius + 1.6 m, marker follows, truck back at the post, a driving robot targets the new hole centre.
6. Blower view model scaled to 0.5 (first screenshot: it covered a quarter of the view).

### Odrzucone
- Robot engine sound, wheels on the truck, picking up gnomes it bumps on the way, cargo kept in the save, a "ROBOT DUMP" big text: not in the plan (plan "Not built" list, ladder rung 1).
- Grey-out animation on wheel slices, keyboard selection in the wheel: not asked.
- `Math.min(1, dt * 12)` in the tractor push (`sweeper.ts`): older code, untouched (same decision as the scope note).
- Keep Tools does not keep Bigger Bed / Faster Motor / Wider Area after a rebirth: `hole.ts` (not my file) keeps `TOOL_IDS` + `crateSize` only. → separate task for the `hole.ts` owner (one id list).

### Tractor side push (extra item)
Not a regression. Probe `tmp-side-probe.js` (scenario-tractor's king/control setup, strafing 1 s with a normal statue 1.6 m ahead) run three times in one page: 0.041 m, 0.669 m, 0.043 m. The plow touches the gnome in exactly 3 frames in every run (same `setLinvel` count, same first velocities 0.45 → 0.54 → 0.63 m/s); what differs is which way the toppled statue falls afterwards: in the 0.04 m runs it slides 0.15 m forward and rocks back, in the 0.66 m run it falls forward and slides. Ground friction 0 on the gnome gave 0.044 m too, and statues do not run the flee code. So the number is a coin flip of a 3-frame brush; the 0.66 m in the broom note was one side of it. Driving forward pushes as before (21.7 m in `scenario-tractor.js`).

## Work progress

Scenarios in `<scratchpad>/smoke/`: `scenario-robots.js` (C1-C8, C10, C15, C16, C20 + screenshots), `scenario-robots2.js` (C9, C11-C14, C17-C19), `scenario-robots-rebirth.js` (C21, `tmp-reb0.js` / `tmp-reb1.js`), `scenario-wheel.js` (B1-B8), `scenario-blower.js` (A1-A9 + Magnet Gun reach), `tmp-side-probe.js`. Robot/wheel/blower scenarios skip rendering between screenshots (`renderer.render` swapped for a no-op), so they run at 60 fps game time.

Final runs (all `LOGS:` empty, no exceptions): `final-scenario-robots`, `final-scenario-robots2`, `final3-reb0`, `final3-reb1`, `final-scenario-wheel`, `final-scenario-blower`, regressions `final-zz-scenario15-scope`, `final-scenario-tractor`, `final-scenario-magnet-gun`.

Kompletność:
- [PASS] C1 — robot at (8,8), awake gnome at (10,8) → picked after 0.75 s: `queue 1`, gnome `stashed`, 1 hat; pick curve `0, -0.04, -0.1, 0.07 … 0.3, 0.2 … -0.03, 0` (dip, flick, overshoot).
- [PASS] C2 — 5 gnomes within 2.5 m → full in 4.25 s, drive 3.98 s, tip; coin value paid 5.75 (≥ 5), combo 0 → 5, queue 0; min hole distance 2.88 m ≥ R + 1.0 = 2.6; tip curve `0, -0.04, -0.08, 0.1 … 1.05, 0.86, 0.53, 0.11, -0.1 … 0` (39 samples). Screenshots `run-rob4/c-robot-loaded.png` (hats in the bed, post) and `c-robot-tip-peak.png` (bed raised over the hole), checked by eye.
- [PASS] C3 — back at the post 3.38 s after the tip: `idle`, 0.56 m from the post.
- [PASS] C4 — 2 gnomes, cap 5 → `drive` 4.23 s after the second pick.
- [PASS] C5 — no gnomes, 10 s → moved 0, `idle`.
- [PASS] C6 — King 2 m from the post, 10 s → queue 0.
- [PASS] C7 — gnome stashed in a crate in the area → robot queue 0, crate keeps it.
- [PASS] C8 — thrown gnome picked → `throwPos null, thrownBy machine, bounced false`; after the dump no big text at all.
- [PASS] C9 — Metal Panel across the path, 60 s → 1 full trip (`return` after `tip`), 5 eaten, min hole distance 2.86 ≥ 2.6, no exception.
- [PASS] C10 — player 2 m in front → max speed 0 for 60 frames; player gone → 2.5 m/s.
- [PASS] C11 — X with 3 in the bed (`lookAt` = the truck) → no robot, 3 gnomes `ragdoll` 0.08-0.09 m from the post, available 4 of 4, marker gone, toast "Cleaning Robot back in your inventory.".
- [PASS] C12 — G → placing `robot`, ghost ring radius 6, placed at (-8, 0.02, 8.69) (aimed at (-8, 8)), `idle`, no `drop` ring on the placed robot, its cargo dropped.
- [PASS with Odstępstwo 5] C13 — level-up: post 2.0 m from the new centre (radius 2) → moved out to 3.6 m, marker on it, truck back at the post (`idle`, min 1.83 m while leaving the rim); a driving robot's waypoint = new hole (0.6, 1.04).
- [PASS] C14 — serialize → clear → restore (what boot does) with 3 in the bed: one robot at (8, 8), queue 0, `idle`.
- [PASS] C15 — Bigger Bed 2 → cap 11; Faster Motor 2 → 3.7 m/s measured over 1 s; Wider Area 2 → gnome at 9 m picked, at 11 m still a statue; shop "now: 5 gnomes, next: 8 gnomes", "now: 2.5 m/s, next: 3.1 m/s", "now: 6 m area, next: 8 m area".
- [PASS] C16 — broken → speed 0 on all 10 frames; repaired → 2.5 m/s.
- [PASS] C17 — 4 robots → row shows MAX, no BUY button.
- [PASS] C18 — hotbar robot slot `k = ""`, buy toast "Cleaning Robot bought! Open the tool wheel (hold Tab) to place it.", `selectTool('robot')` → placing `robot`.
- [PASS] C19 — ghost over the hole `blocked true`, at (8,8) `false`, ring `drop` outer radius 6; placed robot has no `drop`, marker in the scene. Screenshot `run-rob5`/`final-scenario-robots2/c-robot-ghost.png`.
- [PASS] C20 — truck set to y -3 → next frames at the post (0 m), queue 1 kept, `drive`.
- [PASS] C21 — real rebirth + reload: Keep Tools 0 → `placed []`, no robot; Keep Tools 1 → `placed ["robot"]`, robot at (8, 8) `idle`.
- [PASS] C22 — `npx tsc --noEmit` → exit 0; regressions below.
- [PASS] B1 — Tab held: open, items `hands, tractor, box, fan`, time scale 0.318 → 0.25, yaw change 0 after 50 px.
- [PASS] B2 — 100 px right → index 1 of 4 (tractor); +10 px → 1; back inside the dead zone → 1. Screenshot `run-wheel2/b-wheel-open.png` (4 slices, tractor highlighted, "Plow Tractor" in the centre), checked by eye.
- [PASS] B3 — release on fan → placing `fan`, ghost in the scene, time scale 1 at frame 20 (`0.57, 0.89, 0.95, 0.98, 0.99, 1`).
- [PASS] B4 — release on a sold-out crate (0/1, greyed) → toast "All your Wooden Crates are placed. X picks one up.", placing null.
- [PASS] B5 — release on tractor → gear `tractor`; placing fan, release on Hands → placing null, gear hands.
- [PASS] B6 — Tab with the shop open → wheel closed; Tab alone → shop stays closed (wheel opens); B → shop opens.
- [PASS] B7 — unlock while open → closed, time scale 1, placing `fan` unchanged.
- [PASS] B8 — nothing owned → one item `hands`, release → gear hands.
- [PASS] A1 — C → `blower`, view model visible, HUD `BLOWER · 6.0 m (C)`, C → hands; with the tractor: `tractor, blower, hands, tractor`; nothing owned: toast "Buy the Plow Tractor or the Leaf Blower in the shop (Movement).".
- [PASS] A2 — 3 gnomes 3 m ahead (lateral 0, ±1) → 6.39 / 6.12 / 5.95 m further away.
- [PASS] A3 — ±2.5 m lateral and 10 m ahead → moved 0 / 0 / 0 m.
- [PASS] A4 — Turbo Fan 0: 6.26 m, level 2: 10.32 m → 1.65x.
- [PASS] A5 — gnome 7.5 m: Long Nozzle 0 → 0 m, level 2 → 2.64 m.
- [PASS] A6 — King 2.5 m ahead, 2 s → 0 m.
- [PASS] A7 — LMB with the blower on a gnome → held null, swarm 0, Magnet Gun hidden.
- [PASS] A8 — gnome with `throwPos` blown → `throwPos null`, eaten 1, no big text. Screenshot `final-scenario-blower/a-blower-blowing.png`.
- [PASS] A9 — shop row "Leaf Blower … $150", bought → `blower 1`, money 500 → 350, HUD `BLOWER · 6.0 m (C)`.
- [PASS] Magnet Gun reach — gnome 8.5 m away: Coil 0 (reach 7.0) → still a statue; Coil 5 (reach 10.0) → `held`, pulled to 2.97 m.
- [PASS] Tractor side push — explained, not a regression (section above); `scenario-tractor` control 0.05 m tonight, same coin flip.

Regression: `zz-scenario15-scope.js` → fan ratio 0.99, arc green at 0.05 and eaten 1, crate 10 inside, hoop bullseye true, parade 16/16; `scenario-tractor.js` → King 0, plow 2.6 m pushes the middle three 21.7 m and not ±1.6, Wider Plow pushes all 5, normal/massive 17.13/17.24, C without tractor shows the new toast; `scenario-magnet-gun.js` → every step as before (Coil 5 ball holds 70 of 120, now with 10 m reach). All `LOGS:` empty. `npx tsc --noEmit` → exit 0.

Self-check: changed only owned files (`robots.ts`, `wheel.ts` new; `machines.ts` robot lines only; `player.ts`, `sweeper.ts`, `upgrades.ts`, `hud.ts`, `shop.ts`, `style.css`, `models.ts` robot/blower functions appended at the end; `main.ts` one line became two; `docs/PLAN.md`; this note). `context.ts` needed no field. No new `Math.min(1, dt`. Animations: pick and tip use `inQuad`/`outCubic`/`outBack` with anticipation and overshoot, sampled over 21 and 39 frames; wheel pop is a CSS overshoot curve; no runtime lights; no body changed inside a Rapier callback (the blower and robot scans collect first).
