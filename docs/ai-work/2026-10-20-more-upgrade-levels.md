# More levels for Products and Combos upgrades (PP, 2026-10-20)

## Problem

PP (verbatim): "dodaj jeszcze więcej leveli dla upgradów, jak szybkość maszyny, w combos i products, bo jest za mało na 12 lvl".
Translation: add more levels to upgrades like machine speed, in Combos and Products; there are too few for 12 hole levels.

## Summary

`src/data/upgrades.ts`, level caps doubled; price formula (`cost x growth^level`) unchanged:
- Premium Gnomes 10 → 20 (last level $110,842)
- Factory Gears 8 → 16 ($28,645)
- Bigger Batches 3 → 6 ($48,829)
- Auto Crank 6 → 12 ($1,397,884; 12 levels ≈ 1 gnome per second)
- Gnome Glue 4 → 8 ($24,489; wake chance x0.85^level, never below zero)
- Combo Window 5 → 10 ($4,124; 2.5 s → 6.5 s)
- Combo Cap 6 → 12 ($51,408; x2 → x8)

Not changed:
- Gnome Permit stays at 5: each level adds 40 gnomes, and 320 gnomes is the most the yard simulates smoothly on PP's Mac (see `2026-10-19-performance.md`).
- One-off upgrades (Combo Insurance, Jackpot) stay max 1.

## Work progress

- `npx tsc --noEmit` clean. Every formula reading these levels was checked (`hole.ts` comboWindow/value, `factory.ts` speed/autocrank/batch, `gnomes.ts` glue): all scale linearly or multiplicatively, none goes negative at the new caps.
