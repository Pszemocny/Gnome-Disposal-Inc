# Tree expansion + endgame prices (implementation)

## Problem

PP (verbatim): "to zrob najpierw rozbuduj to drzewko wiecej wiatrakow i kazde narzedzie ma osobne fuzes jako ulepszenie", "wiatraki moga miec sile nadmuchu", "pasy transportowe moga miec szerokosc", and on the corrected questions "ok plan dobry". Two plans built together: `2026-10-21-plan-endgame.md` (final) and `2026-10-21-plan-tree-expansion.md` (final, its "Endgame overrides" win).

Interpretation: every question of both plans takes option a. The late surcharge stays 1.3 (endgame question 2 unanswered). The Deep caps (endgame step 3) are built, because PP accepted 3a.

## Summary

- Prices: levels above the 5th cost x1.3 more per level. Crates (flat $70), placeable tools (whole Tools tab: the non-placeable Tools rows all have max <= 5, so `!TOOL_IDS.includes` and "whole tab" give the same prices) and Deep are exempt.
- Deep caps 15 / 7 / 6 / 9 (Keep Tools stays 1).
- 20 Cooling Fans at x1.4. Big Blades (4 x +25 % push along the fan axis; the lift term stays, so a level fan never makes gnomes hover).
- Wide Belt (3 x +0.6 m). Placed belts are rebuilt in place on the same `Machine` and body (new model and colliders). The model grows from the old width in about 0.25 s. A belt that now overlaps something goes back to the inventory with a shop message; the same check runs when a save or a blueprint is loaded.
- Nine generated `<Tool> Fuses` rows (short names, 1/4 of the tool price, min $100, x1.8, 5 levels, hole `max(5, tool hole)`). Old saves: the global `fuses` level goes to every tool (the higher level wins), `fuses = 0` only deletes the key.
- Shop tree packing: a root takes the lowest free row of its column, a child the first free row at or below its parent. Tools: 6 rows x 8 columns, scale 0.83 at 1280x720, no scroll. Other tabs keep their rows.
- Ladder: data rows and the migration block copy existing patterns (rung 2); `fanPush`, `beltWidth`, `machineBox` follow `robotArea()` (rung 2); `colliderDescs` is a pure move out of `place`; `rebuild`, `overlaps` and the packing change are rung 6, each needed by a scenario (side-by-side belts, blueprint undo, 9-row tree).

Note for later: a revert of the Deep caps needs a shard refund like `state.ts:122-133`, because the boot clamp (`main.ts`) lowers bought levels without giving shards back.

## Work progress

### Gotowe, gdy (endgame plan, final, with the tree-expansion overrides)

Run: `URL_QUERY='' DEV_PORT=5176 CDP_PORT=9431 MAXPOLL=800 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-endgame.js` → 17/17 PASS.

- [PASS] 1 premium5 "$254" — RESULT `premium5:"$254"`
- [PASS] 2 premium6 $494, coil6 $209, arm6 $149, gears16 $513k — `PASS 2 $494 $209 $149 $513k`
- [PASS] 3 box6 / crateSize6 $70 — `PASS 3 $70 $70`
- [PASS] 4 fan6 "$1.08k" (override) — `PASS 4 $1.08k`; D1/D2 see line 16
- [PASS] 5 dValue6price 8, dValue11price 58 — `PASS 5 8 58 💎 58`
- [PASS] 6 caps 15/7/6/9, node text 10/15 — `PASS 6 15/7/6/9 10/15`
- [PASS] 7 keepToolsMax 1 — `PASS 7`
- [PASS] 8 old save dValue 10, next 58, no clamp — iframe boot: `{"dValue":10,"next":"LVL 10/15 · 💎 58","clampNote":"none"}` (clampNote = nothing lowered; the boot clamp has no note)
- [PASS] 9 value 20, head "LVL 20/20 · MAX", money same — `{"value":20,"money":12345,"head":"LVL 20/20 · MAX"}`
- [PASS] 10 kept robot next "$7.17k", kept fan next "$1.08k" — `PASS 10 $7.17k $1.08k`
- [PASS] 11 legend Premium $494, Deep Value 10/15 (robot $1.49k) — `PASS 11 $494 10/15 $1.49k`
- [PASS] 12 Premium AFFORD, hover text unchanged — `now: x1.4 money, next: x1.5 money` (the plan wrote "now: +40%"; the real EFFECT text is `x1.4 money`)
- [PASS] 13 valueScale with dValue 15 = 4 x mult — `PASS 13 4`; `grep -n "deep('dXp') \* 0.25" src/systems/hole.ts` → 1 line
- [PASS] 14 shard formula untouched — `grep -nF 'Math.sqrt(s.totalEarned / 20000)' src/systems/hole.ts` → 1 line
- [PASS] 15 12 hole levels — `grep -c 'xp:' src/data/holeLevels.ts` → 13 = 12 level rows + 1 line of the interface (`xp: number;`)
- [PASS] 16 scenario-balance D1 `[769,1076,1506,2109,2952,4133]`, D2 `[2848,4272,6408,9611]` — `PASS D1 769,1076,1506,2109,2952,4133 11/11 10 free 1 extra 5786`, `PASS D2 2848,4272,6408,9611 10`
- [PASS] 17 robot6 $1.49k, robot12 $7.17k; rule line — `PASS 17 $1.49k $7.17k`; `grep -n "TOOL_IDS.includes(u.id)" src/data/upgrades.ts` → line 130
- [PASS] 18 crank6 $5.92k; "670k" in upgrades.ts and SPEC — `PASS 18 $5.92k`; grep → upgrades.ts:41, SPEC.md:170
- [PASS] 19 SPEC line 18 keeps "ceny rosną łagodnie" and ends with "zastępuje „łagodnie”" — grep → both on line 18
- [PASS] 20 guard with fan max forced to 4 — `RESULT FAIL: balance batch not landed (fan max 4)`; smoke.mjs always exits 0, so the exit code 1 comes from `| grep -q "FAIL: balance batch not landed"` (wrapper printed `guard exit 1`)
- [PASS] 21 CHANGELOG top section says "next rebirth" — grep → CHANGELOG.md:10
- [PASS] 22 refund sentence — this note, section Summary ("shard refund"); the plan named `2026-10-21-endgame.md`, the brief asked for one note, this file
- [PASS] 23 premiumDouble level +1, money 0 — `PASS 23 {"level":1,"money":0}`
- [PASS] 24 `npx tsc --noEmit` → exit 0. [PENDING] `scenario-esc.js` needs FULL=1 (pointer lock), not run (PP 2026-10-24: no FULL=1).

### Gotowe, gdy (tree-expansion plan, final)

Run: `URL_QUERY='' DEV_PORT=5176 CDP_PORT=9433 MAXPOLL=2800 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-tree-expansion.js` → 44/45 PASS (last run), F3 FAIL.

- [PASS] F1 — `{"max":20,"prices5to10":[769,1076,1506,2109,2952,4133],"price11":5786,"price20":119527,"total20":417851,"hotbar":"0/20","placed":20,"free":0}`
- [PASS] F2 — `{"oldSaveFan":10,"oldSave4":4,"blueprintFans":10}` (loadState + blueprint LOAD, not an iframe)
- [FAIL] F3 — `{"land":3,"beltWidth":3,"fanPower":4,"robots":12,"gnomes":300,"frames":1801,"updateP95":1.1,"updateMax":11.4,"stepP95":1.5,"calls0":58,"calls30":136}`. p95 passes (gate 2.0 ms), max fails (gate 8 ms). Details below.
- [PASS] F4 — `{"fuses":270,"boxes":54,"skipped":0,"tools":54}`
- [PASS] F5 — TOOL_IDS `["box","trampoline","panel","fan","conveyor","wheel","magnet","cannon","vacuum","blackhole","robot"]`; `grep -rn NOT_PLACEABLE src` → 0
- [PASS] F6 — `{"fan6":"$1.08k","belt7":"$2.85k","robot6":"$1.49k","premium6":"$494"}`
- [PASS] P1 — first-frame impulse equals today's `55 x (1 - d/10) x mass x dt` exactly (`relErr 0`), lift/push 0.35 (scenario-fan-strong does not exist, so the impulse is compared with the formula instead)
- [PASS] P2 — push along the axis x2.000, lift unchanged (0.35); flown in 0.6 s L4/L0 = 1.65; gnome at 10.7 m untouched. (Over 1 s the ratio was 1.43-1.52: after leaving the 10 m stream both gnomes only roll on friction.)
- [PASS] P3 — `{"puffSpeed":16,"spinTarget":50,"spinAfter1Frame":26.61,"spinAfter0_5s":46.83}`
- [PASS] P4 — static: `fanPower` is read only in `src/entities/machines.ts`; the blower's `fx.wind` call (`sweeper.ts:165`) passes no `k`. Not measured with the blower in hand.
- [PASS] P5 — `{"gnomesBefore":20,"gnomesAfter":20}`
- [PASS] P5b — `{"half":22,"outsideL0":0,"outsideL4":0}`; `FAN_TOP` not needed
- [PASS] P5c — `{"maxY":0.5}`
- [PASS] P6 — `{"parent":"fan","cls":"needs","effect":"x1.00 push, next: x1.25 push","price":"$150"}`
- [PASS] P7 — iframe boot + rebirth with Keep Tools: `{"kept":{"fanPower":4,"beltWidth":3,"fanFuses":5},"rebirths":1}`
- [PASS] U1 — 9 nodes, names as planned, no `fuses` node, holes `{fanFuses:5, cannonFuses:6, vacuumFuses:8, blackholeFuses:10}`
- [PASS] U2 — `{"fanBlownAfter3":3,"fanBrokenAfter3":0,"fanBrokenAfter4":30,"trampBrokenAfter1":30}`
- [PASS] U3 — `{"robotFuses":2,"blownAfterHit":1}`
- [PASS] U4 — perTool 4 x 9, key gone, note "Fuses are now per tool: every tool got your old level.", saved JSON without "fuses"
- [PASS] U5 — old save `fuses 5` → boot → rebirth: all nine `*Fuses` = 5
- [PASS] U6 — `{"target":"trampoline"}`
- [PASS] U7 — `{"boxFuses":0,"panelFuses":0,"nodes":0}`
- [PASS] U8-U13 — Belt Fuses hole 5 $100 x1.8; Wheel 5 $125; Magnet 5 $500; Cannon 6 $1k; Vacuum 8 $2k; Black Hole 10 $12.5k
- [PASS] U14 — `{"legendRows":63,"upgrades":63,"fuseRows":9}`; literal rows in upgrades.ts = 54 (the nine Fuses rows are generated, so the plan's "rg → 63" cannot match; `UPGRADES.length` = 63)
- [PASS] U15 — `{"rows":6,"cols":8,"scale":0.832,"scrollMax":0,"cutNames":0}`; screenshot Tools-1280 checked by eye: 6 rows, every name readable
- [PASS] U15b — `{"plow":3,"magnet":3,"factory":2,"movement":4,"combos":2,"bonuses":4}`
- [PASS] U16 — `{"blownAfterClamp":5,"fanFusesAfterBoot":5}`
- [PASS] U17 — `{"fanFuses":4,"trampolineFuses":2,"robotFuses":2}`
- [PASS] U18 — key deleted, 0 notes
- [PASS] B1 — width 1.3, rail 0.7, body half 0.75, gnome at lx 0.68 carried, centring `c / lx = -2` (byte-identical rule). `lxAfter0_5s` = -0.161: the plan's "< 0.05" was never true at -2 x lx (0.4 x e^-1 = 0.15), so the check is the centring ratio
- [PASS] B2 — same 3 objects, widths 1.9, positions, blown, spin rate kept, fuse box x 1.1, blueprint `last` unchanged
- [PASS] B2b — scale samples 0.684 → 0.965 over 12 frames, 1 after 0.3 s
- [PASS] B2c — `{"pairAfter":1,"available":1,"msg":"Wide Belt: 1 belt(s) had no room and went back to your inventory.","loneBeltKept":true}`
- [PASS] B2d — gnome speed next frame 0.19 m/s
- [PASS] B3 — `{"carried":6,"spread":1.88,"vz":4.61,"tossed":true}`
- [PASS] B4 — real placement ghost: `{"blockedL3":true,"blockedL0":false}`
- [PASS] B5 — robot grid blocked cells L3 > L0
- [PASS] B6 — repeat.x 2, offset delta equals `dt x spinRate x 0.13 x 4 / 2.94`; `grep -rn "Math.min(1, dt" src` → 0 lines (unchanged)
- [PASS] B7 — iframe boot: widths `[2.5,2.5,2.5,2.5]`, the fifth belt (1.4 m away) back to the inventory, blueprint belt 2.5 m
- [PASS] B8 — `{"parent":"conveyor","clsWithoutBelt":"needs","effect":"1.3 m wide, next: 1.9 m wide","price":"$400"}`
- [PASS] B9 — `machineBox('conveyor')` half 1.65 → mushroom radius and stack reach 1.95
- [PASS] T1 — "Big Blades|Wide Belt|Fuses" in SPEC (8), PLAN (2), CHANGELOG (4), legend (1); "x1,4" on SPEC:104 and SPEC:124 (the rewritten decision, was line 123)
- [PASS] T2 — tsc exit 0; `scenario-balance.js` 42/42 PASS on the second run (`D1 769,...,4133 11/11 free 1 extra 5786`, `D3 270 54 0`, `E1 2 0`, `E3`); `upgrades.fuses` in it → 0 lines. The plan's hotbar "1/11" is wrong: D1 reads the hotbar with nothing placed, so it prints available/owned = `11/11`; the "one fan left" check is `placed.fanFree === 1` after 10 placements.

Other runs: `scenario-tutorial-goals.js` → all lines PASS (32 output lines, no FAIL). `scenario-balance.js` first run (in parallel with the tutorial run): C19 FAIL once (`kickedMidAir money 14.175 vs plain 9.45`), second run alone 42/42 PASS; C19 (kick in mid-air) does not touch any changed code path.

### F3: what I measured and tried

20 s runs on Dark Forest, 20 fans, 10 belts in a row 4.5 m apart, 300 gnomes, `machines.update` max:
- belts 1.3 m + 12 robots: max 5.1 ms, 0 frames over 8 ms
- belts 3.1 m + 12 robots: max 11-18 ms, 8-16 frames over 8 ms
- belts 3.1 m + 1 robot: max 3.7 ms; + 3 robots: max 9-10 ms
- belts 3.1 m, no robots: max 1.0 ms

So when wide belts close the gaps (a belt plus robot clearance is 4.7 m, the row is 4.5 m apart), each robot's route search costs about 3-4 ms and several robots search in the same frame. Tried and reverted (no change in max): (1) at most one yard-wide search per frame; (2) a random 0.75-1.25 x replan interval. Two attempts, stop per the rule. Not in this diff: `robots.ts` only switched to `machineBox`.

### Odrzucone

- Geometry leak on rebuild (plan-performance Low): the old root is dropped like every pick-up today, three purchases per run.
- `FAN_TOP` fence rule: P5b green at L0 and L4, so the fallback line is not added.

### Deviations from the plans

- `overlaps()` tests every collider pair (`intersectsShape`) instead of `intersectionsWithShape`: the scene query does not see colliders created in the same frame (probe: false right after `place`, true after 2 frames), and `restore()` checks belts placed in the same frame.
- Belt scan radius `max(2.4, hypot(1.6, hw + 0.05, 1.65))` instead of `hypot(1.6, hw) + 0.65`: the plan's formula gives 2.377 m at L0, not today's 2.4 m.
- Wide Belt scale damp runs only while `scale.y === 1`, so it never fights the hole's sink animation (`hole.ts`, uniform scale).
- Players and coins are excluded from the overlap check by collision group (`player.body` is private).
- One ai-work note for both plans (brief), not `2026-10-21-endgame.md` / `2026-10-21-tree-expansion.md`.
- CHANGELOG bullets without "Test:" (PP rule 2026-10-24); the tests are this note.

## Orchestrator decision on F3 (2026-10-24)

Gate "max frame ≤ 8 ms" for 10 belts at Wide Belt 3 in a wall + 12 robots on Dark Forest dropped: worst frames 10-18 ms come from several robots running the whole-yard route search in one frame, only in that extreme wall layout; p95 stays 1.1 ms, a normal yard stays at 5.1 ms worst. Two fixes (one search per frame, random replan) measured and reverted, no gain. Revisit only if PP's `?stats` line or the Supabase error/slow-frame log shows robot-search hitches in real play.

## Review round 1 (code-reviewer → fix-finding, 2026-10-24)

- Cause: the Wide Belt room check (`overlaps`) counted things resting on or moving beside a belt as blockers and ignored the hole. Fix: only fixed bodies block; only the strip the belt gains sideways is tested, below the rail top; the placement test `footprintOverHole` is shared from machines.ts.
- [PASS] B10 panel on the rails → belt kept; B11 crate on the belt → kept; B12 robot beside → kept; B13 crate saved before the belt → kept on restore; B14 belt by the rim → back to inventory instead of hanging over the hole.
- [PASS] B15 player standing beside a widened belt is pushed out the shortest way (`player.pushOutOf`), `awayMove 1`.
- [PASS] B16 a belt already gliding into the hole keeps its old width and leaves (`hole.goingAway`).
- scenario-tree-expansion 51/52 (F3 accepted above), scenario-balance 42/42, tsc clean.
