# Bullseye early money (analysis, no code change)

## Problem

PP (Slack 2026-10-21 17:05): "Nie miałem za każdym razem gold hour na początku i rzucałem wszystkie jako bullseye i zaraz kasa była". On a fresh start, throwing every gnome through the golden hoop next to the hole made money very fast.

## Summary

When the player throws every gnome through the hoop at hole level 1-2, then he earns about $4.5k in 3 minutes instead of about $0.7k, because 85 % of a hoop shot is the flat $60 + $10 bonus, not the x5 multiplier. Capping the multiplier does nothing early; the flat bonus is the lever.

## Facts from the code (a = fact)

- The hoop exists from the very start: `Hole.updateRing` builds it on the first frame, no hole-level check (`src/systems/hole.ts`, `updateRing`). The BULLSEYE lesson comes only at hole level 4 (`src/systems/goals.ts:85`).
- Money per eaten gnome (`Hole.consume`): `type.value x tier x trick x comboMult x valueScale + bonus x valueScale`.
  - `trick`: AIR x2 (never touched the ground), LONG SHOT x2.5 (thrown from >= 8 m from the hole centre), SNIPER x4 (>= 14 m), TRICK x3 (bounce off a tool), BULLSEYE x5; multiplied, capped at x20 (`TRICK_CAP`), x8 for a Magnet Gun ball (`VOLLEY_CAP`).
  - `bonus` (flat, `TRICK_BONUS`): AIR $10, LONG $20, TRICK $25, SNIPER $40, BULLSEYE $60, summed.
  - `valueScale` at the start = hole multiplier: x1 / x1.5 / x2 at levels 1 / 2 / 3.
  - `comboMult` = 1 + 0.05 x combo, capped at x2 without upgrades; BULLSEYE adds +3 combo on top of the normal +1.
- XP does not depend on tricks: a hand-thrown gnome gives 1 XP. Level 2 after 25 gnomes, level 3 after 85, level 4 after 205 (`src/data/holeLevels.ts`).
- Measured earlier (`2026-10-19-trick-shots.md`, hole level 1): BULLSEYE alone $66, SNIPER + AIR + BULLSEYE $134, AIR alone $12.

## Money per gnome (ordinary gnome, no upgrades; combo x1.2 .. x2)

| Shot | Hole 1 | Hole 2 | Hole 3 |
|---|---|---|---|
| dropped / pushed in, no trick | $1.2-2 | $1.8-3 | $2.4-4 |
| hand throw straight in, AIR | $12.4-14 | $18.6-21 | $24.8-28 |
| BULLSEYE alone | $66-70 | $99-105 | $132-140 |
| BULLSEYE + AIR (the usual hoop shot) | $82-90 | $123-135 | $164-180 |
| LONG + AIR + BULLSEYE (x25 → x20) | $114-130 | $171-195 | $228-260 |
| SNIPER + AIR + BULLSEYE (x20) | $134-150 | $201-225 | $268-300 |

In a BULLSEYE + AIR shot at hole 1 ($82), $70 is the flat bonus and $12 is the multiplier.

## First 3 minutes

Assumption (c, inference): about 15 aimed throws a minute, so 45 gnomes in 3 minutes: 25 at hole level 1, 20 at level 2 (level 3 needs 85 gnomes, so it comes at about minute 6). Combo x1.2 (throws 4 s apart, the 2.5 s combo window runs out between them).

| Play style | Money in 3 min |
|---|---|
| everything dropped in | about $66 |
| everything thrown straight in (AIR) | about $680 |
| everything through the hoop (BULLSEYE + AIR) | about $4,510 |
| everything through the hoop from 8 m (LONG + AIR + BULLSEYE) | about $6,270 |

The hoop pays about 6.6x a normal throw and 68x dropping. $4.5k buys the whole early shop (the plan note put that at $2.4-4.8k).

Not measured (d, real uncertainty): how many hoop throws a minute a player really makes, and whether a Magnet Gun ball ($300) fits through the 0.8 m hoop. If it does, a ball of 6 at hole 2 pays about $250 per throw (x8 cap per gnome, the flat bonus once per throw).
An AIR throw straight into the hole counts as AIR only when the gnome is eaten before it drops below 0.5 m (`gnomes.ts:542`); the AIR baseline above assumes it does (inference from the measured $12).

## Options

The flat bonus is a PP decision from 2026-10-20 (`2026-10-19-trick-shots.md`, "Follow-up: flat trick bonus"): "a few trick shots beat dumping the armchair" ($250 once). Options a) and c) undo that before hole level 4: five hoop shots at level 1 then pay about $110, less than the armchair.

a) The BULLSEYE flat $60 counts only from hole level 4, where the BULLSEYE lesson is; the x5 stays. Hoop shot $22 / $33 / $44 at levels 1 / 2 / 3; 3 minutes ≈ $1.2k (normal throws $680). The hoop stays the best throw, about 2x, not 7x.
b) Every flat trick bonus grows with the hole level: a quarter at level 1, half at 2, three quarters at 3, full from 4. Hoop shot $29.5 / $70.5 / $129; a normal AIR throw $4.9 / $11.1 / $19.8; 3 minutes ≈ $2.1k with the hoop, $345 with normal throws. The whole start gets slower, the hoop still pays 6x.
c) The hoop appears only from hole level 4. 3 minutes ≈ $680 (normal throws); nothing to aim at before the lesson.
Rejected: capping the trick stack early (for example x5 below level 4): a hoop shot at level 1 drops only from $82 to $76, because the flat bonus is 85 % of it.

Recommendation: a), because it hits exactly the hoop, keeps the x5 celebration from the first minute, and leaves normal throws as they are.

## Work progress

- 2026-10-21: analysis from the code (formulas in `Hole.consume`, `TRICK_BONUS`, `HOLE_LEVELS`), no code change, no scenario run (PP's order). Waiting for PP's choice.

## Decision and change (2026-10-21)

PP (via hub, 19:17): option b. Every flat trick bonus is multiplied by `min(1, holeLevel / 4)` in `Hole.consume` (1/4 at level 1, 1/2 at 2, 3/4 at 3, full from 4); the multipliers (x5 for the hoop, etc.) are unchanged. Price growth stays as it is (PP: "Drożenie jest ok tak ma być"). Check G12 in `scenario-small-batch.js` measures the bonus share at hole levels 1/2/4/6.
