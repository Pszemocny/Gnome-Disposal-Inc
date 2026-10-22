# 2026-10-22 Golden Hour, machine mushrooms, King vs robots and fans

Interpretation: PP ("bez planu"): G7 b with XP 5, G8 a, G9 as described. Gnomes the Golden Hour turned gold (the swap wave and factory gnomes that come out golden while it runs, both marked `goldFrom`) pay x10 and 5 XP; natural golden gnomes keep x100 and 10 XP. A gnome eaten under the FEED_XP rule drops mushrooms at 1/4 chance. Robots never take the King; fans push him 5x weaker.

Gotowe, gdy:
1. G7: `scenario-endgame-boost.js` E21 → `PASS E21`: a retyped golden pays 1/10 of a natural golden (same tier, same combo) and adds 5 XP vs 10.
2. G8: `scenario-endgame-boost.js` E22 → `PASS E22`: 4000 eats via `consume(.., true)` drop about 1/4 of hand throws; lesson still guaranteed on a machine eat.
3. G9 robots: `scenario-fan-funnel.js` F-KING-ROBOT → `PASS`: a robot next to a lone King never targets him in 60 frames.
4. G9 fans: `scenario-fan-funnel.js` F-KING-FAN → `PASS`: King's speed gain in front of a fan is about 1/5 of a classic's.
5. `npx tsc --noEmit -p .` → no output.

## Problem

PP progress log: the Golden Hour mushroom made $107k → $8.5m in one minute and hole levels 10-12 in 10 s each, because every free gnome became a x100 golden gnome and machines eat many gnomes per second, each with a mushroom chance.

## Summary

- G7: `typeValue(g)` in `src/systems/hole.ts` returns `GOLD_HOUR.value` (10) for a gnome with `goldFrom`, else the type value; XP uses `GOLD_HOUR.xp` (5). The HUD "worth" on the magnet panel uses the same `typeValue`. Constants in `src/data/gnomeTypes.ts`. Legend golden card and SPEC say the Golden Hour gold pays a tenth.
- G8: `Hole.consume` names the FEED_XP case `fed` and passes `bonus x 0.25` to `maybeDrop`. The lesson guarantee in `maybeDrop` ignores `bonus`, combo-text mushrooms go through `spawn`, so both stay.
- G9: robots already skip the King (`findGnome`); fan strength x `KING_FAN` (0.2) for the King in `src/entities/machines.ts`.

Assumptions:
1. Gnomes the factory spawns golden during the Golden Hour also carry `goldFrom`, so they also pay x10: they are "turned golden by the Golden Hour" and turn back when it ends.
2. "the same FEED_XP rule": a crate dump and the King keep the full chance (they pay full XP), a gnome that walks in by itself drops at 1/4 (it pays x0.25 XP).

Rejected:
- Leaf Blower, wind, Gnomenado and Magnet on the King: not asked (blower already skips the King per SPEC).
- E19 (Shadow clicks while staring) failed in run 2 with `staring: 0` after PASS in run 1: the click is a 25 % roll per AI tick and the scenario's rerun budget was used; unrelated to these files → separate task if it repeats.

## Work progress

Ladder: the mark already exists (`goldFrom` on the gnome, set by the Golden Hour swap and by spawns during the Golden Hour, gone after the turn-back because the gnome is replaced), so no new flag. The FEED_XP rule is already computed in `Hole.consume`; the drop chance reuses `maybeDrop`'s `bonus` argument. Robots already skip the King in `findGnome` (robots.ts), so G9 robots is a check only. The fan push is `55 * power * falloff * mass` (mass cancels: same acceleration for all), so the King factor is a plain `/5` on that line.

Scenario edits: `scenario-endgame-boost.js` gets E21 (G7, real swap wave via `events.start('golden')`), E22 (G8, records the `bonus` passed to `maybeDrop`; `wantsMushroom` is a getter, so the test pins it with `defineProperty`), E23 (G9 robots). `scenario-fan-funnel.js` gets KF (G9 fans, `pushRate` takes a gnome type). E9 expectation fixed: `comboMidas >= 40` dated from the 90 % Midas Spores; with +5 %/level (this session's balance edit) 50 combo mushrooms give ~16.5 Midas, range now 6-30.

Run 1 `scenario-endgame-boost.js`: E21 FAIL (ratio 0.141, the AIR flat bonus does not follow the price; test now sets `touchedGround`), E22 FAIL (lesson 0, getter not overridden), E9 FAIL (stale threshold). Run 2: all PASS except E19 (see Rejected).

Self-check: diff only touches the three rules plus texts; no new dependency; `typeValue` replaces the two places that read `g.type.value` for money (hole, HUD).

Gotowe, gdy:
- [PASS] 1 G7 — run 2 `PASS E21 {"natural":{"paid":840,"xp":10},"retyped":{"paid":84,"xp":5},"from":"classic"}`
- [PASS] 2 G8 — run 2 `PASS E22 {"hand":1,"machine":0.25,"crate":1,"walkIn":0.25,"king":1,"wizardMachine":1.5,"lesson":1}`
- [PASS] 3 G9 robots — run 2 `PASS E23 {"kingTargets":0,"kingFree":true,"classicTaken":true}`
- [PASS] 4 G9 fans — `scenario-fan-funnel.js` `PASS KF {"king":7.7,"classic":38.5,"ratio":0.2}` (all 34 checks PASS)
- [PASS] 5 `npx tsc --noEmit -p .` → exit 0, no output
