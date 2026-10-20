# 2026-10-20 Gnomenado event (card M, plan-night-features 2.2)

Interpretation: a new random event `gnomenado` (hole level 3+, weight 1.5 like wind/quake/uprising, 20 s). A tornado mesh walks a gentle curve that passes within ~2 m of the hole, lifts free gnomes within 3.5 m of its axis, spins them at 4-7 m and drops them; near the hole it throws them ballistically at the hole. Player-thrown gnomes keep `thrownBy`/`throwPos`/`touchedGround`, so the hole's existing AIR rule pays when they land without touching the ground. Kings and held/stashed/falling gnomes are skipped. Orchestrator spec (night task) is the plan; files owned: `src/systems/events.ts`, new `src/systems/tornado.ts`.

## Gotowe, gdy

1. `events.start('gnomenado')` → banner shows "GNOMENADO!".
2. 8 gnomes placed on its path → at least 3 rise above 3 m within 5 s.
3. After the event → every gnome is back on the ground or eaten, tornado mesh hidden.
4. Hole on the path → at least 1 gnome eaten by the hole during the event.
5. While it runs → draw calls +≤ 2, triangles +≤ 3k (`URL_QUERY=''`).
6. No exceptions in the scenario logs; regression `zz-scenario15-scope.js`, `scenario-wiring.js` unchanged.
7. `npx tsc --noEmit` → no output.
8. One screenshot checked by eye.

## Summary

Ladder: rung 6 (new code) for the tornado itself; reused `isFree`, `ragdoll`, `fx.puff/dust/shake`, `audio.rumble/whoosh`, `ease.outBack/inQuad`, the hole's falling/AIR logic. Only new asset is a small canvas streak texture (no download).

## Work progress

- `src/systems/tornado.ts` (new): `Tornado` class. Mesh = one group with two open funnels (24 and 16 segments, 4 rows), shared look via a canvas streak texture, `MeshBasicMaterial` transparent, `DoubleSide` with `forceSinglePass` (without it three.js draws a transparent double-sided mesh twice: first run measured +4 calls). Created on the first start, hidden when idle. Grows in with `outBack` over 0.3 s, shrinks out with `inQuad`; spin speed is damped (rule 7). Path: quadratic curve, midpoint 0.5-2 m beside the hole, bend 3-5 m, clamped to the yard. Grab: free, non-king gnomes within 3.5 m of the axis and below 9 m, max 12 at a time, collected first, then ragdolled (without `by`, so throw flags stay). Riders steer to an orbit point (radius 1.2-2.6 m, height 4-7 m, climb capped at 6 m/s) and are dropped after 2-3.5 s; when the tornado is within hole radius + 5 m they are thrown ballistically at the hole centre (x1.06 for damping, like the factory). A dropped gnome is not re-caught for 2 s. Dust at the base, `audio.rumble(3)` at start, `audio.whoosh()` within 20 m, soft shake pulses within 6 m.
- `src/systems/events.ts`: row `gnomenado` (weight 1.5, hole level 3+, sub text), `case 'gnomenado'`, `tornado.update(dt)` after the UFO.

### Checks (scenario `scratchpad/smoke/scenario-gnomenado.js`, `URL_QUERY=''`, CDP 9391)

- [PASS] 1 banner — `banner: "GNOMENADO!"`.
- [PASS] 2 lift — `above3: 8` of 8, max heights 5.16-6.75 m within 5 s.
- [PASS] 3 after — `meshVisible: false, active: false, rides: 0, airborne: 0` (7 left at y 0.19-1.39, 10 eaten).
- [PASS] 4 hole pass — `eatenDuringEvent: 10`; the player-thrown gnome was eaten with `air: true` (thrownBy player, touchedGround false while riding).
- [PASS] 5 cost — `dCalls: 2, dTri: 320` (visible vs hidden in the same run).
- [PASS] 6 no exceptions (LOGS empty); `scenario-wiring.js` result identical to `final3-wiring.txt`; `zz-scenario15-scope.js` identical to the earlier run except the random rain mix.
- [PASS] 7 `npx tsc --noEmit` → exit 0, no output.
- [PASS] 8 screenshot `gn3/gnomenado-look.png`: pale streaked funnel, gnomes circling at mid height, dust at the base.
- Grow curve (rule 3/12): scale 0.62, 0.96, 1.02, 1.06, 1.10, 1.05, 1, 1 (overshoot then settles).

### Rejected

- Save/restore of a running tornado across reload: the UFO is not saved either; the event just ends.
- Statue gnomes the tornado drops stay lying (ragdoll, not awake): same as rain and quake today.
