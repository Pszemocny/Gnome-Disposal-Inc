# Balance: F9 prices and F11 prerequisites (2026-10-20, night)

Plan: `docs/ai-work/2026-10-20-plan-night-features.md` part 1.3, findings F9 and F11, with the orchestrator's decisions in BOARD.md "Night A".

Interpretation: change the four F9 prices and the F11 shop items in `src/data/upgrades.ts` and `src/ui/shop.ts` only. The Kicking Wheel speed (machines.ts) and the level-9 golden chance (gnomes.ts) belong to files other agents edit tonight, so this note lists the exact lines for the orchestrator instead.

## Gotowe, gdy

1. Shop DOM shows Vacuum Tower $8,000, Gnome Cannon $4,000, Gnome Magnet $2,000; Auto Crank at level 11 costs ceil(1200 x 1.5^11).
2. Without the Magnet Gun the Magnet Coil row says "needs Magnet Gun" and a buy click takes no money; after buying the gun the row is normal. Same for Magnet Dish, Wider Plow (Plow Tractor), Bigger Crate (Wooden Crate), Bigger Bed / Faster Motor / Wider Area (Cleaning Robot), Turbo Fan / Long Nozzle (Leaf Blower).
3. Gnome Glue max 3; an old save with Glue 5 loads as 3 (clamp in main.ts).
4. Economy simulator re-run with the new prices: money at unlock vs price per path recorded below.
5. No exceptions in the headless runs; `npx tsc --noEmit` clean; one screenshot of a "needs ..." row.

## Problem

F9: when a crate or automation player reaches the hole level that unlocks the Kicking Wheel, Gnome Magnet, Cannon or Vacuum, they cannot afford it for a long time, because the prices were set for trick-shot income. Auto Crank's 12 levels cost $2.95M.

F11: when a player buys Magnet Coil, Magnet Dish, Wider Plow, Bigger Crate, robot upgrades or blower upgrades without the base item, the money is wasted, because the shop did not check prerequisites. Gnome Glue's 8 levels are not worth buying.

## Summary

`src/data/upgrades.ts`:
- Gnome Magnet $3,000 → $2,000, Gnome Cannon $6,000 → $4,000, Vacuum Tower $15,000 → $8,000.
- Auto Crank growth 1.9 → 1.5. Level 11 now costs $103,798; all 12 levels cost $308,996 (was $2,949,758). The plan said "$155k", which was a miscount; the comment in code says $309k.
- Gnome Glue max 8 → 3 (orchestrator decision F11). This overrides the 8 from `2026-10-20-more-upgrade-levels.md` for Glue only; every other cap from that note stays (Premium 20, Gears 16, Batches 6, Auto Crank 12, Combo Window 10, Combo Cap 12). Crate prices stay a flat $70 (Wooden Crate and Bigger Crate, growth 1).
- New field `requires?: string` on `Upgrade` (9th argument of `U`). Set on: Magnet Coil and Magnet Dish → `magGun`; Wider Plow → `tractor`; Turbo Fan and Long Nozzle → `blower`; Bigger Crate → `box`; Bigger Bed, Faster Motor, Wider Area → `robot`.

`src/ui/shop.ts`:
- `missing(u)` returns the prerequisite upgrade while its level is 0.
- When the prerequisite is missing, the row shows a red badge "needs <name>" after the name and a grey disabled BUY button without `data-buy`; the row never gets AFFORD. `buy()` also refuses it, so no code path can take money for it. "HOLE LVL n" (locked) and "MAX" take precedence over the badge.

Ladder: step 2, the shop already had the `hole` lock and the `.badge` / `.buy.poor` styles; the new field reuses them. The only new style is an inline red background on the badge, because `style.css` is not my file tonight.

### Lines for the orchestrator (other agents own these files tonight)

1. `src/entities/machines.ts`, Kicking Wheel (`case 'wheel'`, the `setLinvel` inside `gn.forEachNear`). Today the launch is 13 forward + 7 up = 14.8 m/s, about 10 m. Scaled to 20 m/s at the same 28° angle (about 18 m):
   - old: `g.body.setLinvel({ x: fwd.x * 13 + up.x * 7, y: fwd.y * 13 + up.y * 7, z: fwd.z * 13 + up.z * 7 }, true);`
   - new: `g.body.setLinvel({ x: fwd.x * 17.6 + up.x * 9.5, y: fwd.y * 17.6 + up.y * 9.5, z: fwd.z * 17.6 + up.z * 9.5 }, true);`
2. `src/entities/gnomes.ts`, `pickSpawnType()`. Today level 9+ triples the chance: 0.4% x 3 = 1.2% without Gold Fever.
   - old: `const goldChance = (0.004 + lvl('goldChance') * 0.004) * (hl >= 9 ? 3 : 1);`
   - new: `const goldChance = 0.004 + lvl('goldChance') * 0.004 + (hl >= 9 ? 0.026 : 0);`
   - Result: 3.0% at level 9 without Gold Fever, 4.6% with Gold Fever 4. I chose an added 2.6% instead of x7.5, because x7.5 with Gold Fever 4 would make 15% of all gnomes golden (worth x100 each).

## Work progress

- `npx tsc --noEmit` → exit 0, no output.
- Headless `scenario-prereqs.js` (port 9363) → `LOGS:` empty. `scenario-prereqs-shot.js` → `LOGS:` empty, screenshot `run-prereqs-shot/02-needs-magnet-gun.png` (Magnet Coil row with the red "needs Magnet Gun" badge and a grey BUY).
- [PASS] 1 prices — `"vacuum":"$8k","cannon":"$4k","magnet":"$2k","raw":{"vacuum":8000,"cannon":4000,"magnet":2000},"autocrank11":"$103k","autocrank11exact":103798,"expected":103798` (the shop formats money as `$8k`; exact values read from `upgradeCost`).
- [PASS] 2 prerequisites, all 9 rows. Example: `"magPower":{"before":"Magnet Coilneeds Magnet Gun","beforeDisabled":true,"moneyKept":true,"levelKept":true,"parentLvl":1,"after":"Magnet CoilAFFORD","afterDisabled":false,"boughtAfter":1,"paid":25,"price":25}`. The same shape with `moneyKept: true, levelKept: true` before and `paid == price` after for magRange, plowWidth, blowPower, blowRange, crateSize, robotBed, robotSpeed, robotArea. The parent was bought through its own shop button each time (`parentLvl: 1`).
- [PASS] 3 Glue — `"max":3,"loadedGlue":3`: a save with `glue: 5` written to localStorage and booted in an iframe loads as 3.
- [PASS] 4 simulator — table below.
- [PASS] 5 no exceptions (both runs `LOGS:` empty), `tsc` clean, screenshot taken.

### Simulator (`<scratchpad>/design/econ-f9.mjs`, a copy of `econ.mjs` with a `--f9` flag and a WALLS line; both runs with `--implemented`)

Cash on hand when the unlock level is reached vs the first price. In brackets: seconds of income at that level needed to pay the price (the greedy buy policy spends cash on other upgrades, so cash alone overstates the wall).

| Path | Gnome Magnet (L5) | Cannon (L6) | Vacuum (L8) |
|---|---|---|---|
| crate, before | $280 vs $3,000 (172 s) | $625 vs $6,000 (140 s) | $8,308 vs $15,000 (133 s) |
| crate, after | $280 vs $2,000 (115 s) | $625 vs $4,000 (93 s) | $8,308 vs $8,000 ok (71 s) |
| automation, before | $698 vs $3,000 (248 s), bought 19 min | $530 vs $6,000 (368 s), bought 20 min | $6,588 vs $15,000 (269 s), never bought |
| automation, after | $698 vs $2,000 (165 s), bought 17 min | $530 vs $4,000 (245 s), bought 19 min | $1,796 vs $8,000 (71 s), bought 22 min |
| tractor, before | $411 vs $3,000 (435 s) | $1,107 vs $6,000 (690 s) | $1,443 vs $15,000 (254 s) |
| tractor, after | $411 vs $2,000 (290 s) | $1,107 vs $4,000 (460 s) | $1,443 vs $8,000 (136 s) |
| kick, before | $221 vs $3,000 (74 s) | $1,268 vs $6,000 (204 s) | $11,580 vs $15,000 (798 s) |
| kick, after | $221 vs $2,000 (49 s) | $1,268 vs $4,000 (136 s) | $11,580 vs $8,000 ok (426 s) |
| hands / gun | affordable within 1 min of income before and after | | |

Other numbers: automation reaches level 12 at 24 min instead of 27 and earns $2.43M instead of $1.72M; the other paths do not buy these tools in the model, so their runs do not change. Maxing every money upgrade + all land: $3,823,972 → $1,150,710.

Verdict: the walls shrink by the price cut (a third to a half) but are not gone for every path. Every tool is now payable within 8 minutes of income at its unlock level (worst: tractor Cannon 460 s, kick Vacuum 426 s); before, the worst was 13 minutes. Kicking Wheel ($900) and the first Auto Crank level ($1,200) at L4 are unchanged by F9 and still cost 1.5-4x the cash a crate, automation, tractor or kick player has at L4 (86-250 s of income). Gun vs other paths (earned in the run): automation 2.2x, crate 6.8x, tractor 12.7x; the BOARD target "gun ≤ 10x" is not met for the tractor path, which F9 prices cannot change (the tractor path buys none of these tools).

### Rejected

- Badge colour as a CSS class in `style.css`: not my file tonight; an inline background on one badge does the same.
- Changing Kicking Wheel / Auto Crank first prices to remove the L4 wall: not in the orchestrator's F9 decision.

### Uncertain

- Magnet Dish also widens the plain hand magnet (`player.ts`: range `7 + 1.2 x magRange`, cone `0.94 - 0.02 x magRange` without the gun). With the new rule a player without the Magnet Gun can no longer buy it. Done as decided; if the Dish should stay for hand players, drop `'magGun'` from its row.
- Rebirth checked: without Keep Tools every upgrade resets; with Keep Tools the tools and Bigger Crate are kept (`hole.ts`), so a kept child never sits without its parent. Robot upgrades (Bed/Motor/Area) are not kept by Keep Tools while the robot is; that is `hole.ts` behaviour, untouched here.

### Orchestrator follow-ups (2026-10-20)

- Magnet Dish no longer requires the Magnet Gun: it also widens the hand magnet, so hand players keep it.
- The L4 wall the simulator still showed: Kicking Wheel $900 → $500, Auto Crank base $1,200 → $600 (growth 1.5 stays; 12 levels ≈ $154k).
- Keep Tools keeping robot/blower/plow upgrades was sent to the land/balance agent (owner of `hole.ts`).
- The two lines for `machines.ts` (Kicking Wheel 20 m/s) and `gnomes.ts` (golden +2.6 % from L9) are applied by the orchestrator after the land/balance agent releases those files.
