# Fix plan: main uncommitted batch (L6 hole side, BIGGEST COMBO, Strong Arm downgrade), round 5

## Findings
- F1 `tools/smoke/scenario-strong-arm-downgrade.js:59-66` D12 "old save at level 3 pays 0 for level 4 (expected 51)" (r5 log).
- F2 `tools/smoke/scenario-auto-lands.js:197` 04_robot: the truck falls into the hole for 1 frame during the Garden -> Lawn slide (r5 log). 04_forest slideTime 2.97 passes (2.5-3.5), no fix.
- F3 `tools/smoke/scenario-auto-lands.js:386-397` 09_blueprint_tramp `outsideSkipped:false` (r5 log).
- F4 `tools/smoke/scenario-robot-stations.js:238` A5 `postMovedSameFrame:false` at level 3 (r5 log).
- F5 `src/ui/leaderboard.ts:345-349` a daily run that reached level 12 also posts a `speed` row (found by the session, read in code; no red check yet).

## Context
- F1: not a code bug. `changeCost` (`src/data/upgrades.ts:146`) falls back to the level when `paidChanges` is missing, so level 3 -> 4 costs `upgradeCost(u, 3)` = 51. The D12 fixture saves `freshState()` with `money: 0` (`scenario-strong-arm-downgrade.js:59`), so `Shop.buy` (`src/ui/shop.ts:233`) denies the purchase and the step measures 0. `state.ts` and `upgrades.ts` stay untouched.
- F2: real. When a land slide starts, `Environment` (`src/world/environment.ts:461-472`) calls `hole.carry`, which skips robots (`src/systems/hole.ts:326`). The station steps out each frame against the moving hole (`src/entities/robots.ts:177`, `stepOutPost`), radially, so it is pushed ahead of the hole, and the truck has only a "do not drive toward the hole" guard (`robots.ts:351-360`). Since L6 the Garden -> Lawn slide is 21.8 m sideways (it was a short move on one line), so the hole runs over a truck parked at the new spot. The fall recovery `toPost` (`robots.ts:462`) puts it back, which is the one frame below y -1.
- F3: fixture only. The Lawn fan sits 40 m along +z from the hole. With the new turns the Garden hole at level 3 is at about (10.0, -0.7), so the fan lands at z 39.3, inside the 42 m fence, and is placed. The loader's fence check (`src/entities/machines.ts:589`) works.
- F4: fixture only. `stepCase` starts at level 2, so the level-up brings the Garden (a slide), but `Env.holeCenterFor(lv + 1)` uses the Backyard. The post is placed beside the wrong spot; A4/A6 pass by chance. The L6 note says A4-A6 are meant for a level-up without a land change.
- F5: the one caller of `send()` is the form submit (`leaderboard.ts:259`); `offer()` sets `this.board` to the daily board on a daily run (`leaderboard.ts:296-300`). The combo branch already checks `this.board === 'main'`; the speed branch does not. SPEC (`docs/SPEC.md:285`) says "every run that reached level 12 posts its time": the orchestrator states daily is excluded (order for this round); SPEC gets one sentence.

## Groups
- G1 = F3, F4 + class hit `tools/smoke/scenario-mushroom-rim.js:31-36`. Class: a scenario puts the hole on a level of another land without that land (`holeCenterFor(level)` with the default land, or `holeLevel` set without `land`). Class grep `holeCenterFor(` in `tools/smoke`: 5 hits; auto-lands and letters pass the land (rejected below), robot-stations:238 and mushroom-rim:31 in group, auto-lands 09 is the same class by a hand offset. Shape: (a) fixture fixes, the game code is right.
- G2 = F2. Class: a land slide moves the hole across ground where robot trucks and stations stand; only tools and crate homes are handled. Class grep: other movers on the slide path are tools (`carry`), crate homes (`moveCrateHomes`), gnomes and the player (they may fall in, that is the game). No other hit.
  Shape: (a) make the truck flee the moving hole: rejected, the hole peaks near 19 m/s, a truck cannot outrun it. (b) new exported `clearSlide(from, to, newR)` in `robots.ts`, called once when the slide starts: chosen. For each robot whose post lies within `keep` of the segment `from -> to`, put the post `keep` beside the final spot, perpendicular to the path, on its own side first, then the other side, then the angle loop of `stepOutPost`; any truck within `newR + HOLE_GAP + 0.6` of the segment goes to its new post with `toPost` (puff exists; add the 0.1-0.3 s appear transition per animation rule 3 by reusing the placement pop-in in `machines.ts` if one exists, else say so in the return). This mirrors `moveCrateHomes` ("beside, not behind, because the hole sweeps the ground behind"). Non-land level-ups keep today's radial `stepOutPost` (A4-A6 cover that). (c) no slide for robots / cancel the slide: rejected, PP asked for the side change and the orchestrator for the slower slide.
  Ladder: rung 6, one function of about 20 lines, reusing `stepOutPost` constants, `poleBlocked`, `toPost`. Cost: one pass over placed robots once per land change (3 per run).
- G3 = F1. Fixture: `old.money = 1e6` before the save. One sentence: the code is right.
- G4 = F5. Shape (a): the speed branch gets the same `this.board === 'main'` guard as the combo branch. Ladder rung 5, one condition.

## Packages
### PA (G1 auto-lands/robot fixtures + G2) verifier: yes
- Owns: `src/entities/robots.ts`, `src/world/environment.ts`, `tools/smoke/scenario-auto-lands.js`, `tools/smoke/scenario-robot-stations.js`, `tools/smoke/scenario-mushroom-rim.js`.
- Edit order: 1. `robots.ts`: export `toPost`'s use inside new `clearSlide(from, to, newR)` as in G2. 2. `environment.ts:461-472`: call `clearSlide(from, to, holeLevel(...).radius)` right after `ctx.hole.carry(...)` when the slide starts. 3. auto-lands 09: put the far fan at `new V3(h5.x + 40, 0, h5.z)` (Lawn about (34.9, 14.7), inside 66; Garden about (50.0, -0.7), past 42) and fix the comment numbers; measure both spots in the page, do not trust these numbers blindly. 4. robot-stations `stepCase`: run on a level-up without a land change (start on the Garden at level 3, `land = landFor(3)`, hole rebuilt and no slide running), use `holeCenterFor(lv + 1, landFor(lv + 1))`, drop the `finishSlide` workaround. 5. mushroom-rim b: same, the case starts on the Garden at level 3 with its land, `holeCenterFor(4, 1)`.
- Red tests: F2 = existing 04_robot (fell 0, post out within 2 s). F3 = existing 09. F4 = existing A5 (and A4/A6 stay green on a plain level-up).
- Run once at the end (dev server `npx vite --port 5203 --host 127.0.0.1 --strictPort --config /private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-disposal-inc/4c1ea029-d602-463e-ad53-1903c38602be/scratchpad/slb/vite.nohmr.config.mjs`, then, in parallel, one line):
  `S=/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-disposal-inc/4c1ea029-d602-463e-ad53-1903c38602be/scratchpad/r6; for s in auto-lands:9731 robot-stations:9732 mushroom-rim:9733; do n=${s%%:*}; URL_QUERY='' FAKELOCK=1 MAXPOLL=4000 CDP_PORT=${s##*:} DEV_PORT=5203 node tools/smoke/smoke.mjs $S/$n tools/smoke/scenario-$n.js > $S/$n.log 2>&1 & done; wait; npx tsc --noEmit -p .`

### PB (G3) verifier: no
- Owns: `tools/smoke/scenario-strong-arm-downgrade.js`.
- Edit order: 1. D12 fixture: `old.money = 1e6` after `old.upgrades.throw = 3`.
- Red test: F1 = existing D12 (51, count 4).
- Run once at the end (dev server on 5205, same `--config`):
  `S=/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-disposal-inc/4c1ea029-d602-463e-ad53-1903c38602be/scratchpad/r6; URL_QUERY='' FAKELOCK=1 MAXPOLL=4000 CDP_PORT=9751 DEV_PORT=5205 node tools/smoke/smoke.mjs $S/strong-arm-downgrade tools/smoke/scenario-strong-arm-downgrade.js > $S/strong-arm-downgrade.log 2>&1`

### PC (G4) verifier: no
- Owns: `src/ui/leaderboard.ts`, `tools/smoke/scenario-remote-lb.js`.
- Edit order: 1. Red check in R6_daily_over (`scenario-remote-lb.js:60-77`): before the submit set `g.state.maxLevelAt = 1800; g.state.runTimeUnknown = undefined;` and add a check that `postBoards` equals exactly `['daily-<date>']` (no `speed`, no `combo`). 2. `leaderboard.ts:346`: `if (t !== null && this.board === 'main')`, comment: main board only, like the combo row.
- Red test: F5 in R6_daily_over: a daily run at level 12 with combo 7 posts one row, to the daily board.
- Run once at the end (dev server on 5207, same `--config`; R6 runs only with the daily query):
  `S=/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-disposal-inc/4c1ea029-d602-463e-ad53-1903c38602be/scratchpad/r6; URL_QUERY='' FAKELOCK=1 MAXPOLL=4000 CDP_PORT=9771 DEV_PORT=5207 node tools/smoke/smoke.mjs $S/remote-lb tools/smoke/scenario-remote-lb.js > $S/remote-lb.log 2>&1 & URL_QUERY='?lowfx&daily=2026-10-20' FAKELOCK=1 MAXPOLL=4000 CDP_PORT=9772 DEV_PORT=5207 node tools/smoke/smoke.mjs $S/remote-lb-daily tools/smoke/scenario-remote-lb.js > $S/remote-lb-daily.log 2>&1 & wait`

No package edits `docs/SPEC.md`, `CHANGELOG.md` or `docs/ai-work/*`: each returns its lines and the orchestrator writes them (PA: robots step aside when the hole changes side; PC: a daily run posts to the daily board only).

## Final tests (orchestrator, once)
- `r5/run.sh` with the output dir `r6`, plus `mushroom-rim` and `remote-lb` with `URL_QUERY='?lowfx&daily=2026-10-20'`, plus `npx tsc --noEmit -p .`. Never `FULL=1`, never port 5300.

## Verifier scenarios (once)
- PA: two robots, one post on the middle of the slide path and one at the new spot; a broken robot during the slide; a level-up chain during the slide (04_chain path, `finishSlide`); the player standing on the beside spot (`poleBlocked`, other side taken); a post near the fence where the beside spot is outside the yard; a plain level-up still steps the post out radially. Skipped: concurrency and volume (single player, at most a few robots, 3 slides per run).

## Rejected / out of plan
- F1 as a code bug in `state.ts` / `upgrades.ts`: the fixture had no money, the price path is right.
- Class hits `scenario-auto-lands.js:36` and `scenario-letters.js:41`: they pass the land explicitly.
- F2 part 04_forest: slideTime 2.97 is inside 2.5-3.5, passes.
- L6 note line "Rejected: robot-stations A4-A6 ... no land change": wrong for level 2 -> 3, superseded by PA step 4.
