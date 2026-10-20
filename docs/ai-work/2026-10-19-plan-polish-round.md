# Polish round: game feel (PP, 2026-10-19)

## Problem

PP after playtesting: "pomyśl jeszcze co można poprawić bo jest słabo" (think what else to improve, it is weak), then: launch several implementers on Opus in parallel; the orchestrator designs the improvements, the implementers build them.

Already done by the orchestrator in this round (not part of the packages): fan pushes every gnome the same (mass-independent, 28 m/s² near the fan), magnet lifts 4.5 kg at the start, crate always liftable, gnomes and props have dominance so gnomes cannot push the crate or props, only the factory makes ordinary gnomes (no starting statues, rain drops only special types, parade recruits/produces via factory), vertical bullseye hoop 2.5 m off the hole edge at 1.5 m height, magnet beam and throw-trajectory preview, fixed weight classes 0.5 / 0.8 / 1.2 / 2 / 3 kg (`WEIGHT_TIERS` in `src/data/gnomeTypes.ts`).

## Plan (plan-senior, final)

Written by the orchestrator at PP's explicit request ("ty wymyślaj poprawki a implementery niech robią"); this replaces the plan-team round for this polish pass. Three packages, run in parallel. **Each package owns its files exclusively; do not edit any other file.** If a package needs something from a file it does not own, it reads it and uses the existing public API (`ctx.*`), never edits it.

Shared rules (all packages):
- Read `CLAUDE.md` (rules learned the hard way: never mutate Rapier bodies inside query callbacks; never touch a removed gnome's body; no runtime lights, use glow sprites).
- Match the surrounding code style (TypeScript, short comments in English, no new dependencies, no assets to download; sounds are synthesised in `src/core/audio.ts`).
- `npx tsc --noEmit` must be clean for your files at the end (other packages edit in parallel; if tsc fails only in files you do not own, report it, do not fix it).
- Verify with a headless scenario (see "Tests" below), dev server `http://localhost:5199` (already running, hot reload). Do NOT build `release/` and do NOT touch port 5300.
- Write a short note `docs/ai-work/2026-10-19-polish-<package>.md` (Problem / Summary / Work progress) — your own file only.

### Package A — impact and gnome feel
Files (exclusive): `src/entities/gnomes.ts`, `src/core/audio.ts`, `src/systems/fx.ts`.
1. Landing impact: a thrown or dropped gnome (state `ragdoll`) that hits the ground or a machine with a vertical speed drop > 5 m/s (compare `linvel().y` between frames; keep the previous value on the gnome) gets: a dust puff at the contact point (new `fx.dust(pos, strength)`: 6-12 brownish puffs spreading sideways), a `thud` scaled by impact speed (new `audio.impact(strength)`: low sine + short noise, pitch lower for heavier `g.body.mass()`), and a squash on the instance for 0.15 s (scale y x0.7, xz x1.2, eased back) — add a `squash` timer field to `Gnome`, apply it in `writeInstances`.
2. Struggle on the magnet: while `state === 'held'`, gnomes wiggle visually (small sinusoidal roll in `writeInstances`, 8 Hz, ±0.25 rad around the gnome's up axis) and every 1.5-3 s say a struggle line (`'Let go!'`, `'Nooo!'`, `'I can see my house!'`, `'Put me DOWN!'`) through the existing `say()`.
3. Throw scream: when a gnome flies faster than 10 m/s after a player throw, play `audio.voice('scream')` once per throw (flag on the gnome, reset on landing), pitch by mass (lighter = higher).
4. Statues that wake up do a little hop (`applyImpulse` up 3 x mass) and a puff.
Done when:
- drop a 1.2 kg gnome from 4 m → within 2 s `fx` emitted dust (expose a counter `fx.stats.dust` or similar) and the gnome's `squash` went > 0
- hold a gnome on the magnet for 3 s → at least one HUD speech bubble exists (`.bubble` element) and the instance matrix differs between two frames while the body is still
- throw a gnome at 15 m/s → `audio.voice` was called with `'scream'` exactly once for that throw (wrap/count in the scenario)

### Package B — hole spectacle and coins
Files (exclusive): `src/systems/hole.ts`, `src/world/environment.ts`, `src/entities/coins.ts`.
1. Gulp: each eaten gnome makes the hole rim pulse (rim mesh scale 1 → 1.12 → 1 over 0.25 s) and the swirl spin faster for 1 s; at combo ≥ 10 the swirl tints from blue to purple to gold (lerp by combo / 60). Keep a reference to the rim mesh in `Environment` and expose `env.holePulse(strength)`.
2. Coin fountain: coins from the hole fly in a nicer fountain (upwards 9-13 m/s, outward 2-5 m/s, spread around 360°) and land at least `holeRadius + 1` from the centre; coins that would land inside the hole get an extra outward push. Coins within 6 m of the player are pulled to the player with a smooth acceleration (already partly there: `pickupRadius`), and a short rising `coin` chime pitch per coin in a burst (use existing `audio.coin(pitch)`).
3. Level-up shockwave: on level up, an expanding translucent ring on the ground (torus or ring mesh, 0 → 12 m radius in 0.8 s, fading) and every free gnome within 10 m gets a radial push away + up (use `ctx.gnomes.forEachNear` and `applyImpulse` AFTER collecting, not inside a Rapier query).
4. Combo audio/visual: at each combo tier (existing `TIERS`) a coloured light ray burst above the hole (sprites, no lights), 0.6 s.
Done when:
- eat 1 gnome → `env` rim scale > 1.05 within 0.1 s and back to 1 within 0.5 s
- burst coins from the hole 20 times → none of them comes to rest inside `holeRadius` (all coins either collected or resting outside)
- trigger a level up with 10 statues spawned 3-8 m from the hole → each of them moved ≥ 1 m away from the hole within 1 s
- combo 15 → swirl material colour differs from the combo-0 colour

### Package C — guidance and UI
Files (exclusive): `src/ui/hud.ts`, `src/ui/shop.ts`, `src/ui/menu.ts`, `src/ui/style.css`, `src/systems/goals.ts`.
1. Goal waypoint: each goal gets an optional target (`'factory' | 'hole' | 'shop' | 'crate' | null`); the HUD shows an arrow at the screen edge pointing to that target when it is off-screen, and a small floating marker with distance in metres (`12 m`) when on-screen. Positions: `ctx.factory.pos`, `ctx.env.hole`, `ctx.env.deskPos`, first `ctx.machines.list` with type `box`.
2. Shop: rows the player can afford right now get a green left border and an `AFFORD` badge; items unlocked since the shop was last opened get a `NEW` badge (remember the set of unlocked ids in memory per session); show the effect of the next level in the description line ("now: x, next: y" for the numeric upgrades: speed, magPower, throw, magnetRange, value, factorySpeed, comboCap, crateSize).
3. HUD clarity: the magnet panel shows the held gnome's weight class with a coloured badge (tiny/light/normal/heavy/massive) and the money value it would give right now (type value x tier value x `ctx.hole.valueScale` x `ctx.hole.comboMult`); the combo panel shows a shrinking ring around the multiplier instead of the plain bar.
4. Controls help: replace the one-line help with a toggle (`H` key) panel listing controls by context (moving, magnet, tools placement), shown automatically for the first 20 s of a new game.
Done when:
- goal "Make gnomes" active and the player looking away from the factory → an arrow element is visible at the screen edge; looking at the factory → a marker with `m` text is visible
- money ≥ cost of Running Shoes → that shop row has the afford class; a row with `???` (locked) has no afford class
- holding a 2 kg gnome → the magnet panel contains `heavy` and a `$` value
- pressing `H` toggles the help panel visibility

## Tests

Headless scenarios over CDP. Harness: `/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-boozed/844ac005-e3c6-4341-b0ea-34b547159d26/scratchpad/smoke/smoke.mjs`; usage `MAXPOLL=1600 node <harness> <outDir> <scenario.js>`; look at `scenario15.js` in the same folder for the pattern (`window.gnome` is `ctx`, wait on frames, `window.__done = JSON.stringify(out)`). Put your scenario in that folder as `scenario-polish-<package>.js` and your output in `run-polish-<package>`. Each package uses its own Chrome debugging port via `CDP_PORT`: A = 9341, B = 9342, C = 9343 (e.g. `CDP_PORT=9341 MAXPOLL=1600 node ...`). Never use 9333.

## Review focus
- No Rapier mutation inside a query callback; no use of a gnome after `gnomes.remove` / `hole.consume`.
- No new per-frame allocations in hot loops beyond what the surrounding code already does.
- Nothing in these packages changes balance numbers in `src/data`.
