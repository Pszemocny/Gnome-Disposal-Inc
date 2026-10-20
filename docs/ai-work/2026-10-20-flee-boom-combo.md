# Fleeing gnomes, Boom Gnome, combo burst (2026-10-20)

Board items Hub 5, Hub 6, Hub 3. Plan: the orchestrator's final plan in the night task (PP asleep, value decisions are mine and listed below).

Gotowe, gdy (headless, from the plan):
1. A walking gnome 3 m from the player: its distance to the player grows over 2 s; a massive one moves at most 60% as fast as a normal one; a statue does not move.
2. 1000 rolled spawns at hole level 3: boom gnomes between 0.5% and 3%; none at hole level 1.
3. A boom gnome eaten with 5 gnomes standing within 3 m of the hole edge: each moves >= 2 m outwards within 1 s, a burst and a shake happen, no exception, no gnome body touched after removal.
4. Eat burst count at combo 30 >= 2x the count at combo 1.
5. Regression `scenario15-wait.js`, `scenario-golden.js` pass; no exceptions; `npx tsc --noEmit` clean.

## Problem

- Hub 5: walking gnomes ignored the player; PP wanted them to walk away when the player comes close, heavy ones and the king slower.
- Hub 6: only one rare gnome (golden). A new rare gnome should blow its neighbours away when the hole eats it.
- Hub 3: the eat burst had 14 particles at every combo, so a big combo did not look bigger.

## Summary

Fleeing (`src/entities/gnomes.ts`, numbers in `src/data/gnomeTypes.ts` `FLEE` and `WeightTier.flee`):
- Every walking gnome has a `scared` timer. When the player is closer than 4 m it is set to 2 s. Between 4 and 6 m it stays. Further than 6 m it counts down, so the gnome calms down 2 s after the player left the 6 m circle.
- While scared, the default branch of `decide()` (the wander branch) sets a walk target 6 m straight away from the player, clamped inside the fence like the existing golden flee. The existing hole push in the walk code still keeps them out of the hole. No pathfinding.
- Flee speed = type speed x 1.3 x weight class (normal 1, heavy 0.75, massive 0.55); the king x 0.4.
- Who does not flee: statues, ragdolls, held, stashed and falling gnomes (they never run `decide()`); parade gnomes (parade returns first); golden and dwarf gnomes (their own `flee` behaviour returns first, so they keep their own speed); greedy gnomes that chase a coin or run off with loot (return before the default branch); angry gnomes (they charge the player, that is their job; excluded by name); the shadow gnome (stalk returns). Saboteurs and wizards flee when they have nothing else to do.
- The king: while scared he backs off at 0.4 x 1.3 x 1.0 = 0.52 m/s and still stomps when the player is within 9 m.

Boom Gnome (`src/data/gnomeTypes.ts`, `src/entities/gnomes.ts`, `src/systems/hole.ts`, `src/world/models.ts`):
- New type `boom`, "Boom Gnome": red hat with two black bands, a brown fuse and an orange spark on the tip, dark shirt. Value 3 (x3 a classic), XP 2, walks like a classic (awake, not a statue, so the player sees it move). Capacity 30.
- Rarity: `BOOM_CHANCE = 0.015`, from hole level 2 (`unlock: 2`). It is rolled before the normal pool in `pickSpawnType` (factory) and in `pickSpecialType` (rain); the rain loop skips it, otherwise it would be about 10 % of the rain (it would take its share among the few special types).
- Never in parades: the parade makes classic/blue gnomes in the factory, and the recruit filter in `src/systems/events.ts` now skips `boom` (one condition, see Odstępstwa).
- When eaten (`Hole.consume`, after `gnomes.remove`): `audio.impact(1, 6)` + `audio.rumble(0.6)` (low bang), `fx.shake(0.3)`, three bursts (orange 30, yellow 24, smoke 20). Every free gnome (not held, stashed, falling, not the king) within 4 m of the hole edge is collected first, then turned to ragdoll for 2-3 s and given 8 m/s outwards and 6 m/s up plus a random spin. Eaten by a black hole machine (`consume(g, at)`): the same blast centred on the machine, radius 4 m.
- Only when eaten; a kick does not set it off (plan).

Combo burst (`src/systems/hole.ts`):
- Eat burst count `n = round(14 x (1 + 1.5 x min(1, (combo - 1) / 29)))`: 14 at combo 1, 35 from combo 30. Above 30 it is split into two bursts of equal size (the second 0.3 m higher), so no single event has more than 30 particles (Animation rule 6).

Value decisions (mine, PP asleep):
1. Flee radius 4 m, calm radius 6 m, calm time 2 s, flee speed x1.3, tier factors 1 / 0.75 / 0.55, king 0.4 (all from the plan).
2. Angry gnomes do not flee (the plan did not list them; fleeing would kill their charge).
3. The king flees slowly but keeps stomping (the plan lists the king at 0.4).
4. Boom Gnome: value 3, XP 2, awake walker, capacity 30, 1.5 % from hole level 2, blast 8 m/s out + 6 m/s up, shake 0.3, three bursts.
5. During Golden Hour a Boom Gnome turns golden like every other gnome; a golden one does not explode (it is a golden gnome then) and turns back into a Boom Gnome when the event ends.

Drabina: shelf 2. Reused the golden flee target code shape, `forEachNear` + collect-then-push from the level-up shockwave, `ragdoll`, `ctx.fx.burst/shake`, existing audio calls (`impact`, `rumble`), the existing type/geometry tables. New code only for the scared timer, the boom roll and the blast.

Odstępstwa:
- `src/systems/events.ts` is not on the owned list: one condition in the parade recruit filter (`g.type.id !== 'boom'`), because the plan says "never in parades" and the recruit filter is the only place that puts yard gnomes into a parade. No other agent owns that file.

Odrzucone:
- Bigger particle size at high combo: the plan asks for count only; the particle size is random per particle in `ParticlePool.emit` (`src/systems/fx.ts`, not my file).
- Explosion on a hard kick: the plan says only when eaten.
- Calling `fleeFrom` from the golden/dwarf `flee` case to remove the duplicate 2 lines: it would also apply the x1.3 flee speed to them, and the plan says golden keeps its own flee.

## Work progress

- `npx tsc --noEmit` → no output (clean).
- `grep -n "Math.min(1, dt" src` → only lines that existed before this task.
- Scenario `<scratchpad>/smoke/scenario-flee-boom.js`, run `CDP_PORT=9374 MAXPOLL=2400 node smoke.mjs run-flee-boom2 scenario-flee-boom.js`. Result (second run, first run gave the same picture):
  - normal walker 3.06 m from the player → 5.69 m after 2 s, distance every 0.2 s `[3.31, 3.56, 3.81, 4.06, 4.31, 4.56, 4.82, 5.07, 5.38, 5.69]`, 1.32 m/s; 2.6 s after the player went 16 m away: `scared 0, fleeing false`.
  - heavy 0.83 m/s, massive 0.61 m/s → massive / normal = 0.46 (≤ 0.6). Measured speeds are lower than type speed x 1.3 because ground friction takes the same speed off every walker each step (existing walk code), so slow walkers lose a bigger share.
  - statue: moved 0.01 m, state `statue`.
  - golden: own flee, 3.16 m/s, `fleeing false` (not the new flee).
  - 1000 rolls: hole level 3 factory 15 (1.5 %), rain 12 (1.2 %); hole level 1: 0 and 0. First run: 14 and 18.
  - boom eaten through the real fall into the hole, 5 statues 2 m outside the edge (3.6 m from the centre): moved outwards `[5.9, 5.6, 5.8, 6.3, 5.04]` m within 1 s, all `ragdoll`; held gnome next to them moved 0 and stays `held`; boom gnome no longer in the list; bursts `[d01818 x14, ff7a1a x30, ffd23f x24, 1a1a1a x20]`; shakes `[0.3]`; radial distance of the first gnome per frame `[4.4, 4.79, 5.18, 8.61, 8.85, 9.04, 9.14, 9.24, 9.34, 9.43, 9.5]` (headless runs at about 5 fps); no exceptions in the log.
  - combo burst: combo 1 → `[14]` = 14; combo 30 → `[18, 18]` = 36; combo 60 → 36; ratio 2.57.
  - Screenshots checked by eye: `run-flee-boom2/10-boom-hat.png` (red hat with two black bands, fuse with an orange spark, readable), `run-flee-boom2/11-boom-peak.png` (gnomes thrown off around the hole, smoke on the grass).
- Regression `scenario15-wait.js` (`run-fb-reg15`): all steps as before except `arc_green_when_aimed_at_hole` `{"greenAtPitch":null,"eatenAfterGreenThrow":0}` and `massive_lifts_at_base.arc: false`. Cause in the current code: `src/player/player.ts` shows the throw arc only with `scopeT > 0`, i.e. with the Trick Scope upgrade (`2026-10-20-scope-and-placement.md`, item 3), and the scenario does not buy it. A copy with `g.state.upgrades.scope = 1` (`zz-scenario15-scope.js`, `run-fb-reg15s`) passes every step: `arc_green {"greenAtPitch":0.05,"eatenAfterGreenThrow":1}`, `parade_uses_factory {"produced":16,"parading":16}`, `rain_only_specials` has no classic/blue (one boom among 43). No exceptions.
- Regression `scenario-golden.js`: the first run hung on a dev server reload (no RESULT, only the title screenshot); rerun once (`run-fb-golden2`): `goldenFree 51 / freeNonKing 51`, held and stashed unchanged, factory during the event 4/4 golden, `value_100x golden 168` vs `classic 1.68`, after the end `leftWithGoldFrom 0`, natural golden still golden. No exceptions.

Kompletność:
- [PASS] 1. walking gnome 3 m away flees, massive ≤ 60 %, statue still — `run-flee-boom2` → normal 3.06 → 5.69 m in 2 s; massive/normal 0.46; statue moved 0.01 m.
- [PASS] 2. 1000 rolls at hole level 3: 0.5-3 %, none at level 1 — `run-flee-boom2` → 15 (1.5 %) factory, 12 (1.2 %) rain; level 1: 0, 0.
- [PASS] 3. boom eaten next to 5 gnomes: each ≥ 2 m outwards within 1 s, burst, shake, no exception — `run-flee-boom2` → moved 5.04-6.3 m, bursts x3 + eat burst, shake 0.3, LOGS empty, boom out of the list.
- [PASS] 4. eat burst at combo 30 ≥ 2x combo 1 — `run-flee-boom2` → 36 vs 14 (2.57x), split 18 + 18.
- [PASS] 5. regression + tsc — `run-fb-reg15s` all steps pass (plain `scenario15-wait.js` fails only the two arc checks, cause: Trick Scope now required, not this change); `run-fb-golden2` passes; `npx tsc --noEmit` → no output.
