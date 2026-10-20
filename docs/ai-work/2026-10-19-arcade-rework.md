# Arcade rework (PP, 2026-10-19)

## Problem

PP: make the game more arcade-like (skill-based). Add weight to gnomes, weight differs by level. Remove carrying more than one gnome; instead a magnet that obeys physics, upgrades make it wider and stronger. Add variety, think it through.

## Summary

Plan: `docs/ai-work/2026-10-19-plan-arcade.md` (plan-author on Fable) with PP decisions at the bottom.

- Magnet (hold LMB): one body at a time, critically damped spring force capped at `45 x (1 + 0.2 x Magnet Coil)`; anything heavier than power/20 drags on the ground. Magnet Dish widens range and cone. Strong Arms and Gnome Vac removed (no refund).
- Throw (RMB): fixed impulse, so heavy gnomes fly shorter; Wind-up upgrade ($300, PP) charges up to x1.8.
- Weight tiers rolled per spawn from the hole level; money AND XP scale with the tier (PP).
- Trick shots: LONG SHOT, SNIPER, AIR, TRICK (trampoline), BULLSEYE ring, HEAVY HAUL label. Combo does not run out while a gnome hangs on the magnet.
- OVERTIME event: factory runs on its own for 20 s, everything eaten is worth x1.5.
- Crate: Bigger Crate upgrade (+6 per level), out-of-yard crate returns next to the shop PC, kick hit all five crate colliders (5x impulse) → now each body is kicked once and the crate gets a softer kick.
- Machines pay full value (PP).
- Bug fixed: a gnome dragged into the hole while on the magnet disappeared without pay.

## Work progress

- [x] plan v0 (plan-author, Fable)
- [x] PP decisions (crate stays + capacity upgrade + respawn by the PC; machines full value; Wind-up as $300 upgrade; heavy = more money and XP)
- [x] implementation
- [x] headless scenario `scenario10.js`: 22 checks pass (lift normal/heavy, massive drags, Coil 3 lifts massive, one at a time, release, throw speeds 15.0 / 7.5 / charged 27.1 m/s, LONG+AIR, BULLSEYE, HEAVY HAUL x2.5, tier odds L1/L12, dragged into hole pays, kick ratio 0.27, crate drag/lift/respawn by PC, crate kick 6 m/s, king not grabbable, combo freeze, OVERTIME 2 gnomes/s, shop without removed upgrades, auto release when far)
- [x] regression scenarios 1, 3, 8 without errors
- [x] release build on 5300
- [x] GUSTY WIND event (hole level 3+): 30 s side wind only on airborne player throws, HUD arrow relative to the view; scenario11: airborne gnome drifts (vx 2.7 after 10 frames), gnome on the ground does not move.
- [x] PP follow-up: crate must be liftable → crate mass 5 → 1.5 kg (base magnet lifts 2.25); armchair spawns at a random spot away from hole/factory/PC (new spot after each respawn); factory shoots every gnome ballistically onto one marked spot 6.5 m in front of it (orange ring), so a crate placed there catches them. scenario12: crate caught 8/8 at factory pace, lifted with 8 inside (y 1.2), chair 22-24 m from the factory; scenario10 regression still passes. Factory lost its metal texture (made it almost black).
- Rejected by the planner (reasons in the plan): juggling (conflicts with the 1.5 s no-regrab rule), moving hole (rebuilds ground bodies; the ring is the moving target), chain strikes and bank shots off panels (need Rapier contact events in the loop).
