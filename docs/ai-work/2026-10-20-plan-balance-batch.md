# Plan: balance batch (UFO/King weights, no slow-mo, XP by feeding style, more fans and belts, fuses check)

Spec: PP via hub, Slack 2026-10-20 23:00 (verbatim: "6. B ale król powinien pojawić się zawsze na poziomie 10. 7 nie ma zwalniania czasu. 10a.") and terminal (verbatim: "Daj wiecej fanow np z 10 i raili. Wszystkie narzedzia maja fuzes osobno"). Questions PP answered: BOARD.md "In progress" (UFO/King a/b/c, slow-mo yes/no) and "Pytania do PP na rano" item 3 (XP by feeding: hand x1, Magnet Gun volley x1/sqrt(n), machines, crate, plow and kick x0.25, money unchanged). Notes: `2026-10-20-ufo-king.md` (option b numbers: UFO 1.5 -> 5, King 0.6 -> 3), `2026-10-20-remove-trick-slowmo.md`, `2026-10-20-slowmo.md`, `2026-10-20-fuses.md`, `2026-10-20-land-and-balance.md` (simulator: machine paths reach L12 in 23-30 min, hands 307).
Trivial check: four data paths (event draw, the game clock in `main.ts`, the XP formula with every feeding path, tool limits with the fuse instance caps); 12 production files.
Decision age: every decision this plan rests on is from 2026-10-19 or 2026-10-20 (repo is two days old); nothing older than 60 days.
File overlap with other agents: `src/entities/robots.ts` (one line, 663) and `src/entities/gnomes.ts` (type union, `drop`) are also in the factory-bugs and gnome-parts plans; `src/main.ts` is shared by everyone. Edit those lines last and re-read before editing.

## Plan v0 (plan-author)

### Goal
The UFO comes about every 9 min and the King about every 16 min at level 10 (plus once, always, 6 s after reaching level 10); nothing in the game slows time except the Tab wheel; hole XP depends on how the gnome was fed while money stays as it is; the shop sells up to 10 fans and 10 conveyor belts; every placed tool keeps its own fuses (verified, no code).

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| A1 | hole level 4-9, day, event timer fires | draw | UFO share 5/24 = 20.8 % (was 7.3 %): about every 8.4 min at the 105 s average | PP 6b; ufo-king.md option b |
| A2 | hole level 10+, day, no King alive | draw | King share 3/27 = 11.1 % (about every 16 min), UFO 5/27 = 18.5 % | PP 6b |
| A3 | hole level 10+, night | draw | Night Visitor (3) joins: King 3/30 = 10 %, UFO 5/30 = 16.7 % | PP 6b (gates unchanged) |
| A4 | hole level 10+, a King is alive | draw | King row out of the pool (gate `!some(king)` unchanged); UFO still 5 | events.ts:29 |
| A5 | hole reaches level 10 (any feeding path, also a crate dump that jumps 9 -> 11) | level-up | one King 6 s later, always; `spawn` cannot refuse him (king capacity 2, none alive) | PP "król zawsze na poziomie 10"; hole.ts:252 |
| A6 | hole below 4 / below 10 | draw | no UFO / no King (gates unchanged) | ufo-king.md |
| A7 | `spec silent` save already at level 10+ before this build, or the King was eaten | play | no second guarantee; the pool brings him about every 16 min | ufo-king.md |
| B1 | combo crosses 60 (also 59 -> 61) | eat | game speed stays 1 (dt = realDt x wheel); GNOMEGEDDON text, shake and sound stay | PP 7 |
| B2 | combo crosses 100 | eat | same, no slow-mo | PP 7 |
| B3 | the King is eaten | eat | no freeze, no slow-mo, no slow-mo rumble; King money/XP/achievement unchanged | PP 7 |
| B4 | BULLSEYE | eat | no slow-mo (already true) | remove-trick-slowmo.md |
| B5 | `spec silent` Tab held (tool wheel open) | play | game at 0.25 speed while open, back to 1 within 0.3 s after release (kept) | wheel.ts:17 |
| B6 | legend opened (L) | read | no "Slow motion" section | legend.ts:61,247 |
| C1 | hand throw (one gnome, `thrownBy 'player'`) falls in | eat | XP x1: classic normal tier +1 XP | PP 10a |
| C2 | Magnet Gun volley of n gnomes (n > 1) falls in | eat | XP x1/sqrt(n) each: n = 4 -> +0.5 each, n = 16 -> +0.25 each; money and VOLLEY cap unchanged | PP 10a |
| C3 | `spec silent` hand throw helped by a tool on the way (trampoline TRICK, conveyor toss, fan, Gnome Magnet pull) | eat | still the player's throw (as for tricks): XP x1 | hole.ts:97, machines.ts:719,764 |
| C4 | `spec silent` gnome let go of by hand over the hole without a throw; a whole Magnet Gun ball let go of | eat | hand feeding: x1; the ball counts as a volley: x1/sqrt(n) (guard: a dropped ball of 20 must not pay 20 XP) | PP 10a intent |
| C5 | kick (F) sends a gnome in | eat | XP x0.25; the kicked gnome is still a STRIKE ball | PP 10a "kopniak" |
| C6 | `spec silent` ground pound (J in the air) sends a gnome in | eat | XP x0.25 (same as a kick) | pound.ts:94 |
| C7 | plow tractor pushes a gnome in; `spec silent` leaf blower blows one in | eat | XP x0.25 (`thrownBy null`) | PP 10a "spych"; sweeper.ts:152,188 |
| C8 | crate dump (also gnomes thrown into the crate) | eat | XP x0.25 each; CRATE DUMP bonus and money unchanged | PP 10a "skrzynia" |
| C9 | machine feeds a walker: fan, conveyor, Kicking Wheel, cannon, trampoline, magnet (`thrownBy 'machine'`) | eat | XP x0.25 | PP 10a "maszyny" |
| C10 | `spec silent` vacuum / black hole eat on the spot, robot tips its bed, even for a gnome the player threw there | eat | XP x0.25 (the machine fed it); money tricks for the thrown one unchanged | machines.ts:852, robots.ts:663 |
| C11 | `spec silent` gnome walks in by itself, or an event pushes it (quake, tornado, UFO drop, STRIKE victims, Boom blast) | eat | XP x0.25 (`thrownBy` null or 'machine') | gnomes.ts:499 |
| C12 | `spec silent` the King (xp 200) | eat | same rule: by machine 50 XP, by a hand throw 200 | gnomeTypes.ts:88 |
| C13 | Hole Hunger L5, Deep Hunger L2, hand throw | eat | +1 x 1.5 x 1.5 = +2.25 (feed factor multiplies with the rest) | hole.ts:147 |
| C14 | old save (holeXp 123.4, level 7) | load | unchanged, no migration; HUD bar `XP 123 / 900` as before | state.ts:73 |
| D1 | shop, Cooling Fan owned 4 | buy | 5th-10th fan sold at $2 606, $4 952, $9 409, $17 877, $33 966, $64 535 (x1.9 kept); hotbar `n/10`; 10 placeable | PP "np z 10" |
| D2 | `spec silent` shop, Conveyor Belt owned 6 | buy | 7th-10th belt at $2 847, $4 271, $6 407, $9 610 (x1.5 kept); 10 placeable | PP "i raili" |
| D3 | 10 fans + 10 belts + every other tool at max, Fuses L5 | draw | every tool shows its box and 5 fuses (caps 220 fuses / 44 boxes, derived from `UPGRADES`), none skipped | machines.ts:49-50 |
| D4 | 10 fans + 10 belts, 300 gnomes | play | `machines.update` p95 <= 1.5 ms, `LOGS:` empty | perf note 2026-10-19 |
| D5 | old save with fan 4 / conveyor 6, blueprint with 4 fans | load | loads as before; LOAD places what is owned | blueprints.ts |
| E1 | two fans, saboteur hits fan A twice | sabotage | A has 2 red fuses, B has 0 red (per-piece `blown`, already true) | PP "fuzes osobno"; machines.ts:38,47 |
| E2 | `spec silent` crate and panel | sabotage | never targeted (`nearestWorking` skips them), so no fuses: stays | machines.ts:47,478 |
| E3 | robot | sabotage | own fuses on the truck (already true) | fuses.md |

### Reach
- `src/systems/events.ts:27,29` `EVENTS` weights: read by `Events.update` (draw) and `legend.ts:226` (names only). Level-10 guarantee `src/systems/hole.ts:252` stays; `events.start('king')` -> `factory.produce('king')` -> `gnomes.spawn` refuses only at king capacity 2.
- `src/systems/slowmo.ts` (delete): `src/core/context.ts:24,58`; `src/main.ts:29,100,230,266`; `src/ui/legend.ts:61,247`. `audio.rumble` stays (events, burp, quake). `hud.update(realDt)`, `playTime += realDt`, `codeCd` stay on real time (the wheel still scales dt). `replay.update(realDt)` untouched (a playback, not a slow-down).
- `Hole.consume` (`src/systems/hole.ts:85`) callers: `src/entities/gnomes.ts:499` (fell in), `src/entities/machines.ts:651` (crate dump), `:852` (vacuum/black hole), `src/entities/robots.ts:663` (tip). `thrownBy` writers: gnomes.ts:308 (`ragdoll` by), 346 (`drop`), 359 (`release`), 621 (`standUp` -> null), 282 (type swap copy); player.ts:814 (kick), pound.ts:94; sweeper.ts:152,188 (null); robots.ts:635, machines.ts:764,833 ('machine'); events.ts:336 (UFO -> null). Readers comparing to `'player'`: hole.ts:97,136,458; strike.ts:33,39; events.ts:334 (UFO hit, needs y within 1.6 of y 14: a kick never reaches); machines.ts:719,764 (also need `throwPos`, so a kick never matched). `volley` writers: gnomes.ts:337-342 (`drop` with impulse), 287 (swap copy); reader hole.ts:136.
- `holeXp` writers: hole.ts:211 only; readers hud.ts:381-382. No job, no save migration.
- `UPGRADES.fan/conveyor.max` (`src/data/upgrades.ts:61-62`): shop (sell until `lvl(id) < max`), hotbar count, placement `machines.count(type) < lvl(type)` (machines.ts:363), `TOOL_IDS` unchanged, `KEEP_TOOL_IDS` unchanged. Derived caps: `FUSE_CAP`/`BOX_CAP` (machines.ts:49-50; `drawFuses` silently skips tools past them).
- Fuses: `blown`, `fuseAnim` per `Machine` (machines.ts:38-39); `fuseCount` 0 only for `box`/`panel`; `nearestWorking` skips `box`/`panel`. No change.
- Front: no API; HUD XP bar already shows fractions (`Math.floor`).

### Data
- No database. Save (`localStorage`): `holeXp`, `upgrades.fan`, `upgrades.conveyor` keep their shape; old values load unchanged.
- Cost of the fan limit: `forEachNear` is a full scan of `gnomes.list` (gnomes.ts:423): 10 fans x 320 gnomes (120 + 5 permits x 40) = 3 200 distance checks per frame, about 0.1 ms; belts the same with radius 2.4. Wind puffs: 10 x 8 per s into the capped `ParticlePool`. Draw calls: about +20-40 for 6 fans and 4 belts (each tool is its own mesh group, shadows on); D4 measures it.
- Event draw: unchanged cost, one weighted pick per 70-140 s.

### Steps (edit order)
1. `src/systems/events.ts:27` `weight: 1.5` -> `weight: 5` (ufo); `:29` `weight: 0.6` -> `weight: 3` (king). Comment on the row: `PP 2026-10-20 6b`. Nothing else: the level-10 guarantee at `hole.ts:252` already exists.
2. Delete `src/systems/slowmo.ts`. `src/core/context.ts`: remove the import (24) and `slowmo: Slowmo;` (58). `src/main.ts`: remove the import (29) and `ctx.slowmo = new Slowmo();` (100); line 230 becomes `const dt = realDt * ctx.player.wheel.slow(realDt);` (drop the slow-mo comment line); remove `ctx.slowmo.update(realDt);` and its comment (265-266). `src/ui/legend.ts`: remove the `slowmo` text (61) and `${sec('Slow motion', 'slowmo')}` (247).
3. `src/entities/gnomes.ts:32` `thrownBy: 'player' | 'machine' | 'kick' | null;` and `ragdoll(g, seconds, by: Gnome['thrownBy'] = null)` (308). In `drop` (gnomes.ts:~327-348) move the volley block (`if (this.volleyAt !== ctx.time ...) ... g.volley = this.volley;`) out of `if (impulse)` so every gnome let go of in one frame shares a volley (comment: "a ball let go of over the rim is one volley too (XP)"); `throwPos` stays inside `if (impulse)`.
4. `src/player/player.ts:814` `ctx.gnomes.ragdoll(g, 3, 'kick')`; `src/player/pound.ts:94` `ctx.gnomes.ragdoll(g, rand(1.5, 2.5), 'kick')`. `src/systems/strike.ts:33` `if ((g.thrownBy !== 'player' && g.thrownBy !== 'kick') || g.state !== 'ragdoll') continue;` and `:39` the same pair for `o` (a kicked gnome stays a STRIKE ball, as today).
5. `src/systems/hole.ts`: next to `VOLLEY_CAP` (34) add `export const FEED_XP = 0.25; // XP for a gnome a machine, crate, plow or kick fed (PP 2026-10-20 10a); a hand throw pays x1, a volley x1/sqrt(n)`. Signature `consume(g: Gnome, at?: THREE.Vector3, machine = false): void` (85). Line 147 becomes:
   `const feed = !machine && g.thrownBy === 'player' ? 1 / Math.sqrt(g.volley?.n ?? 1) : FEED_XP;`
   `const xp = g.type.xp * g.tier.value * feed * (1 + lvl('hunger') * 0.1) * (1 + deep('dXp') * 0.25);`
   Callers: `src/entities/machines.ts:651` `ctx.hole.consume(g, undefined, true);` `:852` `ctx.hole.consume(g, m.type === 'blackhole' ? centre : undefined, true);` `src/entities/robots.ts:663` `ctx.hole.consume(g, undefined, true);`. `value` (money) line untouched.
6. `src/data/upgrades.ts:61` fan `max` 4 -> 10; `:62` conveyor `max` 6 -> 10; row comment `PP 2026-10-20: "wiecej fanow np z 10 i raili"`. `src/entities/machines.ts:49-50`:
   `const FUSE_ABLE = UPGRADES.filter((u) => TOOL_IDS.includes(u.id) && u.id !== 'box' && u.id !== 'panel').reduce((s, u) => s + u.max, 0); // 44`
   `const FUSE_CAP = FUSE_ABLE * UPGRADE_BY_ID.fuses.max; // 220`, `const BOX_CAP = FUSE_ABLE;` (import `UPGRADES`, `TOOL_IDS` from `../data/upgrades`; check for an import cycle: `upgrades.ts` must not import `machines.ts`).
7. Texts. `docs/SPEC.md`: "Dziura" remove the Slow-mo line, add decision "(PP, 2026-10-20) Żadnego zwalniania czasu: combo 60/100 i król już nie spowalniają gry, zostaje tylko koło narzędzi (Tab): „myślałem, że gra się zacina""; "Cel i pętla gry" XP sentence: "XP zależy od sposobu karmienia: rzut ręką x1, salwa Magnet Guna x1/√n, maszyny, skrzynia, roboty, spych, dmuchawa i kopniak x0,25; kasa bez zmian" + decision (PP 10a, "automatyzacja kończyła grę w pół godziny; model: 33-69 min dla każdej ścieżki"); "Narzędzia do postawienia": fan `max 4` -> `max 10 (było 4)`, conveyor `max 6` -> `max 10 (było 6)` + decision; Fuses line: add "każda postawiona sztuka ma własne bezpieczniki (skrzynia i panel bez, bo sabotażysta ich nie atakuje)"; "Eventy i pogoda": "UFO i król losowani częściej (UFO ok. co 9 min od poziomu 4, król ok. co 16 min od 10) i król zawsze raz, 6 s po wejściu na poziom 10" + decision 6b. `docs/PLAN.md:85` add the XP-by-feeding sentence; `:86` fan/conveyor limits. `CHANGELOG.md`: new section on top (next build) with four bullets (UFO/King, no slow-mo, XP by feeding, 10 fans / 10 belts) each with a "Test:" sentence. `BOARD.md` (local): N8 and 6b/7/10a rows to "w kodzie, nie na 5300".
8. Scenario `tools/smoke/scenario-balance.js` (kept in the repo: the four checks are balance regressions) printing one `RESULT {...}` with the keys of "Done when"; run with `npx vite --port 5199 --host 127.0.0.1` and `CDP_PORT=9420 MAXPOLL=2400 node tools/smoke/smoke.mjs balance-out tools/smoke/scenario-balance.js`, output folder deleted after reading.

### Tests
Headless, `window.gnome` (ctx), scenario from step 8. Events: share computed from `EVENTS.filter(ok)` with `holeLevel` and `env.isNight` forced (A1-A4, A6), plus the real loop: `holeLevel = 9`, `holeXp = xpNeeded - 0.5`, one hand throw of a classic -> after 7 s `gnomes.list.some(king)` (A5). Slow-mo: `hole.comboTimer = 1e9`, `combo = 59`, throw one gnome -> `combo >= 60`; sample `ctx.time` delta / real delta over 30 frames (B1); same at 99 (B2); spawn a King at the rim and push it in with `ragdoll` + `setTranslation` (B3); `wheel.open` by a real Tab keydown (B5); `legend` HTML (B6). XP: `holeLevel = 11` (MAX-1, so XP accumulates without level-up noise), read `holeXp` before/after each feeding: hand throw via `gnomes.drop(g, impulse)` over the hole (C1), four gnomes dropped in one frame (C2), hand throw onto a trampoline aimed at the hole (C3), `gnomes.drop(g)` without impulse over the hole and a ball of 4 (C4), `ragdoll(g, 3, 'kick')` + impulse into the hole (C5-C6), `sweeper` plow drive (C7), crate with 2 gnomes dropped in (C8), fan-pushed walker (C9), vacuum at the rim eating a player-thrown gnome, robot tip (C10), walker at the rim (C11), King via `factory.produce('king')` pushed in by a fan (C12), `upgrades.hunger = 5`, `deep.dXp = 2` (C13), `loadState` of a fixture (C14). Money: `state.money` delta per case equals the same case recorded before the change (file `balance-money-before.json` from one run on the current code, kept in the scratchpad). Limits: `upgrades.fan = 4`, buy through `shop.buy('fan')` six times reading the price label (D1), the same for conveyor (D2), place all tools, `fuses = 5`, read `machines.fuseMesh.count` (D3), perf sampling `performance.now()` around `machines.update` (D4), old-save fixture + blueprint LOAD (D5). Fuses: two fans, `breakMachine(fanA)` twice (E1), `nearestWorking` with only a crate and a panel placed (E2), robot `blown` after one hit (E3).

### Done when
- A1: `RESULT.ufoShareL6 = 0.208` (±0.002) | A2: `RESULT.kingShareL10 = 0.111`, `ufoShareL10 = 0.185` | A3: `kingShareL10night = 0.1`, `ufoShareL10night = 0.167` | A4: `kingInPoolWhileAlive = false`, `ufoWeightWhileKingAlive = 5` | A5: `kingAfterLevel10 = 1` (within 7 s) and `kingAfter9to11 = 1` | A6: `ufoInPoolL3 = false`, `kingInPoolL9 = false` | A7: `grep -n "setTimeout" src/systems/hole.ts` → exactly the one line 252 (no new guarantee)
- B1: `combo60.minRatio = 1` (game dt / real dt over 30 frames) | B2: `combo100.minRatio = 1` | B3: `kingEaten.minRatio = 1`, `kingEaten.xp = 50` | B4: `bullseye.minRatio = 1` | B5: `wheel.timeScale = 0.25` while open, `1` within 0.3 s after release | B6: `legendHasSlowmo = false` and `ls src/systems/slowmo.ts` → `No such file`
- C1: `xp.hand = 1` | C2: `xp.volley4 = 0.5` per gnome (sum 2), `xp.volley16 = 0.25` | C3: `xp.trampolineThrow = 1` | C4: `xp.handDrop = 1`, `xp.ballDrop4 = 0.5` per gnome | C5: `xp.kick = 0.25`, `strike.kickBallCounted = true` | C6: `xp.pound = 0.25` | C7: `xp.plow = 0.25`, `xp.blower = 0.25` | C8: `xp.crate2 = 0.5` (two gnomes), `money.crate2` equals the before-file | C9: `xp.fanWalker = 0.25` | C10: `xp.vacuumThrown = 0.25`, `xp.robotTip = 0.25`, `money.vacuumThrown` equals the before-file | C11: `xp.walkIn = 0.25` | C12: `xp.kingByFan = 50` | C13: `xp.handHunger = 2.25` | C14: `load.holeXp = 123.4`, HUD text `XP 123 / 900`
- D1: `shop.fanPrices = [2606, 4952, 9409, 17877, 33966, 64535]` (rounded), `hotbar.fan = "10/10"` after buying, `placed.fan = 10` | D2: `shop.conveyorPrices = [2847, 4271, 6407, 9610]`, `placed.conveyor = 10` | D3: `fuses.count = 220`, `fuses.boxes = 44`, `fuses.skipped = 0` | D4: `perf.machinesP95 <= 1.5` ms with 300 gnomes, `LOGS:` empty | D5: `oldSave.fan = 4`, `blueprint.placedFans = 4`
- E1: `fuses.fanA = 2`, `fuses.fanB = 0` | E2: `saboteur.targetWithOnlyCrateAndPanel = null` | E3: `fuses.robotBlown = 1`
- All: `npx tsc --noEmit` → exit 0; `grep -rn "slowmo" src` → nothing.

### Assumptions (numbered)
1. "6b" = the weights from option b of `2026-10-20-ufo-king.md` (UFO 5, King 3), the only numbers PP saw.
2. "Zawsze na poziomie 10" is already true in the code (`hole.ts:252`); PP has not seen the King because his save is at level 8 (BOARD, N3). No new code, one verification line.
3. The slow-mo "whoomp" rumble on combo 60/100/King goes away with the slow-mo; the combo tier sound, text and shake stay.
4. `thrownBy 'kick'` covers the kick and the ground pound; both keep counting as a STRIKE ball.
5. The volley on a plain drop changes XP only: money's volley logic still requires `throwPos` (hole.ts:136), which a drop never sets.
6. Fan and conveyor price growth stays (x1.9 / x1.5); PP's N3 asks for steeper top levels, not cheaper ones.
7. The derived `FUSE_CAP` keeps the two-draw-call fuse rendering; the instance buffers grow from 170 to 220 (negligible).
8. The scenario lives in `tools/smoke/` because the XP table is a balance regression the next balance change must re-run.

### Alternatives rejected
- (a) UFO and King on their own timers (ufo-king.md option a): PP chose b.
- (b) A `kicked` boolean on `Gnome` instead of the `'kick'` union value: six writers (kick, pound, drop, release, standUp, swap) would duplicate the `thrownBy` lifecycle; the union reuses it.
- (c) Marking machine feeds by setting `thrownBy = 'machine'` in the crate / vacuum before `consume`: a player-thrown gnome sucked in by a vacuum would lose its money tricks ("kasa bez zmian").
- (d) A `feed` multiplier computed at each caller: scatters the rule over four files; one line in `consume` is the single place.
- (e) Flattening fan prices to x1.5 ($7.7k for the 10th): not asked; question 3 instead.
- (f) Hardening the King guarantee for saves already past level 10 (a `kingSeen` flag): not asked; A7 names it.

### Ladder
- Weights (step 1): data edit, rung 5; "6. B".
- Deletion of `slowmo.ts` and its wiring (step 2): rung 1; "7 nie ma zwalniania czasu".
- `'kick'` union value (steps 3-4): rung 6; "kopniak x0,25" while the STRIKE rule keeps kicked balls. No helper exists for "who fed it".
- Volley on drops (step 3): rung 6, exploit guard for the Magnet Gun ball let go of over the rim; "salwa x1/√n".
- `FEED_XP` constant and `machine` parameter (step 5): rung 5/6; "maszyny, skrzynia ... x0,25" (the crate keeps `thrownBy 'player'` for thrown-in gnomes, so the caller must say "machine").
- `max` 10 / 10 (step 6): data edit, rung 5; "wiecej fanow np z 10 i raili".
- Derived `FUSE_CAP`/`BOX_CAP` (step 6): rung 2 (reuses `UPGRADES`, `TOOL_IDS`); required so the limit change cannot leave the 35th tool without fuses.
- Scenario in `tools/smoke` (step 8): rung 2, the harness exists.

### Open decisions (for PP)
1. [spec silent] Kiedy gracz trzyma Tab (koło narzędzi), wtedy gra zwalnia do 1/4 na czas wyboru. Zakładam: zostaje | Dowód: `src/player/wheel.ts:17,35` (osobny mechanizm, nie efekt po akcji) | Jeśli źle: gracz wybiera narzędzie w pełnym tempie, gnomy uciekają w trakcie | Pewność: Likely | rekomendacja: a) zostaje (koło to menu, nie „zacięcie"); b) usunąć też: krok 2 dodatkowo `wheel.slow` → `main.ts` `const dt = realDt;`.
2. [spec silent] „raili" = Conveyor Belt. Zakładam: limit taśm 6 → 10 | Dowód: `src/data/upgrades.ts:62`, jedyne narzędzie z szynami; `machines.ts:153` "side rails" | Jeśli źle: PP chciał czegoś innego i taśm dalej jest 6 | Pewność: Likely | rekomendacja: a) taśmy do 10.
3. Ceny wentylatorów 5-10 przy obecnym wzroście x1,9: $2,6k, $5k, $9,4k, $17,9k, $34k, $64,5k (10. wentylator droższy niż Mini Black Hole $50k). a) zostaje: wtedy ostatnie wentylatory kupuje się dopiero pod koniec gry (zgodne z N3 „droższe najwyższe levele"); b) wzrost x1,5: wtedy 10. wentylator kosztuje $7,7k i komplet jest przed poziomem 6. (rekomendacja: a)
4. [spec silent] Kiedy gracz puszcza gnoma (albo całą kulę z Magnet Guna) nad dziurą bez rzutu, wtedy liczy się jak karmienie ręką: x1, kula x1/√n. Zakładam: tak | Dowód: `gnomes.ts:346` (`drop` zawsze daje `thrownBy 'player'`) | Jeśli źle: a) puszczenie liczone x0,25 karze najwolniejszą ścieżkę; b) bez salwy przy puszczeniu kula 20 gnomów dałaby 20 XP zamiast 4,5 | Pewność: Likely | rekomendacja: a) jak w planie.
5. [spec silent] Kiedy gnom sam wejdzie do dziury (wściekły, parada, trzęsienie, tornado, UFO go upuści, STRIKE go wepchnie, wybuch Boom), wtedy x0,25. Zakładam: wszystko, czego gracz nie rzucił ręką, to x0,25 | Dowód: `gnomes.ts:621` (`standUp` zeruje `thrownBy`), `events.ts:336` | Jeśli źle: STRIKE (trik gracza) płaci XP jak maszyna | Pewność: Likely | rekomendacja: a) x0,25; STRIKE i tak płaci kasą.
6. [spec silent] Rzut ręką, któremu pomogło narzędzie po drodze (trampolina, taśma, wentylator, magnes), liczy x1 jak trick; rzut zjedzony przez wieżę ssącą / czarną dziurę / robota liczy x0,25. Zakładam: tak | Dowód: `machines.ts:719,764` (rzut gracza zachowuje `thrownBy` przez trampolinę i taśmę), `machines.ts:852`, `robots.ts:635` | Jeśli źle: rzut na trampolinę obok dziury daje pełny XP przy pół-automacie | Pewność: Likely | rekomendacja: a) jak w planie.
7. [spec silent] „Wszystkie narzędzia mają fuzes osobno": dziś każda postawiona sztuka ma własne bezpieczniki, wyjątek to skrzynia i panel (sabotażysta ich nie atakuje). Zakładam: bez zmian w kodzie, tylko zapis w SPEC | Dowód: `machines.ts:38,47,478` | Jeśli źle: PP chciał b) osobnego zakupu Fuses dla każdego typu narzędzia (9 pozycji w sklepie) albo c) bezpieczników też na skrzyni i panelu (musiałby je ktoś psuć) | Pewność: Unclear | rekomendacja: a) bez zmian.
8. [spec silent] Kiedy zapis jest już na poziomie 10+ (albo król został zjedzony), wtedy nie ma drugiej gwarancji; król wraca z losowania ok. co 16 min. Zakładam: tak | Dowód: `hole.ts:252` (tylko moment awansu) | Jeśli źle: gracz po przeładowaniu na poziomie 10 czeka na króla do kwadransa | Pewność: Likely | rekomendacja: a) bez kodu.

### Self-check
- Every criterion (6b, 7, 10a, fans/rails, fuses) has a step (1, 2, 3-5, 6, 7) and a Done-when line.
- Every step names the file, line, signature and value; no "handle edge cases" lines.
- Fields written: `thrownBy` (all 12 writers and 8 readers listed in Reach), `volley` (2 writers, 1 reader), `holeXp` (1 writer, 1 reader), `EVENTS.weight`, `UPGRADES.max`, `FUSE_CAP`/`BOX_CAP`.
- Lists compared with the code: slow-mo triggers (2 + King in `COMBO_MARKS`/`kings`: exact, plus 1 `spec silent` row for the wheel); feeding paths (4 `consume` callers x `thrownBy` values: 9 `spec silent` rows C3, C4, C6, C7-blower, C10, C11, C12, A7, D2, E2 = 11 rows marked `spec silent` in total); event rows (ufo, king: exact); tool limits (fan named, conveyor `spec silent`). Matrix rows 35, Done-when lines 35 (one per row), plus the "All" line.
- Decisions older than 60 days: none (repo from 2026-10-19).
- Plan vs code: the code change is about 40 lines in 12 files plus one scenario; the plan is longer because 35 variants are enumerated (the matrix is the deliverable here, decision PP 2026-10-19).

## Review: performance (plan-performance)

Verdict: CONCERNS

No database in this repo. Cost here means work per frame (16.7 ms budget at the 60 fps cap) with every tool placed and 320 gnomes (`gnomes.ts:194`, 120 + 5 permits x 40).

| plan step | operation | shape / index | multiplicity | volume (where measured) | cost | severity |
|---|---|---|---|---|---|---|
| 6 | `forEachNear` per fan / belt (`machines.ts:732,754`) | full scan of `gnomes.list`, one `body.translation()` WASM call per free gnome | per placed fan and belt, every frame | 10 fans + 10 belts x 320 = 6 400 calls; all tools at max about 36 scans = 11 520 calls | 0.26 ms median / 0.31 ms p95 for 20 scans; 0.48 / 0.55 ms for 36 scans (Node + rapier3d-compat 0.21 micro-benchmark); the change adds +10 scans = about +0.13 ms | none |
| 6 | fan impulse `applyImpulse` (`machines.ts:745`) | one WASM call per gnome inside the 0.8 cone | per fan per frame, only gnomes in the cone | bounded by gnomes in range | negligible | none |
| 6 | extra meshes for 6 fans + 4 belts | fan = 2 meshes, both `castShadow`; belt = 5 meshes (body + 3 rollers `castShadow`, belt receive-only, own material) | every rendered frame, main pass + shadow pass | code count: fan 2 + 2 = 4 calls, belt 5 + 4 = 9 calls; +6 x 4 + 4 x 9 = +60 draw calls (scene today: 60 on the title camera, perf note 2026-10-19) | about +60 draw calls, roughly double the title scene; the plan says +20-40 | Medium |
| 6 | wind puffs `fx.wind` (`machines.ts:747`) | emit into the shared 300-slot `puffs` pool | 8 per s per fan | 10 fans = 80/s, life 0.7 s = about 56 live of 300 | fits the pool | none |
| 6 | `drawFuses` with `FUSE_CAP` 220 / `BOX_CAP` 44 | 2 instanced draw calls, `setMatrixAt` per fuse | once per frame | 220 + 44 matrices (was 170 + 34) | negligible; draw calls unchanged | none |
| 1 | event draw | weighted pick over `EVENTS` | once per 70-140 s | 2 changed weights | negligible | none |
| 3 | volley block moved out of `if (impulse)` in `drop` | O(1), compares `volleyAt` | per gnome let go of | - | negligible | none |
| 5 | XP feed factor in `consume` | one `Math.sqrt` | per eaten gnome | - | negligible | none |
| 2 | remove `Slowmo` | deletes one update per frame | - | - | removes work | none |

Findings:
- [Medium] Draw calls for the new tools are higher than the plan says and D4 does not measure them: when the player places 10 fans and 10 belts, the renderer draws about 60 more meshes per frame (not 20-40), because each fan has 2 shadow-casting meshes and each belt 5 meshes with 4 casting shadows, so every piece is drawn twice. The CPU scan cost is fine; the render cost is the part that changed. Fix: extend D4 to read `ctx.renderer.info.render.calls` (or the renderer the loop uses) with 0 and with 10 fans + 10 belts placed, default scene (`URL_QUERY=''`), and write both numbers into the ai-work note; no code change unless PP's playtest shows a drop. Measured: estimated from the mesh count in `machines.ts:139-176`, not rendered.
- [Low] D4 checks only `machines.update` p95 <= 1.5 ms: the micro-benchmark puts all scans at 0.55 ms p95 in Node, so the line passes with room; headless Chromium at about 5 fps measures the same JS, so the threshold is a regression guard, not a frame-time guarantee. Keep it as is. Measured: yes (Node micro-benchmark, 320 Rapier bodies, 600 frames).

No findings on: event weights and the level-10 King timer (one draw per 70-140 s, one `setTimeout`), slow-mo removal, XP formula, volley on drops, fuse instance caps 220 / 44 (two draw calls as before), wind particles (56 of 300 slots), fan impulses.

Measured on: Node 22 micro-benchmark with `@dimforge/rapier3d-compat` 0.21 from the repo (320 bodies, `translation()` scan like `forEachNear`, script in the scratchpad, deleted after reading); draw calls counted from the code. Prod: not applicable (static game, no server).

## Review: impact (plan-impact)

Verdict: CONCERNS

Missing from the plan:
- [High] `src/entities/gnomes.ts:359` `release` writes `thrownBy = 'player'` and the plan lists it but gives it no rule. Two callers keep that value: `src/entities/machines.ts:665` (a crate tipped over spills its load) and `:437` (`remove`: a crate, cannon or robot taken back spills its queue). The cannon (`:832-833`) overwrites it with `'machine'`, these two do not. When the player tips a full crate over next to the rim, then every gnome that rolls in pays XP x1 instead of x0.25, because it looks like a hand feed (no `throwPos`, `thrownBy 'player'`). That breaks C8 ("skrzynia x0,25") with up to 60 gnomes per crate. Fix: in step 3, set `g.thrownBy = 'machine'` after `release` at `machines.ts:437` and `:665` (as the cannon does), and add a matrix row "crate tipped at the rim → x0.25".
- [Medium] `src/entities/gnomes.ts:483` (held gnome dragged low over the hole slips off the magnet: `drop(g)` then `startFalling`) and `src/player/player.ts:748` (a gnome slips out of the Magnet Gun ball: `drop(s.g)`). Both let go of one gnome per call in different frames. When the player lowers a ball of 20 slowly over the hole, then the gnomes slip off one by one, each gets its own volley of n = 1 and pays x1 = 20 XP. This bypasses the C4 guard ("a dropped ball of 20 must not pay 20 XP"), because step 3 groups only gnomes let go of in the same `ctx.time`. Fix: let the XP volley come from the ball (for example, the volley is opened at `hold` time for the swarm, or the slip paths join the ball's open volley), and add a matrix row "ball lowered slowly over the rim".
- [Medium] `src/ui/legend.ts:169` (per-type card `x${t.value} money · ${t.xp} XP`), `:179` (tier column "Money and XP"), `:236` ("Feed the hole to fill its XP bar"), `src/data/holeLevels.ts:2` ("1 xp = 1 ordinary gnome") and `docs/SPEC.md:11` ("Zwykły gnom = 1 XP") all read the base XP. When the player opens the legend, then the King card says 200 XP, but a machine-fed King gives 50, because step 5 multiplies at `consume` only. Fix: step 7 updates these texts (one sentence "x0.25 when a machine, crate, plow or kick feeds it").
- [Medium] King XP drops from 200 to 50 in every case, not only "by machine". The King cannot be grabbed (`src/player/player.ts:757`), pounded (`src/player/pound.ts:82`) or plowed (`src/player/sweeper.ts:143,177`), so no hand throw exists and matrix row C12 "by a hand throw 200" is unreachable. When the player feeds the King at level 10, then he fills 50 / 2 500 = 2 % of the bar instead of 8 %. Fix: drop the "200" half of C12 and put this to PP in Open decisions (keep 50, or exempt the King from `FEED_XP`).
- [Medium] `docs/ai-work/2026-10-20-plan-auto-lands.md:64` (scenario `02_levelup_garden`) forces a level-up with `holeXp = xpNeeded − 1` and `consume(gnome)` on a spawned gnome (`thrownBy null`). After this plan, that call adds 0.25 XP and no level-up happens, so the auto-lands scenario goes red. Fix: tell the auto-lands implementer to use `xpNeeded − 0.1` or a hand-dropped gnome. Steps 1 and 5 also touch `hole.ts` and `events.ts`, which auto-lands edits (`levelUp`, spawn points), as that plan already notes at line 43.
- [Low] Kick and stale `throwPos`: `hold` (`gnomes.ts:318`) does not clear `throwPos`, and a kick only changes `thrownBy`. When the player kicks a gnome still in the air from a throw, then today it keeps `'player'` plus `throwPos` and pays LONG/AIR tricks, can trigger the trampoline `byPlayer` path (`machines.ts:719`) and the BULLSEYE ring (`hole.ts:458`); with `'kick'` it pays none. That is a money change against "kasa bez zmian". The same stale `throwPos` lets several re-grabbed gnomes dropped in one frame hit the money VOLLEY cap after step 3 (`hole.ts:136`), against assumption 5. Fix: accept with one sentence in the note, or clear `throwPos` in `hold`.
- [Low] `docs/SPEC.md:20` records "(PP, 2026-10-20) [...] tempo XP wg sposobu karmienia odłożone („jeszcze nie wiem co i jak")". PP's 10a answer replaces it, but step 7 only adds a new line. Fix: step 7 rewrites line 20. Slow-mo also appears in `docs/SPEC.md:46`, `:202` and `:212`; step 7 removes only line 34.

Neighbours checked: draft/live: not affected (no draft state in a browser game) | profiles/LEVEL 2/3: not affected (no accounts) | serve-cache: not affected (none) | polling/imports: not affected (no backend); save load affected only by value (fan 4/conveyor 6, `holeXp` fractions already floored in HUD) | find_best/cohorts: not affected | dimensions/formulas: affected, `consume` XP formula (step 5); goals "Reach hole level N" (`src/systems/goals.ts:38-44`) and auto-lands land slides arrive later for machine players, no code change | text index/search: not affected | prompt context: not affected | widget/serving: not affected | achievements/stats/contracts/moods: not affected (they count `gnomesEaten`, `typesEaten`, `crateDumps`, not XP) | leaderboard: score is `totalEarned` (money, unchanged); the `level` column on the `main` and same-day `daily-*` board will mix old and new XP speed, accepted | daily challenge: game-time timer, unaffected by slow-mo removal except it no longer runs slower during combo 60/100 | offline earnings: not affected (removed, `rg -i offline src` empty) | saboteur targeting: not affected (`nearestWorking` per piece) | robots: `buildGrid` (`robots.ts:455-508`) treats every placed tool as an obstacle, 10 more fans/belts mean more blocked cells and longer routes (behaviour, see factory-bugs plan) | shop: `shop.ts:297` shows pips only for `max <= 8`, so fan and conveyor switch to the `n/10` text, as panel and robot already do | fuse caps: `FUSE_ABLE` from `TOOL_IDS` (`upgrades.ts:100-101`) gives 44; `upgrades.ts` imports nothing, no cycle | King guarantee: `hole.ts:252` `setTimeout` on real time, `events.start('king')` → `factory.produce('king')`, unchanged | slow-mo: only `main.ts:29,100,230,266`, `context.ts:24,58`, `legend.ts:61,247` use it; `audio.rumble` keeps other callers.
FE/BE: no API. Supabase `scores` (`supabase/leaderboard.sql:10-11`) checks only `score >= 0` and `level 1..99`; nothing in this plan changes the payload.
Decisions: consistent with `2026-10-20-ufo-king.md` (option b weights), `2026-10-20-remove-trick-slowmo.md`, `2026-10-20-fuses.md:33` (caps must cover all max values; the derived cap keeps it), `2026-10-20-strike.md:13` (kicked gnomes stay STRIKE balls through the `'kick'` pair); `2026-10-20-slowmo.md` is replaced by PP 7 (newer), and `docs/SPEC.md:20` by PP 10a (newer), see finding above.
Decisions older than 60 days: none (oldest note 2026-10-19).
Regression vs current behaviour: kicking a mid-air thrown gnome no longer pays its trick money (Low finding above); otherwise none, `Slowmo.update` did nothing besides the scale and one `rumble(0.3)`.

## Review: roast (plan-roaster)

Verdict: BLOCK (scoped to step 3 and the `release` path; steps 1, 2, 4, 6, 7 hold up)

Steel-man: The plan puts the whole XP rule in one line of `consume` and lets callers only say "a machine did this", which is the cheapest place to keep it right as tools are added. It reuses `thrownBy` instead of a parallel `fedBy` field, keeps money untouched by construction (the `value` line is not edited), and derives the fuse caps from `UPGRADES` so the next limit change cannot silently drop fuses. Strong: the slow-mo deletion list is complete (`grep slowmo src` matches exactly the plan's lines); the event shares are arithmetically right (day L4-9 pool = 24, L10 = 27, night = 30); price rows D1/D2 match `200 x 1.9^n` and `250 x 1.5^n`; `FUSE_ABLE` = 44 includes the 12 robots because `robot` is in `TOOL_IDS` (`upgrades.ts:71,101`); the King cannot be refused by `spawn` (only per-type capacity, `gnomes.ts:207`); the tutorial goal "release LMB over it" is a plain drop, so x1 and the early levels keep their pace.

Findings:
- [Major] Step 3 gives a re-grabbed thrown ball a fresh volley and reopens the night-plan F2 money exploit.
  Assumption: a plain drop only adds XP grouping; money stays as it was (assumption 5, "volley on drop changes XP only").
  Scenario: player throws a Magnet Gun ball of 20 from 14 m, it lands short of the hole; within the 1-2.5 s ragdoll window (`noGrabUntil` 1.5 s, `drop` timer 2.5-4 s) the player grabs the pile again and lowers it over the rim. Each gnome slips off at `gnomes.ts:481-484` in its own frame, so step 3 gives it a new `{ n: 1, bonusPaid: false }`. `throwPos` is still the 14 m spot (`hold` and a plain `drop` never clear it, `gnomes.ts:316-347`), so `consume` sees `throwPos && thrownBy 'player'`, `volley.n = 1` = not a volley: SNIPER x4 under `TRICK_CAP` 20 plus `TRICK_BONUS.sniper` 40 x `valueScale` for every gnome. Today the same gnomes keep the thrown volley (n 20, bonus paid once, cap 8).
  Checked: `gnomes.ts:327-347` (volley only inside `if (impulse)`, `throwPos` untouched without impulse), `hole.ts:97-100,136-143` (volley needs `n > 1`, bonus once per volley), `hole.ts:40` (sniper 40), `hole.ts:91` comment "only for gnomes the player threw (not dropped ...)".
  Impact: 20 flat bonuses per re-drop instead of at most 1; at level 10 (mult 8) that is about $6 400 extra per pile, the exact loop F2 closed. The money before/after file in Tests has no case for it, so it ships green.
  Recommendation: do not write `g.volley` on a plain drop. Keep XP grouping on its own: open one XP group per Magnet Gun hold (the `swarm` in `player.ts:553-557`) and let `consume` read `n` from it. Separately, PP decides whether a plain drop should clear `throwPos` (matches the `hole.ts:91` comment, but changes carry-in money: today a gnome thrown from 14 m, re-grabbed and carried in still pays SNIPER).
- [Major] Same root, XP side: the C4 guard ("a dropped ball of 20 must not pay 20 XP") cannot work, because a lowered ball lets go one gnome per frame (already raised by plan-impact as Medium; I rate it Major because it decides which path is fastest).
  Assumption: a ball let go of over the rim leaves in one frame.
  Scenario: hold a ball of 20 over the hole and aim down; gnomes cross `hp.y < 1.4 * scale` (`gnomes.ts:482`) or slip by mass (`player.ts:745-748`) in different frames, each `volleyAt !== ctx.time` opens a new volley, XP about 1 each. Only a full LMB release (`player.ts:642`) groups them. At 60 fps real play the spread is wider than in the 5 fps headless scenario, so C4 can pass headless and fail for PP.
  Checked: `gnomes.ts:337-342`, `:481-484`, `player.ts:642,748`.
  Impact: hovering a ball over the hole pays about x1 per gnome, throwing the same ball pays x1/sqrt(n); the gun path stays near today's 39 min while every machine path goes 4x slower, the opposite of 10a's intent. Fixed by the same per-hold group as above.
- [Major] Crate tipped next to the rim pays x1 (plan-impact High, confirmed): `release` writes `thrownBy 'player'` (`gnomes.ts:359`) and the tip branch (`machines.ts:665`) and `remove` (`:437`) never overwrite it; the dump branch is skipped when the crate lies just outside `holeRadius + 0.3` (`machines.ts:640`). The tip also keeps each gnome's old `throwPos` (only the dump branch clears it, `:649`), so a gnome sniped into the crate from 14 m and then tipped into the hole pays SNIPER money today and after. Fix as plan-impact says (`thrownBy = 'machine'` after both `release` calls) and add the matrix row; clearing `throwPos` there too is one more line and matches the dump branch.
- [Minor] Economy numbers are stale. BOARD question 3 and step 7's SPEC line ("model: 33-69 min dla każdej ścieżki") come from the `--xpFeed` run in `2026-10-20-plan-night-features.md:56`, made before `2026-10-20-land-and-balance.md:66-75`, which already moved hands 167 -> 307 min and the gun 22 -> 39 min. Hands (307) and kick (397, x4 after this plan) were never inside 33-69. Not reopening 10a: only the sentence written into SPEC is not true. Recommendation: re-run `econ.mjs --implemented --xpFeed` (with the auto-lands assumption if that lands first) and write the measured range, or drop the number from SPEC.
- [Minor] Two Kings at level 10: when the event timer fires inside the 6 s window after reaching level 10, the pool can draw the King (no King alive yet, `events.ts:29`), and the `setTimeout` at `hole.ts:252` adds a second one (capacity 2 allows it). About 6/105 x 11 % = 0.6 % of runs. Harmless, but A5's "kingAfterLevel10 = 1" will flake if the scenario does not hold the event timer.
- [Minor] The King guarantee runs on wall-clock time: `setTimeout` fires while the game is paused (Esc, shop), so the King and his banner appear behind the menu; a tab closed within 6 s after the level-up keeps the save at level 10 (saved in `levelUp`, `hole.ts:254`) and the King never comes from the guarantee (same outcome as A7).
- [Minor] B1-B4 "game dt / real dt" measured with `performance.now()` reads 0.25 headless, because `main.ts:227` clamps `realDt` to 0.05 s and headless runs at about 5 fps (0.2 s per frame). The scenario must compare `ctx.time` delta with the clamped delta (or read the scale factor), or the implementer will chase a slow-down that is not there.
- [Minor] Ball XP shrinks below machine XP for big balls: x1/sqrt(n) is under x0.25 when n > 16, so a Coil 5 ball of 71 thrown into the hole gives 8.4 XP while the same 71 gnomes dumped from a crate give 17.75. Not wrong per 10a, but PP should see that the best gun upgrade makes the gun the slowest XP route per gnome.

Pre-mortem: A week later PP writes "maszyny są bez sensu, a Magnet Gun dalej przechodzi grę w 40 minut". Cause: the per-frame volley (step 3) never groups a lowered ball, so hovering a ball over the hole pays almost full XP while machines pay a quarter; the same change hands out a flat SNIPER bonus per slipped gnome. The missed signal: every XP case in the scenario drops gnomes in one frame, and the money before/after file has no re-grab case.

Inversion worth considering: tie the XP group to the hold, not to the frame: one group per Magnet Gun grab (or per throw), created in `player.ts` where the swarm is built, and leave `g.volley` (money) exactly as it is today. This removes both drop findings and makes assumption 5 true by construction.

Investigate first: (1) re-run the economy model on the current code with `--xpFeed` before SPEC gets a minute range; (2) PP: should a plain drop of a gnome that was thrown earlier still pay its trick money (today yes, `hole.ts:91` says no)?

Not a finding: keeping the Tab wheel slow-down (open decision 1). PP's complaint was an unexpected slow-down after a shot (`2026-10-20-remove-trick-slowmo.md:10`); the wheel is a held menu PP asked for (BOARD, robots-wheel-blower), and the manual instant replay (`replay.ts`, key I) plays at real speed. Recommendation a) stands.

## Plan (plan-senior, final)

Status: needs-decision (steps 1-8 are buildable now with the defaults named in "Decisions for PP"; PP is asleep, the defaults are the safe ones)

Sequencing (orchestrator): this batch lands AFTER factory-bugs and tutorial-goals. Re-read `hole.ts consume`, `player.ts` (kick, swarm), `robots.ts:663`, `main.ts` before editing: line numbers below are from today's tree. The auto-lands scenario `02_levelup_garden` must use `holeXp = xpNeeded − 0.1` (not `− 1`): a spawned gnome (`thrownBy null`) pays 0.25 XP after step 5. Whichever plan lands second fixes that line (step 8 here carries the conditional).

### Resolutions
- R1: roaster [Major, BLOCK] + impact [Medium] step 3 per-frame volley on a plain drop vs v0 assumption 5: **Decision: step 3 of v0 is dropped; `g.volley` (money) is not written on a plain drop. XP grouping gets its own field `xpGroup: { n }` opened once per Magnet Gun hold in `player.ts` and cleared by `hold()`; `consume` reads `n` from it.** Rationale: v0 grouped by `ctx.time`, but a ball lowered over the rim lets go of one gnome per frame (`gnomes.ts:481-484` slip over the hole, `player.ts:745-748` slip by mass), so every gnome would open its own group (n = 1, x1) and the C4 guard could pass headless at 5 fps and fail at 60 fps; the same fresh volley with a stale `throwPos` (never cleared by `hold`/plain `drop`, `gnomes.ts:316-347`) would pay a SNIPER bonus per gnome, reopening night-plan F2. A per-hold group is the only shape where "ball of 20 pays 4.5 XP" holds whether the player throws it, releases it or lets it slip. Checked: `gnomes.ts:327-347,481-484`, `player.ts:553-558,642,745-748`, `hole.ts:97,136-144`.
- R2: impact [High] + roaster [Major] `release` keeps `thrownBy 'player'` (crate tipped at the rim, tool taken back): **Decision: accepted, fixed inside `release` itself (`thrownBy = 'machine'`, `throwPos = null`, `bounced = bullseye = false`), not at the two callers; the cannon's own override at `machines.ts:833` goes away as redundant.** Rationale: all three callers of `release` are machines (`machines.ts:437,665,832`), so the function is the single place; clearing `throwPos` matches the dump branch (`machines.ts:646-648` "dumped, not thrown: no trick shot") and the robot pick (`robots.ts:634-638`). Side effect, deliberate: a gnome sniped into a crate from 14 m and then tipped in stops paying SNIPER money; that was the F3 exploit in a second door, not a feeding path PP uses. Checked: `gnomes.ts:352-362`, `machines.ts:437,640-667,832-833`.
- R3: impact [Medium] King XP 200 -> 50 in every case: **Decision: the King is exempt from the feed factor (always `g.type.xp`), built now; PP confirms (Decisions 2).** Rationale: impact is right that no hand feed of the King exists (`player.ts:757` not grabbable, `pound.ts:82`, `sweeper.ts:143,177` skip him), so v0's C12 "by hand 200" was unreachable and the plan would silently cut a boss reward PP never asked to cut; 10a is about feeding paths, the King is one event per ~16 min. Checked: `player.ts:757`, `pound.ts:82`, `sweeper.ts:143,177`, `gnomeTypes.ts:88`.
- R4: impact [Medium] legend / `holeLevels.ts` / SPEC texts read the base XP: **Decision: accepted into step 7 (one sentence in the legend "Hole levels" section, one comment in `holeLevels.ts:2`, SPEC line 11); the per-type card keeps `${t.xp} XP` because the King card is now right and the others are the hand value.**
- R5: impact [Medium] auto-lands scenario `xpNeeded − 1` goes red: **Decision: accepted as a sequencing note (top of this section) and a conditional in step 8.**
- R6: impact [Low] kick on a mid-air thrown gnome loses its trick money with `'kick'`: **Decision: accepted as is (no `throwPos` clearing in `hold`), one sentence in SPEC.** Rationale: a kick is "not a throw" by PP's 10a; the trick pay for a kicked gnome was an accident of `'player'` being the only non-machine value. The second half of the finding (VOLLEY cap on re-grabbed drops) is moot after R1.
- R7: impact [Low] SPEC line 20 ("odłożone") and slow-mo at SPEC 46, 202, 212: **Decision: accepted, step 7 rewrites line 20 and edits all four slow-mo lines.**
- R8: roaster [Minor] economy minutes in SPEC are stale and `econ.mjs` lives in a session scratchpad (`land-and-balance.md:62`), so the implementer cannot re-run it: **Decision: no minute range in SPEC or CHANGELOG; the decision text names the rule and the reason ("maszyny kończyły grę w pół godziny"), not a model number.**
- R9: roaster [Minor] two Kings when the event timer fires inside the 6 s window: **Decision: behaviour accepted (0.6 % of runs, capacity 2, harmless); the A5 scenario holds `ctx.events['next'] = 1e9` so the line does not flake.** Checked: `events.ts:36`.
- R10: roaster [Minor] B1-B4 ratio reads 0.25 headless because `realDt` is clamped to 0.05 at 5 fps: **Decision: accepted; B-lines assert the `ctx.time` delta per frame equals the clamp (0.05) with the wheel closed, instead of a game/real ratio.** Checked: `main.ts:227`.
- R11: performance [Medium] +60 draw calls for 10 fans + 10 belts, not 20-40: **Decision: accepted; D4 reads `ctx.renderer.info.render.calls` with 0 and with 10 + 10 placed and writes both into the ai-work note; no code change (PP's playtest decides).** Checked: `context.ts:36`.
- R12: roaster [Minor] 1/sqrt(n) falls under 0.25 for n > 16: **Decision: PP's formula stays as written (Decisions 3 carries the floor as option b).**
- R13: roaster "investigate (2)" plain drop of an earlier-thrown gnome still pays trick money: **Decision: unchanged (today's behaviour, "kasa bez zmian"); goes to PP as Decisions 11 because it is a money rule.**
- Rejected: roaster [Minor] King guarantee on wall-clock `setTimeout` (fires behind the pause menu; tab closed within 6 s loses him) because the gap is seconds wide, A7 already accepts "no second guarantee", and a game-time timer plus a saved flag is a new save field for a 0.1 % case; revisit if PP reports "level 10, no King" after a reload.
- Rejected: performance [Low] D4 threshold is a regression guard not a frame guarantee because the reviewer asks to keep it as is.
- Rejected: v0 alternative (f) `kingSeen` flag, same reason as above.

### Chosen variant
Per-hold XP group: `player.ts` opens one `{ n }` object when a Magnet Gun ball starts (swarm empty -> first batch) and every gnome that joins the ball gets `g.xpGroup = group; group.n++`; `gnomes.hold()` clears it (hands = 1, a re-grab starts fresh); `consume(g, at?, machine = false)` pays `feed = king ? 1 : machine ? 0.25 : thrownBy === 'player' ? 1/sqrt(n) : 0.25`. `g.volley` and every money line stay byte-identical. `release` marks gnomes as machine-fed. Pros: one rule in one line of `consume`; the ball pays the same whether thrown, released or lowered; money untouched by construction; no caller computes anything. Cons: one new field on `Gnome` (+ init, swap copy, clear), one field on `Player`; `n` counts every gnome that ever joined the hold (a ball topped up after slips pays a little less, never more). Cost: O(1) per gnome; the batch's only per-frame cost is the fan/belt limit: +10 `forEachNear` scans = about +0.13 ms with 320 gnomes, and about +60 draw calls with 10 fans + 10 belts (measured in D4, no code change). Risk: the roast's pre-mortem ("gun still finishes in 40 min while machines are 4x slower") is closed by C17 (one gnome per frame) and the F2 money loop by C18 (re-grab, before-file). Ladder: rung 6 for `xpGroup` (no existing helper knows the ball size at consume time; `volley` cannot carry it without changing money), rung 5 for weights, limits, `FEED_XP`, rung 1 for the slow-mo deletion, rung 2 for derived fuse caps and the smoke harness.

### Rejected variant(s)
- (b) v0 step 3, volley opened per frame on every drop: pros: zero new fields; cons: one group per slipped gnome, so a lowered ball of 20 pays about 20 XP (C17 fails at 60 fps) and the fresh volley plus stale `throwPos` pays 20 SNIPER bonuses (about $6 400 per pile at level 10); rejected because it does not handle the slip path at all.
- (c) `fedBy: 'hand' | 'volley' | 'machine'` written at every caller (night-features F1 shape): pros: explicit; cons: seven writers across six files for a rule that `thrownBy` plus one boolean already expresses; rejected because every new tool would have to remember it.
- (d) `drop` reads the ball size from `ctx.player.swarm.length` at drop time: pros: no new field; cons: the swarm shrinks as gnomes slip, so the last gnome sees n = 1 and a ball of 20 pays about 2*sqrt(20) = 8.9 XP instead of 4.5; also a reverse dependency from `gnomes.ts` to `player.ts`; rejected because the number is wrong by construction.

### Behaviour matrix (final)
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| A1 | hole level 4-9, day, event timer fires | draw | UFO share 5/24 = 20.8 % (about every 8.4 min) | PP 6b |
| A2 | hole level 10+, day, no King alive | draw | King 3/27 = 11.1 %, UFO 5/27 = 18.5 % | PP 6b |
| A3 | hole level 10+, night | draw | King 3/30 = 10 %, UFO 5/30 = 16.7 % | PP 6b |
| A4 | hole level 10+, a King is alive | draw | King out of the pool; UFO weight 5 | events.ts:29 |
| A5 | hole reaches level 10 (also a crate dump 9 -> 11), event timer held | level-up | one King 6 s later, always | PP "król zawsze na 10"; hole.ts:252 |
| A6 | hole below 4 / below 10 | draw | no UFO / no King | ufo-king.md |
| A7 | save already at level 10+ before this build, or the King was eaten | play | no second guarantee; the pool brings him about every 16 min | Decisions 10 |
| B1 | combo crosses 60 | eat | game dt stays `min(0.05, realDt)`; GNOMEGEDDON text, shake, sound stay | PP 7 |
| B2 | combo crosses 100 | eat | same, no slow-mo | PP 7 |
| B3 | the King is eaten | eat | no freeze, no slow-mo; money unchanged, XP 200 | PP 7; R3 |
| B4 | BULLSEYE | eat | no slow-mo (already true) | remove-trick-slowmo.md |
| B5 | Tab held (tool wheel open) | play | game at 0.25 while open, 1 within 0.3 s after release (kept) | Decisions 5 |
| B6 | legend opened (L) | read | no "Slow motion" section; `slowmo.ts` gone | PP 7 |
| C1 | hand throw (one gnome) falls in | eat | XP x1 | PP 10a |
| C2 | Magnet Gun volley of n thrown in | eat | x1/sqrt(n) each: n = 4 -> 0.5, n = 16 -> 0.25 (equal to a machine; n > 16 pays below a machine, Decisions 3) | PP 10a |
| C3 | hand throw helped by a tool (trampoline, belt toss, fan, magnet) | eat | x1 (still the player's throw, `thrownBy 'player'` kept) | Decisions 9 |
| C4 | gnome or a whole ball let go of over the hole (LMB release) | eat | hand x1; ball x1/sqrt(n) from the hold group | Decisions 7 |
| C5 | kick (F) | eat | x0.25; the kicked gnome stays a STRIKE ball | PP 10a "kopniak"; strike.md |
| C6 | ground pound (J) | eat | x0.25 | pound.ts:94 |
| C7 | plow tractor / leaf blower | eat | x0.25 (`thrownBy null`) | PP 10a "spych" |
| C8 | crate dump (also gnomes thrown into the crate) | eat | x0.25 each; CRATE DUMP bonus and money unchanged | PP 10a "skrzynia" |
| C9 | machine feeds a walker: fan, belt, wheel, cannon, trampoline, magnet | eat | x0.25 | PP 10a "maszyny" |
| C10 | vacuum / black hole on the spot, robot tip, also for a player-thrown gnome | eat | x0.25 (`machine = true`); money tricks for the thrown one unchanged | machines.ts:852, robots.ts:663 |
| C11 | gnome walks in by itself or an event pushes it (quake, tornado, UFO drop, STRIKE, Boom) | eat | x0.25 | Decisions 8 |
| C12 | the King, by any feeder | eat | 200 XP (exempt from the feed factor) | R3; Decisions 2 |
| C13 | Hole Hunger L5, Deep Hunger L2, hand throw | eat | +2.25 | hole.ts:147 |
| C14 | old save (holeXp 123.4, level 7) | load | unchanged; HUD `XP 123 / 900` | state.ts:73 |
| C15 | crate with 2 gnomes tipped over next to the rim (not dumped), gnomes roll in | eat | x0.25 each; no trick money even for a gnome sniped into the crate | R2 |
| C16 | crate / cannon taken back (inventory) spills its queue, a gnome rolls in | eat | x0.25 | R2 |
| C17 | ball of 4 lowered over the rim, gnomes slip one per frame; then 2 more join the same hold and slip | eat | 0.5 each for the first four (n = 4); 0.408 each for the two late joiners (n = 6) | R1 |
| C18 | ball of 20 thrown from 14 m, re-grabbed within the ragdoll window, lowered in | eat | money equal to today (old volley kept: SNIPER capped at 8, bonus once); XP 20 x 1/sqrt(20) | R1, R13 |
| C19 | gnome thrown from 8 m, kicked in mid-air, falls in | eat | x0.25; no LONG/AIR money (was paid today) | R6 |
| D1 | shop, Cooling Fan owned 4 | buy | 5th-10th at $2 606, $4 952, $9 409, $17 877, $33 966, $64 535; hotbar `n/10`; 10 placeable | PP "np z 10"; Decisions 4 |
| D2 | shop, Conveyor Belt owned 6 | buy | 7th-10th at $2 847, $4 271, $6 407, $9 610; 10 placeable | Decisions 6 |
| D3 | 10 fans + 10 belts + every tool at max, Fuses L5 | draw | 220 fuses / 44 boxes drawn, none skipped | machines.ts:49-50 |
| D4 | 10 fans + 10 belts, 300 gnomes | play | `machines.update` p95 <= 1.5 ms; draw calls with 0 and with 10 + 10 written to the note | perf review |
| D5 | old save with fan 4 / conveyor 6, blueprint with 4 fans | load | loads as before | blueprints.ts |
| E1 | two fans, saboteur hits fan A twice | sabotage | A 2 red fuses, B 0 | PP "fuzes osobno" |
| E2 | crate and panel | sabotage | never targeted, no fuses (stays) | Decisions 1 |
| E3 | robot | sabotage | own fuses on the truck | fuses.md |
| F1 | legend opened (L), Gnomes and Mechanics tabs | read | King card says 200 XP (true); "Hole levels" names the hand / volley / quarter rule | R4 |

### Steps (edit order)
1. `src/systems/events.ts:27` `weight: 1.5` -> `weight: 5` (ufo), `:29` `weight: 0.6` -> `weight: 3` (king), row comment `// PP 2026-10-20 6b`. Nothing else (`hole.ts:252` guarantee exists). Red test: step 8 `events` block, A1-A6.
2. Delete `src/systems/slowmo.ts`. `src/core/context.ts`: remove import (24) and `slowmo: Slowmo;` (58). `src/main.ts`: remove import (29), `ctx.slowmo = new Slowmo();` (100), the two comment lines 228-229 become one `// the open tool wheel slows the game; it damps on real time`, line 230 `const dt = realDt * ctx.player.wheel.slow(realDt);`, remove 265-266 (`ctx.slowmo.update(realDt)` and its comment). `src/ui/legend.ts`: remove line 61 (`slowmo:` text) and `${sec('Slow motion', 'slowmo')}` (247). Red test: B1-B6.
3. `src/entities/gnomes.ts`: line 32 `thrownBy: 'player' | 'machine' | 'kick' | null;`; after `volley` (line 41) add `xpGroup: { n: number } | null; // one Magnet Gun hold: every gnome of the ball shares it, XP x1/sqrt(n) (PP 2026-10-20 10a); null = hands`; init `xpGroup: null` next to `volley: null` (238); swap copy `n.xpGroup = g.xpGroup;` after line 287; `ragdoll(g: Gnome, seconds = rand(2.5, 4.5), by: Gnome['thrownBy'] = null)` (308); in `hold(g)` (318) add `g.xpGroup = null; // hands hold one; a re-grabbed ball member starts a fresh group`; in `release(g, pos, vel)` (352-362) replace `g.thrownBy = 'player';` with `// let out by a machine (crate tipped over, tool taken back, cannon): not a throw, as the crate dump (machines.ts dump branch)` + `g.thrownBy = 'machine'; g.throwPos = null; g.bounced = false; g.bullseye = false;`. `drop` untouched. Red test: C15, C16, C17.
4. `src/player/player.ts`: field after `swarm` (62) `private ballGroup: { n: number } | null = null; // XP group of the current Magnet Gun hold`; in the batch block (553-558): `if (batch.length) { if (!this.swarm.length) this.ballGroup = { n: 0 }; if (!this.holdsGnome) ctx.audio.whoosh(); for (const g of batch) this.swarm.push({ ... }); for (const g of batch) { this.grab(g); g.xpGroup = this.ballGroup; this.ballGroup!.n++; } }` (assignment after `grab`, because `hold` clears it); line 814 `ctx.gnomes.ragdoll(g, 3, 'kick');`. `src/player/pound.ts:94` `ctx.gnomes.ragdoll(g, rand(1.5, 2.5), 'kick');`. `src/systems/strike.ts:33` `if ((g.thrownBy !== 'player' && g.thrownBy !== 'kick') || g.state !== 'ragdoll') continue;` and `:39` `!((o.thrownBy === 'player' || o.thrownBy === 'kick') && o.state === 'ragdoll')`. `src/entities/machines.ts:833` delete `g.thrownBy = 'machine';` (now in `release`). Red test: C4, C5, C6, C17, C18, C19.
5. `src/systems/hole.ts`: after `VOLLEY_CAP` (34) `export const FEED_XP = 0.25; // XP for a gnome a machine, crate, robot, plow, blower or kick fed (PP 2026-10-20 10a); a hand throw pays x1, a Magnet Gun ball x1/sqrt(n); the King always pays his full XP (R3)`. Signature `consume(g: Gnome, at?: THREE.Vector3, machine = false): void` (85). Line 147 becomes two lines:
   `const feed = g.type.id === 'king' ? 1 : machine || g.thrownBy !== 'player' ? FEED_XP : 1 / Math.sqrt(g.xpGroup?.n ?? 1);`
   `const xp = g.type.xp * g.tier.value * feed * (1 + lvl('hunger') * 0.1) * (1 + deep('dXp') * 0.25);`
   Callers: `src/entities/machines.ts:651` `ctx.hole.consume(g, undefined, true);`, `:852` `ctx.hole.consume(g, m.type === 'blackhole' ? centre : undefined, true);`, `src/entities/robots.ts:663` `ctx.hole.consume(g, undefined, true);`. The `value` line (146) untouched. Red test: C1-C3, C7-C14.
6. `src/data/upgrades.ts:61` fan `max` 4 -> 10, `:62` conveyor 6 -> 10, comment `// PP 2026-10-20: "wiecej fanow np z 10 i raili"`. `src/entities/machines.ts:49-50`: `const FUSE_ABLE = UPGRADES.filter((u) => TOOL_IDS.includes(u.id) && u.id !== 'box' && u.id !== 'panel').reduce((s, u) => s + u.max, 0); // 44 fuse-able tools at max` / `const FUSE_CAP = FUSE_ABLE * UPGRADE_BY_ID.fuses.max; // 220` / `const BOX_CAP = FUSE_ABLE;` (import `UPGRADES`, `TOOL_IDS` from `../data/upgrades`; `upgrades.ts` imports nothing, no cycle). Red test: D1-D5, E1-E3.
7. Texts. `docs/SPEC.md`: line 11 "Zwykły gnom = 1 XP" -> "Zwykły gnom = 1 XP za rzut ręką; salwa Magnet Guna x1/√n na gnoma; maszyny, skrzynia, roboty, spych, dmuchawa i kopniak x0,25; król zawsze 200. Kasa bez zmian."; line 20 rewritten: "(PP, 2026-10-20, 10a) XP zależy od sposobu karmienia (rzut ręką x1, salwa x1/√n, reszta x0,25), bo automatyzacja i skrzynia kończyły grę w pół godziny, a ręce w pięć; kasa bez zmian. Kopnięty w locie gnom nie płaci już tricków (kopniak to nie rzut). Skrzynia przewrócona przy dziurze liczy jak zrzut: bez tricków, x0,25."; line 34 (Slow-mo) removed and replaced by "(PP, 2026-10-20) Żadnego zwalniania czasu: combo 60/100 i król już nie spowalniają gry, zostaje tylko koło narzędzi (Tab): „myślałem, że gra się zacina""; lines 46, 202, 212: drop the slow-mo words; "Narzędzia do postawienia": fan `max 10 (było 4)`, conveyor `max 10 (było 6)` + decision (PP "wiecej fanow np z 10 i raili"); Fuses line: "każda postawiona sztuka ma własne bezpieczniki (skrzynia i panel bez, bo sabotażysta ich nie atakuje)"; "Eventy i pogoda": "UFO i król losowani częściej (UFO ok. co 9 min od poziomu 4, król ok. co 16 min od 10) i król zawsze raz, 6 s po wejściu na poziom 10" + decision 6b. No minute range from the model anywhere (R8). `docs/PLAN.md:85-86` XP rule and limits. `src/ui/legend.ts:236` sentence after "Feed the hole to fill its XP bar.": "A hand throw pays a gnome's full XP, a Magnet Gun ball of n gnomes pays 1/√n each, and a machine, crate, robot, plow, blower or kick pays a quarter; the King always pays in full."; `src/data/holeLevels.ts:2` comment `(1 xp = 1 ordinary gnome thrown by hand)`. `CHANGELOG.md`: new top section with four bullets (UFO/King, no slow-mo, XP by feeding, 10 fans / 10 belts), each with a "Test:" sentence. `BOARD.md` (local): N8 and 6b/7/10a rows to "w kodzie, nie na 5300". Red test: B6, F1.
8. Scenario `tools/smoke/scenario-balance.js` printing one `RESULT {...}` with the keys of "Done when"; run: `npx vite --port 5199 --host 127.0.0.1`, `CDP_PORT=9420 MAXPOLL=2400 node tools/smoke/smoke.mjs balance-out tools/smoke/scenario-balance.js`, output folder deleted after reading. Setup per block: events `ctx.events['next'] = 1e9` before A5; B-lines sample `ctx.time` per frame; XP cases at `holeLevel = 11`, `holeXp` read before/after; C17 drops the ball members with `gnomes.drop(g)` on four consecutive frames (same path as the slip), then pushes two more through the real LMB batch path; C18 records money on the current code first (`balance-money-before.json`, scratchpad, one run before step 1; cases: crate2, vacuumThrown, regrabBall20); D4 reads `ctx.renderer.info.render.calls` with 0 and with 10 + 10 placed and the implementer writes both numbers into the ai-work note. If `tools/smoke/scenario-auto-lands.js` exists, change its `xpNeeded − 1` to `xpNeeded − 0.1` (R5). Red test: all lines below.

### Review focus
1. Ball lowered slowly at 60 fps (slips spread over more frames than the 5 fps headless run) → pinned by step 8 test C17 (one `drop` per frame, explicit, not physics-driven).
2. Re-grabbed thrown ball reopening the F2 money loop (stale `throwPos`) → pinned by step 8 test C18 (money equals the before-file).
3. Crate tipped just outside `holeRadius + 0.3` (tip branch, not dump) → pinned by step 3's test C15 (also asserts no SNIPER money for a gnome thrown into the crate from 14 m).
4. Ball topped up after slips shares the group (n grows, never pays more) → pinned by step 4's test C17 second half (n = 6).
5. Second King when the event timer fires inside the 6 s window → pinned by step 8's A5 setup (`events['next']` held); the behaviour itself is accepted (R9).

### Done when
- A1: `RESULT.ufoShareL6 = 0.208` (±0.002)
- A2: `RESULT.kingShareL10 = 0.111`, `ufoShareL10 = 0.185`
- A3: `kingShareL10night = 0.1`, `ufoShareL10night = 0.167`
- A4: `kingInPoolWhileAlive = false`, `ufoWeightWhileKingAlive = 5`
- A5: `kingAfterLevel10 = 1` (within 7 s, `events['next']` held) and `kingAfter9to11 = 1`
- A6: `ufoInPoolL3 = false`, `kingInPoolL9 = false`
- A7: `grep -n "setTimeout" src/systems/hole.ts` → exactly the one line (no new guarantee)
- B1: `combo60.dtMin = 0.05`, `combo60.dtMax = 0.05` (`ctx.time` delta per frame over 30 frames, wheel closed, ±1e-6)
- B2: `combo100.dtMin = 0.05`, `combo100.dtMax = 0.05`
- B3: `kingEaten.dtMin = 0.05`, `kingEaten.dtMax = 0.05`, `kingEaten.xp = 200`
- B4: `bullseye.dtMin = 0.05`
- B5: `wheel.timeScale = 0.25` while open, `1` within 0.3 s after release
- B6: `legendHasSlowmo = false` and `ls src/systems/slowmo.ts` → `No such file`
- C1: `xp.hand = 1`
- C2: `xp.volley4 = 0.5` per gnome (sum 2), `xp.volley16 = 0.25`
- C3: `xp.trampolineThrow = 1`
- C4: `xp.handDrop = 1`, `xp.ballRelease4 = 0.5` per gnome
- C5: `xp.kick = 0.25`, `strike.kickBallCounted = true`
- C6: `xp.pound = 0.25`
- C7: `xp.plow = 0.25`, `xp.blower = 0.25`
- C8: `xp.crate2 = 0.5` (two gnomes), `money.crate2` equals the before-file
- C9: `xp.fanWalker = 0.25`
- C10: `xp.vacuumThrown = 0.25`, `xp.robotTip = 0.25`, `money.vacuumThrown` equals the before-file
- C11: `xp.walkIn = 0.25`
- C12: `xp.kingByFan = 200`
- C13: `xp.handHunger = 2.25`
- C14: `load.holeXp = 123.4`, HUD text `XP 123 / 900`
- C15: `xp.crateTip2 = 0.5` (two gnomes), `money.crateTipSniper = money.plain` (gnome thrown into the crate from 14 m, crate tipped at the rim: no SNIPER, no bonus)
- C16: `xp.toolRemoveSpill = 0.25` (cannon taken back with one gnome queued, gnome rolls in)
- C17: `xp.ballLowered4 = 0.5` per gnome (four `drop` calls on four frames), `xp.ballToppedUp6 = 0.408` per late joiner (±0.002)
- C18: `money.regrabBall20` equals the before-file, `xp.regrabBall20 = 0.224` per gnome (±0.002)
- C19: `xp.kickedMidAir = 0.25`, `money.kickedMidAir = money.plain` (no LONG, no AIR)
- D1: `shop.fanPrices = [2606, 4952, 9409, 17877, 33966, 64535]` (rounded), `hotbar.fan = "10/10"` after buying, `placed.fan = 10`
- D2: `shop.conveyorPrices = [2847, 4271, 6407, 9610]`, `placed.conveyor = 10`
- D3: `fuses.count = 220`, `fuses.boxes = 44`, `fuses.skipped = 0`
- D4: `perf.machinesP95 <= 1.5` ms with 300 gnomes, `LOGS:` empty, `perf.drawCalls0` and `perf.drawCalls20` present in RESULT and copied into the ai-work note
- D5: `oldSave.fan = 4`, `blueprint.placedFans = 4`
- E1: `fuses.fanA = 2`, `fuses.fanB = 0`
- E2: `saboteur.targetWithOnlyCrateAndPanel = null`
- E3: `fuses.robotBlown = 1`
- F1: `legend.kingCard` contains `200 XP`, `legend.xpRule` contains `quarter`
- All: `npx tsc --noEmit` → exit 0; `grep -rn "slowmo" src` → nothing; `grep -rn "thrownBy = 'player'" src` → exactly one line (`gnomes.ts` `drop`)

### Decisions for PP
1. [spec silent] „Wszystkie narzędzia mają fuzes osobno": dziś każda postawiona sztuka ma własne bezpieczniki, wyjątek to skrzynia i panel (sabotażysta ich nie atakuje). Zakładam: bez zmian w kodzie, tylko zapis w SPEC | Dowód: `machines.ts:38,47,478` | Jeśli źle: PP chciał b) osobnego zakupu Fuses dla każdego typu narzędzia (9 pozycji w sklepie) albo c) bezpieczników też na skrzyni i panelu (musiałby je ktoś psuć) | Pewność: Unclear | rekomendacja: a) bez zmian.
2. Król a XP: króla nie da się nakarmić ręką (gun, pound, spych i dmuchawa go pomijają), więc wg samej reguły 10a zawsze dawałby 50 XP zamiast 200 (2 % paska na poziomie 10 zamiast 8 %). a) król zawsze 200 XP, niezależnie od tego, co go wepchnęło (tak buduję teraz) b) król x0,25 jak każdy gnom od maszyny, czyli 50 (jedna linia). (rekomendacja: a, bo 10a mówi o ścieżkach karmienia, a nie o nagrodzie za bossa; legenda pokazuje 200)
3. Salwa Magnet Guna x1/√n spada poniżej x0,25 od 17 gnomów: kula z Coil 5 (71 gnomów) daje 8,4 XP, te same 71 ze skrzyni 17,75. a) wzór zostaje jak w 10a (tak buduję teraz) b) podłoga x0,25: rzut kulą nigdy nie płaci mniej niż maszyna (jedna linia `Math.max`). (rekomendacja: a, bo PP wybrał wzór widząc n, a tempo na kulę wychodzi podobne do automatu)
4. Ceny wentylatorów 5-10 przy obecnym wzroście x1,9: $2,6k, $5k, $9,4k, $17,9k, $34k, $64,5k (10. wentylator droższy niż Mini Black Hole $50k). a) zostaje: wtedy ostatnie wentylatory kupuje się dopiero pod koniec gry (zgodne z N3 „droższe najwyższe levele"); b) wzrost x1,5: wtedy 10. wentylator kosztuje $7,7k i komplet jest przed poziomem 6. (rekomendacja: a)
5. [spec silent] Kiedy gracz trzyma Tab (koło narzędzi), wtedy gra zwalnia do 1/4 na czas wyboru. Zakładam: zostaje | Dowód: `src/player/wheel.ts:17,35` (osobny mechanizm, nie efekt po akcji) | Jeśli źle: gracz wybiera narzędzie w pełnym tempie, gnomy uciekają w trakcie | Pewność: Likely | rekomendacja: a) zostaje (koło to menu, nie „zacięcie"); b) usunąć też: krok 2 dodatkowo `wheel.slow` → `main.ts` `const dt = realDt;`.
6. [spec silent] „raili" = Conveyor Belt. Zakładam: limit taśm 6 → 10 | Dowód: `src/data/upgrades.ts:62`, jedyne narzędzie z szynami; `machines.ts:153` "side rails" | Jeśli źle: PP chciał czegoś innego i taśm dalej jest 6 | Pewność: Likely | rekomendacja: a) taśmy do 10.
7. [spec silent] Kiedy gracz puszcza gnoma nad dziurą bez rzutu, wtedy liczy się jak karmienie ręką: x1; kula z Magnet Guna puszczona albo opuszczona powoli nad dziurę liczy x1/√n (grupa przypięta do chwytu, nie do klatki). Zakładam: tak | Dowód: `gnomes.ts:346` (`drop` zawsze daje `thrownBy 'player'`), `gnomes.ts:481-484` (gnomy zsuwają się po jednym na klatkę) | Jeśli źle: a) puszczenie liczone x0,25 karze najwolniejszą ścieżkę; b) bez grupy kula 20 gnomów opuszczona nad dziurę dałaby 20 XP zamiast 4,5 | Pewność: Likely | rekomendacja: a) jak w planie.
8. [spec silent] Kiedy gnom sam wejdzie do dziury (wściekły, parada, trzęsienie, tornado, UFO go upuści, STRIKE go wepchnie, wybuch Boom), wtedy x0,25. Zakładam: wszystko, czego gracz nie rzucił ręką, to x0,25 | Dowód: `gnomes.ts:621` (`standUp` zeruje `thrownBy`), `events.ts:336` | Jeśli źle: STRIKE (trik gracza) płaci XP jak maszyna | Pewność: Likely | rekomendacja: a) x0,25; STRIKE i tak płaci kasą.
9. [spec silent] Rzut ręką, któremu pomogło narzędzie po drodze (trampolina, taśma, wentylator, magnes), liczy x1 jak trick; rzut zjedzony przez wieżę ssącą / czarną dziurę / robota liczy x0,25. Zakładam: tak | Dowód: `machines.ts:719,764` (rzut gracza zachowuje `thrownBy` przez trampolinę i taśmę), `machines.ts:852`, `robots.ts:635` | Jeśli źle: rzut na trampolinę obok dziury daje pełny XP przy pół-automacie | Pewność: Likely | rekomendacja: a) jak w planie.
10. [spec silent] Kiedy zapis jest już na poziomie 10+ (albo król został zjedzony), wtedy nie ma drugiej gwarancji; król wraca z losowania ok. co 16 min. Zakładam: tak | Dowód: `hole.ts:252` (tylko moment awansu) | Jeśli źle: gracz po przeładowaniu na poziomie 10 czeka na króla do kwadransa | Pewność: Likely | rekomendacja: a) bez kodu.
11. Kasa za gnoma rzuconego z 14 m, złapanego z powrotem i doniesionego nad dziurę: dziś płaci SNIPER, bo `throwPos` nie znika przy chwycie. a) zostaje jak dziś („kasa bez zmian", tak buduję teraz) b) chwyt kasuje `throwPos`: doniesiony gnom płaci bez tricków (jedna linia w `hold`). (rekomendacja: a, bo to dzisiejsze zachowanie i 10a nie dotyka kasy)
12. [spec silent] Skrzynia przewrócona tuż przy dziurze (nie zrzucona do niej) i narzędzie zabrane do ekwipunku wypuszczają gnomy jak maszyna: x0,25 i bez tricków, nawet dla gnoma, którego gracz wrzucił do skrzyni z 14 m. Zakładam: tak | Dowód: `machines.ts:646-648` zrzut ze skrzyni już kasuje tricki („dumped, not thrown"), a przewrócenie (`:665`) tego nie robiło, przez co 60 gnomów płaciło x1 i SNIPER | Jeśli źle: przewrócona skrzynia zostaje drugą furtką do pełnego XP i tricków | Pewność: Likely | rekomendacja: a) jak w planie.

### v0 → final
- added: `xpGroup` per Magnet Gun hold (steps 3-4) in place of the per-frame volley on drops; `release` marks gnomes machine-fed and clears tricks (step 3) and the cannon's own override goes; the King is exempt from the feed factor (step 5); legend / `holeLevels` / SPEC lines 11, 20, 46, 202, 212 (step 7); D4 draw-call reading; matrix rows C15-C19, F1 (35 → 41 rows, Done-when 41 + All).
- dropped: v0 step 3 volley block move (money exploit F2 would return); the model's "33-69 min" range from SPEC and CHANGELOG; v0 C12 "by hand 200" (unreachable).
- moved to PP: King XP (2), 1/√n floor (3), carry-in SNIPER money (11), crate-tip rule (12); v0's eight open items kept in their format (1, 4-10).
- sequencing: auto-lands scenario `02_levelup_garden` must use `xpNeeded − 0.1`; whichever plan lands second edits that line (step 8 conditional).
