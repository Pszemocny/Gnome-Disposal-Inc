# Hole moves with each Land, trampoline per Land, balance fixes F2-F14 (2026-10-20)

Gotowe, gdy (from the orchestrator's order, plan `2026-10-20-plan-land-hole-trampoline-gun.md` items 1-2 and `2026-10-20-plan-night-features.md` F2, F3, F4, F6, F7, F8, F10, F13, F14):
1. Backyard: a gnome dropped on a flat trampoline flies <= 60% of the old distance; with `state.land = 3` >= 110%.
2. For land 0..3 the hole centre = anchor + level drift; every anchor inside its fence and >= 8 m from factory/house/desk/fence; each anchor further from the factory than the previous.
3. Buying the Garden in the shop moves the hole within 1.5 s; a tool on the new spot goes back to the inventory with the toast; the hoop is 2.5 m from the new hole edge.
4. F2: a 20-gnome ball thrown from 15 m pays <= 4x its no-trick value + one flat bonus; a single SNIPER+AIR throw still pays x8 + bonus.
5. F3: a 12-gnome dump pays +24 x valueScale extra.
6. F4: the second armchair pays 10%.
7. F6: a greedy gnome with $10 loot pays exactly $10 extra and no loot coins.
8. F7: an L-magnet on the far rim survives 3 level-ups at the rim (rim distance within 0.3 m).
9. F8: both tracks visible; a plow-only player sees level goals.
10. F10: shards = formula for 3 sample saves; Keep Tools keeps Bigger Crate.
11. F13 / F14 values.
12. Simulator re-run, table below.
13. Regression `zz-scenario15-scope.js`, `scenario-trick.js`, `scenario-magnet-arm.js`, `scenario-golden.js` (plus the plan's `scenario15-wait.js`, `scenario-magnet-gun.js`); `npx tsc --noEmit` clean.
14. (coordinator, mid-task) a full 12-gnome crate dumped across a level-up: level goes up, no exception for 5 s, all 12 paid.
15. (coordinator, mid-task) a save with Keep Tools and robot, leaf blower and plow upgrades: after rebirth they are all still there, money and hole level reset.

## Problem

PP: the single trampoline was too good, and "dziura z każdym kupionym landem ucieka gdzieś indziej [...] albo nie losuj i daj je na stałe". The night plan found money leaks and dead ends (F2-F14). Item 3 of the land plan (Magnet Gun reach) and F1, F5, F9, F11 belong to other agents or to PP.

## Summary

Ladder: rung 2 everywhere (existing `rebuildHole`, ground slabs, `fx.dust`, `ease.ts`, `coins.burst`, `hole.earn`, `achievements.has`, goal objects, HUD goal markup); new code is the slide, the carry/glide of tools, the volley object and the second goal track.

Land and hole (`src/data/land.ts`, `src/world/environment.ts`):
- Each land tier has a fixed `anchor` (hole centre at hole level 1). The hole drifts 1.2 m per level from the anchor, along the line factory → anchor (Backyard keeps today's line).

| Land | anchor (x, z) | from factory | desk | house | fence | margin at level 12 (radius 6) |
|---|---|---|---|---|---|---|
| Backyard | 0, 0 | 15.0 | 15.0 | 23.0 | 22 | 4.6 |
| Garden | -10, 6 (left, away from the house) | 19.2 | 25.8 | 29.2 | 22 | 6.9 |
| Neighbour's Lawn | 10, 2 (right) | 23.0 | 15.2 | 25.2 | 34 | 18.0 |
| Dark Forest | -24, -34 (behind the house's left side) | 26.7 | 37.9 | 17.1 | 24 | 7.6 |

- Garden was moved off the plan's "far left corner" example: at (-14, 10) the level-12 hole reached 6.3 m from the golden shovel (lies on its rim). The plan's anchors were "e.g.".
- On purchase (`rebuildLand`, called by the shop): the hole slides to the new spot in 1 s (`inOutSine`), the ground slabs and the grass mesh move with it every frame, dust puffs every 0.15 s and at both ends, a rumble, a small shake on arrival; then `rebuildHole()` at the target. The hoop, goal arrow, cannon aim and gnome AI read `env.hole` live, so they follow. Nothing new in the save. No grass tufts on any land's hole path.
- Tools: `Hole.carry(oldC, oldR, newC, newR, T)` is used by the land move and by level-ups (F7). Tools within 1.5 m of the old rim keep their distance to the rim and glide there with the hole (land: same 1 s and easing; level-up: 0.25 s). A tool resting on another one (stack) moves with it as one group. Tools the new hole covers (centre within radius + 0.6, below 1.5 m) shrink away in 0.2 s (`inQuad`) when the hole arrives and go back to the inventory, toast "The hole moved! Tools in its way went back to your inventory." (level-up keeps its old toast, once). Crates and the cleaning robot are left out: a crate is a loose object that dumps itself when it falls in, the robot drives itself.
- `machines.move(m, pos)`: body, root and `m.pos`.

Trampoline (`machines.ts`): launch velocity x `0.6 x 1.25^land`. Measured flight (flat pad, classic): today 7.6 m, Backyard 3.3 m (44%), Dark Forest 10.3 m (135%). The plan wrote "about 5 m" for 0.6; distance goes with the speed squared, so it is 3.3 m.

Balance (`hole.ts`, `gnomes.ts`, `machines.ts`, `props.ts` untouched, `goals.ts`, `hud.ts`, `achievements.ts`):
- F2 VOLLEY: `gnomes.drop` with an impulse puts every gnome dropped in the same frame (`ctx.time`) into one shared `Volley { n, bonusPaid }`; `retype` copies it. `consume`: a player throw with n > 1 caps the trick product at x4 and pays the flat bonus once (the first eaten gnome that has one). Big text "VOLLEY x4 (20 gnomes)". `player.ts` needs no change.
- F3: the crate dump pays `2 x n x valueScale` as a coin burst, shown under "CRATE DUMP x12!" (now after the gnomes, so it is the text the player reads). Gnomes thrown into a crate lose their throw flags before the dump: they paid LONG/AIR tricks per gnome, which undid F3's reasoning.
- F4: armchair and flamingo pay full only while their achievement is missing, then 10%.
- F6: loot returns x1 through `hole.earn`, not as coins; toast "Stolen $10 recovered!".
- F8: Milestones (tutorial, levels, Garden, The Deep) as `GOAL` and Skills (crate, combo 15, tricks, heavy haul) as `SKILL`, both in the goal panel. Skills open after "Reach hole level 2" (the old position). `goal2` / `goalBase2` are declared on `GameState` by module augmentation in `goals.ts` (no edit of `state.ts`); an old save is split from its single index on load (old 3 → 3/0, 9 → 6/3, 14 → 7/7, 19 → 12/7). The waypoint follows the milestone, else the skill.
- F10: `shards = 5 + floor(sqrt(totalEarned / 20000)) + floor(gnomes eaten this run / 2000)`. "This run" = `stats.gnomesEaten - runEatenStart`; `stats` are lifetime, so rebirth stores `runEatenStart` (augmented field). Rebirth carries `goal2`/`goalBase2` like `goal`. Keep Tools keeps `KEEP_TOOL_IDS` (new, `src/data/upgrades.ts`): every upgrade in the Tools tab (also Bigger Crate and the robot's Bigger Bed, Faster Motor, Wider Area) plus Plow Tractor, Wider Plow, Leaf Blower, Turbo Fan, Long Nozzle. An explicit list for the last five, because their tab (`Plow`) also holds Steel Toes, which is not a tool.
- F13: "Gnome Baron" text says $100m. The unlock check (`1e9`) sits in `src/systems/achievements.ts`, not mine: one line for the orchestrator, `['m1b', s.lifetimeEarned >= 1e9],` → `['m1b', s.lifetimeEarned >= 1e8],`.
- F14: combo cap +0.5 per land tier (2, 2.5, 3, 3.5 without upgrades).

Crash fix (coordinator, found by the contracts agent): when a crate dump levelled the hole up, `levelUp` removed the crate while its queue still held the eaten gnomes, and `remove` released them, so Rapier touched freed bodies (`RuntimeError: unreachable`, `recursive use of an object`). Now: the dump empties the queue before eating, `carry` skips crates, and `machines.remove` releases only gnomes still in `ctx.gnomes.list`. Nothing of this runs inside a Rapier query callback.

Rejected:
- Moving the worn-dirt trail for far anchors: on the Lawn and Forest the 8 trail patches from the factory are spread over 17-33 m and look like stepping stones; not asked, visual only.
- Machines placed on a bigger land and kept by Keep Tools end up outside the Backyard fence after rebirth: older behaviour, not part of this change → separate order.
- Shop text for Combo Cap (`shop.ts`) does not show the land bonus: not my file; the HUD `cap xN` shows the real cap.

## Simulator (`scratchpad/design/econ.mjs --implemented`)

New flag: land anchors (distances from the crank spot and the landing circle per land), trampoline flight measured above, VOLLEY x4 + bonus once per throw, crate +2 per gnome, combo cap +0.5 per land, new shards. Assumption: the player buys each land as soon as the hole level allows and it costs at most half the cash (the model had no land before). Not modelled: F4, F6 (exploit loops), F7, F8 rewards.

| Strategy | L4 before / now | L8 before / now | L12 before / now | $ to L12 before / now | $/s at L12 before / now | shards before / now |
|---|---|---|---|---|---|---|
| Hands | 7 / 7 min | 50 / 54 | 167 / **307** | $20.0M / $8.0M | 2 869 / 525 | 31 / 25 |
| Magnet Gun | 3 / 3 | 17 / 18 | 22 / **39** | $18.6M / $5.4M | 58 260 / 16 320 | 30 / 22 |
| Crate | 4 / 4 | 14 / 12 | 24 / **23** | $0.41M / $0.79M | 2 341 / 2 916 | 4 / 12 |
| Automation | 3 / 3 | 18 / 18 | 27 / **27** | $1.34M / $1.72M | 3 564 / 4 634 | 8 / 15 |
| Plow tractor | 3 / 3 | 18 / 18 | 28 / **30** | $0.35M / $0.42M | 2 172 / 2 038 | 4 / 10 |
| Kick | 3 / 3 | 22 / 60 | 251 / 397 | $2.3M / $3.1M | 330 / 244 | 10 / 18 |

Reading: the gun is still the richest path but 3.6x instead of 16x automation; crate and automation earn more. Hands get much slower, because in the model the moved hole is 15-31 m from the crank spot, so most gnomes are walked over; that depends on the "buy land at once" assumption. The run length of the machine paths (23-30 min) is unchanged: that is F1 (XP by feeding style), still waiting for PP.

## Work progress

- [x] `npx tsc --noEmit` → no output (clean).
- [x] `scenario-land-balance.js` (scratchpad `smoke/`, port 9391) → all checks true, 0 exceptions. Values: tramp old 7.6 / land0 3.32 (0.44) / land3 10.25 (1.35); anchors table above, live hole = formula (0.00); buy Garden: arrived 1.03 s, in-way fan shrink samples 0.97, 0.83, 0.75, 0.66, 0.31 then gone, toast text present, hoop 2.5 m from the edge, rim fan kept its offset (0.00), raycast: gap at the new spot, ground at the old; F7 magnet rim distance 0.5 → 0.5, 0.5, 0.5 over levels 4-6, stack offset 0.00, a fan 1.7 m outside the far rim swallowed; F2 plain 30.5, ball 172.0 = 4 x 30.5 + 50, single 58.4 = 8 x 1.05 + 50, text "VOLLEY x4 (20 gnomes)"; F6 coins 3.15 vs 3.15, direct $0 vs $10; F4 250 / 25 / 80 / 8; F3 extra 24 = 24 x 1; F14 caps 2, 2.5, 3, 3.5; F13 "Earn $100m."; F8 GOAL "Reach hole level 4" + SKILL crate goal in the HUD, migration as above; F10 14/14, 20/20, 47/47, real rebirth with Keep Tools: crateSize 3 kept, shards 47.
- [x] `scenario-dump-levelup.js` (port 9392): red before the fix (`RuntimeError: unreachable` in `rbSetEnabled`, 16 exceptions), green after: level 2 → 3, 12 eaten, crate not moved, no released dead gnome, 0 exceptions over 5 s.
- [x] Keep Tools (coordinator): `f10_keep_tools` → lost [], Premium/Running Shoes not kept, money 0, hole level 1, shards 47 = expected.
- [x] Regressions, 0 exceptions each: `zz-scenario15-scope.js` (all steps as before, hoop 5.7 = 5.7, bullseye true), `scenario-trick.js` (SNIPER+AIR x8 ratio 55.6 with the $50 bonus, BULLSEYE x5, cap "x20 MAX", AIR x2; needed MAXPOLL 4800, the first two runs ran out of polls at 600 s), `scenario-magnet-arm.js` (10 eaten over the hole, heap, ghost colours, no rim), `scenario-golden.js` (swap and turn-back counts match), `scenario15-wait.js`, `scenario-magnet-gun.js` (ball sizes, throw, shop buy).
- [x] `npx tsc --noEmit` → clean (one run in between failed in `src/ui/shop.ts` while another agent was changing the tabs; clean again after).
