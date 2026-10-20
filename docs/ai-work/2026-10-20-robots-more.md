# More cleaning robots, dangerous and still gnomes first (2026-10-20)

Interpretation: PP: "3 chodzi mi o te roboty sprzatajace super to wyglada niezle jezdzi, ale jest ich za malo", earlier: they should protect tools from saboteurs. Then: "do planu pracy robota dodaj jakies ustawienie aby mogl priorytetyzowac jeden typ krasnali albo po prostu niech priorytetyzuje te grozne. Dodatkowo niech priorytetyzuje te co dluzej leza bez ruchu". Built the simple variant the orchestrator chose: no per-robot setting, a fixed order. The task started as "Vacuum Tower too weak"; that was a misunderstanding, the vacuum code was measured only and never edited.

## Gotowe, gdy

(Written when the task changed to robots; the first robot edit came after the red run.)
1. `scenario-robots-more.js`, 60 game s, hole level 10, 150 gnomes + factory, 21 saboteurs walking in, 3 tools with the robot posts around them → breaks with 12 robots lower than the red run with 4 (red: 12).
2. `tmp-sabfirst.js` → `first: saboteur` (saboteur 5 m, ordinary gnome 2 m), `switch: classic → saboteur`, `stillFirst: B (still 6 s)` (B 5.5 m, A 2 m), `twoRobots: r1 c1, r2 c2`.
3. Cost: `cost_replan_12` (12 robots, 320 gnomes) `machines.update` p95 ≤ ~1 ms, also with all robots replanning on one frame; hole jam 0 s with 12 robots.
4. Regression `scenario-robots.js`, `scenario-robots-avoid.js`, `zz-scenario15-scope.js` as in their notes; `npx tsc --noEmit` exit 0.

## Problem

Red run (`run rm-before`, code before this change):
- 4 robots: 12 breaks in 60 s, all of them robots. The three tools in the middle were never broken: a saboteur walks to the nearest working tool, and the robot posts stand around the tools, so the posts get broken first. A broken robot stands still for 30 s. 30 saboteurs picked, 156 gnomes eaten by robots.
- 12 robots (old targeting, limit lifted in the test only): 5 breaks, 246 eaten.
- Cause in the code: `findGnome` took the nearest gnome of any kind, and a truck already driving to an ordinary gnome never looked again until it picked it. The limit was 4 robots at $400 x1.6.

## Summary

`src/entities/robots.ts`:
- Target order inside the work area: (1) Saboteur, (2) Greedy, Shadow, Wizard, Angry, (3) the rest. Then the gnome lying still longest, counted in 5 s steps; within a step, the nearest. One score per gnome during the existing 0.5 s scan, no sort.
- Why these types: Saboteur breaks tools (the reason for the request, so it ranks above the others). Greedy steals coins and runs off with the money. Shadow takes 5 % of the money after 45 s. Wizard throws up to 8 gnomes away from the hole. Angry knocks the player back and kicks gnomes around. Not Boom: it only harms when the hole eats it, a robot cannot prevent that. The King stays excluded as before.
- "Lying still": a `WeakMap` in robots.ts keeps where each gnome came to rest and since when. It is updated during the scans; a gnome that moves more than 0.5 m from that spot starts again at 0. It lives in robots.ts, so `gnomes.ts` (other agent, `state 'gone'`) is untouched.
- A truck chasing a less dangerous gnome keeps scanning every 0.5 s and switches when a more dangerous one is in its area. It no longer resets its detour count on every scan (only when the target changes).
- Two robots do not chase the same gnome when another one is there: a gnome another robot already targets scores last. Saboteurs are excepted, every robot near one goes for it. With the exception on as well, 12 robots gave 6 and 7 breaks (`rm-final4/5`): the one robot chasing a saboteur was often far away while it walked up to another robot's post.

`src/data/upgrades.ts`: Cleaning Robot max 4 → 12, growth x1.6 → x1.3. Prices 400, 520, 677, 879, 1143, 1486, 1931, 2510, 3263, 4242, 5515, 7169. The first 4 cost $2,476 (was $3,702), all 12 cost $29,735, about the Vacuum Tower pair ($8k + $20k). The 12th robot costs less than one Vacuum Tower. PP: "Niech nie będą super drogie". Description gets one line: "Takes dangerous gnomes first (saboteurs top), then those lying still longest." The legend Tools tab shows the same text. `docs/PLAN.md` robot line updated.

Why 12: 8 robots gave 3 breaks, 12 gave 0-2 (table below). Twelve also eat about 1.7x what 4 eat, with no jam at the hole.

Ladder: rung 2 for everything (the scan, `forEachNear`, `ctx.machines.list`, the upgrade table). The rest map is rung 6, a few lines: nothing in the repo tracks how long a gnome lies still.

Rejected:
- Per-robot priority setting (UI): PP allowed the simple fixed order, the orchestrator chose it.
- Staggering replans: with all 12 robots forced to replan on the same frame, p95 is 0.6-1.0 ms. Scans and replans run on timers that start at different moments, so a real all-at-once frame is rare. Nothing to add.
- Robots immune to saboteurs: not asked; a saboteur breaking a post is now the measured failure, and the fix is catching it earlier.
- Vacuum Tower: no change (wrong item). Its red run, kept for the record: 1 vacuum, 0 breaks in 60 s, 0.42 eats/s; `machines.update` 0.27 ms with 2 vacuums and 320 gnomes, 0.32 ms with 4.
- Offline payout (`offline.ts`) does not count robots; unchanged, not asked.

## Work progress

Scenarios in `<scratchpad>/smoke/`: `scenario-robots-more.js` (guard + cost), `zz-robots-more-n.js` (4/8/12), `tmp-sabfirst.js` (order checks). All runs `CDP_PORT=9398`, rendering off between steps, about 60 fps game time.

Breaks in 60 s (all of them robot posts, the tools in the middle were never broken), saboteurs picked, gnomes eaten by robots:

| Run | 4 robots | 8 robots | 12 robots |
|---|---|---|---|
| before (`rm-before`) | 12 breaks, 30 sab, 156 eaten | | 5, 33, 246 |
| saboteur first, 12 max (`rm-after`, `rm-after2/3`) | 3 / 1 / 1 breaks | 3 | 2 / 0 / 1 |
| final, full order (`rm-final6`, `rm-final7`) | 1, 28, 85 / 2, 25, 85 | | 2, 32, 215 / 0, 29, 234 |

The breaks that are left come from saboteurs that appear 1-2 m from a post. The debug run (`tmp-rm-dbg.js`) showed one with `sabLife 1` s and 7 trucks already driving to it. No truck can get there in under a second. With 4 robots the final order eats fewer gnomes than "saboteur first" (85 vs 109-169). The trucks now drive for still gnomes and dangerous types across the area instead of the nearest one; with 12 robots the eat rate stays at 215-262.

Kompletność:
- [PASS] 1 — `rm-final6`: `guard_12 breaks 2`, `rm-final7`: `guard_12 breaks 0` (red: `guard_4 breaks 12`).
- [PASS] 2 — `rm-sabfirst2` → `{"first":"saboteur","switch":{"before":"classic","after":"saboteur"},"stillFirst":{"distA":2,"distB":5.5,"picked":"B (still 6 s)"},"twoRobots":{"r1":"c1","r2":"c2"}}`. In `twoRobots`, r2 is nearer to c1 (2.7 m vs 3.0 m), so without the rule it would pick c1.
- [PASS] 3 — `rm-final6`: `cost_replan_12 normal p95 0.5 max 1.1, allReplanSameFrame p95 0.9 max 1.0`; `rm-final7`: `normal p95 0.5, allReplanSameFrame p95 1.0 max 1.0`; `jamMaxS 0` in every run with 12 robots (longest drive to the hole 4.7-8.9 s). The 60 s runs show single spikes up to 3-5 ms in `max` (p95 0.4); the red run had 3.5 ms too.
- [PASS] 4 — `rm-reg2-scenario-robots`: c1 0.68 s, c2 tFull 4.28, minHoleDist 2.86 ≥ 2.6, c10/c15/c16 as in `final3-robots.txt`, `LOGS:` empty. `rm-reg2-zz-scenario15-scope`: same values as `run-avoid-reg15b`. `scenario-robots-avoid`: tramp 31.97 s, eaten 4, stall 0.33, contact 0.03, tools moved 0; wall 9.67 s, eaten 5. perf step in three runs: p95 0.3-0.5 ms, eaten 13, tools moved 0 / 0.19 / 0.21 m (see below). `npx tsc --noEmit` → exit 0.

Self-check: diff is `robots.ts` (order, rest map, switch, no double chase), `upgrades.ts` (one line + comment), `docs/PLAN.md` (one line), this note. No new motion, no body changes inside a query callback. `grep "Math.min(1, dt" src/entities/robots.ts` → nothing.

Uncertain: in the avoid `perf` step a crate moved 0.19-0.21 m in 2 of 3 runs (0 in the avoid note). Robots now spread over different gnomes, so a truck touches a crate more often. The avoid note already accepts that a truck can shove a crate it touches (crate dominance, `machines.ts`).

## Follow-up bug: robots chase gnomes in the air (2026-10-20)

Interpretation: PP: "roboty nie moga triggerowac sie na gnomach ktore sa w powietrzu bo teraz jezdza w kolko, triggeruja sie tylko na gnomach ktore chodza / leza na ziemi". A robot picks and keeps only gnomes that walk or lie on the ground. Thrown, bouncing and launched gnomes are not targets until they land. Only `src/entities/robots.ts` changes.

Gotowe, gdy (written after the red run, together with the first edit):
1. `scenario-robots-air.js` p1 (gnome A kept above 1.8 m, 3 m from the post; gnome B on the ground 4.5 m away, 10 s) → `airTargetS 0`, B picked, `turnRad` far below the red run.
2. Same scenario p2 (A stops flying and lies still) → A picked; p3 (a thrown gnome flies over the post) → `flightFramesTargeted 0`, picked after it lands.
3. Regression `scenario-robots.js`, `scenario-robots-avoid.js`, `scenario-robots-more.js`, `../alias/scenario-aliasing.js` as before; `npx tsc --noEmit` exit 0.

Cause in the current code: `findGnome` and the target check only ask `isFree` (not held, stashed, falling or gone). A thrown or bouncing gnome is a free `ragdoll`, so it is a valid target at any height. The truck drives to the point under it, the scoop needs the gnome below truck height + 1.3 m, so it never fires, and the truck turns on the spot under the gnome. A juggled gnome also does not move sideways, so the "lying still longest" order even ranks it first.

Fix: `onGround(g, gp)` in `robots.ts`: height below `1.2 × scale` (the height `gnomes.ts` lets a ragdoll stand up from) and vertical speed below 3 m/s. `findGnome` skips gnomes that fail it; a current target that fails it is dropped (no skip), so the truck goes back towards its post and the next 0.5 s scan takes a ground gnome or the same gnome once it has landed. Dropping was chosen over waiting under the gnome: waiting still needs a guess where it lands, and dropping reuses the existing "target gone" branch in one condition. Held gnomes and the Magnet Gun ball were already excluded (`hold` sets state `held`, `forEachNear` skips it). Priority order (danger, still time, distance) and A* are untouched.

Why 3 m/s, not 1.5: with 1.5 the test gnomes spawned 0.16 m above their resting height (falling at up to 1.98 m/s) were dropped for 0.5 s, and `scenario-robots.js` moved (c1 0.68 → 1.42 s, c15 speed 3.7 → 2.71). 3 m/s is a drop of about 0.45 m; a trampoline launch is 7.8 m/s, a walker counts as hit at 3.5 m/s (`gnomes.ts`).

Ladder: rung 2 (the `1.2 × scale` height from `gnomes.ts`, the existing drop-target branch); one helper line, rung 5.

Rejected:
- Reading `g.touchedGround` or a grounded flag from `gnomes.ts`: `touchedGround` is only kept for player throws, and there is no grounded flag; adding one means editing `gnomes.ts` (other agent).
- Gnomes lying on top of a tool (trampoline pad, crate) below 1.2 m still count as on the ground, as before; not asked.

Work progress (all `CDP_PORT=9394`, scenarios in `<scratchpad>/smoke/`):
- Red `air-red3`: p1 `targetTime A 9.33 s of 10, airTargetS 9.33, turnRad 76.1, pathM 6.3, B not picked`; p3 thrown gnome `flightFramesTargeted 52 of 61`. (First red run `air-red` kept A low enough to be scooped mid-air: target A 1.17 s in the air, picked in flight.)
- Green `air-fin-scenario-robots-air` (final code): p1 `targetTime B 1.27, A 0, airTargetS 0, turnRad 7.7 (incl. the drive to the hole), pathM 15.7, B stashed`; p2 `A targeted 3.88 s after landing, A stashed`; p3 `flightFramesTargeted 0, picked 2.4 s after the throw`.
- Own bug found by `scenario-aliasing.js` (`air-reg2-alias`): the first version read the target's body before `isFree`, so a gnome eaten while targeted threw `RuntimeError: unreachable` (201 exceptions). Fixed by keeping `isFree` first in the condition; `air-reg3-alias` → `staleTargets 0, exceptions 0`.
- [PASS] 1 — `air-fin-scenario-robots-air` p1 above (red 76.1 rad → 7.7 rad, air target 9.33 s → 0).
- [PASS] 2 — same run, p2 `A stashed`, p3 `flightFramesTargeted 0, C stashed`.
- [PASS] 3 — `air-fin-scenario-robots`: c1 0.68 s, c2 tFull 4.23, minHoleDist 2.89 ≥ 2.6, c15 3.7 m/s, rest as in `rm-reg2-scenario-robots.txt`, `LOGS:` empty. `air-fin-scenario-robots-avoid`: tramp 30.52 s, eaten 4, stall 0.38, contact 0.05, tools moved 0; wall 9.62 s, eaten 5; perf p95 0.3 ms, tools moved 0. `air-fin-scenario-robots-more`: guard_4 breaks 1, guard_12 breaks 2, jam 0, cost_replan_12 p95 0.5 / 0.9 ms. `air-reg3-alias`: exceptions 0. `npx tsc --noEmit` → exit 0. `grep "Math.min(1, dt" src/entities/robots.ts` → nothing.

Self-check: diff is `robots.ts` (one helper, one constant, one condition in the target check, one in `findGnome`), one CHANGELOG bullet, this section. No motion, no body change in a query callback.
