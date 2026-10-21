# Endgame boost: Combo Cap 13-18, hole-10 rows, King and UFO XP, Shadow Gnome behind the player

Interpretation: execute `2026-10-21-plan-endgame-boost.md` (plan v0) with its recommended option for every open decision. PP (2026-10-21): recommendation taken, PP may override on Slack. PP's workflow, verbatim: "zrob wszystko z boardu najpierw implementuj wszystko napisz testy ale ich nie odpalaj jak zrobisz wszystko wtedy pusc reviewera tak aby wszystko wypchnac szybciej". So: scenarios written, not run; only `npx tsc --noEmit -p .` run.

## Problem
At hole level 10 with $70M and the whole shop bought there was nothing to buy and levels 10-12 were slow. Shadow Gnomes never stared at the player, because robots and tools took them first. The night event showed as "..." in the legend.

## Summary
- Combo Cap goes to 18 levels (13th $712k ... 18th $37.6m, late surcharge applies).
- Three Bonuses rows from hole level 10 (round 2: level 8, prices doubled), each needs its parent: Bottomless Hunger (+25% XP, needs Hole Hunger), Spore Storm (+50% drop chance, needs Spore Bag), Midas Spores (+18% Gold Midas per level, needs Spore Storm).
- King XP 200 → 1000 (still multiplied by the XP rows). A downed UFO adds 40% of the current bar, no multipliers, nothing at level 12, nothing when it flies away.
- One XP path: `hole.xpMult` and `hole.addXp(n)`; `consume` and the UFO crash both use it.
- Midas Spores line in `pickDef` sits behind `GOLD_LEVEL`, so no Midas below hole level 6 even with an edited save.
- Shadow Gnome: spawns 7-10 m behind the player (6 tries 60 degrees apart, inside the fence, clear of the hole and tools), else the old fence spawn. It grows in (`pop`), black burst, "we see you", whisper. For 20 s (`SHADOW_GRACE`) `forEachNear` skips it, so robots, every tool, explosions, angry kicks and wizard casts ignore it; the Magnet Gun cone passes `all = true` and still sees it. Hand kick uses a raycast and still works.
- Event name `NIGHT VISITOR` (reverted to "..." in round 2, PP asked "co to jest"); legend shadow card rewritten.
- Texts: SPEC (shop lists, combo, King decision, Shadow row and decision, UFO XP, mushrooms), PLAN combo and Bonuses lines, CHANGELOG five bullets in `## 2026-10-26 13:00`, BOARD status line.

Ladder: data rows and numbers rung 5; `xpMult`/`addXp` rung 2 (extracted from `consume`); `inTool` and `POP_TIME` reused (rung 2); `lurking` + `forEachNear(..., all)` rung 6 (no hook existed); spawn search rung 6 with the old fence spawn as fallback.

## Gotowe, gdy (plan "Done when", 27 lines)
Checked now (static, no scenario):
- [PASS] 17 `rg -n "isFree\(g\)" src/systems/events.ts src/systems/tornado.ts` → 7 lines (plan counted 4 on older code), none with `lurking`; events/tornado untouched by this change.
- [PASS] 22 `rg -n "score >= 120" supabase/leaderboard.sql` → 1 line (line 18); `rg -n "rollTiers\(" src/data/gnomeTypes.ts` → signature line 129 unchanged.
- [PASS] 23 `rg -c "NIGHT VISITOR|Midas Spores|Spore Storm|Bottomless Hunger|1000 XP" docs/SPEC.md` → 5; `rg -l "Spore Storm" CHANGELOG.md docs/PLAN.md` → both files.
- [PASS] 27 `rg -nF "100 * Math.pow(3, startLvl)" src/systems/hole.ts` → 1 line (568); `KEEP_TOOL_IDS` → import + one use (unchanged).
- [PASS] `npx tsc --noEmit -p .` → no output (clean).
Not run, by PP's order (scenarios run after the reviewer): lines 1-16, 18-21, 24-26 (E1-E17, `scenario-balance.js` B3/C12/F1/A2/A3, `scenario-small-batch.js` G9/D13/F6).

## Checks written
`tools/smoke/scenario-endgame-boost.js`: E1, E2, E3a, E3b, E4, E5, E6, E7, E8, E9, E10, E11, E12 (with screenshot `shadow-behind.png`, check by eye), E13, E14, E15, E16, E17.
`tools/smoke/scenario-balance.js`: B3 and C12 expect 1000 XP, F1 expects "1000 XP" in the King card (data change, step 2).
E18 is the static grep above (line 27).

Commands:
- `URL_QUERY='' FAKELOCK=1 DEV_PORT=5199 CDP_PORT=9424 MAXPOLL=2400 node tools/smoke/smoke.mjs eb-out tools/smoke/scenario-endgame-boost.js`
- `CDP_PORT=9421 node tools/smoke/smoke.mjs bal-out tools/smoke/scenario-balance.js` (B3, C12, F1, A2, A3)
- `URL_QUERY='' DEV_PORT=5199 CDP_PORT=9423 MAXPOLL=2400 node tools/smoke/smoke.mjs sb-out tools/smoke/scenario-small-batch.js` (G9, D13, F6)

## Deviations from the plan
- E5 feeds the King through `hole.consume(k, undefined, true)` (machine path) instead of copying B3's thrown King; B3/C12 in `scenario-balance.js` cover the thrown and fan paths.
- E13 forces the fallback by stubbing `env.holeDist` to 0 for one call instead of moving the hole: same branch, no hole rebuild.
- `forEachNear` skip also hides a lurking Shadow from hole shockwave/boom, angry kick and wizard cast (all `forEachNear` callers); the plan's Reach says the same ("All skip a lurking shadow except the player").

## Rejected
- none.

## Round 2 (PP, Slack 2026-10-21 17:05)
PP verbatim: "2. Daj od 8 poziomu ceny podwójne / 3a / 4. Tak dodaj jakiś dźwięk dziwny do tego jakieś klikanie czy coś / 5. Co to jest / 6. Nie miałem za każdym razem gold hour na początku i rzucałem wszystkie jako bullseye i zaraz kasa była".
Interpretation: the three end rows open at hole level 8 and every level costs twice as much; the Shadow Gnome clicks quietly when it appears and while it stares (the 20 s grace), nothing after; the event name goes back to "..." until PP answers; point 6 is an analysis only (`2026-10-21-bullseye-early-money.md`).
Rung: reused `U()` rows, the `noiseBuf` and `gate()` in `audio.ts`, the existing `decide()` tick (0.25-0.45 s) and `lurking()`; one new sound function, `clicks(x, z)`, because no existing sound is a click burst and none is panned.

Gotowe, gdy:
- [PASS] the rows open at 8 and cost double — `grep -n "U('xpBoost\|U('mushStorm\|U('goldSpores" src/data/upgrades.ts` → 800000 / 500000 / 2000000, hole 8 on all three.
- [PASS] the event is "..." again — `grep -rn "NIGHT VISITOR" src CHANGELOG.md docs/SPEC.md docs/PLAN.md tools/smoke` → no lines.
- [PASS] the shadow clicks on spawn and only while lurking — `grep -rn "audio.clicks" src` → `events.ts:280` (spawn) and `gnomes.ts:759` (`lurking(g) &&`, in the stalk branch, after the vanish check).
- [PASS] types — `npx tsc --noEmit -p .` → exit 0; `node --check tools/smoke/scenario-endgame-boost.js` → exit 0.
Written, not run (PP's order): E3a/E3b (locked at 7, open at 8, doubled prices `$800k $2m $5m $12.5m $31.3m`, `$500k $1.25m $3.13m $7.81m $19.5m`, `$2m $5m $12.5m $31.3m $78.1m`), E15 (legend row and banner read "..."), E19 (one `clicks` call on spawn at the shadow's spot, at least one while `life < 20`, none at `life 25`).
Rejected: none.

## Round 3: FASTEST LVL 12 with the rows at hole 8 (review finding 7)
Question: the plan said a run under the 120 s floor is impossible, but it assumed the rows open at hole 10. Recomputed for a run after a rebirth (Head Start 7 = $218,700, Deep Value 15 = x4, Deep Hunger 9 = x3.25, Keep Tools: crates, vacuums, magnet kept).
Numbers from the code (fact):
- XP to L12: 11,305 in total; 2,305 before hole 8, 9,000 from 8 to 12 (`holeLevels.ts`).
- XP multiplier: Hole Hunger 5 (about $2.8k) x Deep Hunger 9 = x4.875; Bottomless Hunger adds x1.25 per level from hole 8, first level $800k (`hole.ts:82`, `upgrades.ts:109`).
- A crate dump pays full XP (`hole.ts:170`, `machine === 'crate'`); fans, vacuums and robots pay 0.25. A full crate holds 60 gnomes (`crateCap`, Bigger Crate 8).
- From hole 6 the Golden Hour mushroom turns the yard AND every new factory gnome golden (`gnomes.ts:217`): 10 XP each instead of 1 (`gnomeTypes.ts:42`). Long Trip 4 (about $2.1k) makes it 45 s; since this round the event lasts the whole 45 s.
- Mushroom chance per eaten gnome 6.25 % with Spore Bag 5 (about $1.6k), Golden Hour 8 of 118 weight, Rainbow (now also a Golden Hour) 2 of 118: about one Golden Hour per 190 eaten gnomes, crate dumps included.
Estimate (inference, not measured): with $218,700 the factory gets about Gears 10 and Bigger Batches 6, about 16 gnomes/s into a crate at the landing spot, so one crate cycle (fill, drag, dump) is about 10 s.
- Hole 1 to 6: 805 XP / 4.875 = 165 gnome-XP, three crates of plain gnomes, about 30-40 s.
- Hole 6 to 12 without a Golden Hour: 10,500 XP, 292 XP per plain crate, 36 crates, about 6 min.
- Hole 6 to 12 with one Golden Hour: 2,925 XP per golden crate, about 3.6 crates, about 40 s, inside one 45 s Golden Hour; the first Golden Hour comes after 0-3 crates of waiting.
- Best lucky run: about 70-110 s. Bottomless Hunger 1 at hole 8 (bought from the first golden crate, $144k+ each) cuts the 8-12 part by 20 %, about 6 s.
Conclusion: a run under 120 s looks possible, but the hole-8 rows are not the cause. The cause is the Golden Hour (10 XP golden gnomes from hole 6) dumped by crates at full XP with Deep Hunger 9; the rows at hole 10 would leave it about the same. No code changed: the fix is a product choice for PP (for example: golden gnomes give plain XP, the crate pays 0.25 XP for golden gnomes, or a higher floor), so it goes back to the orchestrator.

## Work progress
- 2026-10-21: code, texts, scenario written; tsc clean; scenarios not run (PP's order).
- 2026-10-21 round 2: rows at hole 8 with doubled prices, shadow clicks, "..." name back, bullseye analysis; tsc clean; scenarios not run (PP's order).
