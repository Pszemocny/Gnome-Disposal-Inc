# Strong Arm downgrade

## Problem

PP (Slack 2026-10-21 23:25): "Dodaj możliwość downgrade siły wszystko płatne jak za kolejny lvl nawet upgrade downgrade upgrade płacisz coraz więcej".
Order: PP "bez planu" (terminal 2026-10-21: implement everything, write tests, do not run them; reviewer after).

Interpretation: in the shop Strong Arm (`throw`) can go one level down. Every level change, up or down, is paid at the price of the next purchase.
The game counts paid changes per upgrade; a change costs `upgradeCost(u, paidChanges)`. Buying 1..6 straight costs what it costs today.

Assumptions:
1. Only Strong Arm can go down (data flag `downgrade: true` on `throw`). The orchestrator asks PP whether to extend.
2. The downgrade action is a right-click on the node; the description line shows "Right-click: LVL n-1 for $X".
3. Old saves without the counter start at the current level (no extra cost for what was bought).
4. The counter lives in `GameState.paidChanges` (optional). `freshState` does not copy it, so rebirth resets it with the level.
5. A downgrade does not count as "bought" in stats (it is not a purchase of a new level).

## Gotowe, gdy:

1. `npx tsc --noEmit -p .` → no output, exit 0.
2. `grep -n "downgrade: true\|downgrade = true" src/data/upgrades.ts` → exactly one line, on `throw`.
3. Checks written in `tools/smoke/scenario-strong-arm-downgrade.js` (prices 1..6 unchanged, up/down/up costs, save/load, rebirth reset, ignoreWeight off after 6 → 5); not run on PP's order.

Ladder: rung 2 (existing `upgradeCost`, `buy`, `deny`, `lvl`); one new optional save field, one data flag, one shop method branch.

## Summary

- `src/data/upgrades.ts`: `downgrade?: boolean` on `Upgrade`, set only on `throw`; `changeCost(u, level, paid)` prices a downgradable upgrade by its paid-change count (missing = level), every other upgrade by its level as before.
- `src/core/state.ts`: optional `paidChanges` (one line). `freshState` does not copy it, so a rebirth resets it together with the level.
- `src/ui/shop.ts`: `buy(id, dir)`; right-click (`contextmenu`) calls `buy(id, -1)`. A downgrade is refused at level 0, without the flag, and without money (`deny`). Every paid change of a flagged upgrade adds 1 to the count. A downgrade does not add to `stats.bought`. The description head adds "· right-click: down to LVL n for $X".
- `src/ui/legend.ts`: "Price now" uses `changeCost`, so it matches the shop after a downgrade.
- Prices: levels 1..6 $15, $23, $34, $51, $76, $149 (unchanged); then $289, $564, $1098 for the next changes.

Rejected:
- A visible "−" button on the node: rejected, the 120 px node has no free spot; right-click plus the hint in the description line is enough for one upgrade.
- Downgrading placeable tools (placed machines above the new count): rejected, out of scope; enabling the flag on a tool would need that handling first.

## Work progress

Checks written (not run, PP order "napisz testy ale ich nie odpalaj"): `tools/smoke/scenario-strong-arm-downgrade.js`
D1 only `throw` flagged · D2 down at level 0 does nothing · D3 levels 1..6 cost [15,23,34,51,76,149] · D4 level 6 ignoreWeight true · D5 shop line shows "right-click" and $289 · D6 down/up/down costs [289,564,1098], levels 5/6/5 · D7 after 6 → 5 ignoreWeight false · D8 count 9 · D9 down without money refused · D10 Running Shoes cannot go down · D11 save/load keeps the count · D12 old save at level 3 pays $51 for level 4 · D13 rebirth (`freshState(old)`) resets level and count.
Run: `DEV_PORT=5199 CDP_PORT=9423 node tools/smoke/smoke.mjs sad-out tools/smoke/scenario-strong-arm-downgrade.js`

Self-check:
- [PASS] 1. `npx tsc --noEmit -p .` → no output, `tsc_exit=0`.
- [PASS] 2. `grep -n "downgrade: true" src/data/upgrades.ts` → one line, 36, on `throw`.
- [PASS] 3. scenario file written with D1-D13; not run on PP's order.
- Discipline: one flag, one save field, one price helper, one branch in `buy`, one listener. Ladder: rung 2 (reuses `upgradeCost`, `buy`, `deny`, `rowData`).
- `state.ts` edited with one text-anchored line; other agents' changes in that file left untouched.

## Review round (2026-10-21)

- With any Feeding Frenzy level, weight is ignored anyway (Frenzy compensation, PP Q1 a), so a Strong Arm downgrade from 6 to 5 only lowers throw power. Asked PP as [G6]; default a: the shop line adds "Feeding Frenzy also ignores weight" when Frenzy is owned (`shop.ts` rowData). If PP picks b, Frenzy stops setting `ignoreWeight`.
