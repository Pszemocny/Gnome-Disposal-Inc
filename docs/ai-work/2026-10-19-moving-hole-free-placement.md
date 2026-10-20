# Moving hole, changing yard, free tool placement (PP, 2026-10-19)

## Problem

PP: every level should change the landscape a bit and move the hole further away so difficulty grows. Trampoline, conveyor and fan must be buyable on the first levels after a few hundred dollars. Placed objects should be freely rotatable (e.g. holding RMB) and placeable, with the position blocked when it touches something such as the ground.

## Summary

- Hole centre `env.hole` moves 1.2 m per level away from the gnome factory (`Environment.holeCenterFor`), level 12 at (6.6, 11.4). Every place that assumed the hole at (0,0) now uses `env.hole` / `env.holeDist` (gnomes, hole scoring and ring, coins origin, events quake/burp/UFO/parade, magnet, cannon, crate dump, props, mushrooms, player fall, placement). Ground physics slabs and the grass cut-out follow the centre.
- On level up, machines standing where the hole moved go back to the inventory.
- Each level from 2 adds up to 3 seeded obstacles (rocks, hedges) away from the hole's whole path, the factory, its landing spot, the PC and the player start; same places after a reload. Grass tint drifts from green to late-summer yellow.
- Trampoline $100, fan $200, conveyor $250, all from hole level 1.
- Placement: the tool floats where you look (wheel = distance), rests on the surface the crosshair hits (pushed out along the surface normal by its rotated extent), hold RMB + mouse rotates it freely, R turns 45°, T tilts 15°, V resets, Q cancels. Red + BLOCKED when its box overlaps anything solid, sits in the hole or leaves the yard. G picks up a placed tool and moves it with its rotation. Saves store the full quaternion (old saves still load from yaw/tilt).
- Machines now act along their own axes: tilted fan blows up, tilted conveyor is a ramp, trampoline launches along its normal, kicking wheel kicks along its own forward/up.

## Work progress

- [x] implementation, `tsc` clean
- [x] scenario13: hole moved 4.8 m at level 5, eats only at the new place, 12 obstacles, player falls into the new hole, tool placed flat on the ground (y 0.02), RMB turns the tool 81° while the camera stays, blocked over the hole, G moves a machine
- [x] regression: scenario10 (magnet/throws/tricks/crate), scenario12 (factory → crate 8/8), scenario1 (all content to level 12), scenario8 (greedy escape) without errors
- [x] release build on 5300
- Test scripts got a shim for the new `machines.place(type, pos, quaternion)` signature.
