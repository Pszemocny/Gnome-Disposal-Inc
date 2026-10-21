# Plan: endgame (shop runs out at hole level 8; what shards buy)

Spec: PP, terminal 2026-10-20 (verbatim): "wieksze nagrody za diamenty albo wiecej poziomow. drozsze najwyzsze levele bo teraz przy hole lvl 8 jestem wymaxowany a moze lepiej wiecej leveli." BOARD.md "Plan na noc" N2 (diamonds) and N3 (end of the tree).
"Diamenty" = Hole Shards: the only gem currency in the game, drawn as 💎 in the HUD (`hud.ts:376`), the shop (`shop.ts:284`, Deep tab icon `icons.ts:21`) and the legend; earned once per rebirth (`hole.ts:500`), spent only on the five Deep upgrades (`upgrades.ts:90-94`). No other gem or diamond exists (`rg -i "gem|diamond"` finds only the icon).
Trivial check: a price formula with three readers (shop buy, shop row, legend), five Deep level caps read by four formulas in `hole.ts`, and a headless scenario; it changes what every player pays from level 6 of every upgrade.
Decision age: the repo is two days old; no decision this plan rests on is older than 60 days.
Sequencing: lands after `2026-10-20-plan-balance-batch.md` (fans/belts 10, XP by feeding) and `2026-10-20-plan-auto-lands.md`; both change numbers this plan's model already assumes.

## Plan v0 (plan-author)

### Goal
A player with machines and the Magnet Gun still has upgrade levels to buy at hole levels 9-12 (levels above the 5th of every priced upgrade cost extra x1.3 per level), and the Deep has enough levels that shards from several rebirths have somewhere to go.

### Numbers (economy model, `<scratchpad>/econ/econ2.mjs`, reads `src/data` by regex; post-batch rules: hand x1 XP, gun ball x1/sqrt(n), machines x0.25, lands at 3/5/8, hole 15/19/23/27 m)
"All bought" = the minute and hole level at which the greedy buyer (priority list, then everything cheapest first) owns every money upgrade at max. "Typical" = Magnet Gun throws plus robots, Auto Crank and machines (PP's style). Model income is lower than PP's real play (events, mushrooms, Deep bonuses): PP reports "maxed at L8" on today's build, the model's typical path reaches that only after L12; the x10 column is a calibration toward PP's numbers, not a measurement.

| variant | shop total | typical: L12 at / all bought | automation | crate | hands | typical x10 income: all bought |
|---|---|---|---|---|---|---|
| today's build (XP x1 for all) | $994k | 14 min / 25 min @L12 | 18 / 29 @L12 | 21 / 35 @L12 | 280 / 138 @L10 | 11 min / 21 @L12 |
| after the batch, no change (baseline) | $994k | 34 / **31 @L10** | 48 / 43 @L10 | 52 / 51 @L11 | 280 / 138 @L10 | 25 / **21 @L10** |
| (a) levels 6+ cost x1.3 per level (recommended) | $14.4M | 53 / **59 @L12** | 50 / 63 @L12 | 93 / 145 @L12 | >360 / never | 40 / 40 @L11 (x3 income) |
| (a') levels 6+ cost x1.5 per level | $95M | 56 / 157 @L12 | 56 / 132 @L12 | 118 / never | never | 45 / 48 @L12 |
| (a'') growth +0.1 on every upgrade | $2.05M | 39 / 37 @L11 | 50 / 50 @L11 | 63 / 66 @L12 | 325 / 206 @L10 | - |
| (b) level caps x1.5 on every stat upgrade | $28.4M | 37 / 39 @L12 | 47 / 51 @L12 | 52 / 83 @L12 | 168 / 170 @L12 | 27 / 28 @L12 |
| (b') caps x1.5 on economy upgrades only | $28.4M | 35 / 36 @L12 | 47 / 49 @L12 | 52 / 86 @L12 | 236 / never | 25 / 26 @L12 |
| (c) 16 hole levels, prices as today | $994k | L16 at 51 / 31 @L10 | 80 / 43 @L10 | 104 / 51 @L11 | - / 138 @L10 | 42 / 21 @L10 |
| (a) + (c) 16 levels | $14.4M | L16 at 73 / 59 @L12 | 82 / 63 @L14 | 155 / 140 @L15 | never | - |

Reading: after the balance batch the money per hole level of a machine player grows 4-8x (typical earns $26M to L12 instead of $3.2M), so the $994k shop runs out earlier than today, not later; the shop must grow 10-30x at the top. (a) x1.3 lands "all bought" at L12 for typical, automation and crate in the model; x1.5 overshoots (the last Premium level costs $48.5M, nobody buys it); (b) fits too but every extra level has a physical effect that needs its own check (Strong Arm 9 = x2.35 throw, Magnet Coil 15 = 3.8 m ball of about 250 gnomes, Running Shoes 8 = x2 speed, Spring Socks 5, Wider Plow 8 = 9 m blade); (c) alone does not touch the problem (still all bought at L10) and PP deferred run length on 2026-10-20 ("Gra przechodzi się w pół godziny": "na razie zostawiamy"). Hands-only never maxes under (a); PP 2026-10-20 (BOARD q5): "nikt nie gra samymi rękami".
Top prices under (a) x1.3 (today -> new): Premium Gnomes 20th $110.8k -> $5.67M (all 20: $332k -> $11.65M), Factory Gears 16th $28.6k -> $513k, Auto Crank 12th $51.9k -> $326k, Combo Cap 12th $51.4k -> $323k, Cleaning Robot 12th $7.2k -> $45k, Cooling Fan 6th-10th $4,952 / $9,409 / $17,877 / $33,966 / $64,535 -> $6,438 / $15,902 / $39,277 / $97,014 / $239,624, Conveyor 7th-10th $2,847 / $4,271 / $6,407 / $9,610 -> $4,813 / $9,385 / $18,300 / $35,685. Levels 1-5 of everything unchanged (Premium 5th stays $254, 6th $380 -> $494).
Shards: a run gives `5 + sqrt(earned / 20000) + eaten / 2000`; model post-batch 28-86 per run (today 13-39) because earned per run grows. The Deep catalogue costs 302 shards today (Deep Value 119, Head Start 62, Keep Tools 8, Deep Combo 45, Deep Hunger 68), so after the batch 3-6 rebirths buy everything. Caps Value 15 / Head Start 7 / Combo 6 / Hunger 9 make it 1,672 shards (about 15 rebirths); the new levels cost 58, 87, 130, 195, 292 (Value), 64, 128 (Start), 48, 96 (Combo), 49, 83, 140 (Hunger). Effects at the new caps: money x4, start money $218,700, combo cap +3, XP x3.25.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | money upgrade with a growing price, owned 0-4 | shop shows / buys the next level | price = `ceil(cost x growth^owned)`, as today (Premium 5th $254, Strong Arm 5th $76) | PP "najwyższe levele" (not the low ones) |
| 2 | money upgrade with a growing price, owned >= 5 | shop shows / buys | price = `ceil(cost x growth^owned x 1.3^(owned-4))`: Premium 6th $494 (was $380), Magnet Coil 6th $209 (was $161), Strong Arm 6th $149 (was $114), Factory Gears 16th $513,349 | PP "droższe najwyższe levele"; model row (a) |
| 3 | `spec silent` flat-price upgrades (Wooden Crate, Bigger Crate: growth 1) owned >= 5 | shop | still $70 | PP 2026-10-19 "every crate step costs a flat $70" (`upgrades.ts:53`) |
| 4 | `spec silent` placeable tools with a growing price (fan, belt, panel, trampoline, robot) owned >= 5 | shop | surcharge applies: fan 6th $6,438 ... 10th $239,624; belt 7th $4,813 ... 10th $35,685 | balance batch decision 4 ("ostatnie wentylatory pod koniec gry") |
| 5 | `spec silent` Deep upgrades (shards) owned >= 5 | shop, legend | no surcharge: Deep Value 6th stays 8 💎, 11th 58 💎 | N2 handles the Deep by caps, not prices |
| 6 | Deep tab after the first shard | render | Deep Value LVL n/15, Head Start n/7, Deep Combo n/6, Deep Hunger n/9, Keep Tools n/1; levels past 8 drawn as text `n/15`, not pips (`shop.ts:297`) | PP "więcej poziomów" (shards) |
| 7 | `spec silent` Keep Tools | render | stays max 1 (one-off) | one-offs stay 1 (`more-upgrade-levels.md`) |
| 8 | old save with Deep Value 10 (the old max) | load | loads as 10/15, next level buyable at 58 💎; no clamp triggers (`main.ts:49` only lowers) | state.ts, main.ts:46-50 |
| 9 | old save with every money upgrade at max (PP's) | load, shop | levels unchanged, rows say MAX, no refund, no charge; the new prices matter after a rebirth | nothing resets levels |
| 10 | rebirth with Keep Tools | new run | kept tool levels stay; their next level costs the surcharged price (e.g. robot 12th $44,983) | `hole.ts:520-526` |
| 11 | legend (L) → Tools | render | "Price now" column shows the surcharged price for owned >= 5; Deep rows show the new `n/max` | `legend.ts:203-205` |
| 12 | shop row with EFFECT hover (Premium: "now +50%, next +60%") | hover | text unchanged; AFFORD badge and the green ring use the surcharged price | `shop.ts:281-289` |
| 13 | Deep effects at the new caps | formulas | `valueScale` x(1 + 0.2 x 15) = x4, XP x(1 + 0.25 x 9), combo cap +0.5 x 6, start money 100 x 3^7 = $218,700 | `hole.ts:56,70,149,518-519` |
| 14 | `spec silent` shard reward per rebirth | rebirth | formula unchanged (`5 + sqrt(earned/20000) + eaten/2000`) | "większe nagrody za diamenty" read as "what diamonds buy", BOARD N2 |
| 15 | `spec silent` hole levels | play | still 12; The Deep opens at 12 as today | option (c) rejected (numbers above); PP deferred run length 2026-10-20 |
| 16 | `tools/smoke/scenario-balance.js` D1/D2 (if the batch landed) | run | expected fan 6-10 and belt 7-10 prices are the surcharged ones | row 4 |

### Reach
- `src/data/upgrades.ts:106` `upgradeCost(u, level)`: callers `src/ui/shop.ts:219` (buy, the only money writer for purchases), `src/ui/shop.ts:282` (`rowData`: price text, `poor`, `afford`), `src/ui/legend.ts:203` (Price now). No other price computation in `src` (`rg upgradeCost`). `EFFECT` texts (`shop.ts:100-130`) read levels, not prices.
- Deep caps `max` on `dValue/dStart/dCombo/dXp`: readers `src/main.ts:49` (clamp down only), `src/ui/shop.ts:218` (buy guard), `:281` (maxed), `:297` (pips vs text), `:310`, `src/ui/legend.ts:193,203,205`. Effect formulas reading the level: `src/systems/hole.ts:56` (dCombo), `:70` (dValue), `:149` (dXp; the balance batch rewrites this line, keep its `deep('dXp')` factor), `:518-519` (dStart), `src/ui/shop.ts:108` (comboCap text).
- Shards: `hole.ts:500-505` formula, `hud.ts:341-376`, `legend.ts:248`, `shop.ts:221-224` spend; untouched.
- Save: no new field, no migration (caps only grow; `freshState` keeps `deep` and `shards`).
- Front/response shape: none (static game). Texts: `upgrades.ts:19-20` comment, `docs/SPEC.md:18` (decision line stays), shop section (new sentence), `:172` (Deep caps), `docs/PLAN.md:41,90`, `CHANGELOG.md` top section (memory rule), `BOARD.md` N2/N3 status.

### Data
- No database. Prices are computed only when the shop or legend renders (open, tab click, buy): one `Math.pow` more per row, about 60 rows, nothing per frame.
- Model volume: shop total $994k -> $14.35M (x1.3); typical path earns $18M to L12 in the model; Deep 302 -> 1,672 shards vs 28-86 shards per post-batch run.

### Steps (edit order)
1. `src/data/upgrades.ts:106` — `export const LATE_PRICE = 1.3; // levels above the 5th cost extra x1.3 per level: the shop ran out at hole level 8 (PP 2026-10-20 "drozsze najwyzsze levele"); not for flat prices (crates) or shards` and `upgradeCost(u, level)` returns `Math.ceil(u.cost * Math.pow(u.growth, level) * (u.growth > 1 && u.currency !== 'shards' ? Math.pow(LATE_PRICE, Math.max(0, level - 4)) : 1))`. Comment lines 19-20: "(x1.25-x2.5 per level, x1.3 extra per level above the 5th)". Test: scenario `01_prices` (rows 1-5).
2. `src/data/upgrades.ts:90-94` — `dValue` max 10 -> 15, `dStart` 5 -> 7, `dCombo` 4 -> 6, `dXp` 6 -> 9; row comment `// caps raised (PP 2026-10-20 "wiecej poziomow" for shards): a post-batch run gives 30-90 shards, the old catalogue (302) was gone in a few rebirths`. Test: `02_deep` (rows 6-8, 13).
3. Texts — `docs/SPEC.md` shop section: "Każdy poziom ulepszenia powyżej piątego kosztuje dodatkowo x1,3 za poziom (6. poziom x1,3, 7. x1,69...); skrzynie ($70) i Deep bez dopłaty" plus the decision "(PP, 2026-10-20) bo przy poziomie dziury 8 PP miał wszystko kupione, a po zmianie XP wg karmienia maszyny zarabiają na poziom 4-8x więcej"; line 172 new caps; `docs/PLAN.md:41` ("prices grow x1.25-x2.5 per level, x1.3 extra per level above the 5th"), `:90` caps; `CHANGELOG.md` top section (two bullets, each with "Test:"); `BOARD.md` N2/N3 "w kodzie, nie na 5300". Test: row 11 (legend reads data), `rg -n "x1,3" docs/SPEC.md`.
4. `tools/smoke/scenario-endgame.js` (harness of `scenario-esc.js`, dev server 5199, `g = window.gnome`): `01_prices` sets `g.state.upgrades = { value: 4, magPower: 5, throw: 5, factorySpeed: 15, box: 5, crateSize: 5, fan: 5 }`, money 1e9, opens the shop (`g.shop.open()` or E at the desk as `scenario-tree.js` did), reads the node head text per `[data-buy]` and clicks Premium once; `02_deep` sets `g.state.shards = 2000`, `g.state.deep = { dValue: 10 }`, `g.state.stats.rebirths = 1`, reads Deep nodes and buys Deep Value 11; `03_legend` opens L → Tools and reads the Premium and Deep Value rows; `04_oldsave` writes a save with `deep.dValue = 10` and `upgrades.value = 20` to localStorage and boots an iframe (as `scenario-prereqs.js` did for Glue). Prints one `RESULT {...}`. If `tools/smoke/scenario-balance.js` exists: change its D1 list to `[6438, 15902, 39277, 97014, 239624]` and D2 to `[4813, 9385, 18300, 35685]` (row 16; expected values follow the new rule).

### Tests
- `01_prices`: Premium 5th head `LVL 4/20 · $254` then (after buying) `LVL 5/20 · $494`; Magnet Coil `$209`; Strong Arm `$149`; Factory Gears `$513k`; Wooden Crate `$70`; Bigger Crate `$70`; Cooling Fan `$6.4k` (shop money format `$6k`-style, read `upgradeCost` exactness through the sub-$1k rows).
- `02_deep`: Deep tab shows `Deep Value LVL 10/15` with price `💎 58`; buy → shards 1942, `deep.dValue = 11`; Head Start `0/7`, Deep Combo `0/6`, Deep Hunger `0/9`, Keep Tools `0/1`; `g.hole.valueScale` with dValue 15 = 4 x hole mult.
- `03_legend`: Tools tab Premium row price cell `$494` at level 5; Deep Value row `10/15`.
- `04_oldsave`: iframe boot → `deep.dValue = 10`, `upgrades.value = 20`, money unchanged, no load note.
- `npx tsc --noEmit`; `tools/smoke/scenario-esc.js` as regression (shop open/close untouched).

### Done when
1. `01_prices → premium5 = "$254"`
2. `01_prices → premium6 = "$494" coil6 = "$209" arm6 = "$149" gears16 = "$513k"`
3. `01_prices → box6 = "$70" crateSize6 = "$70"`
4. `01_prices → fan6 = "$6.4k"` (and, if `scenario-balance.js` exists, its D1/D2 lines pass with the new lists)
5. `02_deep → dValue6price = 8 dValue11price = 58`
6. `02_deep → caps = "15/7/6/9"` (Deep Value / Head Start / Deep Combo / Deep Hunger node heads) and `dValueNodeText contains "10/15"`
7. `02_deep → keepToolsMax = 1`
8. `04_oldsave → dValue = 10 next = 58 clampNote = none`
9. `04_oldsave → value = 20 head = "LVL 20/20 · MAX" money = same`
10. `02_deep → afterRebirthKeptRobotNext = "$45k"` (robot 11 kept, next price) or `rg -n "KEEP_TOOL_IDS" src/systems/hole.ts → 1 line` (unchanged path)
11. `03_legend → premiumPrice = "$494" deepValueLevel = "10/15"`
12. `01_prices → premiumAfford = true premiumDesc contains "now: +40%"` (hover text unchanged, badge on the new price)
13. `02_deep → valueScale15 = 4 * mult` and `rg -n "deep\('dXp'\) \* 0.25" src/systems/hole.ts → 1 line`
14. `rg -n "Math.sqrt(s.totalEarned / 20000)" src/systems/hole.ts → 1 line` (shard formula untouched)
15. `rg -c "xp:" src/data/holeLevels.ts → 12`
16. `CDP_PORT=9421 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-balance.js → D1, D2 PASS with the new lists` (only if the file exists; else `ls tools/smoke/scenario-balance.js → No such file`)

### Assumptions (numbered)
1. "Wymaxowany przy hole lvl 8" means every money upgrade unlocked at level 8 is at max; the fix is for the next run and new players (PP's current save keeps its levels, row 9).
2. "Większe nagrody za diamenty albo więcej poziomów" is about the Deep catalogue (what shards buy), as BOARD N2 reads it; the shard count per rebirth is not changed, because after the balance batch it already doubles or triples (model: 28-86 vs 13-39).
3. "A może lepiej więcej leveli" = more upgrade levels (option b), compared in the table and rejected for the physics side effects; more hole levels (c) is listed with numbers for PP.
4. The economy model's absolute minutes are 2-10x pessimistic versus PP's play; the level at which the shop runs out shifts the same way in every variant, which is what the recommendation rests on.
5. Levels 1-5 stay at today's prices so the early game (tutorial, first tools, Trick Scope, Magnet Gun) does not change.

### Alternatives rejected
- (a') x1.5 per level: the last Premium level costs $48.5M and only the typical path buys everything, after 100 minutes at level 12; x1.3 reaches "all bought" at L12 in the model.
- (a'') growth +0.1 on every upgrade: the shop total only doubles ($2.05M), all bought at L11 for typical; also changes levels 2-5.
- (b) level caps x1.5: fits the money curve, but Strong Arm 9, Magnet Coil 15 (ball of about 250 gnomes), Running Shoes 8, Spring Socks 5, Wider Plow 8, Long Nozzle 6 (15 m) each need a physics and performance check; `more-upgrade-levels.md` already doubled Factory and Combos on 2026-10-20 and PP was still maxed at L8.
- (c) more hole levels (16 or 20): with today's prices the shop is still all bought at L10; it changes run length (typical L16 at 51-73 min), which PP deferred on 2026-10-20; also four new unlock texts, whispers and a hole 35+ m from the factory.
- (e) hole-level gating (levels above half unlock one per hole level): guarantees "something new at every level" regardless of income, but cash still piles up between unlocks and it adds a second rule to the shop and legend; kept as an option for PP (Open decisions 1d).
- (d') bigger shard rewards or stronger Deep effects per level: the first rebirth already buys +140% money and +75% XP; stronger per-level effects shorten the next run further.
- Price x hole multiplier ("inflation", every price x1..x10 with the hole): hands-only never maxes and prices jump at every level-up, which reads as a bug.

### Ladder
- `LATE_PRICE` constant and the one-line formula in `upgradeCost`: rung 6 (no existing helper; the spec sentence "droższe najwyższe levele").
- Deep caps: rung 5 (four numbers in data; "więcej poziomów").
- No new file except the headless scenario (Animation rule 12 / repo test convention), no new dependency, no save field, no shop or legend code (they read `upgradeCost` and `max` already: rung 2).

### Open decisions (for PP)
1. Jak ma dłużej starczać sklep: a) poziomy powyżej 5. drożeją dodatkowo x1,3 za poziom (tak buduję; w modelu gracz z maszynami kupuje ostatnią rzecz przy poziomie 12, Premium 20 kosztuje $5,7M zamiast $111k); b) x1,5 za poziom (ostatni poziom Premium $48,5M, w modelu nikt poza "typowym" tego nie kupi, a on dopiero 100 min po poziomie 12); c) więcej poziomów ulepszeń (limity x1,5), wtedy Strong Arm 9, Magnet Coil 15 (kula ok. 250 gnomów), buty x2 szybkości wymagają osobnych testów fizyki; d) odblokowywanie górnej połowy poziomów po jednym na poziom dziury, wtedy zawsze jest coś nowego, ale kasa i tak się odkłada. (rekomendacja: a, jedna stała, wczesna gra bez zmian)
2. Więcej poziomów dziury (12 → 16)? a) nie, zostaje 12 (tak buduję; sklep i tak kończy się na 10 przy dzisiejszych cenach, a długość gry odłożyłeś 2026-10-20); b) tak, 16 poziomów (typowa droga do The Deep 51-73 min zamiast 34-53, cztery nowe teksty odblokowań, dziura 35+ m od fabryki). (rekomendacja: a)
3. Diamenty: a) więcej poziomów Deep: Deep Value 15, Head Start 7, Deep Combo 6, Deep Hunger 9 (tak buduję; komplet 1 672 odłamków zamiast 302, przy 30-90 za odrodzenie po zmianie XP to ok. 15 odrodzeń zamiast 3-6); b) mocniejsze efekty za poziom (np. +30% kasy zamiast +20%), wtedy drugie odrodzenie kończy grę jeszcze szybciej; c) większa liczba odłamków za odrodzenie (wzór x2), wtedy Deep jest kompletny po 2-3 odrodzeniach. (rekomendacja: a)
4. [spec silent] Zakładam: dopłata x1,3 obejmuje też narzędzia do postawienia (wentylator 10. $239,6k zamiast $64,5k, taśma 10. $35,7k zamiast $9,6k, robot 12. $45k zamiast $7,2k) | Dowód: `upgrades.ts:61-62,69` mają rosnącą cenę jak ulepszenia poziomowe, a decyzja 4 partii balansu już chciała ostatnich wentylatorów pod koniec gry | Jeśli źle: komplet 10 wentylatorów kupuje się przed poziomem 8, jak dziś | Pewność: Likely | rekomendacja: a) z dopłatą; b) bez: jeden warunek `!TOOL_IDS.includes(u.id)` w kroku 1 i stare liczby w D1/D2.
5. [spec silent] Zakładam: skrzynie ($70 płasko) i Deep bez dopłaty | Dowód: `upgrades.ts:53` "every crate step costs a flat $70 (PP 2026-10-19)"; Deep dostaje własną zmianę (pytanie 3) | Jeśli źle: 6. skrzynia $91, Deep Value 10. poziom 145 zamiast 39 odłamków | Pewność: Confident | rekomendacja: a) bez dopłaty.
6. [spec silent] Zakładam: Keep Tools zostaje jednorazowe (max 1), wzór na odłamki bez zmian, 12 poziomów dziury | Dowód: `upgrades.ts:92`, `hole.ts:504`, `holeLevels.ts` | Jeśli źle: patrz pytania 2 i 3 | Pewność: Likely | rekomendacja: a) bez zmian.
7. Ryzyko z sąsiedniego planu, nie pytanie: po partii balansu droga z samym Magnet Gunem jest w modelu wolniejsza od maszyn (x1/√n spada do x0,12 przy kuli 71 gnomów; poziom 12 po 172 min, z dopłatą poza 6 h), bo nie ma podłogi x0,25 (tamtejsze pytanie 3). Gdy wybierzesz tam b) podłogę, droga z gunem zachowuje się jak automatyzacja i pytania wyżej się nie zmieniają.

### Self-check
- Every acceptance criterion (shop lasts to L12, Deep has levels) has a step (1, 2) and a test (01, 02).
- Every step names the file, the signature or the exact numbers; texts have their sentences.
- `upgradeCost` readers (3) and Deep `max` readers (shop 4, legend 3, main clamp, hole formulas 4) listed; no field is written.
- Spec lists compared with code: upgrades with growth 1 (2: crates), placeables with growth > 1 (fan, belt, panel, trampoline, robot, wheel, cannon, vacuum), Deep ids (5, Keep Tools one-off), hole levels (12), shard writers (1); 8 `spec silent` rows of 16; Done when 16 lines = 16 rows.
- Decisions older than 60 days: none (repo from 2026-10-19).
- Plan vs code: the code change is about 6 lines of data and one formula plus one scenario; this file is longer because PP asked for the comparison numbers, which are the deliverable of N2/N3.

## Review: impact (plan-impact)

Verdict: BLOCK

Missing from the plan:
- [High] Conflict with a recorded PP decision: `docs/ai-work/2026-10-20-robots-more.md:29` sets robots to x1.3 so that "all 12 cost $29,735 [...] PP: "Niech nie będą super drogie"", and `docs/SPEC.md:139` keeps the reason: robots "mają chronić przed sabotażystami", 12 robots = 0-2 breakdowns per 60 s. Under step 1 robots 6-12 cost $1,931 / $3,263 / $5,514 / $9,320 / $15,750 / $26,600 / $44,983, so all 12 cost about $111k (x3.7). When a player reaches hole level 5 (saboteurs), he can afford fewer robots, so tools break more often. Open decision 4 names "robot 12. $45k" but not this decision. Fix: cite the quote in question 4 and offer robots without the surcharge as their own option (the condition becomes `!['robot'].includes(u.id)` or a `NO_LATE` set); `docs/SPEC.md:135` ("12 robotów łącznie ok. $30k") and `upgrades.ts:70` (comment "all 12 cost $30k") must change in step 3 whichever way PP answers.
- [High] Step 4 / Done when 4 / Done when 16: the batch's D1 reads six prices, 5th to 10th fan (`2026-10-20-plan-balance-batch.md:283,346`: `[2606, 4952, 9409, 17877, 33966, 64535]`). The plan's new list has five values (`[6438, 15902, 39277, 97014, 239624]`). The 5th fan has no surcharge (`1.3^0`), so the correct list is `[2606, 6438, 15902, 39277, 97014, 239624]`. If the implementer pastes the five-value list, D1 fails or loses its 5th-fan check. D2 (7th-10th belt, four values) is right.
- [Medium] Session decision partly reversed without a quote: `docs/ai-work/2026-10-20-balance-prices-prereqs.md:17,88` (F9) cut Auto Crank from $2.95M to about $154k for 12 levels, because "the crate path earns $0.41M in the whole run, automation $1.3M". Step 1 brings 12 levels back to about $670k (12th $326k). The plan's model says automation still buys everything at L12, so this may be fine; but step 3 must also fix `upgrades.ts:41` ("12 levels cost about $154k") and `docs/SPEC.md:160`, and the decision line should say the F9 reason was weighed.
- [Medium] `docs/SPEC.md:18` (PP, 2026-10-19: "ceny rosną łagodnie: bo pierwszy playtest skończył się na 5 wentylatorach i $119m, gra wyglądała jak idle clicker") and `upgrades.ts:19-20` ("level caps are low, so this is not an idle clicker"). The plan says "decision line stays". When a reader sees "prices grow gently" next to a $5.67M Premium level, the spec contradicts itself. Fix: step 3 adds to line 18 that levels above the 5th grow faster since 2026-10-20 ("droższe najwyższe levele"), so the newer PP quote visibly supersedes the old one.
- [Medium] Deep Value cap 15 (x4 instead of x3) reaches every `valueScale` reader, not only `hole.ts:148`: crate dump bonus `machines.ts:648`, contract rewards `contracts.ts:93`, event coin bursts `events.ts:86,307`, chair/prop bonus `hole.ts:224`, kick payout `player.ts:495`, and the leaderboard score (`leaderboard.ts:317` submits `totalEarned`). When a player maxes Deep Value, every reward and the leaderboard run score are 33% higher than at today's cap. The model excludes Deep bonuses (plan "Numbers"), so "all bought @L12" after a few rebirths is earlier than the table says. Not a code change; one sentence in the Numbers reading.
- [Low] Head Start 7 = $218,700 at the start of a run (`hole.ts:518-519`). After a rebirth this buys levels 1-5 of almost every upgrade in the first minute, so the surcharge zone starts right away; the tutorial goal "Buy an upgrade" (`goals.ts:51`) still works because goals stay done across rebirths (`hole.ts:515-516`). Mention in question 3 as a consequence.
- [Low] Done when 4 / test `01_prices` fan6 needs `upgrades.fan = 5` below a max of 10; that holds only after the balance batch lands (today fan max is 4, `upgrades.ts:61`). The sequencing line covers it; the scenario should fail loudly if `UPGRADE_BY_ID.fan.max < 10`.

Callers of `upgradeCost` (step 1): `shop.ts:219` (buy), `shop.ts:282` (`rowData`, which also feeds `affordCount` `shop.ts:316` and the tab pulse `:420`), `legend.ts:203`. No other price computation; land prices (`shop.ts:260,328`) and the auto-lands refund (`2026-10-20-plan-auto-lands.md:284`, `LAND[].cost`) do not use it. Old-save refunds (`state.ts:122-133`) are fixed amounts. Readers of Deep `max`: as the plan lists; `main.ts:49` only lowers, caps only grow, so no save is touched. Blueprints store placements, not prices.

Neighbours checked: draft/live: not affected (static game, no draft state) | profiles / LEVEL 2/3: not affected (none in this game) | serve-cache: not affected (none) | auto-regeneration / delete-then-rebuild: rebirth (`hole.ts:507-530`) is the only rebuild; Keep Tools carries levels, next price uses the new rule (row 10 covers it) | polling/imports: not affected (none) | find_best/cohort: not affected | dimensions/formulas: affected, four Deep formulas (`hole.ts:56,70,149,518`) and every `valueScale` reader above | text index / admin search: not affected | prompt context: not affected | widget / serving path: GitHub Pages static build; an old tab open across the deploy keeps old prices until reload, no save shape change, so harmless | daily run: not affected (`freshState()` without `keep`, `deep` empty) | contracts: affected through `valueScale` only | leaderboard: affected through `totalEarned` (x4 Deep Value) | fuses / `FUSE_ABLE` (batch): not affected, it sums `max`, not prices.
FE/BE: no backend; the shop and legend read `upgradeCost` and `u.max` directly, so no shape mismatch. Pips vs text: `shop.ts:297` draws pips for `max <= 8`, so Head Start 7 and Deep Combo 6 stay pips, Deep Value 15 and Deep Hunger 9 become text; row 6 matches.
Decisions: consistent with `2026-10-19-crate-price-fan.md` / `upgrades.ts:54` (crates flat $70, row 3), `2026-10-20-more-upgrade-levels.md` (one-offs stay 1, row 7), `2026-10-20-plan-balance-batch.md` decision 4 (late fans) and `deep('dXp') * 0.25` kept on the rewritten XP line | conflicts with `2026-10-20-robots-more.md` ("Niech nie będą super drogie", all 12 for $29,735) | partly reverses `2026-10-20-balance-prices-prereqs.md` F9 (Auto Crank $154k) | supersedes `docs/SPEC.md:18` (PP 2026-10-19 "ceny rosną łagodnie") without saying so.
Decisions older than 60 days: none (oldest note in `docs/ai-work` is 2026-10-19).
Regression vs current behaviour: none in code paths (buy, row, legend keep their logic); the behaviour change is the robot price curve above, which a recorded PP decision set on purpose.

## Review: performance (plan-performance)

Verdict: APPROVE

| plan step | operation | shape / index | multiplicity | volume (where measured) | cost | severity |
|---|---|---|---|---|---|---|
| 1 | `upgradeCost(u, L)` with one extra `Math.pow` | pure arithmetic, no lookup | shop `render()` only: open, tab click, buy (`shop.ts:143,181,241,266`); `affordCount` x tabs calls `rowData` for every upgrade once per render (`shop.ts:420`); legend `render()` on open/tab | ~60 upgrades x (1 row + tab counts) per render, nothing per frame (`rg upgradeCost` in main/hud/systems: 0 hits) | a few hundred flops per click | none |
| 2 | Deep caps 10/5/4/6 -> 15/7/6/9 | scalars read in `hole.ts:56,70,149,518` | per eaten gnome / per combo read, same as today | the cap changes a multiplier value, not a count of bodies, instances or particles | 0 | none |
| 2 | Shop Deep node head `n/15` as text instead of pips | DOM string | per render | 5 Deep nodes | 0 | none |
| 1 | Large prices in UI (`money()`, `src/core/format.ts`) | suffix loop up to `dc` | per row per render | top price $5.67M, shop total $14.4M; `Number` exact to 9e15 | 0; formatter already handles `m`/`b` | none |
| - | Save | no new field (`state.ts:159` `JSON.stringify`) | autosave interval unchanged | +0 bytes (levels stay small integers) | 0 | none |
| 4 | Done-when #4 expected string `fan6 = "$6.4k"` | `money(6438)`: 6.438 < 10 -> `toFixed(2)` -> `"$6.44k"` | test only | - | the check fails on correct code | Low |

Findings:
- [Low] Done when #4 / Tests 01_prices: when the scenario reads the 6th Cooling Fan head, it gets `$6.44k`, not `$6.4k`, because `money()` prints two decimals below 10k-suffix 10 (`format.ts:12`); fix: expect `"$6.44k"` (the other strings check out: `money(513349)` = `$513k`, `money(44983)` = `$45k`, `money(494)` = `$494`). Measured: yes (read of `format.ts`, arithmetic by hand).

No findings on: per-frame cost (the plan adds no tool, body, instance or particle; placeable caps unchanged, so option (b)'s Magnet Coil 15 ball of ~250 gnomes is not in this plan), shop/legend render cost, Deep effect formulas, save size, large-number formatting and float precision.

## Review: roast (plan-roaster)

Verdict: CONCERNS

Steel-man: The plan keeps levels 1-5 untouched (tutorial and first tools stay as PP tuned them), puts the whole money fix in one constant inside the only price function, and the Deep fix in four data numbers; no save field, no migration, no new UI path. It was measured against alternatives in a model instead of guessed, it respects the flat crate price and the one-off rule, and old saves are safe because caps only grow and `main.ts:46-50` only lowers. Strengths: tiny code surface, reversible constant, early game unchanged, every option has numbers for PP.

Findings:
- [Major] The model is not PP's run, so "x1.3 lands at L12" is not shown for PP.
  Assumption: the model's 2-10x pessimism shifts every variant equally (assumption 4), so the level where the shop runs out is trustworthy.
  Scenario: PP plays a post-rebirth run (he asks about diamonds, so he has rebirthed): Deep Value up to x3 money, Head Start money, Keep Tools tools already owned. The model starts every run at `money: 0` with no Deep factor and buys tools from zero. The plan's own "today's build, x10 income" row says all bought at L12, while PP reports maxed at L8 on that same build. So even x10 does not reproduce PP's observation; the calibration fails on exactly the axis the recommendation rests on.
  Checked: model `scratchpad/econ/econ2.mjs:167` (start state `money: 0`, all `up` at 0), `:189` (`scale` = hole mult x Premium only, no `dValue`), `:195` (income has no Deep term); game `hole.ts:70` (`deep('dValue') * 0.2`), `hole.ts:518-526` (Head Start money, Keep Tools carry).
  Impact: when PP rebirths on the new build, he can again be maxed well before L12, and the plan has no number that says otherwise.
  Recommendation: before picking x1.3, re-run the model with PP's state at run start (his Deep levels, Keep Tools owned tools, Head Start money) and tune it until "today's build" gives "maxed at L8"; then read the surcharge off that calibrated run.
- [Major] With x1.3 the late shop is one row, so PP will still feel "wymaxowany".
  Assumption: "every money upgrade at max" late means many things to buy late.
  Scenario: of the $14.35M surcharged shop, Premium Gnomes is $11.65M (81%) and Factory Gears $1.02M (7%); every other upgrade together costs $1.45M plus Tools $0.23M (computed from `upgrades.ts` with the plan's formula). After the balance batch the plan's model earns $18-26M to L12, so every row except Premium and Gears is bought around where PP is maxed today, and with Keep Tools the Tools part is paid once in the save's life (`upgrades.ts:104` `KEEP_TOOL_IDS` = whole Tools tab). When PP reaches L8-9, then the only thing left is pressing "+10% money" for the rest of the run, because the surcharge compounds hardest on the 20-level row (1.3^15 = x51 on the last level).
  Checked: `upgrades.ts:39,43,104`, `hole.ts:520-522`, totals by arithmetic over `UPGRADES` (Premium 11,645,838; Gears 1,019,237; Tools tab 232,392; rest 1,450,834).
  Impact: the goal "still has upgrade levels to buy at hole levels 9-12" is met on paper by one or two rows, not the shop.
  Recommendation: put the share in Open decision 1 in plain words ("81% dopłaty to Premium Gnomes; reszta sklepu kończy się mniej więcej tam, gdzie dziś"), so PP decides knowing it.
- [Major] PP's first wish has a viable shape that the plan drops for a reason that does not apply to it.
  Assumption: "more upgrade levels" (assumption 3) always means physics side effects.
  Scenario: the table row (b') "caps x1.5 on economy upgrades only" reaches all bought at L12 (typical 36 min) like (a). The model's own `--capsEcon` switch excludes every physical upgrade (throw, magPower, magRange, kick, speed, jump, magnetRange, plowWidth, blowPower, blowRange). The rejection text and Open decision 1 c) name only (b) with Strong Arm 9, Magnet Coil 15, shoes x2, so PP never sees (b'). PP wrote "a może lepiej więcej leveli" as his preferred direction.
  Checked: `econ2.mjs:15` (`--capsEcon`, "no physics side effects"), `:37` (excluded ids), `:40` (cap scaling); plan table row (b') and "Alternatives rejected" bullet (b).
  Impact: PP picks between a price hike and a physics-risky option, while the option closest to his words and without physics risk is hidden. More visible levels (new pips, new numbers) also answer "wymaxowany" better than the same level costing more.
  Recommendation: add (b') to Open decision 1 with its numbers, and the honest cost: new levels of Premium/Combo Cap/Factory Gears/Hole Hunger need EFFECT text checks only, Factory Gears above 16 needs one check against the 320-gnome permit limit.
- [Minor] Deep Value 15 and Head Start 7 erode the fixed x1.3 every rebirth. Scenario: each Deep Value level raises income (x3 -> x4 at cap, `hole.ts:70`), Head Start 7 starts a run with $218,700 (`hole.ts:518-519`), and shards per run grow with `sqrt(totalEarned)` (`hole.ts:504`), so later runs earn more shards faster. The surcharge stays x1.3. Impact: the "maxed at level X" point drifts earlier with every rebirth; +33% income is about one surcharge level, so small, but in the same direction as the bug.
- [Minor] The last Deep levels cost several full runs for a few percent. Scenario: Deep Value 15th costs 292 shards for x3.8 -> x4 money (+5% relative); at 28-86 shards per run (model, no Deep) that is 3-10 rebirths for one level; Deep Hunger 9th costs 140 for x3.0 -> x3.25 (+8%). Effects add linearly (`hole.ts:70,149`), prices grow x1.5-x2 per level (`upgrades.ts:90-94`). Impact: "about 15 rebirths" is a grind with shrinking reward per level; that is PP's call in Open decision 3, so the question should say it.
- [Minor] Reverting the Deep caps later silently deletes shards. Scenario: PP buys Deep Value 11-15 (58+87+130+195+292 = 762 shards), dislikes it, and the caps go back to 10; on load `main.ts:46-50` sets `deep.dValue = 10` without refunding. Same for Head Start 6-7 (192), Deep Combo 5-6 (144), Deep Hunger 7-9 (272). Impact: up to 1,370 shards gone from PP's save. Recommendation: if a revert ever happens, it needs a refund like `state.ts:122-133`; one sentence in the ai-work note is enough now.
- [Minor] Old save path checked and safe: caps only grow, the clamp only lowers (`main.ts:49`), row 9 keeps PP's maxed levels with no charge. But PP sees no change at all in his current run until he rebirths (row 9, assumption 1), and the CHANGELOG bullet should say "applies from your next rebirth", otherwise PP's first playtest reads as "nic się nie zmieniło".

Scenarios checked explicitly:
- State changes during a step (buy while a level-up or a rebirth lands): no break, because `shop.ts:218-219` reads level and price at click time and rebirth reloads the page (`hole.ts:530`).
- Double click on buy: no break, each call re-reads `L` and re-checks money (`shop.ts:218-219`).
- Step N fails after N-1: no multi-step write; buy is one money subtract and one level increment.
- Process dies mid-way (tab closed between buy and autosave): same as today, the buy is lost with its cost, consistent.
- Empty / boundary: owned 4 -> exponent `max(0, 0)` = no surcharge, owned 5 -> x1.3, correct; growth 1 rows skip; Keep Tools max 1 is growth 1, skipped; shards skipped by `currency`.
- Swallowed errors: none on this path.
- Old process sees new data: an old open tab keeps old prices until reload; it can write an old-cap Deep level only by clamping, which it does not do (clamp runs at boot only). Revert case above.
- Number format: the largest price is $5.67m (`format.ts:12` lowercase `m`), readable; plan prose says "$5.67M", texts in SPEC/CHANGELOG should match what the shop prints. The `$6.44k` Done-when mismatch is already in plan-performance.

Pre-mortem: A week later PP writes "dalej wymaxowany". Most likely cause: PP plays a post-rebirth run with Keep Tools and Deep Value, which the model never simulated, so every row except Premium Gnomes and Factory Gears is bought around L8-9 as today, and the last three levels are spent clicking "+10% money". The first assumption to crack is assumption 4 (the model's pessimism shifts all variants equally); the missed signal was already in the plan's own table, where "today's build at x10 income" still says L12 while PP said L8.

Inversion worth considering: instead of making the same levels pricier, add levels only to economy rows (b'), or combine a smaller surcharge (x1.15) with (b'), so PP gets new things to buy, not the same thing at a higher price.

Investigate first: what PP's save holds right now (rebirth count, Deep levels, Keep Tools yes/no, money when he hit "maxed at L8"); with those, the model can be calibrated to his observation before the factor is chosen.

## Plan (plan-senior, final)

Status: needs-decision

Tonight vs wait: steps 1, 2 and 4 (surcharge `LATE_PRICE = 1.3`, robots exempt, texts, scenario) are reversible by one constant (`LATE_PRICE = 1` restores today's prices; no save field, levels never change) and change nothing in PP's current maxed run until he rebirths, so they may be built tonight if the orchestrator so decides. Step 3 (Deep caps) WAITS for PP question 3: a later revert of the caps deletes bought levels without a refund (`main.ts:46-50` only lowers), so it is not reversible by a constant. Numbers below for the robot and (b') options come from `scratchpad/econ/zz-totals.mjs` and `zz-strings.mjs` (read `upgrades.ts`, fan/belt max 10 as after the batch).

### Resolutions
- R1: impact [High] robots vs step 1 (surcharge on every growing price): Decision: robots exempt, `NO_LATE = new Set(['robot'])` in step 2. Rationale: PP set the robot curve on purpose on 2026-10-20 ("Niech nie będą super drogie", all 12 for $29,735, `robots-more.md:29`) as saboteur protection; the surcharge would make all 12 cost $110,998 (x3.7). The exemption costs the shop total $81k of $14.8M (0.5%), so the model's "all bought @L12" does not move. Checked: `upgrades.ts:69-71`, `docs/SPEC.md:135,139`. The option "robots surcharged too" stays in PP question 4 with its numbers, as the brief asks.
- R2: impact [High] + performance [Low] test strings: Decision: accepted. D1 list has six values `[2606, 6438, 15902, 39277, 97014, 239624]` (the 5th fan has no surcharge, `1.3^0`; the first value stays whatever the batch's D1 asserts today); `fan6 = "$6.44k"` (`format.ts:12` prints two decimals below 10). Checked: `format.ts`, `plan-balance-batch.md:283,346`.
- R3: impact [Medium] Auto Crank F9 ($154k for 12 levels) partly reversed: Decision: surcharge stays on Auto Crank; comment `upgrades.ts:41` and `docs/SPEC.md:160` get the new number in step 4. Rationale: F9 and the orchestrator's follow-up cut the L4 wall (first price $600, `balance-prices-prereqs.md:88`); levels 1-5 ($7,913 together) do not change, so that wall is untouched; only levels 6-12 grow ($5,924 ... $325,656, 12 levels $670,133) and the model's automation path still buys everything at L12 (table row (a)). Not a PP question: F9 was a session decision.
- R4: impact [Medium] `docs/SPEC.md:18` "ceny rosną łagodnie" (PP 2026-10-19) vs v0 "decision line stays": Decision: line 18 stays and gets one appended sentence that PP's 2026-10-20 words ("droższe najwyższe levele") supersede it for levels above the 5th. Rationale: a spec that says "gently" next to a $5.67m Premium level contradicts itself; the newer PP quote must be visible as the newer one. Included in PP question 1 as a consequence (brief).
- R5: impact [Medium] Deep Value 15 reaches every `valueScale` reader (crate dump, contracts, events, kick payout, chair) and the leaderboard score (`leaderboard.ts:317` submits `totalEarned`): Decision: accepted as a consequence line in PP question 3, no code. Rationale: the x3 → x4 step is the same kind of effect as today's x1 → x3; the leaderboard already mixes Deep levels into scores.
- R6: impact [Low] Head Start 7 = $218,700 at run start buys levels 1-5 of almost every row in the first minute: Decision: consequence in PP question 3. Checked: `hole.ts:518-519`.
- R7: impact [Low] scenario needs fan max 10: Decision: step 1 scenario fails loudly when `UPGRADE_BY_ID.fan.max < 10` (`FAIL: balance batch not landed`). Matrix row 20.
- R8: roaster [Major] model not calibrated to PP's run: Decision: accepted as PP question 2 (one line: rebirths, Keep Tools), factor stays x1.3 regardless of the answer. Rationale engaging the roaster: the model cannot be re-run with PP's state tonight because the state is unknown (no save on disk, brief); what we can do is check the factor against the income range the answer can produce. Model rows: x1.3 gives "all bought" at L12 for income x1 and at L11 for income x3 (the "x10 income" column, which is x3 after the batch); x1.5 gives "never / 157 min" at x1 and L12 at x3. So x1.3 holds across both answers (fresh save or Deep Value 10 + Keep Tools), x1.5 breaks the fresh-save case. The roaster is right that the model never reproduced "maxed at L8" even at x10 income; that is why the factor is one constant and the plan asks PP for the data instead of pretending a calibration.
- R9: roaster [Major] "the late shop is one row" (Premium $11.65M of $14.8M = 79%, Gears 7%, rest about as today): Decision: rejected as a reason to change the rule, accepted as a number in PP question 1. Rationale: the share is the structure of the Premium row (20 levels, x1.5, 15 surcharged levels); every uniform surcharge lands there, and (b') lands 69% in Premium 30 too ($18.8M of $27.3M added), so no variant on the table fixes it; a per-row rule ("above half the cap") would be a second rule nobody asked for. Checked: `zz-totals.mjs` on `upgrades.ts`.
- R10: roaster [Major] (b') hidden from PP: Decision: accepted, (b') is PP question 1 option b) with numbers. Rationale for still recommending (a): computed on `upgrades.ts`, (b') caps x1.5 on economy rows adds $27.3M, of which Premium 30 is $18.8M (last level $6.39M), so it has R9's problem too; and three of its rows are not side-effect free: Factory Gears 24 = x4.6 factory speed (`factory.ts:129`), Auto Crank 18 = 1.44 gnomes/s (`factory.ts:133`), Bigger Batches 9 = 10 gnomes per cycle (`factory.ts:216`); together they keep the yard at the 320-gnome permit ceiling, which `more-upgrade-levels.md` names as the smooth-simulation limit. It is 46 new levels with 11 cap edits and 6 formula checks versus one constant. The roaster's physics-free claim holds (no throw, magnet, speed rows); the performance claim does not.
- R11: roaster [Minor] Deep Value 15 / Head Start 7 erode the fixed x1.3 each rebirth (+33% income is about one surcharge level): Decision: accepted as a sentence in PP question 3; no code. Rationale: same direction as the bug but one level of twenty; the fix would be a Deep-aware surcharge, a second rule.
- R12: roaster [Minor] last Deep levels are a grind (Deep Value 15th: 292 shards for +5%): Decision: accepted into PP question 3 in plain words.
- R13: roaster [Minor] reverting the Deep caps deletes shards (up to 1,370): Decision: accepted; this is why step 3 waits for PP; the ai-work note gets the sentence "a revert of the Deep caps needs a shard refund like `state.ts:122-133`". Matrix row 22.
- R14: roaster [Minor] CHANGELOG must say "applies from your next rebirth": Decision: accepted, step 4. Matrix row 21.
- Rejected: roaster inversion "x1.15 + (b')" because two rules compound (one constant and 46 new levels), both still land in Premium (R9), and PP gets a harder question with no better number; (b') alone is offered instead.
- Rejected: performance "no findings on per-frame cost" needs nothing; recorded as APPROVE.

### Chosen variant
(a) Levels above the 5th of every money upgrade with a growing price cost extra x1.3 per level (`LATE_PRICE`), except crates (flat $70), robots (recorded PP decision) and Deep (shards); Deep caps 15/7/6/9 if PP says yes. Pros: one constant in the only price function, levels 1-5 untouched (tutorial, first tools), no save field, reversible by `LATE_PRICE = 1`, model lands "all bought" at L11-L12 for income x1-x3. Cons: 79% of the extra money is the Premium Gnomes row; PP's own run only changes after a rebirth; the factor is a model guess, not a calibration. Cost: shop total $1.15M → $14.8M (Premium 20th $5.67m, Gears 16th $513k, Auto Crank 12th $325k); render cost a few hundred flops per shop click, nothing per frame (performance table). Risk: pre-mortem "dalej wymaxowany" after a rebirth with Keep Tools and Deep Value (R8); mitigated by PP question 2 and the one-constant revert. Ladder: rung 6 for `LATE_PRICE` and the one-line formula (no helper exists), rung 5 for the Deep caps (four numbers), rung 2 for shop/legend (they already read `upgradeCost` and `max`).

### Rejected variant(s)
- (b') caps x1.5 on economy rows only (roaster's pick, PP's "a może lepiej więcej leveli"): pros: visible new pips, no physics rows, answers "wymaxowany" with new things instead of pricier things; cons: +$27.3M of which 69% is Premium 30 ($6.39M last level), Gears 24 / Crank 18 / Batches 9 saturate the 320-gnome ceiling, 46 new levels, 11 cap edits, 6 formula and EFFECT-text checks, and a revert deletes bought levels without refund (same as the Deep caps). Rejected because it does not handle the "one row" complaint better than (a) and adds a performance scenario (a) does not have; offered to PP as 1b.
- (a') x1.5: last Premium $48.5M, fresh-save typical never buys everything in the model (157 min); rejected because it breaks the fresh-save answer of question 2.
- (c) 16 hole levels: shop still all bought at L10 with today's prices; changes run length PP deferred 2026-10-20; rejected, offered as question 6.
- (e) hole-level gating, (d') stronger Deep effects / x2 shards, price inflation by hole multiplier: as v0, rejected (second rule / faster second run / looks like a bug).

### Behaviour matrix (final)
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| 1 | money upgrade, growing price, owned 0-4 | shop shows / buys | price = `ceil(cost x growth^owned)` as today (Premium 5th $254, Strong Arm 5th $76) | v0 row 1 |
| 2 | money upgrade, growing price, owned >= 5 | shop shows / buys | price = `ceil(cost x growth^owned x 1.3^(owned-4))`: Premium 6th $494, Magnet Coil 6th $209, Strong Arm 6th $149, Factory Gears 16th $513,349 | v0 row 2, R8 |
| 3 | flat-price upgrades (Wooden Crate, Bigger Crate, growth 1) owned >= 5 | shop | still $70 | v0 row 3 |
| 4 | placeable tools with a growing price (fan, belt, panel, trampoline, wheel, cannon, vacuum) owned >= 5 | shop | surcharge applies: fan 6th $6,438 ... 10th $239,624; belt 7th $4,813 ... 10th $35,685 | v0 row 4, PP q4 |
| 5 | Deep upgrades (shards) owned >= 5 | shop, legend | no surcharge: Deep Value 6th 8, 11th 58 | v0 row 5 |
| 6 | Deep tab after the first shard (if PP q3 = a) | render | Deep Value n/15, Head Start n/7, Deep Combo n/6, Deep Hunger n/9, Keep Tools n/1; max > 8 drawn as text (`shop.ts:297`) | v0 row 6 |
| 7 | Keep Tools | render | max 1 | v0 row 7 |
| 8 | old save with Deep Value 10 (if PP q3 = a) | load | 10/15, next level 58 shards, no clamp | v0 row 8 |
| 9 | old save with every money upgrade at max (PP's) | load, shop | levels unchanged, MAX, no refund, no charge | v0 row 9 |
| 10 | rebirth with Keep Tools, robot 11 kept | new run | kept levels stay; robot 12th costs $7,169 (exempt), a kept fan 6th $6,438 (surcharged) | v0 row 10 + R1 |
| 11 | legend (L) → Tools | render | "Price now" shows the surcharged price for owned >= 5 (Premium $494 at 5), robot row $1,486 at 5; Deep rows new `n/max` | v0 row 11 + R1 |
| 12 | shop row EFFECT hover (Premium) | hover | text unchanged; AFFORD badge and green ring use the surcharged price | v0 row 12 |
| 13 | Deep effects at the new caps (if q3 = a) | formulas | `valueScale` x4, XP x3.25, combo cap +3, start money $218,700 | v0 row 13 |
| 14 | shard reward per rebirth | rebirth | formula unchanged | v0 row 14 |
| 15 | hole levels | play | still 12 | v0 row 15, PP q6 |
| 16 | `tools/smoke/scenario-balance.js` D1/D2 | run | D1 six values `[2606, 6438, 15902, 39277, 97014, 239624]`, D2 `[4813, 9385, 18300, 35685]` | R2 |
| 17 | Cleaning Robot owned >= 5 | shop, legend | no surcharge: 6th $1,486, 12th $7,169, all 12 $29,735 | R1 |
| 18 | Auto Crank owned >= 5 | shop | surcharged: 6th $5,924, 12th $325,656; comment and SPEC say $670k for 12 levels, first 5 unchanged | R3 |
| 19 | `docs/SPEC.md:18` | read | the 2026-10-19 "ceny rosną łagodnie" line keeps its text and ends with the 2026-10-20 supersede sentence | R4 |
| 20 | scenario on a tree without the balance batch (fan max 4) | run | prints `FAIL: balance batch not landed (fan max 4)` and exits non-zero | R7 |
| 21 | CHANGELOG top section | read | the price bullet says the new prices apply from the next rebirth | R14 |
| 22 | ai-work note | read | one sentence: a revert of the Deep caps needs a shard refund like `state.ts:122-133` | R13 |

### Steps (edit order)
1. `tools/smoke/scenario-endgame.js` (harness of `scenario-esc.js`, dev server 5199, `g = window.gnome`), written first so it is red on today's code. Guard at the top: `if (UPGRADE_BY_ID.fan.max < 10) { console.log('FAIL: balance batch not landed (fan max ' + max + ')'); process.exit(1); }` (read through `g` or the shop DOM). `01_prices`: `g.state.upgrades = { value: 4, magPower: 5, throw: 5, factorySpeed: 15, box: 5, crateSize: 5, fan: 5, robot: 5, autocrank: 5 }`, money 1e9, open the shop, read each `[data-buy]` head; click Premium once; then set money to exactly 494 and click Premium twice (`premiumDouble`: level +1 once, money 0, never negative). `02_deep`: `shards = 2000`, `deep = { dValue: 10 }`, `stats.rebirths = 1`; read Deep heads, buy Deep Value 11. `03_legend`: L → Tools, read Premium, Cleaning Robot and Deep Value rows. `04_oldsave`: save with `deep.dValue = 10`, `upgrades.value = 20` in localStorage, iframe boot. One `RESULT {...}`. If `tools/smoke/scenario-balance.js` exists: D1 expected `[2606, 6438, 15902, 39277, 97014, 239624]` (first value as the batch wrote it), D2 `[4813, 9385, 18300, 35685]`. Red test: `01_prices` "premium6" → `$494` (today `$380`).
2. `src/data/upgrades.ts:106` — `export const LATE_PRICE = 1.3; // levels above the 5th cost extra x1.3 per level: the shop ran out at hole level 8 (PP 2026-10-20 "drozsze najwyzsze levele"); not for flat prices (crates), shards, or NO_LATE` and `const NO_LATE = new Set(['robot']); // cleaning robots stay cheap (PP 2026-10-20 "niech nie beda super drogie": all 12 for $29,735)`; `upgradeCost(u, level)` returns `Math.ceil(u.cost * Math.pow(u.growth, level) * (u.growth > 1 && u.currency !== 'shards' && !NO_LATE.has(u.id) ? Math.pow(LATE_PRICE, Math.max(0, level - 4)) : 1))`. Comments: lines 19-20 "(x1.25-x2.5 per level, x1.3 extra per level above the 5th since 2026-10-20)"; line 41 "12 levels cost about $670k with the late surcharge (first 5: $7.9k, unchanged by F9's cut)"; line 70 append "(no late surcharge)". Test: step 1 rows 1-5, 17, 18.
3. `src/data/upgrades.ts:90-94` — ONLY after PP answers question 3 = a: `dValue` max 10 → 15, `dStart` 5 → 7, `dCombo` 4 → 6, `dXp` 6 → 9, comment `// caps raised (PP 2026-10-20 "wiecej poziomow" for shards): a post-batch run gives 30-90 shards, the old catalogue (302) was gone in a few rebirths`. Test: step 1 `02_deep`, `04_oldsave` (rows 6-8, 13).
4. Texts — `docs/SPEC.md`: shop section sentence "Każdy poziom ulepszenia powyżej piątego kosztuje dodatkowo x1,3 za poziom (6. poziom x1,3, 7. x1,69...); skrzynie ($70), roboty sprzątające i Deep bez dopłaty" plus decision "(PP, 2026-10-20) bo przy poziomie dziury 8 PP miał wszystko kupione, a po zmianie XP wg karmienia maszyny zarabiają na poziom 4-8x więcej; roboty bez dopłaty, bo mają chronić przed sabotażystami i PP chciał je tanie"; line 18 append "Od 2026-10-20 poziomy powyżej piątego rosną szybciej (PP: „droższe najwyższe levele"), to zastępuje „łagodnie" dla górnych poziomów."; line 160 append "(od 2026-10-21 z dopłatą 12 poziomów ok. $670k; pierwsze 5 bez zmian)"; line 172 new caps only with step 3. `docs/PLAN.md:41` ("prices grow x1.25-x2.5 per level, x1.3 extra per level above the 5th; robots and crates exempt"), `:90` caps only with step 3. `CHANGELOG.md` top section: price bullet ending "Applies from your next rebirth; a maxed save keeps its levels." plus the Deep bullet only with step 3, each with "Test:". `BOARD.md` N2/N3 "w kodzie, nie na 5300" (N2 "czeka na PP" until step 3). `docs/ai-work/2026-10-21-endgame.md`: Problem / Summary / Work progress with the sentence "a revert of the Deep caps needs a shard refund like `state.ts:122-133`" and the rejected list from this section. Test: rows 19, 21, 22 by `rg`.

### Review focus
1. Rebirth with Keep Tools: the kept robot's next price must be the cheap one ($7,169) while a kept fan's next price is surcharged ($6,438) → pinned by step 1 `02_deep` "afterRebirthKeptRobotNext" and "afterRebirthKeptFanNext".
2. Double click on buy at exactly one affordable surcharged level: level +1 once, money 0, never negative → pinned by step 1 `01_prices` "premiumDouble".
3. Scenario run on a tree where the balance batch has not landed (fan max 4) must fail loudly instead of asserting the wrong row → pinned by step 1 guard (row 20).
4. The batch's D1 line has six values; after this plan the 5th stays and 6th-10th change → pinned by step 1's edit of `scenario-balance.js` (row 16).
5. Legend "Price now" for the robot row must show the exempt price ($1,486 at 5 owned), not $1,931 → pinned by step 1 `03_legend` "robotPrice".

### Done when
1. `01_prices → premium5 = "$254"`
2. `01_prices → premium6 = "$494" coil6 = "$209" arm6 = "$149" gears16 = "$513k"`
3. `01_prices → box6 = "$70" crateSize6 = "$70"`
4. `01_prices → fan6 = "$6.44k"` (corrected from v0 `$6.4k`, R2; and, if `scenario-balance.js` exists, its D1/D2 lines pass with the six- and four-value lists)
5. `02_deep → dValue6price = 8 dValue11price = 58` (step 3; until PP answers q3: `dValue11price` absent and `dValue10 = MAX`)
6. `02_deep → caps = "15/7/6/9"` (Deep Value / Head Start / Deep Combo / Deep Hunger node heads) and `dValueNodeText contains "10/15"` (step 3; until then `caps = "10/5/4/6"`)
7. `02_deep → keepToolsMax = 1`
8. `04_oldsave → dValue = 10 next = 58 clampNote = none` (step 3; until then `dValue = 10 next = MAX clampNote = none`)
9. `04_oldsave → value = 20 head = "LVL 20/20 · MAX" money = same`
10. `02_deep → afterRebirthKeptRobotNext = "$7.17k" afterRebirthKeptFanNext = "$6.44k"` (robot 11 and fan 5 kept; corrected from v0 `$45k`, R1) or `rg -n "KEEP_TOOL_IDS" src/systems/hole.ts → 1 line` (unchanged path)
11. `03_legend → premiumPrice = "$494" deepValueLevel = "10/15"` (`10/10` until step 3)
12. `01_prices → premiumAfford = true premiumDesc contains "now: +40%"` (hover text unchanged, badge on the new price)
13. `02_deep → valueScale15 = 4 * mult` (step 3) and `rg -n "deep\('dXp'\) \* 0.25" src/systems/hole.ts → 1 line`
14. `rg -n "Math.sqrt(s.totalEarned / 20000)" src/systems/hole.ts → 1 line` (shard formula untouched)
15. `rg -c "xp:" src/data/holeLevels.ts → 12`
16. `CDP_PORT=9421 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-balance.js → D1 = [2606, 6438, 15902, 39277, 97014, 239624], D2 = [4813, 9385, 18300, 35685] PASS` (only if the file exists; else `ls tools/smoke/scenario-balance.js → No such file`)
17. `01_prices → robot6 = "$1.49k" robot12 = "$7.17k"` and `rg -n "NO_LATE = new Set\(\['robot'\]\)" src/data/upgrades.ts → 1 line`
18. `01_prices → crank6 = "$5.92k"` and `rg -n "670k" src/data/upgrades.ts docs/SPEC.md → 2 lines`
19. `rg -n "zastępuje „łagodnie"" docs/SPEC.md → 1 line` on the same line as `ceny rosną łagodnie`
20. with `UPGRADE_BY_ID.fan.max` forced to 4 in the scenario (one-line override for the check) → output `FAIL: balance batch not landed (fan max 4)`, exit code 1
21. `rg -n "next rebirth" CHANGELOG.md → 1 line` in the top section
22. `rg -n "shard refund" docs/ai-work/2026-10-21-endgame.md → 1 line`
23. `01_prices → premiumDouble = { level: +1, money: 0 }` (money set to 494, two clicks)
24. `npx tsc --noEmit → exit 0`; `tools/smoke/scenario-esc.js → as before` (shop open/close untouched)

### Decisions for PP
1. Jak ma dłużej starczać sklep? a) poziomy powyżej 5. drożeją x1,3 za poziom (tak buduję): Premium 20. poziom $5,67M zamiast $111k, Factory Gears 16. $513k zamiast $29k, Auto Crank 12 poziomów $670k zamiast $154k (pierwsze 5 bez zmian, $7,9k); 79% dopłaty to Premium Gnomes, reszta sklepu kończy się mniej więcej tam, gdzie dziś; to uchyla Twoją zasadę z 19.10 „ceny rosną łagodnie" dla poziomów 6+; roboty i skrzynie bez dopłaty; Twój obecny zapis nie zmienia się aż do odrodzenia. b) więcej poziomów tylko w ekonomii (Premium 30, Gears 24, Batches 9, Auto Crank 18, Combo Window 15, Combo Cap 18, Hole Hunger 8, grzybki/złote/eventy +2): widzisz nowe kropki zamiast droższych starych; +$27,3M, z czego 69% to Premium 30 ($6,39M ostatni poziom); fabryka na Gears 24 / Crank 18 / Batches 9 trzyma podwórko stale na limicie 320 gnomów (granica płynności), 46 nowych poziomów do sprawdzenia; cofnięcie kasuje kupione poziomy. c) x1,5 za poziom: Premium 20. $48,5M, nowy gracz bez odrodzeń w modelu nigdy nie kupi wszystkiego. d) górna połowa poziomów odblokowuje się po jednym na poziom dziury: zawsze coś nowego, ale kasa i tak się odkłada, druga reguła w sklepie. (rekomendacja: a, jedna stała, cofnięcie jedną liczbą)
2. Jedna linia o Twoim zapisie: ile odrodzeń masz i czy kupiłeś Keep Tools? a) zero odrodzeń: x1,3 zostaje (w modelu kupujesz ostatnią rzecz przy poziomie 12), pytanie 3 nie dotyczy Twojego playtestu; b) odrodzenia z Keep Tools i Deep Value: x1,3 zostaje (model przy 3x dochodzie: ostatnia rzecz przy poziomie 11), a jeśli po odrodzeniu znów będziesz wymaxowany przy 8-9, podniosę stałą do 1,4-1,5 jedną linią. (rekomendacja: odpowiedz, stała się nie zmienia, ale bez tego model nie da się skalibrować)
3. Diamenty (ten krok czeka na odpowiedź, bo cofnięcie kasuje kupione poziomy bez zwrotu odłamków): a) więcej poziomów Deep: Deep Value 15, Head Start 7, Deep Combo 6, Deep Hunger 9; komplet 1 672 odłamków zamiast 302, przy 30-90 za odrodzenie to ok. 15 odrodzeń; ostatni poziom Deep Value kosztuje 292 odłamki za +5% kasy; Head Start 7 daje $218 700 na start, czyli pierwsze 5 poziomów prawie wszystkiego od razu; Deep Value 15 to x4 na każdą wypłatę i wynik w rankingu (dziś x3); każde odrodzenie przesuwa „wymaxowany" o ok. jeden poziom dopłaty wcześniej. b) mocniejsze efekty za poziom (np. +30% zamiast +20%): drugie odrodzenie kończy grę szybciej. c) x2 odłamków za odrodzenie: Deep kompletny po 2-3 odrodzeniach. (rekomendacja: a)
4. [spec silent] Zakładam: dopłata x1,3 obejmuje narzędzia do postawienia (wentylator 10. $239,6k zamiast $64,5k, taśma 10. $35,7k zamiast $9,6k), ale NIE roboty sprzątające (12 robotów nadal $29,7k) | Dowód: `upgrades.ts:61-62` rosnące ceny jak ulepszenia, decyzja 4 partii balansu („ostatnie wentylatory pod koniec gry"); roboty: Twoja decyzja z 20.10 „Niech nie będą super drogie", mają chronić przed sabotażystami od poziomu 5 | Jeśli źle: a) jak zakładam; b) narzędzia też bez dopłaty: komplet 10 wentylatorów przed poziomem 8 jak dziś; c) roboty też z dopłatą: 12. robot $45k, 12 robotów $111k, mniej robotów przy sabotażystach | Pewność: Likely | rekomendacja: a)
5. [spec silent] Zakładam: skrzynie ($70 płasko) i Deep bez dopłaty | Dowód: `upgrades.ts:54` „every crate step costs a flat $70 (PP 2026-10-19)"; Deep ma własną zmianę (pytanie 3) | Jeśli źle: 6. skrzynia $91, Deep Value 10. poziom 145 zamiast 39 odłamków | Pewność: Confident | rekomendacja: a) bez dopłaty
6. [spec silent] Zakładam: Keep Tools jednorazowe (max 1), wzór na odłamki bez zmian, 12 poziomów dziury | Dowód: `upgrades.ts:92`, `hole.ts:504`, `holeLevels.ts`; długość gry odłożyłeś 20.10 („na razie zostawiamy") | Jeśli źle: 16 poziomów dziury = droga do The Deep 51-73 min zamiast 34-53, cztery nowe teksty odblokowań, dziura 35+ m od fabryki; sklep i tak kończy się na 10 przy dzisiejszych cenach | Pewność: Likely | rekomendacja: a) bez zmian
7. Ryzyko z sąsiedniego planu, nie pytanie: po partii balansu droga z samym Magnet Gunem jest w modelu wolniejsza od maszyn (poziom 12 po 172 min, z dopłatą poza 6 h), bo nie ma podłogi x0,25 (tamtejsze pytanie 3). Gdy wybierzesz tam b) podłogę, droga z gunem zachowuje się jak automatyzacja i pytania wyżej się nie zmieniają.

### v0 → final
- added: robots exempt (`NO_LATE`, row 17); Auto Crank and SPEC:18 text fixes (rows 18, 19); scenario guard for the batch (row 20); CHANGELOG "next rebirth" (row 21); refund sentence (row 22); double-click check (row 23); (b') and the robot option with numbers in PP questions 1 and 4; PP question 2 (save data).
- dropped: nothing from v0's matrix; corrected: `$6.4k` → `$6.44k`, D1 five values → six, kept-robot next price `$45k` → `$7.17k`.
- moved to PP: Deep caps step 3 now waits for question 3 (revert deletes shards); variant (b') and robots surcharge offered with numbers instead of decided here.
- status: steps 1, 2, 4 reversible by one constant and may ship tonight if the orchestrator decides; step 3 after PP.
