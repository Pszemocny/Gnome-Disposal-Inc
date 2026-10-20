# Plan: tutorial goals (mushrooms, multipliers, gnome types)

Spec: PP 2026-10-20: "pomysl aby pierwsze gole pokazywaly mechaniki gry mushrooms, mnozniki, gnomy".
Trivial check: touches the goal list and its save format (`goal`, `goal2`, `goalBase*` in localStorage), two new stats written by `hole.consume`, the mushroom drop path, the HUD label, contracts' start trigger and rebirth. Not trivial.

## Plan v0 (plan-author)

### Goal
The GOAL panel walks a new player through make → grab → feed → coins → throw (LONG SHOT) → combo → shop → level 2, then a second LESSON track teaches one mechanic per goal (mushroom, each gnome type as it unlocks, weight classes, AIR / TRICK / BULLSEYE, crate, combo 15), each goal checkable by the game, paying once, and old saves keep what they already did.

### Design notes (game designer)
- One mechanic per goal, text = what to do + the payoff ("x2.5", "worth x8"), no private constants (legend decision 2026-10-20: numbers stay in code; the combo window and drop chance are not quoted).
- A goal never asks for something the hole level cannot produce: every lesson carries `from` (hole level) and waits with "Next lesson at hole level N" until then. Type availability from `GNOME_TYPES[].unlock` (`src/data/gnomeTypes.ts:29-91`), boom at `BOOM_CHANCE` from level 2 (`gnomes.ts:388`), golden 0.4 % at every level plus GOLDEN HOUR events from level 2 (`events.ts:49`), king only by event from level 10 (`events.ts:29`).
- Gnome-type lessons are absolute on `stats.typesEaten[id]` (lifetime, like the album): a type already fed completes at once; nobody has to catch a second Golden Gnome to pass a lesson.
- The hints (`hud.firstUse`, `hud.ts:27-43`) explain tool keys; the legend (L) explains everything in words. Goals do not repeat either: the crate lesson keeps its key hint only because it is the first placed tool; type lessons say the colour and the behaviour in one clause so the player can spot the gnome, the legend card has the rest.
- The mushroom lesson is guaranteed: while it is active and no mushroom lies on the grass, the next eaten gnome drops one (today 2.5 % per gnome, `mushrooms.ts:41`, i.e. about 40 gnomes of waiting, the whole of level 2).

### Proposed goal list

GOAL track (milestones, in order; `rel` counts from the moment the goal shows, `abs` reads the value as is):

| id | text | condition | reward | waypoint |
|---|---|---|---|---|
| make | Make gnomes: stand at the GNOME FACTORY and hold E | rel produced 5 | $5 | factory |
| grab | Grab a gnome: hold LMB while looking at it | rel grabbed 3 | $5 | none |
| feed | Feed the HOLE: release LMB over it, or throw with RMB | rel gnomesEaten 5 | $10 | hole |
| coins | Collect coins: walk over them | rel lifetimeEarned 15 | $10 | hole |
| long (new here, was a skill) | LONG SHOT x2.5: throw (RMB) into the hole from 8 m or more | rel longShots 1 | $20 | hole |
| combo5 (new) | Reach a 5 combo: feed gnomes one right after another. Holding one pauses the timer | abs maxCombo 5 | $15 | hole |
| buy | Buy an upgrade at the SHOP computer (E) | rel bought 1 | $20 | shop |
| lvl2 | Reach hole level 2: every level grows the hole and its money multiplier | abs holeLevel 2 | $30 | hole |
| lvl4, garden, lvl6, lvl8, lvl10, lvl12, deep | unchanged texts, conditions and rewards (`goals.ts:39-45`) | | | |

LESSON track (opens once `lvl2` is done, sequential; `from` = hole level the lesson waits for):

| id | from | text | condition | reward | waypoint |
|---|---|---|---|---|---|
| mushroom | 2 | Eat a MUSHROOM: the hole spits one out now and then. Walk over it for a bonus | rel mushrooms 1 (guaranteed drop, see Steps 5) | $40 | hole |
| greedy | 2 | Feed a GREEDY GNOME (green hat): it steals coins off the grass and runs for the fence | abs typesEaten.greedy 1 | $40 | none |
| heavy | 2 | Feed a HEAVY gnome (bigger, 2 kg): heavier pays more and flies shorter | rel heavies 1 (new stat, heavy or massive tier) | $50 | hole |
| air | 2 | AIR x2: 3 throws that fly into the hole without touching the grass | rel airShots 3 | $60 | hole |
| crate | 2 | Buy a Wooden Crate (Shop → Tools), place it (1) and drop 5 gnomes in | rel crated 5 | $40 | crate |
| dump | 2 | Drag the crate into the hole with the magnet (LMB) | rel crateDumps 1 | $60 | crate |
| trick | 2 | TRICK x3: buy a Trampoline (Shop → Tools), bounce a thrown gnome off it into the hole | rel trickShots 1 (new stat) | $100 | trampoline (desk until placed) |
| combo15 | 2 | Reach a 15 combo (Gnomazing!) | abs maxCombo 15 | $80 | hole |
| angry | 3 | Feed an ANGRY GNOME (dark red): it charges you and kicks other gnomes around | abs typesEaten.angry 1 | $60 | none |
| dwarf | 4 | Feed a DWARF GNOME (small, brown hat): fast, runs away, worth x8 | abs typesEaten.dwarf 1 | $80 | none |
| haul | 4 | HEAVY HAUL: feed a MASSIVE 3 kg gnome, worth x2.3 | abs hauls 1 | $300 | hole |
| boom | 4 | Feed a BOOM GNOME (red hat, burning fuse): it blows nearby gnomes off the rim | abs typesEaten.boom 1 | $60 | none |
| bullseye | 4 | BULLSEYE x5: throw a gnome through the golden hoop next to the hole, into the hole | rel bullseyes 1 | $200 | hole |
| saboteur | 5 | Feed a SABOTEUR (goggles): it walks to your machines and breaks them. Fuses in the shop soak hits | abs typesEaten.saboteur 1 | $100 | none |
| golden | 5 | Feed a GOLDEN GNOME: rare, runs away, worth x100. GOLDEN HOUR turns every gnome gold | abs typesEaten.golden 1 | $300 | none |
| wizard | 7 | Feed a GNOME WIZARD (purple): it hurls gnomes away from the hole and teleports | abs typesEaten.wizard 1 | $200 | none |
| fat | 8 | Feed a FAT GNOME: six times the weight, always heavy or massive | abs typesEaten.fat 1 | $200 | none |
| king | 10 | Feed the KING GNOME: 40 kg, no magnet lifts him. Tractor, cannon, vacuum or the magnet arm | abs typesEaten.king 1 | $2000 | none |

Shadow Gnome gets no lesson: its achievement is secret (`achievements.ts:34`). Existing goal ids reuse their old position's identity, so old saves do not pay them again.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | fresh save | boot | GOAL shows `make`, no LESSON line | spec "pierwsze gole" |
| 2 | tutorial | finish make..coins | next goals are `long`, then `combo5`, then `buy`, `lvl2`; each pays once | spec "mnozniki" |
| 3 | `combo5` turn, `stats.maxCombo` already ≥ 5 | update | completes at once, pays $15 once, moves to `buy` | abs rule (existing `combo15`) |
| 4 | `lvl2` done | update | LESSON line appears with `mushroom` | spec "mushrooms" |
| 5 | `mushroom` active, no mushroom on grass | hole eats a gnome | a mushroom spawns (chance 1); with one already lying, normal chance | design note |
| 6 | `mushroom` not active | hole eats a gnome | drop chance unchanged 2.5 % x Spore Bag | `mushrooms.ts:41` |
| 7 | `mushroom` active | player eats a mushroom | lesson done, +$40, LESSON shows `greedy` | spec |
| 8 | type lesson current, type fed before (lifetime) | update | done at once, paid once | abs rule |
| 9 | next lesson `from` > holeLevel | update | LESSON shows "Next lesson at hole level N", bar holeLevel/N, no waypoint; on level-up the lesson appears and its rel base is read then | design note |
| 10 | heavy or massive gnome eaten (any feeder) | consume | `stats.heavies` +1; normal tier: unchanged | spec "gnomy" (weights) |
| 11 | player-thrown gnome with `bounced` eaten | consume | `stats.trickShots` +1; machine-fed bounced gnome: unchanged (`hole.ts:97` guard) | spec "mnozniki" (TRICK) |
| 12 | F8 save (`goal2` defined) e.g. goal 8, goal2 3 | boot | done = every new milestone before old current (`lvl6`), + crate, dump, combo15; GOAL shows `lvl6`, LESSON shows `mushroom`; running goal keeps its base | brief: no re-pay |
| 13 | pre-F8 save (`goal2` undefined) | boot | split as today (`goals.ts:62-70`), then row 12 | `land-and-balance.md` F8 |
| 14 | rebirth | reload | `goalsDone`/`goalStart` carried; GOAL hidden (all done), LESSON gated at level 1 or hidden when none left | `hole.ts:514` |
| 15 | `?daily` | boot | fresh tutorial as today, nothing saved | `main.ts:46` |
| 16 | no goal done yet, time < 120 s | contracts update | no contract; after the first goal → contract rolls | `contracts.ts:148` |
| 17 | HUD | render | second head reads `LESSON` | spec |
| 18 | `trick` current, no trampoline placed | waypoint | desk; after placing → that trampoline | `goals.ts:86` pattern |
| 19 | `king` lesson, level 10 | king eaten (`typesEaten.king`) | done +$2000; lesson text does not depend on how often the event rolls | concurrency note |
| 20 | spec silent: SNIPER, STRIKE, volley, moods / parade / OVERTIME multipliers | — | no lesson (SNIPER counts inside `long`; the rest have no stat or need the Magnet Gun) | Open decisions 3 |
| 21 | spec silent: angry, dwarf, wizard, fat types | — | lessons as listed; shadow none | Open decisions 4 |

### Reach
- `src/systems/goals.ts` (whole file rewritten in place): readers `main.ts:93,249` (`new Goals()`, `update()`), `hud.ts:486-492` (`progress()`, `progress2()`), `hud.ts:566` (`targetPos()`), `contracts.ts:148` (`ctx.state.goal`), `hole.ts:514-515` (rebirth copies `goal2`, `goalBase2`), `state.ts:101-102` (`goal`, `goalBase` kept by `freshState`).
- New save fields (module augmentation in `goals.ts`, like `goal2` today): `goalsDone?: string[]`, `goalStart?: Record<string, number>`. Writers: `goals.ts` only. Readers: `goals.ts`, `hole.ts` rebirth copy. Legacy `goal`, `goalBase`, `goal2`, `goalBase2` are read once for migration and then left untouched (not deleted: `goal`/`goalBase` are non-optional in `GameState`).
- New stats `heavies`, `trickShots` (`state.ts:31-51` + zeros in `freshState`): writer `hole.ts:consume` only; readers `goals.ts`. `loadState` merges `base.stats` (`state.ts:136`) so old saves get 0.
- `src/entities/mushrooms.ts:40-43` `maybeDrop`: callers `hole.ts:152` only; new read of `ctx.goals.wantsMushroom`.
- `src/ui/hud.ts:486` label `'SKILL'` → `'LESSON'`; `legend.ts` does not mention the track name (`rg SKILL src/ui/legend.ts` → none).
- `contracts.ts:148`: `ctx.state.goal < 1` → `!ctx.goals.firstDone`.
- Not touched: `events.ts`, `gnomeTypes.ts` (other agent), achievements, album, daily.

### Data
- localStorage save only: +`goalsDone` (≤ 34 ids, ~400 bytes) + `goalStart` (≤ 34 numbers). No DB, no index.
- Per frame: `Goals.update` does two `find` over 15 and 19 entries with a `Set` lookup; today it does two array index reads. Negligible next to physics.
- Expected waiting per lesson at its `from` level (spawn pool weights `gnomeTypes.ts`): greedy 1 in 10 gnomes, angry 1 in 17, dwarf 1 in 21, saboteur 1 in 27, wizard 1 in 55, fat 1 in 29, boom 1 in 67 (but 93 % already seen by level 4), golden 1 in 250 plus GOLDEN HOUR (96 % seen by level 5), heavy 1 in 13 at level 2, massive 1 in 33 at level 4.

### Steps (edit order)
1. `src/core/state.ts` — `stats.heavies: number`, `stats.trickShots: number` in the interface (`:31-51`) and `0` in `freshState` (`:80-100`).
2. `src/systems/hole.ts` `consume` — in the `g.bounced` block (`:117-121`) add `s.stats.trickShots++`; after the massive block (`:131-134`) add `if (g.tier.id !== 'normal') s.stats.heavies++`.
3. `src/systems/goals.ts` — replace the two arrays with `MILESTONES: Goal[]` and `LESSONS: Goal[]` from the tables above; `interface Goal` gains `id: string` and `from?: number`; `Where` gains `'trampoline'` (`targetPos`: `ctx.machines.list.find((m) => m.type === 'trampoline')?.pos ?? ctx.env.deskPos`). State augmentation: `goalsDone?: string[]; goalStart?: Record<string, number>`. Constructor: if `goalsDone === undefined` run the existing pre-F8 split (`:64-70`) when `goal2 === undefined`, then build `goalsDone` = ids of new MILESTONES before the old current milestone's id (old list `OLD_MILESTONES = ['make','grab','feed','coins','buy','lvl2','lvl4','garden','lvl6','lvl8','lvl10','lvl12','deep']`, index `goal`) plus `OLD_SKILLS = ['crate','dump','combo15','long','air','bullseye','haul'].slice(0, goal2)` when `goal >= 6`; `goalStart[oldCurrentMilestoneId] = goalBase`, `goalStart[oldCurrentSkillId] = goalBase2` when defined. `current` = first MILESTONE not done; `current2` = first LESSON not done, only when `lvl2` done; `locked2` = `current2 && current2.from > holeLevel`. `progress2()` returns `{ text: \`Next lesson at hole level ${from}\`, have: holeLevel, need: from }` when locked. Base: `measure` reads `goalStart[g.id]`, set in `update()` the first frame a goal is current and unlocked. `done()` unchanged (`ctx.hole.earn`, toast, audio); on done push id, delete `goalStart[id]`. Getters `firstDone` (`goalsDone.length > 0`) and `wantsMushroom` (`current2?.id === 'mushroom' && !locked2`). Remove `start()` (callers: only `goals.ts`).
4. `src/systems/contracts.ts:148` — `if (!ctx.goals.firstDone && ctx.time < FIRST_AFTER) return;`.
5. `src/entities/mushrooms.ts:41` — `const chance = ctx.goals.wantsMushroom && this.list.length === 0 ? 1 : 0.025 * (1 + lvl('mushChance') * 0.3) * bonus;`.
6. `src/systems/hole.ts:514-515` — copy `goalsDone` and `goalStart` instead of `goal2`/`goalBase2` (`freshState` still carries `goal`/`goalBase`, now unused after migration).
7. `src/ui/hud.ts:486` — `'SKILL'` → `'LESSON'`.
8. `docs/SPEC.md` "Cele (panel GOAL)" line and `CHANGELOG.md` entry (what to test: the first eight goals and the lesson line).

### Tests
Headless scenario `scenario-tutorial-goals.js` (scratchpad `smoke/`, dev server 5199, `window.gnome` = ctx). Each check sets state through `gnome.state`, calls `gnome.goals.update()` or feeds a gnome through `gnome.hole.consume`, then reads `.hud-goal` text, `gnome.state.money`, `gnome.state.goalsDone`, `gnome.mushrooms.list.length`. Save-migration checks write a crafted `gnome-boozed-save-v1` to localStorage and reload. Background job: none (goals update in the frame loop; the scenario waits one frame after each mutation).

### Done when
1. fresh boot → `.hud-goal` text contains `GOAL` and `Make gnomes`, not `LESSON`.
2. set produced/grabbed/eaten/lifetimeEarned past targets frame by frame → `goalsDone` = `[make,grab,feed,coins]`, then text `LONG SHOT x2.5`, then `Reach a 5 combo`, then `Buy an upgrade`; money delta = 5+5+10+10+20+15+20.
3. `stats.maxCombo = 9` before `combo5` shows → next frame `goalsDone` includes `combo5`, money +15 exactly once over 3 frames.
4. `holeLevel = 2` → text contains `LESSON` and `Eat a MUSHROOM`.
5. mushroom lesson active, `mushrooms.list.length === 0`, `hole.consume(g)` → `mushrooms.list.length === 1`; consume 20 more with one lying → length stays ≤ 2 (no forced second).
6. `goalsDone` includes `mushroom`, 200 consumes with `Math.random` stubbed to 0.5 → `mushrooms.list.length === 0`.
7. `gnome.buffs.apply('zoom')` during the lesson → money +40, text contains `GREEDY GNOME`.
8. `stats.typesEaten.greedy = 1` before `greedy` shows → done next frame, money +40 once.
9. `holeLevel = 2`, done through `combo15` → text `Next lesson at hole level 3`, `g-num` `2 / 3`, `targetPos()` null; set `holeLevel = 4` and `stats.bullseyes = 7` before `bullseye` shows → `goalStart.bullseye === 7`.
10. consume a `heavy` tier gnome → `stats.heavies` 0→1; consume a `normal` → stays 1.
11. consume a gnome with `thrownBy='player'`, `bounced=true`, `throwPos` set → `stats.trickShots` 0→1; same with `thrownBy='machine'` → stays 1.
12. save `{goal:8, goal2:3, goalBase2:4, stats:{longShots:4}}` + reload → `goalsDone` = `[make,grab,feed,coins,long,combo5,buy,lvl2,lvl4,garden,crate,dump,combo15]`, GOAL text `Reach hole level 6`, LESSON text `Eat a MUSHROOM`, `goalStart.long === undefined` (long is done), money unchanged.
13. save `{goal:9}` without `goal2` + reload → `goalsDone` = milestones before `lvl6` + `[crate,dump,combo15]`, GOAL `Reach hole level 6`.
14. `goalsDone` = all milestones, `hole.rebirth()` (stub `location.reload`) → saved JSON has the same `goalsDone`, after reload `.hud-goal` has no `GOAL` head and LESSON reads `Next lesson at hole level 2` or is empty when every lesson is done.
15. open `?daily` → `.hud-goal` text `Make gnomes`, localStorage save key unchanged after 15 s.
16. fresh boot, `time = 5` → `contracts.current === null`; finish `make` → next frame `contracts.current !== null`.
17. `holeLevel = 2`, `lvl2` done → `.g-head` texts `['GOAL','LESSON']`.
18. `trick` current, no trampoline → `targetPos()` equals `env.deskPos`; place a trampoline → equals its `pos`.
19. `holeLevel = 10`, lessons done through `fat`, `stats.typesEaten.king = 1` → done, money +2000.
20. `rg -n "sniper|strike|volley|parade|mood" src/systems/goals.ts` → no lesson id (only the SNIPER word inside no text; longShots counted by `long`).
21. `rg -n "'angry'|'dwarf'|'wizard'|'fat'" src/systems/goals.ts` → 4 lesson ids; `rg -n "shadow" src/systems/goals.ts` → nothing.

### Assumptions (numbered)
1. Two tracks stay (F8, `2026-10-20-land-and-balance.md`): milestones + lessons; the lesson track opens after `lvl2` as today.
2. Lessons are sequential with level gates; a rare type can block the track for a while, mitigated by placing each type at a level where it is usually already fed (Data section). No out-of-order completion.
3. Type lessons are absolute on lifetime `typesEaten`, so a Golden Hour or an old album completes them instantly, with the reward.
4. Rewards keep today's scale; `long` moves to the tutorial at $20 (was $100 as a skill), `air` target 5 → 3 at $60 (was $150). The contract "5 AIR" is unchanged.
5. `heavies` counts heavy and massive from any feeder (machines too), like `hauls` today.
6. Texts stay under ~90 characters; the column is 210 px at 700 px width (`style.css`), the crate text today is the longest and fits.
7. Daily (`?daily`) keeps showing the tutorial from scratch; a 5-minute run reaches `lvl2` rarely, so the lesson track seldom shows there.

### Alternatives rejected
- (a) Keep the index model and shift indexes like the F8 split: rejected, a reordered lesson list cannot express "long done, mushroom not" and old saves would pay `crate`/`combo15` again.
- (b) One single list (tutorial + lessons + levels): rejected, F8 (2026-10-20) found non-throwing players stuck before the level goals.
- (c) Lesson pool "first available incomplete, complete any satisfied abs lesson out of order": rejected, a rich old save would fire ten rewards and toasts at once; the sequential model with gates is enough.
- (d) MUSHROOM BLOOM event instead of a forced drop: rejected, events roll every 70-140 s with 2/≈19 weight, the lesson would wait minutes.

### Ladder
- `goalsDone`/`goalStart` fields: rung 6, required by "existing saves mid-goal-list must not break or re-pay" (brief) and the reordered list.
- `from` on `Goal`: rung 6, "goals must not ask for a gnome that cannot appear yet" (brief).
- `stats.heavies`, `stats.trickShots`: rung 6, spec "gnomy (weights)" and "multipliers (TRICK)"; no existing counter (`rg heavies|trickShots src` → none).
- `wantsMushroom` branch in `maybeDrop`: rung 5 (one line), spec "mushrooms ... eating one" within the first goals.
- `'trampoline'` in `Where`: rung 2, same pattern as `'crate'` (`goals.ts:86`).
- `LESSON` label: rung 5, spec "pokazywały mechaniki".
- Not built: a locked-lesson preview text, per-lesson icons, a goals list screen, lesson skipping.

### Self-check
- Every acceptance criterion has a step and a Done-when line: yes (21 rows, 21 lines, steps 1-8).
- Every step names a file, a signature and values: yes.
- Every written field lists all writers and readers: `goalsDone`/`goalStart` (goals.ts, hole.ts), `heavies`/`trickShots` (hole.ts → goals.ts), `maybeDrop` chance (hole.ts caller): yes.
- Lists compared with code: gnome types 12 vs 5 named (rows 21, Open decisions 4), multipliers (row 20, Open decisions 3), mushrooms 6 → one lesson. `spec silent` rows: 2.
- Decisions older than 60 days: none (all `docs/ai-work` files are from 2026-10-19/20).
- Plan shorter than the code: no, the goal list for PP is the bulk; the code is about 180 lines.

### Open decisions (for PP)
1. Tor lekcji zaczyna się dopiero po poziomie 2 (jak dziś SKILL). Wcześniej gracz widzi tylko samouczek: zrób, złap, nakarm, monety, LONG SHOT, combo 5, sklep, poziom 2. a) tak, lekcje (grzybek, typy gnomów, tricki) od poziomu 2, wtedy na poziomie 1 jest jedna linia celu i nic nie rozprasza; b) lekcje od razu po „Collect coins”, wtedy od pierwszej minuty są dwie linie celów naraz. (rekomendacja: a, bo grzybki, chciwe gnomy i eventy i tak zaczynają się na poziomie 2)
2. Gdy lekcja o grzybkach jest aktywna, a na trawie nie leży żaden grzybek, następny zjedzony gnom na pewno wypluwa grzybka. a) tak, wtedy lekcja trwa kilka sekund; b) nie, losowo jak dziś, wtedy gracz czeka średnio 40 gnomów, czyli cały poziom 2. (rekomendacja: a)
3. [spec silent] Zakładam: SNIPER, STRIKE, salwa (VOLLEY), nastroje dziury, parada i OVERTIME nie dostają lekcji | Dowód: `hole.ts:99-104` SNIPER liczy się w `longShots`, STRIKE i salwa nie mają licznika w `state.ts:31-51`, salwa wymaga Magnet Gun za $300 | Jeśli źle: gracz nie dowie się o tych mnożnikach z celów, tylko z napisów w grze i legendy | Pewność: Likely | rekomendacja: a) bez lekcji
4. [spec silent] Zakładam: wściekły, krasnal, czarodziej i gruby gnom dostają lekcje jak wymienione typy, Shadow Gnome nie (tajne osiągnięcie) | Dowód: `gnomeTypes.ts:29-91` 12 typów, `achievements.ts:34` `secret: true` | Jeśli źle: cztery lekcje za dużo albo brak lekcji o cieniu | Pewność: Likely | rekomendacja: a) jak w tabeli

## Review: performance (plan-performance)

Verdict: APPROVE

No database in this repo; "cost" here = work per frame, DOM writes per frame, work per eaten gnome, save size and autosave.

| plan step | operation | shape | multiplicity | volume (where measured) | cost | severity |
|---|---|---|---|---|---|---|
| 3 | `current` / `current2` getters (`find` + done lookup) | linear scan, first not-done entry | per frame: `update()` reads both, `hud.ts:486` reads both via `progress`/`progress2`, `hud.ts:566` `targetPos()` reads both → ~6-8 scans | 15 milestones + 19 lessons (plan tables) | < 300 string compares per frame | Low |
| 3 | `goalStart[id]` set on first frame current | one property check | per frame, write once per goal | ≤ 34 keys | O(1) | none |
| 3 | `targetPos()` `'trampoline'` | `machines.list.find` | per frame, only while `trick` is current | placed machines (same as `'crate'` today, `goals.ts:86`) | same as today | none |
| 7 | HUD goal block | `goalKey` string compare, `innerHTML` only on change (`hud.ts:487-492`) | per frame compare; rewrite only when text/have/need change | locked lesson: `have` = holeLevel, changes on level-up only | unchanged pattern | none |
| 5 | `maybeDrop` forced chance | `this.list.length === 0` + getter | per eaten gnome (`hole.ts:152`) | 1 forced mushroom per lesson | O(1) | none |
| 2 | `stats.heavies++`, `stats.trickShots++` | counter | per eaten gnome | — | O(1) | none |
| 3, 6 | save: `goalsDone` + `goalStart` | `JSON.stringify` in `saveState` (`state.ts:154`) | autosave every 10 s (`main.ts:181`) + `beforeunload` | ≤ 34 ids (~400 B) + ≤ 34 numbers (~600 B), estimated from the tables | ~1 KB more per 10 s | none |

Findings:
- [Low] step 3, done lookup: when `goalsDone` stays a `string[]` in the save and the getter builds `new Set(goalsDone)` on each call, then the game allocates ~6-8 Sets per frame (~400/s at 60 fps) for no reason, because the getters run 6-8 times a frame (count above); fix: build the `Set` once in the constructor after migration and add to it in `done`, or use `goalsDone.includes(id)` (≤ 34 items, no allocation). Measured: no (call count read from `main.ts:249`, `hud.ts:486,566`); the cost is GC churn, not CPU.

No findings on: per-eaten-gnome work (two counters, one length check), HUD DOM rewrites (keyed as today), waypoint lookup (same as the crate path), save size (~1 KB on a 10 s autosave), migration (runs once in the constructor), Done-when 6 (200 consumes in a headless scenario). Prod: not applicable (browser game, localStorage only).

## Review: roast (plan-roaster)

Verdict: BLOCK (one-row fix for finding 1; finding 2 needs a PP choice)

Steel-man: the plan turns the goal panel into a teaching track without new UI: one mechanic per goal, rewards paid once, level gates so a lesson never asks for a gnome that cannot spawn yet, lifetime `typesEaten` so nobody re-hunts a Golden Gnome, and an id-based `goalsDone` that finally lets lists be reordered without re-paying old saves. Strong points: the forced mushroom drop (mushrooms expire after 30 s, `mushrooms.ts:118`, so the force re-arms and the lesson cannot dead-lock), the migration rows 12-13 with concrete saves, contracts keyed on `firstDone`, no lesson for the secret Shadow Gnome.

Findings:
- [Major] `long` (LONG SHOT from 8 m) as milestone 5 brings back the F8 bug the two-track split was built to fix.
  Assumption: every new player throws into the hole from 8 m at hole level 1 before buying anything.
  Scenario: a new player who feeds by dropping (release LMB over the hole, which the `feed` text itself teaches) or who buys a broom/fan never lands a player throw from >= 8 m; `long` stays current, so `buy`, `lvl2`, `lvl4` ... `deep` never show (milestones are sequential), and the LESSON track never opens because it waits for `lvl2`.
  Checked: F8 in `2026-10-20-plan-night-features.md:76` ("the goal chain strands non-throwing players ... chain stops at BULLSEYE forever, no Reach hole level goals ($18 250)"), its Done-when 9 in `2026-10-20-land-and-balance.md:12` ("a plow-only player sees level goals"); `hole.ts:97-111` counts `longShots` only for `thrownBy === 'player'` with a `throwPos`, drops and machines never count.
  Impact: the player sees "LONG SHOT x2.5" for the whole run, gets no level goals and no lessons; the plan breaks a settled PP decision without saying so.
  Recommendation: keep `long` out of the milestone track (first lesson after `mushroom`, or with `air`); `combo5` already teaches a multiplier at level 1 and can be done by dropping, so "mnozniki" stays covered in the first goals.
- [Major] The lesson track repeats F8 one level down: throwing lessons block every gnome-type lesson behind them.
  Assumption: a player who reaches level 2 will do 3 AIR shots, a trampoline TRICK shot and a 15 combo.
  Scenario: an automation or tractor player opens lessons at level 2, finishes `mushroom`, `greedy`, `heavy`, then stops at `air` (needs a player throw that never touches grass, `hole.ts:112-117`) for the rest of the run; `angry`, `dwarf`, `boom`, `saboteur`, `golden`, `wizard`, `fat`, `king` never show, which is the "gnomy" half of PP's brief.
  Checked: lesson order in the plan table (air 4th, trick 7th, combo15 8th, bullseye 13th, all before or between the type lessons); `airShots` and `trickShots` increment only inside `if (g.throwPos && g.thrownBy === 'player')` (`hole.ts:97`); SPEC `docs/SPEC.md:15` says automation is the fastest path (27 min), so this is the common player, not an edge case.
  Impact: the players who most need the type lessons (they never hold a gnome long enough to look at it) get none; PP sees "AIR x2: 3 throws" stuck in the panel for 20 minutes.
  Recommendation: question for PP: a) skill lessons (air, trick, bullseye, combo15) in a separate order after all type lessons, then a slow skill stalls only skill lessons; b) the LESSON line shows the first not-done lesson whose `from` <= level, so a skipped skill lesson waits while type lessons go on (this is alternative (c) without the burst, see next finding).
- [Minor] The reason the plan gives for rejecting the pool model (alternative c, "ten rewards and toasts at once") happens anyway in the sequential model, one per frame. Scenario: a pre-F8 save at level 8 with all old skills done: after `mushroom`, `heavy` and `trick`, the abs lessons `angry`, `dwarf`, `boom`, `saboteur`, `golden`, `wizard`, `fat` complete in 7 consecutive frames (`update()` advances one step per frame, `goals.ts:111-118`), 7 toasts against `MAX_TOASTS = 4` (`hud.ts:24`), each lesson text visible for 1 frame. A new player meets the same at level 4 (`boom` 93 % already fed, plan Data). Recommendation: a lesson already satisfied when it becomes current is marked done with no toast, or paid with one summary toast ("3 lessons done +$460").
- [Minor] `king` lesson is close to unreachable in one run, and it is the last line the player sees. King event weight 0.6 of ~25.6 total (`events.ts:10-29`), one event per 70-140 s (`events.ts:52`): about one king per 75 minutes from level 10, while automation finishes level 12 in ~27-30 min (`SPEC.md:15`). The panel shows "Feed the KING GNOME ... $2000" until rebirth, then again at level 10 next run.
- [Minor] Text length: assumption 6 says the crate text (71 chars) is the longest; new texts are longer: saboteur 97, king 95, combo5 83 chars. At 640x360 the column is 210 px with `.g-text` 12px (`style.css:63,70`), about 30 characters per line, so GOAL + LESSON can take 7-8 text lines plus two heads, two bars and two counters, and the column already drops the oldest messages when it runs out of space (`SPEC.md:206`). Done-when has no 640x360 screenshot. Recommendation: one screenshot check at 640x360 with saboteur + `long` showing, or cut the type texts to one clause (legend has the rest, per the plan's own design note).
- [Minor] Mid-tutorial old saves skip the two new tutorial goals unpaid: an old save with `goal = 4` (current `buy`) gets `long` and `combo5` marked done by the "ids before the old current milestone" rule. Harmless, but the player never sees the multiplier lessons; say so in the plan so nobody files it as a bug.
- [Minor] Double pay with contracts: contracts `long`, `air`, `bullseye`, `combo`, `haul`, `crate` (`contracts.ts:38-45`) count the same stats as the lessons, so one throw can finish both. Small money at those levels (lesson total ~$3 970 vs `lvl10` goal $5 000), no economy risk; noted only because SPEC says the game already ends too fast.
- [Minor] No skip for players who know the game: 8 tutorial goals are rel and fast (~2-3 min), so the cost is low; the nag is the stuck cases above, not the length. 34 goals is fine once nothing can stall.

Pre-mortem: a week after release PP plays a fresh save the way he plays now (crate and machines, little hand throwing) and writes "the goal says LONG SHOT forever and I never saw a lesson". The first assumption to crack is "the tutorial player throws from 8 m"; the missed signal is F8 in the night plan, which documented exactly this failure for the same stat.

Inversion worth considering: show the first unlocked, not-done lesson instead of a strict sequence, with already-satisfied lessons closed silently; the plan rejected this for a toast burst that the sequential model also produces.

Investigate first: can a new player at hole level 1, without Trick Scope, land a throw from >= 8 m in a normal attempt (hole radius and throw range at level 1)? If most cannot, finding 1 also hits players who do throw.

## Review: impact (plan-impact)

Verdict: BLOCK

Missing from the plan:
- [High] Conflict with F8 (`2026-10-20-plan-night-features.md:76`: "the goal chain strands non-throwing players"; `2026-10-20-land-and-balance.md:12`: "a plow-only player sees level goals"). The plan puts `long` (LONG SHOT, counted only for `thrownBy === 'player'`, `hole.ts:97-110`) into the GOAL track before `buy` and `lvl2`. When a player only drops, sweeps or plows gnomes, then GOAL stops at `long` forever: no "Reach hole level 2..12", no Garden, no Deep, and the LESSON track never opens because it waits for `lvl2`. That is the exact bug F8 fixed. Fix: keep the GOAL track throw-free (move `long` to the first LESSON, or accept any trick), or get PP's explicit approval to drop F8.
- [Medium] The same F8 logic inside the LESSON track: `air` and `trick` (player throws only) sit before every gnome-type lesson. When a player never throws, then he never sees the angry, dwarf, golden, wizard, fat and king lessons. Today the skills track stalls only on skills. Fix: put type lessons on their own order, or say in Open decisions that throwing gates the type lessons.
- [High] `Goals.start()` is removed ("callers: only goals.ts", Step 3), but 8 scratchpad scenarios call `g.goals.start()` and drive the game by writing `state.goal`: `scenario-contracts.js:39,53,59`, `scenario-contracts-shot.js:8`, `scenario-bottom-row.js:18`, `scenario-left-stack.js:26`, `scenario-polish-c.js:29`, `tmp-left-measure.js:15`, `scenario6.js:40,114-115`. When they run after the change, then they throw `TypeError` or set a dead field, and the contracts scenario never sees a contract (`goal = 1` no longer means "first goal done"). `scenario-land-balance.js:246-260` and `zz-land-no-reload.js` check the `SKILL` head and re-run the old split via `new G()`, which the new constructor skips once `goalsDone` exists. Fix: add a step that rewrites these scenarios to `goalsDone`, or keep a `start()` shim for DEV.
- [Medium] `targetPos()` (`goals.ts:82`) takes the milestone's `where` first. Done-when 9 ("locked lesson → `targetPos()` null") and 18 ("`trick` current, no trampoline → deskPos, then trampoline pos") are only true when no milestone is current. When the test runs at hole level 2-10, then a milestone (`lvl4`, `garden`...) is current and `targetPos()` returns the hole or the desk. Fix: either state "all milestones done" in those Done-when lines, or change the rule (lesson waypoint when the milestone has no `where`); the trampoline waypoint is dead code otherwise for most of the game.
- [Medium] Separate plan `2026-10-20-plan-physical-loads.md` (named in `BOARD.md:63`, "gnomy w skrzynce i w robocie fizycznie, bez znikania"; the file is not on disk yet). The `crate` lesson reads `stats.crated`, written only at `machines.ts:678` together with `ctx.gnomes.stash(g)` + `m.queue.push(g)`; `dump` reads `stats.crateDumps`, written at `machines.ts:641` on `m.queue.length`. When that plan stops stashing gnomes, then both counters may never move and the LESSON track stalls at `crate`. Fix: name both writers as a contract in both plans (the physical-loads implementer keeps `crated++` on "gnome lands in the crate" and `crateDumps++` on a dump of a non-empty crate).
- [Low] `stats.mushrooms` (lesson `mushroom`, rel 1) is written by `buffs.apply` (`buffs.ts:36`), which the BOOZE cheat also calls (`main.ts:268`). When a player types BOOZE, then the mushroom lesson completes without a mushroom. Accept or count in `mushrooms.ts:96` instead.
- [Low] `freshState(keep)` still copies `goal`/`goalBase` on rebirth (`state.ts:101-102`) and `hole.ts:514-515` copies `goal2`/`goalBase2`; after Step 6 the legacy fields stay in every save forever. When a migrated save is rebirthed, then `goalsDone` already exists, so nothing reads them; harmless, noted so nobody re-runs the split.

Neighbours checked: HUD GOAL panel: affected (`hud.ts:486` label + key, Step 7; "Next lesson..." text fits the measure path) | achievements: not affected (`achievements.ts:32-34` read `maxCombo`, `hole.ts:170` unlocks golden/wizard/king in the same frame as the lesson toast, no shared state) | contracts: affected (`contracts.ts:148`, Step 4; contracts `long`/`air`/`haul` read the same stats with their own base, no clash) | daily: not affected (`main.ts:46` `freshState()`, migration runs on `goal 0`, nothing saved) | rebirth/Deep: affected (Step 6; `deep` milestone reads `rebirths`, carried) | save/load: affected (`loadState` merges `stats`, new arrays survive the spread; covered) | offline: not affected (`offline.ts:57` only `hole.earn` → `lifetimeEarned`, before the first `goalStart` read) | hole.consume tricks: affected (Step 2; `bounced` set only for player throws at `machines.ts:721`, cleared at `sweeper.ts:154,190`, `robots.ts:637`; crate dump nulls `throwPos` at `machines.ts:648`, so `trickShots` stays player-only) | volley: not affected (no lesson) | golden hour: affected by design (`events.ts:149` swaps types to `golden`, `typesEaten.golden` counts them; Assumption 3) | mushroom drop: affected (Step 5; only caller `hole.ts:152`; event spawns `events.ts:184,308` do not go through `maybeDrop`) | spawn gates: consistent (`gnomeTypes.ts` unlock: greedy 2, boom 2, angry 3, dwarf 4, saboteur 5, wizard 7, fat 8, king event lvl 10; massive tier from lvl 4 `rollTier`; hoop exists at every level, `hole.ts:482`) | first-use hints/legend: not duplicated except `dump` text = `HINTS.box` (`hud.ts:28`), same as today | moods: not affected (`moods.ts:24,70` read `longShots` deltas only).
FE/BE: not applicable (no API); the HUD reads `progress()`/`progress2()` shape `{text, have, need}`, unchanged.
Decisions: conflicts with `2026-10-20-plan-night-features.md` F8 / `2026-10-20-land-and-balance.md` ("Skills (crate, combo 15, tricks, heavy haul) as SKILL"; plan moves LONG SHOT into GOAL) | consistent with `2026-10-20-contracts.md` (first contract after the first goal) | consistent with `2026-10-20-legend.md` (no private constants in texts) | consistent with `docs/SPEC.md:194` once Step 8 rewrites the line.
Decisions older than 60 days: none (all notes are from 2026-10-19/20).
Regression vs current behaviour: a non-throwing player today reaches every level goal and The Deep via GOAL; with the plan he stops at `long` (first finding).

## Plan (plan-senior, final)

Status: needs-decision

### Resolutions
- R1: roaster [Major] + impact [High] `long` in the GOAL track vs v0 "LONG SHOT teaches a multiplier early": Decision: `long` leaves the GOAL track and becomes a lesson (reward back to today's $100). Rationale: v0 wanted a multiplier in the first goals; `combo5` gives that at level 1 and a dropping player can do it, while `longShots` only counts `thrownBy === 'player'` with a `throwPos`, so a plow or crate player would stand on `long` forever and never open the lessons, the exact F8 bug. Checked: `src/systems/hole.ts:97-110`, `2026-10-20-plan-night-features.md` F8. The GOAL track now contains no stat that needs a hand throw.
- R2: roaster [Major] + impact [Medium] throwing lessons gate the type lessons; roaster asked a) skills after all types or b) first unlocked not-done lesson: Decision: other, "parallel lessons": every unlocked, not-done lesson counts at the same time (rel base taken the frame it unlocks), the LESSON line shows the first not-done unlocked lesson in a fixed order with type/mechanic lessons before skill lessons, and a lesson satisfied in the background completes without being shown. Rationale: a) still stalls (wizard rolls 1 in 55, so `fat`, `king` and every skill behind it wait on one rare gnome); b) alone still shows a stuck `air` while `angry` sits behind it. Parallel counting plus the type-first order shows the most doable lesson and nothing waits on a throw. v0 rejected this pool model for the toast burst; R3 removes the burst. Cost: up to 19 `value()` calls per frame, trivial (performance table).
- R3: roaster [Minor] cascade of already-done lessons (7 toasts vs `MAX_TOASTS = 4`): Decision: accepted; lessons completed in one frame are paid together and get ONE toast (`Lesson done! +$X` for one, `N lessons done! +$total` for more). Rationale: paying stays (an old save earned those lessons; silent completion would hide money PP can see in the counter), the burst goes. Checked: `src/ui/hud.ts:24,227-235` (dedupe only joins identical text, rewards differ).
- R4: roaster [Minor] `king` lesson near unreachable (0.6 / ~24.6 weight, one event per 70-140 s, about one king per 72 min from level 10): Decision: keep the lesson, last (`from` 10), text says it is a rare event; no dependency on a King timer. Rationale: the brief asks that the lesson reflect today's numbers; with R2 the king line shows only when every other lesson is done, so it blocks nothing. Checked: `src/systems/events.ts:16-29,52`.
- R5: roaster [Minor] text length (saboteur 97, king 95 chars) vs assumption 6: Decision: accepted; every goal text ≤ 70 characters (tables below are the final texts), plus one 640x360 screenshot in Done when. Rationale: the column is 210 px at ≤ 700 px width with 12 px text (`src/ui/style.css:58-70`), about 30 chars per line; 70 chars = 3 lines per track.
- R6: roaster [Minor] mid-tutorial old save (`goal = 4`) skips `combo5` unpaid: Decision: accepted as documented behaviour, no code. Rationale: $15 and one lesson; paying it would re-pay every old save for a goal it never saw. Written in the ai-work note.
- R7: roaster [Minor] double pay with contracts: rejected because contracts are their own system with their own base (`src/systems/contracts.ts:38-45`), the overlap is ≤ $200 per lesson and PP has not asked to tie them.
- R8: roaster [Minor] no skip for players who know the game: rejected because the tutorial is 7 rel goals done in 2-3 minutes; the nag was the stall, fixed by R1/R2.
- R9: roaster "investigate first" (8 m throw at level 1): rejected because after R1 `long` is a lesson at level 2 that runs in parallel; nobody waits on it.
- R10: impact [High] `start()` removed while 8 scratchpad scenarios call it and write `state.goal`: Decision: `start()` stays with its real job (record the base of the current milestone in `goalStart`), and step 10 rewrites the scenarios that set `state.goal` / `goal2` to `state.goalsDone`. Rationale: the shim alone would not fix `state.goal = 1` meaning "first goal done" (contracts now read `firstDone`), so the scenarios need the edit anyway; keeping `start()` costs nothing and keeps the base logic in one place. Checked: scratchpad `smoke/scenario-contracts.js`, `scenario-contracts-shot.js`, `scenario-bottom-row.js`, `scenario-left-stack.js`, `scenario-polish-c.js`, `tmp-left-measure.js`, `scenario6.js`, `alias/tmp-i-scenario-land-balance.js:272-279`.
- R11: impact [Medium] `targetPos()` takes the milestone first, so the trampoline waypoint is dead for most of the game: Decision: after `lvl2` is done the lesson's `where` wins; before that only milestones exist. Rationale: once lessons run, the milestones are "Reach hole level N" (hole) and Garden (shop), places the player knows; the lesson waypoint (crate, trampoline) is the one that carries information. Checked: `src/systems/goals.ts:83`.
- R12: impact [Medium] physical-loads plan may stop `crated++` / `crateDumps++`: Decision: the counters are defined at the level both designs keep and written as a contract in this plan and in the ai-work note: `stats.crated` = "a gnome is delivered into a crate (today `machines.ts:678`, after physical loads: the frame the gnome is accepted as the crate's load)", `stats.crateDumps` = "a crate with at least one gnome is dumped into the hole (today `machines.ts:641`)". The physical-loads implementer keeps both increments; the lesson reads only the counters. Checked: `src/entities/machines.ts:641,678`, `BOARD.md:63` (the other plan file is not on disk yet).
- R13: impact [Low] BOOZE completes the mushroom lesson: Decision: accepted; `stats.mushrooms++` moves from `buffs.apply` to the pickup branch in `mushrooms.ts` (the line calling `ctx.buffs.apply(m.def.id)`), so only a mushroom walked over counts. Rationale: `stats.mushrooms` has no other reader (`rg "stats\.mushrooms" src` → only `buffs.ts:36`), so nothing else changes. Checked: `src/systems/buffs.ts:36`, `src/main.ts:268`, `src/entities/mushrooms.ts:96`.
- R14: impact [Low] legacy `goal`/`goalBase`/`goal2`/`goalBase2` stay in saves: accepted, no code; `goal`/`goalBase` are non-optional in `GameState`, the migration reads them once and `goalsDone` makes them inert.
- R15: performance [Low] `new Set(goalsDone)` per getter call: Decision: accepted; the `Set` is built once in the constructor and extended in `done`; `goalsDone` in the save stays an array.
- R16: v0 "Alternatives rejected (c)" (pool model, "ten rewards at once"): superseded by R2 + R3.

### Chosen variant
Two tracks as in F8: a throw-free GOAL track (make, grab, feed, coins, combo5, buy, lvl2, levels, Garden, Deep) and a LESSON track that opens after `lvl2` where every unlocked lesson counts in parallel, the panel shows the first not-done one with type lessons before skill lessons, and lessons finished together get one toast. Pros: no stat that needs a hand throw can stall either track; a rare type or a skipped skill blocks only its own line; old saves pay each id once. Cons: the LESSON line can jump (a new type unlocks ahead of the skill shown); a non-thrower at level 2 sees `long` until level 3 unlocks `angry`. Cost: ≤ 19 `value()` calls and one `Set` lookup each per frame, ~1 KB more per 10 s autosave (performance table), one forced mushroom per lesson. Risk: the toast summary hides which lessons paid (mitigated: the counter shows the total; `goalsDone` in the save lists them). Ladder: rung 6 for `goalsDone`/`goalStart`/`from`/parallel update (no existing structure expresses "done by id"), rung 2 for the trampoline waypoint and the forced-drop branch, rung 5 for the label and the stat move.

### Rejected variant(s)
- (b) v0 strict sequence (lessons one at a time, skills before types): pros: simplest code (~40 lines less), one line that never jumps; cons: `air`/`trick` block every type lesson for a machine player, which SPEC calls the common path (27 min); rejected because it does not handle the non-throwing player, which is the brief's own "must fix".
- (c) roaster a), skills after all types, still sequential: pros: no throw in front of a type lesson; cons: one rare type (wizard 1 in 55, golden 1 in 250 without Golden Hour) blocks `fat`, `king` and every skill lesson behind it; rejected because it only moves the stall.
- (d) MUSHROOM BLOOM event instead of a forced drop: rejected as in v0 (minutes of waiting).

### Behaviour matrix (final)
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| 1 | fresh save | boot | GOAL shows `make`, no LESSON line | v0 |
| 2 | tutorial | finish make..coins | next goals `combo5`, then `buy`, `lvl2`; each pays once; no goal in GOAL reads `longShots`, `airShots`, `bullseyes`, `trickShots` | R1 |
| 3 | `combo5` turn, `stats.maxCombo` already ≥ 5 | update | completes at once, pays $15 once, moves to `buy` | v0 |
| 4 | `lvl2` done | update | LESSON line appears with `mushroom` | v0 |
| 5 | `mushroom` active (shown or not, unlocked and not done), no mushroom on grass | hole eats a gnome | a mushroom spawns (chance 1); with one lying, normal chance | v0 + PP Q2 |
| 6 | `mushroom` done | hole eats a gnome | drop chance unchanged 2.5 % x Spore Bag | v0 |
| 7 | `mushroom` active | player walks over a mushroom | lesson done, +$40, LESSON shows `greedy` | v0 |
| 8 | type lesson unlocked, type fed before (lifetime) | update | done at once, paid once | v0 |
| 9 | every unlocked lesson done, some remain with `from` > holeLevel | update | LESSON shows `Next lesson at hole level N` (N = lowest remaining `from`), bar holeLevel/N; on level-up the lesson appears and its rel base is read then | v0 |
| 10 | heavy or massive gnome eaten (any feeder) | consume | `stats.heavies` +1; normal tier unchanged | v0 |
| 11 | player-thrown gnome with `bounced` eaten | consume | `stats.trickShots` +1; machine-fed bounced gnome unchanged | v0 |
| 12 | F8 save (`goal2` defined), e.g. goal 8, goal2 3 | boot | done = new milestones before old current (`lvl6`) + `crate`, `dump`, `combo15`; GOAL `lvl6`, LESSON `mushroom`; running goal keeps its base | v0 |
| 13 | pre-F8 save (`goal2` undefined) | boot | split as today, then row 12 | v0 |
| 14 | rebirth | reload | `goalsDone`/`goalStart` carried; GOAL hidden (all done), LESSON gated at level 1 or hidden when none left | v0 |
| 15 | `?daily` | boot | fresh tutorial, nothing saved | v0 |
| 16 | no goal done, time < 120 s | contracts update | no contract; after the first goal a contract rolls | v0 |
| 17 | HUD | render | second head reads `LESSON` | v0 |
| 18 | `trick` shown, no trampoline placed, `lvl2` done | waypoint | desk; after placing → that trampoline | v0 + R11 |
| 19 | `king` lesson, level 10 | king eaten | done +$2000; text names the rare event, no timer | v0 + R4 |
| 20 | spec silent: SNIPER, STRIKE, volley, moods, parade, OVERTIME | — | no lesson | v0 |
| 21 | spec silent: angry, dwarf, wizard, fat | — | lessons; shadow none | v0 |
| 22 | level 3, `air` not done, `angry` not done | update | LESSON shows `angry` (type before skill) | R2 |
| 23 | `angry` shown, player lands 3 AIR shots | consume x3 | `air` completes in the background, +$60, toast `Lesson done! +$60`, LESSON still `angry` | R2 |
| 24 | old save level 8, `typesEaten` has angry, dwarf, boom, saboteur, wizard, fat; `goalsDone` = milestones through `lvl8` | first update | six lessons done in ONE frame, money +$700 once, exactly one toast `6 lessons done! +$700` | R3 |
| 25 | `mushroom` active | player types BOOZE | `stats.mushrooms` unchanged, lesson not done | R13 |
| 26 | `lvl2` done, `lvl4` current, `crate` shown, no crate placed | waypoint | desk (lesson wins); at level 1 with `make` current → factory | R11 |
| 27 | scratchpad scenarios that set `state.goal` / call `goals.start()` | run | pass on the new model (`goalsDone` ids) | R10 |
| 28 | window 640x360, GOAL `lvl2` text + LESSON `trick` text | render | both texts, bars and counters fit; contract card still visible below | R5 |
| 29 | gnome delivered into a crate / non-empty crate dumped | machines | `stats.crated` +1 / `stats.crateDumps` +1 (contract kept by physical loads) | R12 |
| 30 | old save `goal = 4` (current `buy`) | boot | `combo5` in `goalsDone` unpaid, GOAL shows `buy`, money unchanged | R6 |
| 31 | any frame | `current2` getter x8 | no `Set` allocation per call (one per constructor) | R15 |
| 32 | `lvl2` done at level 2, lessons `crate`, `dump`, `combo15`, `long`, `air`, `trick` unlocked | first unlocked frame | `goalStart` has a base for every rel lesson among them, read that frame | R2 |

GOAL track (final): `make` $5 factory · `grab` $5 · `feed` $10 hole · `coins` $10 hole · `combo5` "Reach a 5 combo: feed gnomes one after another. Holding one pauses it" abs maxCombo 5 $15 hole · `buy` $20 shop · `lvl2` "Reach hole level 2: every level grows the hole and its multiplier" $30 hole · `lvl4`, `garden`, `lvl6`, `lvl8`, `lvl10`, `lvl12`, `deep` unchanged. Texts for make/grab/feed/coins/buy as in v0 (all ≤ 53 chars).

LESSON track (final order = display order; `from` = hole level; rel base read the frame the lesson unlocks):

| id | from | text (≤ 70 chars) | condition | reward | where |
|---|---|---|---|---|---|
| mushroom | 2 | Eat a MUSHROOM: the hole spits one out now and then. Walk over it | rel mushrooms 1 | $40 | hole |
| greedy | 2 | Feed a GREEDY GNOME (green hat): it steals coins and runs for the fence | abs typesEaten.greedy 1 | $40 | none |
| heavy | 2 | Feed a HEAVY gnome (bigger): worth more, flies shorter | rel heavies 1 | $50 | hole |
| angry | 3 | Feed an ANGRY GNOME (dark red): it charges you and kicks gnomes | abs typesEaten.angry 1 | $60 | none |
| dwarf | 4 | Feed a DWARF GNOME (small, brown hat): fast runner, worth x8 | abs typesEaten.dwarf 1 | $80 | none |
| haul | 4 | HEAVY HAUL: feed a MASSIVE 3 kg gnome, worth x2.3 | abs hauls 1 | $300 | hole |
| boom | 4 | Feed a BOOM GNOME (burning fuse): it blasts gnomes off the rim | abs typesEaten.boom 1 | $60 | none |
| saboteur | 5 | Feed a SABOTEUR (goggles): it breaks your machines. Fuses soak hits | abs typesEaten.saboteur 1 | $100 | none |
| golden | 5 | Feed a GOLDEN GNOME: rare, runs away, worth x100 | abs typesEaten.golden 1 | $300 | none |
| wizard | 7 | Feed a GNOME WIZARD (purple): it hurls gnomes away and teleports | abs typesEaten.wizard 1 | $200 | none |
| fat | 8 | Feed a FAT GNOME: six times the weight, always heavy or massive | abs typesEaten.fat 1 | $200 | none |
| king | 10 | Feed the KING GNOME: a rare event from level 10. 40 kg, use machines | abs typesEaten.king 1 | $2000 | none |
| crate | 2 | Buy a Wooden Crate (Shop → Tools), place it (1), drop 5 gnomes in | rel crated 5 | $40 | crate |
| dump | 2 | Drag the crate into the hole with the magnet (LMB) | rel crateDumps 1 | $60 | crate |
| combo15 | 2 | Reach a 15 combo (Gnomazing!) | abs maxCombo 15 | $80 | hole |
| long | 2 | LONG SHOT x2.5: throw (RMB) into the hole from 8 m or more | rel longShots 1 | $100 | hole |
| air | 2 | AIR x2: 3 throws that fly into the hole without touching grass | rel airShots 3 | $60 | hole |
| trick | 2 | TRICK x3: buy a Trampoline, bounce a thrown gnome off it into the hole | rel trickShots 1 | $100 | trampoline |
| bullseye | 4 | BULLSEYE x5: throw through the golden hoop into the hole | rel bullseyes 1 | $200 | hole |

Crate ($70) and Trampoline ($100) unlock at hole level 1 (`src/data/upgrades.ts:56,59`), so `from` 2 never asks for a tool the shop cannot sell.

### Steps (edit order)
1. `src/core/state.ts` — `stats.heavies: number; stats.trickShots: number` in the interface (`:31-51`), `heavies: 0, trickShots: 0` in `freshState` (`:80-100`). Test: Done when 10, 11.
2. `src/systems/hole.ts` `consume` — inside `if (g.bounced) {` (`:117-121`) add `s.stats.trickShots++;`; after the massive block (`:131-134`) add `if (g.tier.id !== 'normal') s.stats.heavies++;`. Red test: scenario "heavies and trickShots" → counters move only for the right gnomes (Done when 10, 11).
3. `src/systems/buffs.ts:36` — delete `ctx.state.stats.mushrooms++;`; `src/entities/mushrooms.ts` pickup branch (`if (d < 1.6 && ...)`, before `ctx.buffs.apply(m.def.id)`) add `ctx.state.stats.mushrooms++;`. Red test: "BOOZE does not count a mushroom" (Done when 25).
4. `src/systems/goals.ts` — rewrite in place:
   - `type Where = 'factory' | 'hole' | 'shop' | 'crate' | 'trampoline' | null`; `interface Goal { id: string; text; target; value; relative; reward; where; from?: number }`; `rel(id, text, ...)` / `abs(id, text, ...)`.
   - `MILESTONES` (14) and `LESSONS` (19) exactly as the final tables; `OLD_MILESTONES = ['make','grab','feed','coins','buy','lvl2','lvl4','garden','lvl6','lvl8','lvl10','lvl12','deep']`, `OLD_SKILLS = ['crate','dump','combo15','long','air','bullseye','haul']`, `SKILLS_FROM = 6`.
   - `declare module` augmentation: `goalsDone?: string[]; goalStart?: Record<string, number>`.
   - Constructor: `if (s.goalsDone === undefined)`: run the pre-F8 split when `s.goal2 === undefined` (today's lines 64-70), then `goalsDone` = `OLD_MILESTONES.slice(0, s.goal)` mapped onto the new list (every new MILESTONE id before the old current id; `combo5` included when `s.goal >= 4`) plus `s.goal >= SKILLS_FROM ? OLD_SKILLS.slice(0, s.goal2 ?? 0) : []`; `goalStart = {}` with `[oldCurrentMilestoneId]: s.goalBase` and `[oldCurrentSkillId]: s.goalBase2` when defined. Then `this.doneSet = new Set(s.goalsDone)` (R15).
   - `isDone(id)`, `unlocked(g)` = `this.doneSet.has('lvl2') && (g.from ?? 0) <= ctx.state.holeLevel`.
   - `get current` = first MILESTONE not done; `get current2` = first LESSON not done and unlocked, or null; `nextFrom` = lowest `from` among not-done lessons when `lvl2` is done and `current2` is null, else null.
   - `progress2()` = `measure(current2)` or `{ text: \`Next lesson at hole level ${nextFrom}\`, have: holeLevel, need: nextFrom }` when `nextFrom`, else null.
   - `measure(g)` base = `goalStart[g.id] ?? g.value()`.
   - `targetPos()`: `const w = (this.doneSet.has('lvl2') ? this.current2?.where ?? this.current?.where : this.current?.where) ?? null`; `'trampoline'` → `ctx.machines.list.find((m) => m.type === 'trampoline')?.pos ?? ctx.env.deskPos`.
   - `start()` kept: `if (current && goalStart[current.id] === undefined) goalStart[current.id] = current.value()`.
   - `update()`: `start()`; milestone: when satisfied → `done(id, reward)` with today's toast, `start()` for the next. Lessons: for every LESSON not done and unlocked: `if (relative && goalStart[id] === undefined) goalStart[id] = value()`; when satisfied → push to `finished`. Then if `finished.length`: `total` = sum of rewards, mark all done (`goalsDone.push`, `doneSet.add`, `delete goalStart[id]`), `ctx.hole.earn(total)`, one toast: 1 → `Lesson done! +${money(total)}`, more → `${n} lessons done! +${money(total)}`, `ctx.audio.toast()` once.
   - Getters: `firstDone` = `goalsDone.length > 0`; `wantsMushroom` = `!isDone('mushroom') && unlocked(mushroom)`.
   Red test: scenario "tutorial goals" (Done when 1-4, 8, 9, 12-14, 19, 22-24, 30-32).
5. `src/systems/contracts.ts:148` — `if (!ctx.goals.firstDone && ctx.time < FIRST_AFTER) return;`. Test: Done when 16.
6. `src/entities/mushrooms.ts:41` — `const chance = ctx.goals.wantsMushroom && this.list.length === 0 ? 1 : 0.025 * (1 + lvl('mushChance') * 0.3) * bonus;`. Test: Done when 5, 6.
7. `src/systems/hole.ts:514-515` — `next.goalsDone = old.goalsDone; next.goalStart = old.goalStart;` (replaces the `goal2`/`goalBase2` copy). Test: Done when 14.
8. `src/ui/hud.ts:486` — `'SKILL'` → `'LESSON'`. Test: Done when 17, 28.
9. `docs/SPEC.md:194` — "Cele (panel GOAL): dwa tory: kamienie milowe (samouczek z combo 5, poziomy, Garden, The Deep) i lekcje (grzybek, typy gnomów, wagi, tricki, skrzynia; każda odblokowana lekcja liczy się równolegle, panel pokazuje pierwszą niezrobioną), strzałka do celu na krawędzi ekranu."; `CHANGELOG.md` entry; ai-work note `docs/ai-work/2026-10-20-tutorial-goals.md` with the R12 counter contract and the R6 note.
10. Scratchpad scenarios (session scratchpad `smoke/`): replace `g.state.goal = N; g.goals.start()` with `g.state.goalsDone = [...first N ids of OLD_MILESTONES mapped to new ids]` in `scenario-contracts.js:39,53,59`, `scenario-contracts-shot.js:8`, `scenario-bottom-row.js:18`, `scenario-left-stack.js:26`, `scenario-polish-c.js:29`, `tmp-left-measure.js:15`; `scenario6.js:40,114-115` read `goalsDone.length` instead of `state.goal`; `alias/tmp-i-scenario-land-balance.js:272-279` adds `delete s.goalsDone` before each `new G()` and asserts on `goalsDone` instead of `goal`/`goal2`; `SKILL` head checks → `LESSON`. New `scenario-tutorial-goals.js` for Done when 1-32 (frame waits, `window.gnome`).

### Review focus
1. A player who never throws by hand (plow + crate only) from a fresh save to level 12: GOAL never shows a throw text and the LESSON line never shows a throw text while a type lesson is pending → pinned by step 4's test "non-thrower run" (Done when 2, 22).
2. Old save at level 8 with every type already fed: one toast, one payment, no frame where a lesson text flashes → step 4's test "cascade one toast" (Done when 24).
3. BOOZE typed while the mushroom lesson is active → step 3's test "BOOZE does not count" (Done when 25).
4. Waypoint after `lvl2`: `crate` shown, `lvl4` current → desk, not hole → step 4's test "lesson waypoint wins" (Done when 26).
5. 640x360 with the two longest texts (`lvl2` 65 chars, `trick` 70 chars) and a contract card → step 8's screenshot (Done when 28).

### Done when
1. fresh boot → `.hud-goal` text contains `GOAL` and `Make gnomes`, not `LESSON`.
2. set produced/grabbed/eaten/lifetimeEarned past targets frame by frame → `goalsDone` = `[make,grab,feed,coins]`, then text `Reach a 5 combo`, then `Buy an upgrade`, then `Reach hole level 2`; money delta = 5+5+10+10+15+20; `rg -n "longShots|airShots|bullseyes|trickShots" src/systems/goals.ts` → only inside `LESSONS` (changed by R1).
3. `stats.maxCombo = 9` before `combo5` shows → next frame `goalsDone` includes `combo5`, money +15 exactly once over 3 frames.
4. `holeLevel = 2`, `lvl2` done → text contains `LESSON` and `Eat a MUSHROOM`.
5. mushroom lesson unlocked and not done, `mushrooms.list.length === 0`, `hole.consume(g)` → `mushrooms.list.length === 1`; consume 20 more with one lying → length stays ≤ 2 (no forced second).
6. `goalsDone` includes `mushroom`, 200 consumes with `Math.random` stubbed to 0.5 → `mushrooms.list.length === 0`.
7. mushroom lesson active, place a mushroom under the player (`gnome.mushrooms.spawn(...)` at the player's position) and wait one frame → money +40, text contains `GREEDY GNOME`.
8. `stats.typesEaten.greedy = 1` before `greedy` unlocks → done the frame it unlocks, money +40 once.
9. `holeLevel = 2`, every `from 2` lesson done → text `Next lesson at hole level 3`, `g-num` `2 / 3`, `targetPos()` equals the milestone's target (hole); set `holeLevel = 4` and `stats.bullseyes = 7` the same frame → `goalStart.bullseye === 7`.
10. consume a `heavy` tier gnome → `stats.heavies` 0→1; consume a `normal` → stays 1.
11. consume a gnome with `thrownBy='player'`, `bounced=true`, `throwPos` set → `stats.trickShots` 0→1; same with `thrownBy='machine'` → stays 1.
12. save `{goal:8, goal2:3, goalBase2:4, stats:{longShots:4}}` + reload → `goalsDone` = `[make,grab,feed,coins,combo5,buy,lvl2,lvl4,garden,crate,dump,combo15]`, GOAL text `Reach hole level 6`, LESSON text `Eat a MUSHROOM`, `goalStart.long === undefined`, money unchanged (changed by R1: `long` is not in the list, it was old skill index 3 and `goal2` is 3).
13. save `{goal:9}` without `goal2` + reload → `goalsDone` = milestones before `lvl6` (with `combo5`) + `[crate,dump,combo15]`, GOAL `Reach hole level 6`.
14. `goalsDone` = all milestones, `hole.rebirth()` (stub `location.reload`) → saved JSON has the same `goalsDone` and `goalStart`, after reload `.hud-goal` has no `GOAL` head and LESSON reads `Next lesson at hole level 2` or is empty when every lesson is done.
15. open `?daily` → `.hud-goal` text `Make gnomes`, localStorage save key unchanged after 15 s.
16. fresh boot, `time = 5` → `contracts.current === null`; finish `make` → next frame `contracts.current !== null`.
17. `holeLevel = 2`, `lvl2` done → `.g-head` texts `['GOAL','LESSON']`.
18. `lvl2` done, `trick` the first not-done unlocked lesson, no trampoline → `targetPos()` equals `env.deskPos`; place a trampoline → equals its `pos`.
19. `holeLevel = 10`, lessons done through `fat`, `stats.typesEaten.king = 1` → done, money +2000; `rg -n "king" src/systems/goals.ts` → text contains `rare event`, no reference to a timer.
20. `rg -n "sniper|strike|volley|parade|mood" src/systems/goals.ts` → no lesson id.
21. `rg -n "'angry'|'dwarf'|'wizard'|'fat'" src/systems/goals.ts` → 4 lesson ids; `rg -n "shadow" src/systems/goals.ts` → nothing.
22. `holeLevel = 3`, lessons done through `heavy`, `crate`, `dump`, `combo15`, `long` not done, `air` not done → LESSON text contains `ANGRY GNOME`, not `AIR`.
23. same state, three consumes with `thrownBy='player'`, `touchedGround=false`, `throwPos` set → `goalsDone` includes `air`, money +60, LESSON text still `ANGRY GNOME`, exactly one toast containing `Lesson done! +$60`.
24. save `{goalsDone: milestones through lvl8, holeLevel: 8, typesEaten: {angry:1,dwarf:1,boom:1,saboteur:1,wizard:1,fat:1}}` + reload, one frame → six ids added to `goalsDone`, money +700 once, `.toast` count 1 with text `6 lessons done! +$700`.
25. mushroom lesson active, `gnome.input` typed `BOOZE` (or `gnome.buffs.apply('booze')`) → `stats.mushrooms` unchanged, `goalsDone` without `mushroom`.
26. `lvl2` done, `lvl4` current, `crate` first not-done unlocked, no crate placed → `targetPos()` equals `env.deskPos`; fresh save with `make` current → equals `factory.pos`.
27. `node smoke.mjs <outDir> scenario-contracts.js`, `scenario-contracts-shot.js`, `scenario-bottom-row.js`, `scenario-left-stack.js`, `scenario-polish-c.js`, `tmp-left-measure.js`, `scenario6.js`, `alias/tmp-i-scenario-land-balance.js` → all pass; `rg -n "state\.goal\b|goal2" <scratchpad>/smoke <scratchpad>/alias` → only inside crafted legacy saves for Done when 12-13.
28. screenshot at 640x360 with GOAL `Reach hole level 2: ...` and LESSON `TRICK x3: ...` and a running contract → both texts fully visible, no overlap with the contract card (checked by eye, file in the scratchpad).
29. crate path: one gnome thrown into a placed crate → `stats.crated` +1; dump with 1 gnome → `stats.crateDumps` +1; dump an empty crate → unchanged.
30. save `{goal:4}` + reload → `goalsDone` = `[make,grab,feed,coins,combo5]`, GOAL text `Buy an upgrade`, money unchanged.
31. `rg -n "new Set" src/systems/goals.ts` → exactly one hit, in the constructor.
32. `holeLevel = 2`, `lvl2` done the same frame, `stats.crated = 3`, `stats.longShots = 2` → next frame `goalStart.crate === 3`, `goalStart.long === 2`, `goalStart.combo15 === undefined` (abs).
33. `npx tsc --noEmit` → clean.

### Decisions for PP
PP (2026-10-20 23:00, Slack via hub, verbatim): "9. Od pierwszej minuty, grzybek pewny." → lessons start from the first minute (option b, not from hole level 2), and the lesson mushroom is guaranteed (option a). Remaining items in this block: take the recommendation.
1. Lekcje (grzybek, typy gnomów, tricki) zaczynają się dopiero po celu „Reach hole level 2". a) tak, wtedy na poziomie 1 gracz widzi jedną linię celu: zrób, złap, nakarm, monety, combo 5, sklep, poziom 2; b) lekcje od razu po „Collect coins", wtedy od pierwszej minuty są dwie linie celów naraz, a grzybki i chciwe gnomy i tak zaczynają się na poziomie 2. (rekomendacja: a)
2. Gdy lekcja o grzybkach jest aktywna, a na trawie nie leży żaden grzybek, następny zjedzony gnom na pewno wypluwa grzybka. a) tak, wtedy lekcja trwa kilka sekund i gracz od razu widzi, co robi grzybek; b) nie, losowo jak dziś, wtedy gracz czeka średnio 40 gnomów, czyli cały poziom 2. (rekomendacja: a)
3. [spec silent] Zakładam: SNIPER, STRIKE, salwa (VOLLEY), nastroje dziury, parada i OVERTIME nie dostają lekcji | Dowód: `hole.ts:99-104` SNIPER liczy się w `longShots`, STRIKE i salwa nie mają licznika w `state.ts:31-51`, salwa wymaga Magnet Gun | Jeśli źle: gracz pozna te mnożniki tylko z napisów w grze i legendy | rekomendacja: a) bez lekcji (odpowiedź tylko, gdy PP chce inaczej)
4. [spec silent] Zakładam: wściekły, krasnal, czarodziej i gruby gnom dostają lekcje, Shadow Gnome nie (tajne osiągnięcie) | Dowód: `gnomeTypes.ts:29-91` 12 typów, `achievements.ts:34` `secret: true` | Jeśli źle: cztery lekcje za dużo albo brak lekcji o cieniu | rekomendacja: a) jak w tabeli (odpowiedź tylko, gdy PP chce inaczej)

### v0 → final
- added: parallel lessons with type-first display and one summary toast (R2, R3); `long` back to a $100 lesson (R1); `stats.mushrooms` counted at pickup (R13); lesson waypoint wins after `lvl2` (R11); `start()` kept and scratchpad scenarios rewritten (R10); crate counter contract for the physical-loads plan (R12); 70-char text cap and a 640x360 screenshot (R5); `Set` built once (R15); 12 new matrix rows, Done when 21 → 33 lines.
- dropped: `long` from the GOAL track; v0 alternative (c) rejection; the "Next lesson" text when any unlocked lesson is still open.
- moved to PP: the two v0 questions (lessons from level 2; forced mushroom drop) stay, rewritten; [spec silent] 3 and 4 stay as assumptions that need no answer unless PP wants otherwise.
