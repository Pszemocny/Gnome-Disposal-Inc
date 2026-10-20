# Night plan: can the game be finished in several ways, and what to build to surprise PP (2026-10-20)

PP (verbatim, before sleep): "pomyśl, co można jeszcze zrobić, sprawdź wszystkie ścieżki, czy można przejść grę na kilka sposobów. Może jakieś wymyślisz, ponieś wodze fantazji, poszukaj w sieci i dodaj dodatkowe featury, aby mnie zaskoczyć rano".

## Problem

PP wants to know whether the game can be finished in several ways, where the economy breaks, and what new features would surprise him in the morning.

## Summary

- Five real ways to level 12 exist (hands, crate, Magnet Gun, automation, plow) plus an accidental sixth (Steel Toes kick). Four of them finish in 22-28 minutes against a 2-3 hour target; the Magnet Gun earns 25-45x more than the rest because every gnome of a volley scores the full trick (F1, F2).
- Three money leaks: greedy loot x1.5 compounds without a cap (F6), the armchair and flamingos out-earn the crate loop 8x at level 1 (F4), jumping into the hole is a repeatable fountain (F5). The far-side machines get ejected at every level-up (F7) and the goal chain strands non-throwing players (F8).
- Six surprise packages for tonight, each in its own new file: Hole Moods, STRIKE, While you slept, Blueprints, Slow-mo moments, Rain.

Analysis and design only. No file under `src/` was edited by this task. Everything below is an estimate from the code of 2026-10-20 evening (`src/data/*.ts`, `src/systems/hole.ts`, `goals.ts`, `events.ts`, `src/entities/*.ts`, `src/player/*.ts`), checked with a small simulator, not with a human play session.

Simulator: `/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-boozed/844ac005-e3c6-4341-b0ea-34b547159d26/scratchpad/design/econ.mjs` (`node econ.mjs`, flags `--noBonus`, `--bonusPerThrow`, `--nerfTramp`, `--xpFeed`, `--xpFix`). Copy it into `tools/` if PP wants to keep it.

## Part 1: economy model and the six ways through the game

### 1.1 The model (numbers from the code)

Money for one eaten gnome (`hole.ts` `consume`):

`type value x weight tier x trick x OVERTIME(1.5) x valueScale x combo x mushrooms x parade(3) + stolen loot x 1.5 + flat trick bonus x valueScale`

- `valueScale = hole multiplier (x1..x10) x (1 + 0.1 x Premium Gnomes) x (1 + 0.2 x Deep Value) x shovel 1.1`
- combo `min(1 + 0.05 x combo, cap)`, cap `2 + 0.5 x Combo Cap + 0.5 x Deep Combo`; the combo timer does not run while a gnome is in the hand or on the Magnet Gun
- tricks (player throws only): LONG SHOT x2.5 (8 m) or SNIPER x4 (14 m), AIR x2, TRICK x3 (trampoline), BULLSEYE x5, product capped at x20; flat bonus per gnome: long 20, air 10, trick 25, sniper 40, bullseye 60, each x valueScale
- XP: `type xp x tier x (1 + 0.1 x Hole Hunger) x (1 + 0.25 x Deep Hunger)`; needed per level 25, 60, 120, 220, 380, 600, 900, 1300, 1800, 2500, 3400 = **11 305 gnome-XP to level 12**
- weight tiers by hole level L: heavy (2 kg, x1.6) `min(30%, 5% + 2.5% x (L-1))`, massive (3 kg, x2.3) `min(25%, 3% x (L-3))`
- factory: hold E = 0.91 gnomes/s x (1 + 0.15 x Gears) x (1 + Batches); Auto Crank 0.08/s per level, no E needed; yard cap 120 + 40 x Permit (max 320)
- distances (hole moves 1.2 m per level away from the factory): factory landing circle to hole centre `8.5 + 1.2 x (L-1)` m (8.5 at L1, 21.7 at L12); the spot where E still works (4.4 m from the factory) to the hole `10.6 + 1.2 x (L-1)` m, so a throw from the crank spot is a LONG SHOT from level 1 and a SNIPER from level 4
- throw: impulse 15 x (1 + 0.15 x Strong Arm), speed = impulse / mass: 1.2 kg flies about 8 m at Strong Arm 0, 2 kg about 3 m, 3 kg about 1.5 m

Prices (sum of all levels): Auto Crank 12 = $2 949 758, Premium 20 = $332 435, Combo Cap 12 = $124 637, Gears 16 = $80 658, all land $49 500. **Everything useful in the shop = about $3.8M.**

### 1.2 Six strategies, fresh save to level 12 (simulated, today's code)

Assumptions: the player always holds E while disposing (cranking and throwing happen at the same spot), events add +15% income from level 2, goals pay their rewards, no mushrooms. Throughput numbers are the model's, not measured in the game; the Magnet Gun lines are the least certain (cluster hit rate 25% at L1 rising to 80%).

| Strategy | L4 | L8 | L12 | $ earned to L12 | $/s at L12 | shards at first rebirth |
|---|---|---|---|---|---|---|
| 1 Hands only (throw from the crank spot) | 7 min | 50 min | **167 min** | $20.0M | $2 900 | 31 |
| 2 Crate loop | 4 min | 14 min | **24 min** | $0.41M | $2 300 | 4 |
| 3 Magnet Gun + tricks | 3 min | 17 min | **22 min** | $18.6M | $58 000 | 30 |
| 4 Automation (trampoline, fans, belts, L-magnet, cannon, vacuum) | 3 min | 18 min | **27 min** | $1.3M | $3 600 | 8 |
| 5 Broom / plow tractor | 3 min | 18 min | **28 min** | $0.35M | $2 200 | 4 |
| 6 Steel Toes kick (bonus path, $104) | 3 min | 22 min | 251 min | $2.3M | $330 | 10 |

Reading: **yes, the game can be finished in at least five ways**, but four of them finish in 22-28 minutes (target in `docs/PLAN.md`: 2-3 hours) and one strategy earns 25-45x more than the others.

### 1.3 Findings (problem, effect, cause) and fixes with numbers

**F1. The run is too short for every path except hands.** When the player automates, dumps crates or drives the plow, the hole reaches level 12 in 22-28 minutes, because the XP table is 11 305 gnomes and those paths eat 6-7 gnomes/s (Gears 16 + Batches 6 = 21 gnomes/s out of the factory). Hands alone takes 167 min because a throw cycle is about 2.2 s.
Fix (proposal B, simulated with `--xpFeed`): XP depends on how the gnome was fed. Thrown or carried by hand x1; a volley of n gnomes from the Magnet Gun x1/sqrt(n); machine-fed, crate dump, broom/plow push and kick x0.25. Money unchanged (PP 2026-10-19: machines pay full value). Result: gun 33 min, crate 59, automation 65, tractor 69, hands 167. Code: `hole.consume` xp line reads a new `g.fedBy` ('hand' | 'volley' | 'machine') + `g.volley` (set in `player.throwHeld`, `machines.ts` crate dump / cannon / vacuum / black hole, `sweeper.push`, `player.kickHit`). Needs PP's yes: it touches the 2026-10-19 decision "heavy = more money AND XP" only by adding a feeding factor.

**F2. The Magnet Gun ball turns trick shots into a money printer.** When a Coil 5 ball (71 gnomes) is thrown from the crank spot at level 6+, every gnome that lands gets SNIPER x4 and AIR x2 plus the $50 x valueScale flat bonus, because `consume` scores each gnome separately. At level 12 the gun earns about $58 000/s, automation $3 600/s, the crate $2 300/s.
Fix: VOLLEY rule in `consume`: for a throw of n > 1 gnomes the trick product is capped at x4 (single throws keep x20) and the flat bonus is paid once per throw (first gnome of the volley). Label "VOLLEY x4 (18 gnomes)". Simulated `--bonusPerThrow` alone: gun $15.3M instead of $18.6M; with the x4 cap the gun lands near $15-20k/s at level 12 (still the best, which fits "arcade skill game").

**F3. The crate loop PP asked for loses to any single throw by 25x at level 1-3.** When a player fills a 12-crate and dumps it, the hole pays about $16 (12 x $1 x combo), while one gnome thrown from the crank spot pays $35 ($1 x 2.5 x 2 + $30 flat), because the flat bonus is 30x an ordinary gnome at level 1. PP's rule "crate upgrade = what 12 gnomes earn = $70" only holds from level 4-5.
Fix: CRATE DUMP pays a flat bonus too: `+2 x n x valueScale` on every dump (12 gnomes: +$24 at L1, 60 gnomes: +$120), shown in the existing `CRATE DUMP x12!` text. Code: `machines.ts` `updateCrate` dump branch → `ctx.hole.earn` + `coins.burst`.

**F4. Garden props are the best early income and need no skill.** When the player carries the armchair in every 45 s (respawn timer) and the three flamingos, the hole pays $250 + 3 x $80 = $490 x valueScale per minute, because `consumeProp` pays every time. At level 1 that is $8/s; the crate loop makes $1.3/s and hands $5-10/s.
Fix: full pay the first time (achievement), then 10% ($25 chair, $8 flamingo), or respawn after 5 min instead of 45 s. Code: `hole.consumeProp`, `props.ts` respawn 45 → 300.

**F5. Jumping into the hole is a repeatable coin fountain.** When the player walks into the hole below level 12, `fellIn` pays 15 x valueScale coins and spits the player out; repeatable every 3 s. At level 1 that is $5/s (4x the crate loop), at level 12 $150/s (harmless).
Fix: pay only once per hole level (`state.secrets` flag `fall<level>`), the achievement stays.

**F6. Greedy loot x1.5 is a compounding money loop.** When coins lie on the grass (they auto-collect only after 40 s), a greedy gnome takes one coin (a burst has at most 6 coins), and eating it pays the loot x1.5 as a NEW coin burst, which other greedy gnomes can take again. With 6+ greedy gnomes (10% of spawns; about 30 in a full yard) and the Magnet Gun to catch the runners, every burst can be recycled for x1.5 per ~20 s: unbounded growth, no cap anywhere.
Fix: return the loot x1.0 (or +$10 x valueScale flat) and pay it through `hole.earn` directly, not as coins. Code: `consume` line `+ g.loot * 1.5` → `earn(g.loot)`; the "recovered x1.5" toast changes to "recovered".

**F7. Every level-up ejects the machines on the far side of the hole.** When the hole levels up it grows 0.4 m and moves 1.2 m away from the factory; `levelUp` returns to the inventory any machine within radius + 0.6 m of the NEW centre. An L-magnet, vacuum or black hole placed at the rim on the far side ends up 0.6 m inside the new rim and is ejected at every level-up; the near side is safe. Players will re-place the magnet 11 times.
Fix: in `levelUp`, machines that stood within 1.5 m of the OLD rim move by the hole's delta (keep the relative spot), only truly swallowed ones go back. Code: `hole.ts` levelUp loop + `machines.ts` needs a `move(m, pos)` (set body translation + root position).

**F8. The goal chain blocks non-throwing players and hides The Deep.** Goals are one linear list (`goals.ts`): goals 7-8 need a crate, goals 10-13 need LONG SHOT, 5 AIR shots, BULLSEYE and HEAVY HAUL. When a player automates, sweeps or kicks, the chain stops at BULLSEYE forever: no "Reach hole level 4/6/8/10/12" goals ($18 250 of rewards) and no "Jump into the hole" goal, only the one level-12 toast.
Fix: two tracks shown together in the HUD: Milestones (levels, Garden, The Deep) and Skills (crate, tricks). Code: `goals.ts` two arrays + `state.goal2`, `hud.ts` second line. Cost S.

**F9. Tools unlock at prices the non-trick paths cannot pay (walls).** Crate path at the unlock levels: $380 at L4 vs Kicking Wheel $900 / Auto Crank $1200; $780 at L5 vs Gnome Magnet $3000; $1 400 at L6 vs Cannon $6000; $8 600 at L8 vs Vacuum $15 000. Automation path: $1 500 at L6 vs Cannon $6000, $8 400 at L8 vs Vacuum $15 000. Auto Crank's 12 levels cost $2.95M; the crate path earns $0.41M in the whole run, automation $1.3M. Only trick income (F2) pays for the top of the shop.
Fix: Auto Crank growth 1.9 → 1.5 (12 levels = $155k), Vacuum $15 000 → $8 000, Cannon $6 000 → $4 000, Gnome Magnet $3 000 → $2 000. With F2 and F3 applied the gap between paths shrinks to about 5x and these prices fit.

**F10. Shards reward money, so the automation and crate players get 4-8 shards.** `shardsForRebirth = sqrt(totalEarned / 20000)`. Keep Tools costs 8 shards, the whole Deep tab about 250. A crate player needs 2 runs for Keep Tools and 60 runs for everything.
Fix: `shards = 5 + floor(sqrt(totalEarned / 20000)) + floor(gnomesEaten / 2000)`: first run 15 / 16 / 22 / 40 shards (crate / automation / tractor / gun). Also Keep Tools does not keep Bigger Crate (`crateSize` is not in `TOOL_IDS`): keep it too.

**F11. Dead, useless or prerequisite-less upgrades.**
- Gnome Glue (8 levels, $24 500): awake gnomes only matter on foot and every machine ragdolls them anyway; nobody needs it. Fix: cut to 3 levels or make it "awake gnomes walk 20% slower" too.
- Spring Socks ($30 x3) and Gnome Boots ($600): jumping has no use (the shovel lies on the ground). Fix: feature H below (ground pound) gives the boots a job.
- Kicking Wheel ($900 + $2 250, L4): 13 m/s kick, about 10 m, the same as a $100 trampoline (8.5 m). Fix: 20 m/s (about 18 m) so it is the long-range tool before the cannon.
- Missing prerequisites: Magnet Coil and Magnet Dish buy without the Magnet Gun, Wider Plow without the Plow Tractor ($700 wasted), Bigger Crate without a crate. Fix: `requires?: string` on `Upgrade`, the row shows "needs X" and the buy button is disabled. Cost S (`upgrades.ts`, `shop.ts`).
- "Golden gnomes appear more often" at L9 is 0.4% x 3 = 1.2%: one in 83, nobody will notice. Fix: 3%.
- Hole Hunger: 5 levels for $2 800 = +50% XP, the best deal in the shop by far; every path buys it first. Fine, but the whisper of level 9 would be a better place for a visible change.

**F12. Steel Toes is accidental automation for $104.** When a pile of gnomes lies at the landing circle, one kick (radius 1.5 x k, cooldown 0.45 s) lobs every gnome in reach at 11 x k m/s on a fixed 26° arc, about 8-11 m at Steel Toes 1-2, which is exactly the landing-to-hole distance at levels 1-3. Eight gnomes per kick, no aim needed, no tricks. Not broken (level 8 at 21 min, then the hole is out of reach), but worth knowing when PP says "level 3 was too easy". No fix needed.

**F13. Achievement "Gnome Baron $1b" is out of reach.** At the best income ($58k/s) it is 4.8 h of level-12 farming, at automation income 80 h. Fix: $100m.

**F14. Land does nothing but the achievement.** $49 500 buys a bigger fence; the yard cap (320) and income do not change. The board already plans "hole moves with each Land" (another agent). Add on top: each Land tier +0.5 combo cap (one line in `hole.comboCap`), so land is a money upgrade too.

**Checked and fine:** combo cap x8 at level 12; Golden Hour as a 50x spike every ~15 min (intended); Jackpot x10 every 25 combo (+40% average); UFO 150 x valueScale; shadow gnome 5% theft; parade x3; Permit 5 = 320 (performance limit); save migration for removed Wind-up; rebirth keeps placed machines only with Keep Tools; `g10000` unlocks right around level 12 (11 305 gnomes).

### 1.4 Suggested order of balance fixes (all small, `src/data` and `hole.ts`)

1. F6 greedy loop (one line, exploit) and F5 fall-in once per level.
2. F2 VOLLEY cap + bonus once per throw; F3 crate dump bonus.
3. F1 XP by feeding style (needs PP's yes).
4. F7 machines follow the hole; F8 two goal tracks.
5. F9 prices, F10 shards, F11 prerequisites, F13, F14.

## Part 2: features to surprise PP in the morning

### 2.1 What the web says (2026-10-20)

- Original GnomeBoozled (PyroPhysics, Steam demo 21 Sep 2026, update 30 Sep): "absurd traps, conveyor systems and bizarre contraptions", a "living backyard and whole surrounding neighbourhood to explore and automate", secret events when you pick certain items up (two more added in the update), a piggy bank that drops from a "tube", magnet drops "worth $6.5 million", a reworked panel-building system, dwarf gnome, players report gnomes throwing other gnomes into the hole. Nothing public about hole levels, prices or the ending. Sources: [Steam page](https://store.steampowered.com/app/4794780/GnomeBoozled/), [Steam community](https://steamcommunity.com/app/4794780), [itch.io](https://pyro-physics.itch.io/gnomeboozled), [incrementaldb](https://www.incrementaldb.com/game/gnomeboozled).
- Donut County: the fun comes from objects with cause and effect (water fills the hole, a kiln makes it spit fire), a catapult that throws things back out, and the decisions of position and timing; the designer says a plain hole "was pretty boring" until things reacted to it. Sources: [Vice](https://www.vice.com/en/article/donut-county-review-impressions), [indiegamesplus interview](https://indiegamesplus.com/donut-county-developer-talks-about-the-nunances-of-hole-based-play/), [Pocket Gamer](https://www.pocketgamer.com/articles/078486/donut-county-review/).
- Contraption sandboxes (TraptionLab, Principia, Melon Playground): joints, motors, ropes, bumpers, and a challenge/sharing loop (a build area plus a target). Sources: [TraptionLab devlog](https://mrprodoja.itch.io/traptionlab/devlog/1540507/traptionlab-launch), [Principia](https://f-droid.org/packages/com.bithack.principia/).
- Idle genre staples not yet in the game: offline progress ("while you were away"), layouts you can save, a mood/craving system that changes what is worth most right now.

Excluded tonight (already built or planned elsewhere, per the orchestrator): fleeing gnomes, Boom Gnome, bigger eat bursts at high combo, round contracts, coins flying to the counter, tool hints and wheel selection, mute and plow sound, graphics setting, upgrade tree, hole moving with Land / trampoline per Land / gun reach per Coil, Trick Scope and stacking, textures, smoother graphics.

### 2.2 Feature cards

Rules respected: no gnome under 1 kg, no unmovable obstacles, everything that appears can be thrown into the hole, no runtime lights (sprites only), at most 450k triangles, 60 fps cap, never change a Rapier body inside a query callback, never touch a removed gnome's body.

| # | Feature | What the player sees | Why fun | Cost | Files | Perf risk |
|---|---|---|---|---|---|---|
| A | **Hole Moods** (cravings + taunts) | Every 2-3 min the hole whispers a craving: "I want ANGRY ones" / "FAT ones" / "something GOLD"; that type pays x3 for 45 s, the HUD shows a small craving line with a timer; the hole also comments on play ("Five misses. Pathetic.", "Ooh, a SNIPER.") | changes the target every few minutes, gives the hole a personality (PP's cryptic whispers idea), rewards reading the yard | S | new `src/systems/moods.ts` (writes `g.valueMult`, which `consume` already multiplies; uses `hud.banner`, `hud.toast`, `audio.whisper`) | none |
| B | **STRIKE** (bowling chain) | A thrown gnome that knocks 2+ other gnomes into the hole within 2 s shows "STRIKE x3 +$", a bowling pin-crash sound, gold sparks; 5+ = "TURKEY" | the yard pile at the rim becomes a bowling lane; skill shot nobody expects; players of the original report "gnomes throwing gnomes" | S/M | new `src/systems/strike.ts` (marks gnomes hit by fast player-thrown gnomes with a WeakMap, pays via `hole.earn`, `hud.bigText`, `audio.fanfare`) | O(thrown x nearby) per frame, a handful |
| C | **While you slept** (offline progress) | On load after ≥ 2 min away with Auto Crank and a feeding machine placed: a card "Your machines ate 1 234 gnomes while you slept: +$5 678", coin sound | idle staple; PP literally wakes up to it tomorrow | S | new `src/systems/offline.ts` (own localStorage key `gnome-boozed-seen`, reads `state.upgrades`, `state.placed`; pays through `hole.earn`; DOM card) | none |
| D | **Blueprints** (save/load contraptions) | K opens 3 slots: Save / Load / Clear; layouts are stored RELATIVE TO THE HOLE, so after a level-up (hole moved 1.2 m) or a Land change one Load rebuilds the whole contraption around the new hole; Z undoes the last placement | the hole moves every level and (soon) with every Land; rebuilding 15 tools by hand is the chore PP will hit first | S | new `src/ui/blueprints.ts` (uses `machines.serialize/restore/place/remove`, `env.hole`, own localStorage key) | none |
| E | **Pinball Bumpers** + tool registry | New tool: a mushroom bumper; a gnome that hits it gets a *ding*, a flash, +1 "PIN" and x1.2 per bump (max x3) when it finally lands in the hole; chains of bumpers = pinball table | contraptions get a sound and a score; the registry lets future tools live in their own files | M | new `src/entities/tools/registry.ts`, `bumper.ts`; 4 default-branch hooks in `machines.ts` + 1 row in `upgrades.ts` | +1 static body per bumper; the bump test uses `forEachNear` (2 m) |
| F | **Slow-mo moments** | 0.6 s at quarter speed with a low "whoomp" when a BULLSEYE lands, when the combo crosses 60 / 100, when the King falls; an 80 ms freeze on the hit | the celebration PP asked for, felt instead of read | S | new `src/systems/slowmo.ts`; one `dt *= ctx.slowmo.scale` line in `main.ts` (orchestrator) | none |
| G | **Rain** (weather) | From level 3, every 4-7 min 45 s of rain: streaks, darker sky tint, "RAIN: everything slides" banner; grass friction 0.7 → 0.1, gnomes slide 3x further, pushes and kicks go wild, coins skid | cause-and-effect weather (Donut County lesson), changes every tool's feel for a minute | S | new `src/systems/weather.ts` (sets friction on GROUND and GNOME colliders via `physics.forEachCollider`, restores after; `fx.wind` for streaks; `hud.banner`) | friction loop over ~330 colliders once per second |
| H | **Ground pound** (gives Gnome Boots a job) | Jump + Ctrl: slam; gnomes within 4 m pop up and get pushed toward the hole; dust ring, shake | makes the $600 boots worth it; crowd control without a tool | S/M | new `src/player/pound.ts` (reads `player.position`, input; applies impulses after `forEachNear`) | none |
| I | **Warp pipes** | Two green pipes; a gnome entering one shoots out of the other, with a *bloop* | lets a contraption skip the distance the hole runs away by | M | needs E's registry; new `tools/pipe.ts` | none |
| J | **Catapult** (manual volley tool) | Drop up to 20 gnomes in the bucket, E fires them in an arc you aimed with R/T; "CATAPULT x2" on the ones that land | the player's own cannon, skill-based | M | needs E's registry; new `tools/catapult.ts` | none |
| K | **CRATE SHOT** | A full crate thrown into the hole from ≥ 8 m: "CRATE SHOT x2" on every gnome inside | fixes F3 and makes the crate a trick object | S | `machines.ts` crate branch (shared tonight) | none |
| L | **Double hoop** from level 8 | Two hoops; through both = "DOUBLE BULLSEYE x10" | late-game skill target | S | `hole.ts` ring code (shared tonight) | none |
| M | **Gnomenado** event | A tornado walks across the yard for 20 s, lifts gnomes and drops them near the hole; thrown gnomes caught by it get AIR | chaos event with a visible shape (sprites) | S | `events.ts` (shared tonight) | impulse loop over gnomes within 6 m |
| N | **Tithe** (feed the hole money) | Coins dropped into the hole are not refunded but become XP: $10 x hole multiplier = 1 XP; the whisper "money... tastes of paper" | a money sink and a way for rich players to push levels; needs F1 first or it trivialises XP | S | `coins.ts` refund branch | none |

Ranking = surprise (1-5) x fit (1-5) / cost (S 1, M 2, L 3): C 20, A 20, F 16, D 15, B 13, G 12, E 10, H 9, M 9, N 9, I 8, J 6, K 8, L 8.

### 2.3 Top 6 to build tonight, in parallel, no shared files

Shared-file rule: each package owns ONLY its new files. No package edits `main.ts`, `context.ts`, `state.ts`, `machines.ts`, `player.ts`, `hole.ts`, `events.ts`, `hud.ts`. Each system is a class with `update(dt)` (and `boot()` where needed); the orchestrator adds the six `ctx.<name> = new ...` / `ctx.<name>.update(dt)` lines to `main.ts` and the six fields to `context.ts` after all packages return (ten minutes, no conflicts). Until then a package tests its system by importing it in the headless scenario (`const { Moods } = await import('/src/systems/moods.ts'); const m = new Moods(); ` and driving `m.update(dt)` from the scenario's frame loop). Dev server 5199, scenarios in the session scratchpad `smoke/`, separate `CDP_PORT` per package (9351-9356), never 5300.

**P1 Hole Moods** (A). Owns `src/systems/moods.ts`. Every 150-200 s (from hole level 2) pick a craving among the unlocked types with weight > 0 (never classic/blue/king): set `g.valueMult = 3` on every gnome of that type each frame (and back to 1 for the others), banner "THE HOLE CRAVES: ANGRY GNOMES (45 s)", HUD line through `hud.toast` at start and a `hud.banner` at the end; taunts: compare `stats.thrown` and `stats.gnomesEaten` deltas every 10 s; 5 throws without a gnome eaten → "Five misses. Pathetic." (`hud.toast(..., 'secret')`, `audio.whisper`); a SNIPER (`stats.longShots` delta) → "Ooh." Only one taunt per 20 s.
Gotowe, gdy: `moods.start('angry')` then an angry gnome spawned over the hole pays 3x what it paid before (money delta ratio 2.9-3.1); a classic eaten during the craving pays x1; after 45 s the angry gnome pays x1 again; 5 throws that miss → a `.toast.secret` element containing "Pathetic"; no exceptions.

**P2 STRIKE** (B). Owns `src/systems/strike.ts`. Each frame for every gnome with `thrownBy === 'player'`, `state === 'ragdoll'`, speed > 6 m/s: `forEachNear` 1.6 m, mark the others (`WeakMap<Gnome, { t, by }>`) that are not themselves thrown; keep the last position of marked gnomes; when a marked gnome leaves `ctx.gnomes.list` within 2 s of its mark and its last position was within `holeRadius + 0.5` of the hole, count it for that thrower; at 2+ counts within 2 s: `hole.earn(25 x count x valueScale)`, `hud.bigText('STRIKE x' + count, '#ffd23f', '+$...')`, `audio.fanfare(3)`, `fx.burst`; 5+ shows "TURKEY". Never read a body after the gnome left the list (positions are cached).
Gotowe, gdy: 5 statues placed 1 m outside the rim in a row, one classic thrown through them → within 3 s at least 2 of them eaten, `.hud-big` containing "STRIKE", money delta ≥ 50 x valueScale; a thrown gnome that hits nothing → no STRIKE text; no exceptions.

**P3 While you slept** (C). Owns `src/systems/offline.ts`. `boot()`: read `gnome-boozed-seen` (ms); `update()` writes it every 10 s. If elapsed ≥ 120 s and ≤ 8 h, `lvl('autocrank') > 0` and `state.placed` has one of magnet / cannon / vacuum / blackhole: eaten = `min(0.08 x autocrank x (1 + batch), cap)` x elapsed, cap 2.86 per cannon, 5 per vacuum, 12 for the black hole, 3 for the magnet; pay `eaten x avgTypeValue(level) x avgTier(level) x valueScale x 0.5` through `hole.earn`; no XP (F1 pending); DOM card `.offline-card` with the numbers and a CONTINUE button, `audio.coin`. Without the conditions: nothing.
Gotowe, gdy: save with `autocrank: 2`, `placed: [cannon]`, `gnome-boozed-seen` set 7200 s in the past → after load money grew by the formula's amount (±1%) and `.offline-card` is visible; same save without a placed machine → no card, money unchanged; a second reload right away → no card.

**P4 Blueprints** (D). Owns `src/ui/blueprints.ts`, CSS inline in the file (a `<style>` element it appends). Key K toggles a panel with 3 slots: SAVE stores `machines.serialize()` with positions relative to `env.hole` (x - hole.x, z - hole.z) in `gnome-boozed-blueprints`; LOAD removes all placed machines, then places each entry at `hole + offset` if the tool is owned and available, skipping entries whose base would sit inside the hole (`env.holeDist < holeRadius + 0.6 && y < 1.5`) with one toast "3 tools skipped: they would be in the hole"; Z undoes the last placement (`machines.list` tail removal, only within 10 s of placing). Pause and pointer lock handled like `shop.open/close`.
Gotowe, gdy: 3 tools placed, SAVE slot 1, all removed with `machines.clearAll()`, LOAD → 3 tools at the same positions (±0.01 m); `state.holeLevel++` + `env.rebuildHole()` then LOAD → every tool moved by exactly the hole delta; a tool saved at the rim that the new hole covers is skipped with the toast; no exceptions.

**P5 Slow-mo moments** (F). Owns `src/systems/slowmo.ts`. `scale` getter (1 normally); triggers read each frame: `stats.bullseyes` delta, `hole.combo` crossing 60 and 100 (compare with the previous frame), `stats.typesEaten.king` delta; on trigger: 0.08 s at scale 0 (freeze), then 0.6 s at 0.25, then 0.4 s eased back to 1 (`outCubic`); `audio` low tone through the existing `audio.rumble(0.3)`; at most one slow-mo per 5 s. The orchestrator adds `const dt = Math.max(0, Math.min(0.05, timer.getDelta())) * ctx.slowmo.scale` in `main.ts` (HUD and input keep real time: `hud.update` is after the scaled block, pass the real dt there).
Gotowe, gdy: with the system driven by the scenario, `stats.bullseyes++` → over the next 12 frames `ctx.time` advances less than 35% of the frames' real dt sum, then returns to 100% within 1.2 s; two triggers 1 s apart → one slow-mo; no exceptions.

**P6 Rain** (G). Owns `src/systems/weather.ts`. From hole level 3, every 240-420 s: 45 s of rain. On start: `physics.forEachCollider`: colliders whose membership bits include GROUND get friction 0.1, GNOME colliders 0.15 (remember the previous values per handle; new gnomes spawned during rain get 0.15 on the once-a-second pass); `hud.banner('RAIN', 'Everything slides for 45 s')`; each frame 10 `fx.wind` streaks around the player pointing down; `renderer.toneMappingExposure` 1.05 → 0.85 eased over 1 s (no lights). On end restore every friction value and the exposure.
Gotowe, gdy: dry: a classic given linvel 8 m/s along the grass stops within 6 m; during rain the same gnome slides ≥ 15 m; after the rain ends the dry distance is back (±10%) and every collider's friction equals its pre-rain value; `.hud-banner` contains "RAIN"; no exceptions.

Reserve packages when a slot frees up: E Pinball Bumpers + registry (after the Land/trampoline agent releases `machines.ts`), H Ground pound, M Gnomenado.

### 2.4 Review focus for the implementers

- No Rapier body change inside `forEachNear`/`intersectionsWithShape` callbacks: collect, then act.
- Cached positions for anything that may already be removed (P2, P4).
- Every new system survives `ctx.paused`, the shop, rebirth (`location.reload`) and a save without the new keys.
- No new `THREE.Light`, no new per-frame allocations beyond the surrounding code's habit.

## Work progress

- [x] economy model and simulator (6 strategies, 7 flags), results above
- [x] findings F1-F14 with code locations and numeric fixes
- [x] web research (Steam, itch, Donut County interviews, contraption sandboxes)
- [x] 14 feature cards, ranking, 6 packages with exclusive new files and headless "Gotowe, gdy"
- Not done on purpose: no code, no `src/` edits (other agents are in the files); the simulator stays in the scratchpad until PP wants it in `tools/`.
