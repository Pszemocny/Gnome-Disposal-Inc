# 2026-10-21 Strong Arm ignores weight at max, Coin Magnet in the Magnet tab

Gotowe, gdy:
1. `node tools/smoke/smoke.mjs ... scenario-tree-expansion.js` → `PASS U15b ... "magnet":5 ... "movement":4`, and the screenshots Magnet/Movement at 1280 and 1920 read well by eye.
2. `node tools/smoke/smoke.mjs ... scenario-small-batch.js` → `PASS D19` (max Strong Arm: massive hand throw and Magnet Gun ball = normal speed, preview mass 1.2; max-1: massive slower, preview mass 3), and no other check turns FAIL.
3. `npx tsc --noEmit -p .` → no output.

## Problem

PP (Slack 2026-10-21 15:13, via hub):
- "tak": move Coin Magnet from the Movement tab to the Magnet tab.
- "Strong arm na najwyższym levelu niech działa tak, żeby nie zwracało uwagi na wagę. Czyli wszystko leci tak samo, niezależnie od wagi. Zarówno w rękach, jak i na magnesie".

Interpretation: at Strong Arm level 6 (max) a hand throw and a Magnet Gun ball throw give every gnome the speed of a 1.2 kg gnome, exactly like Feeding Frenzy already does. Levels 0-5 unchanged. The Trick Scope preview uses the same mass so it matches the flight.

## Summary

- `src/data/upgrades.ts`: `magnetRange` tab `Movement` → `Magnet`, placed after Trick Scope (id, levels, prices unchanged, so saves keep their levels). Strong Arm description now says the last level ignores weight.
- `src/player/player.ts`: one getter `ignoreWeight` (Frenzy or max Strong Arm) used by both places that already compensated weight for Frenzy: the throw (`mRef`) and the aim preview (`updateAids`).
- `src/ui/legend.ts`: the weight-classes line says heavy gnomes fly shorter only until the last Strong Arm level.
- Drabina: szczebel 2, the existing Feeding Frenzy compensation reused; the getter keeps the throw and the preview on one condition.
- Kick (`kick`) is not a throw and keeps its fixed impulse; Magnet Gun slipping by weight is grip, not flight, so both stay unchanged.

Odrzucone:
- HEAVY HAUL text and contract at max Strong Arm: PP asked only about flight; the text still describes a heavy gnome, so it stays.

## Work progress

Tests (own dev server on 5183, FAKELOCK=1, stopped after the runs):
- `scenario-small-batch.js` → 60 PASS, 0 FAIL. New check D19 (after D12): `PASS D19 L6: normal 23.75 massive hand 23.75 ball [24.94,22.15] preview m [1.2,1.2]; L5: normal 21.87 massive hand 8.75 ball [8.99,8.67] preview m [3,3]`. First run failed D19 only on my tolerance: the ball adds a +-0.06 random spread per gnome, so ball speeds get the 10 % tolerance B1 already uses; the hand throw keeps 2 %.
- `scenario-tree-expansion.js` → 52 PASS, 1 FAIL (F3 perf, known and accepted). U15b expectation changed: magnet 4 → 5, movement 5 → 4, because Coin Magnet is a root without a parent and moved from one tab to the other. `PASS U15b {"plow":3,"magnet":5,"factory":5,"movement":4,"combos":4,"bonuses":5}`; U19 (connectors) PASS. Added screenshots Magnet/Movement at 1280 and 1920.
- `npx tsc --noEmit -p .` → no output.

Screenshots by eye: Magnet 1280 and 1920 show five rows (Strong Arm, Coin Magnet, Magnet Gun + Coil, Trick Scope, Magnet Dish), all fit without scroll, names not cut. Movement shows four rows, centred. Rows sort by hole level then price, so Coin Magnet ($20) lands second.

Samokontrola:
- [PASS] 1 — scenario-tree-expansion.js → `PASS U15b {... "magnet":5 ... "movement":4 ...}`; screenshots read well.
- [PASS] 2 — scenario-small-batch.js → `PASS D19 ...` above, 60 PASS 0 FAIL.
- [PASS] 3 — `npx tsc --noEmit -p .` → no output.
- Dyscyplina: only the two asked changes plus the texts the brief named (description, legend, SPEC, CHANGELOG, board). Drabina: reused the Frenzy compensation; no new helper beyond one getter shared by throw and preview. No rule-1 `Math.min(1, dt` added (no animation change).
