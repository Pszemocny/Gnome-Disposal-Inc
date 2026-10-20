# No gnomes under 1 kg (PP, 2026-10-19)

## Problem

PP (verbatim): "wywalamy wszystkie gnomy poniżej kilograma, lecą zbyt daleko".
The throw gives every gnome the same push, so speed = push / mass: a 0.5 kg gnome flew about 30 m/s, a 0.8 kg gnome about 19 m/s, far past the hole.

## Summary

- `src/data/gnomeTypes.ts`: the weight classes `tiny` (0.5 kg) and `light` (0.8 kg) are removed. Left: normal 1.2 kg, heavy 2 kg, massive 3 kg (from hole level 4). `rollTier` defaults to `normal`; the odds of heavy and massive are unchanged, so the share they used to take from tiny/light now goes to normal.
- `src/entities/gnomes.ts`: the spawn call asks for at least `normal` (was `tiny`).
- `src/ui/style.css`: the `.t-tiny` / `.t-light` badge colours are gone.
- Saves do not store weight classes, so old saves load unchanged.
- The magnet ball holds about 18 normal gnomes at Magnet Coil 0 (measured in `2026-10-19-magnet-ball.md`); the old "28 tiny gnomes" case no longer exists.

## Work progress

- `npx tsc --noEmit` clean.
- Headless `scenario-no-light.js`: 100 spawns at hole level 1 → all normal 1.2 kg; at hole level 6 → normal 76, heavy 13, massive 11; lightest mass 1.2 kg. PASS, no exceptions.
- The scratchpad scenarios that spawned `tier: 'tiny'` (magnet gun, broom, conveyor) now spawn `normal` (the light side of the weight comparisons is 1.2 kg instead of 0.5 kg).
