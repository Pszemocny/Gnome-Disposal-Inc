# Combo mushroom

## Problem

PP (2026-10-21, Slack): "gnomy nie mają dawać dużo grzybków to ma być combo perk". Asked how the perk should work (a: Combos upgrade, a mushroom every 15 combo; b: the same with 3 levels; c: a mushroom at each big combo text, no upgrade), PP answered "C".

## Summary

- `src/systems/hole.ts`, the combo tier loop: each big combo text from 15 up (15, 30, 60, 100, 200) spawns one random mushroom from the hole (it hops out past the rim, clear of placed tools). "Nice!" at 5 does not.
- The regular drop chance (2.5% per eaten gnome, Spore Bag +30% per level, wizard x6) is unchanged.
- Why c over the recommended a: PP chose the simpler version with no purchase.

## Work progress

- `tools/smoke/scenario-small-batch.js` D20: with the random/lesson drop stubbed, crossing combo 5, 15, 30, 60, 100, 200 spawns mushrooms exactly at `[15,30,60,100,200]`. The C1/C2 drop-count helper now resets the combo before each eaten gnome, so combo mushrooms do not mix into the per-gnome drop counts.
- small-batch with `URL_QUERY='' FAKELOCK=1`: 61 PASS, 0 FAIL, `LOGS:` empty. `npx tsc --noEmit -p .` clean.
