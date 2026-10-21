# Balance batch: UFO/King weights, no slow-mo, XP by feeding style, 10 fans / 10 belts, fuses check

## Problem

PP decisions (verbatim): "6. B ale król powinien pojawić się zawsze na poziomie 10. 7 nie ma zwalniania czasu. 10a." and "Daj wiecej fanow np z 10 i raili. Wszystkie narzedzia maja fuzes osobno". Plan: `2026-10-20-plan-balance-batch.md`, section `## Plan (plan-senior, final)`.

Interpretation: build steps 1-8 of the final plan as written. The plan's "Decisions for PP" have no answers yet, so every recommended default (a) is taken (list below); each one is a one-line change if PP picks b.

## Summary

- Events: UFO weight 1.5 → 5, King 0.6 → 3. The level-10 King (6 s after the level-up) already existed and is unchanged.
- Slow-mo removed (`src/systems/slowmo.ts` deleted, wiring in `main.ts`, `context.ts`, legend). Only the Tab wheel still slows the game.
- XP by feeding style in one line of `Hole.consume`: King x1; `machine` flag (crate dump, vacuum, black hole, robot tip) or anything not `thrownBy 'player'` x0.25 (`FEED_XP`); a player throw or drop x1/sqrt(n) of its Magnet Gun hold group. Money lines untouched.
- New `Gnome.xpGroup` (one object per Magnet Gun hold, set in the player's batch grab, cleared by `hold()`), new `thrownBy 'kick'` for kick and ground pound (still STRIKE balls), `release()` marks gnomes machine-fed and clears tricks (crate tip, tool taken back, cannon).
- Fans 4 → 10, belts 6 → 10. Fuse instance caps derived from `UPGRADES` (44 boxes, 220 fuses).
- Texts: SPEC, PLAN, legend (Hole levels sentence), `holeLevels.ts` comment, CHANGELOG `## 2026-10-21 12:00`, BOARD.
- Scenario `tools/smoke/scenario-balance.js` (kept in the repo, 41 checks).

Ladder: weights and limits are data edits (rung 5); slow-mo is a deletion (rung 1); fuse caps reuse `UPGRADES`/`TOOL_IDS` (rung 2); `xpGroup` and `'kick'` are rung 6, because nothing in the repo knows the ball size at eat time and `volley` cannot carry it without changing money.

### Taken by recommendation (Decisions for PP, all option a)

1. Fuses: no code change, each placed tool already has its own fuses; crate and panel have none.
2. The King always pays his full 200 XP, whatever pushed him in.
3. Volley formula 1/sqrt(n) without a floor (a ball above 16 gnomes pays less per gnome than a machine).
4. Fan prices keep growth x1.9 (10th fan $64,538).
5. The Tab wheel slow-down stays.
6. "raili" = Conveyor Belt, limit 10.
7. A gnome let go of over the hole by hand pays x1; a ball released or lowered pays x1/sqrt(n) of its hold.
8. A gnome that walks in or that an event pushes in pays x0.25.
9. A hand throw helped by a tool on the way pays x1; eaten by a vacuum, black hole or robot pays x0.25.
10. No second King guarantee for a save already at level 10+.
11. Carry-in trick money (gnome thrown from 14 m, re-grabbed, carried in) stays as today.
12. A crate tipped next to the hole and a tool taken back release gnomes as machine-fed: x0.25, no tricks.

## Work progress

Dev server: `npx vite --port 5179 --host 127.0.0.1 --strictPort --config <scratchpad>/slb/vite.nohmr.config.mjs`.

1. Scenario written first and run on the unchanged code: `URL_QUERY='' DEV_PORT=5179 CDP_PORT=9421 MAXPOLL=2400 node tools/smoke/smoke.mjs <scratchpad>/bal/before tools/smoke/scenario-balance.js`. Red on the old code: A1-A4, B6, C2, C4-C11, C15-C19, D1-D3, F1 (for example `FAIL A1 0.0732`, `FAIL C5 1 false`, `FAIL D3 170 34 0`). Already true and kept: A5, A6, B5, C1, C3, C12-C14, D4, D5, E1-E3. Money of the cases that must not change went to `<scratchpad>/bal/balance-money-before.json`: `{"crate2":55.35,"vacuumThrown":525.6,"regrabBall20":1458,"plain":9.45}`.
2. B1-B4 on the old code: the full run showed ratio 1, because the old slow-mo has a 5 s cooldown and the King of C12 started one just before. A probe on the old code (one combo 59 → 60) gave ratios `[1,0,0,0,0,0,0.25,0.25,...]`, so the measurement does see a slow-mo. The scenario now waits 5.5 s before each B case.
3. Code steps 1-7 of the plan, then `npx tsc --noEmit` → exit 0.
4. Final run with the before-file prepended (`window.MONEY_BEFORE = …`): 41/41 PASS, `LOGS:` empty.
5. Regression scenarios (main.ts and hole.ts changed):
   - `DEV_PORT=5179 CDP_PORT=9431 MAXPOLL=800 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-tutorial-goals.js` → 31 PASS, 0 FAIL, `LOGS:` empty.
   - `FULL=1 DPR=1 DEV_PORT=5179 CDP_PORT=9374 MAXPOLL=2400 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-factory.js` → every PASS line PASS, 0 FAIL, `LOGS:` empty. Run 1 had `08_spawn_clear stuck=1 worst=1.51`, run 2 `stuck=0 worst=0.03`: the known gnome bouncing back onto the chute (2 in 40 runs, accepted in `2026-10-21-fix-plan-factory-bugs-r1.md` R11). This batch does not touch the factory or spawns.
   - `FULL=1 DPR=1 DEV_PORT=5179 CDP_PORT=9372 MAXPOLL=1600 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-esc.js` → same values as the accepted run in `2026-10-20-esc-resume.md` (for example `24_late_grant menu=visible paused=true locked=false`, `27_pill_clear 640: … hint=7603` (accepted overlap), `21_wheel_free wheel=true timeScale=0.25`), `LOGS:` empty.
6. `tools/smoke/scenario-auto-lands.js` does not exist, so the step 8 conditional (`xpNeeded − 0.1`) does not apply here. The auto-lands plan must still use `xpNeeded − 0.1` (a spawned gnome now pays 0.25 XP).

D4 numbers (default quality, `URL_QUERY=''`, 640x360): draw calls 40 with no tools, 91 with 10 fans + 10 belts (+51); `machines.update` p95 0.7 ms, median 0.5 ms with 300 gnomes.

### Done when (final run, `<scratchpad>/bal/after.json`)

- [PASS] A1 — `ufoShareL6 = 0.2083`
- [PASS] A2 — `kingShareL10 = 0.1111`, `ufoShareL10 = 0.1852`
- [PASS] A3 — `kingShareL10night = 0.1`, `ufoShareL10night = 0.1667`
- [PASS] A4 — `kingInPoolWhileAlive = false`, `ufoWeightWhileKingAlive = 5`
- [PASS] A5 — `kingAfterLevel10 = 1`, `kingAfter9to11 = 1` (levels 10 / 11, event timer held, counted at 7.0 s)
- [PASS] A6 — `ufoInPoolL3 = false`, `kingInPoolL9 = false`
- [PASS] A7 — `grep -n "setTimeout" src/systems/hole.ts` → one line, `259:    if (s.holeLevel === 10) setTimeout(() => ctx.events.start('king'), 6000);`
- [PASS] B1 — combo 60: game dt / clamped real dt over 30 frames `ratioMin 1, ratioMax 1`
- [PASS] B2 — combo 100: `ratioMin 1, ratioMax 1`
- [PASS] B3 — King eaten: `ratioMin 1, ratioMax 1`, `xp 200`
- [PASS] B4 — BULLSEYE: `ratioMin 1`
- [PASS] B5 — wheel open by a real Tab keydown `timeScale 0.2528`, after release `1` within 0.3 s, closed
- [PASS] B6 — `legendHasSlowmo = false`; `ls src/systems/slowmo.ts` → `No such file or directory`
- [PASS] C1 — `xp.hand = 1`
- [PASS] C2 — `xp.volley4 = 0.5` (sum 2), `xp.volley16 = 0.25`
- [PASS] C3 — `xp.trampolineThrow = 1` (bounced = true)
- [PASS] C4 — `xp.handDrop = 1`, `xp.ballRelease4 = 0.5`
- [PASS] C5 — `xp.kick = 0.25`, `strike.kickBallCounted = true`
- [PASS] C6 — `xp.pound = 0.25`
- [PASS] C7 — `xp.plow = 0.25`, `xp.blower = 0.25`
- [PASS] C8 — `xp.crate2 = 0.5`, `money.crate2 = 55.35` = before 55.35
- [PASS] C9 — `xp.fanWalker = 0.25`
- [PASS] C10 — `xp.vacuumThrown = 0.25`, `xp.robotTip = 0.25`, `money.vacuumThrown = 525.6` = before 525.6
- [PASS] C11 — `xp.walkIn = 0.25`
- [PASS] C12 — `xp.kingByFan = 200`
- [PASS] C13 — `xp.handHunger = 2.25`
- [PASS] C14 — `load.holeXp = 123.4`, HUD `XP 123 / 900`
- [PASS] C15 — `xp.crateTip2 = 0.5`, `money.crateTipSniper = 9.45` = `money.plain` 9.45 (old code: 525.6)
- [PASS] C16 — `xp.toolRemoveSpill = 0.25`
- [PASS] C17 — `xp.ballLowered4 = 0.5`, `xp.ballToppedUp6 = 0.408248` (n = 6)
- [PASS] C18 — `money.regrabBall20 = 1458` = before 1458, `xp.regrabBall20 = 0.223607` (throw distance 17.05 m)
- [PASS] C19 — `xp.kickedMidAir = 0.25`, `money.kickedMidAir = 9.45` = plain (old code: 317.25, LONG + AIR)
- [PASS] D1 — `shop.fanPrices = [2607,4953,9410,17878,33968,64538]`, `hotbar.fan = "10/10"`, `placed.fan = 10` (11th buy charged 0)
- [PASS] D2 — `shop.conveyorPrices = [2848,4272,6408,9611]`, `placed.conveyor = 10`
- [PASS] D3 — `fuses.count = 220`, `fuses.boxes = 44`, `fuses.skipped = 0` (old code: 170 / 34)
- [PASS] D4 — `perf.machinesP95 = 0.7` ms with 300 gnomes, `LOGS:` empty, `drawCalls0 = 40`, `drawCalls20 = 91`
- [PASS] D5 — `oldSave.fan = 4`, `blueprint.placedFans = 4`
- [PASS] E1 — `fuses.fanA = 2`, `fuses.fanB = 0`
- [PASS] E2 — `saboteur.targetWithOnlyCrateAndPanel = null`
- [PASS] E3 — `fuses.robotBlown = 1`
- [PASS] F1 — `legend.kingCard` has `200 XP`, `legend.xpRule` has `quarter`
- [PASS] All — `npx tsc --noEmit` → exit 0; `grep -rn "slowmo" src` → 0 lines; `grep -rn "thrownBy = 'player'" src` → one line, `src/entities/gnomes.ts:349` (`drop`)

### Deviations from the plan

- B1-B4 compare the game dt of each frame with that frame's clamped real dt (read where `main.ts` hands it to `wheel.slow`), not with a fixed 0.05: the harness now renders on the GPU at 60 fps (`SW=1` too), so the 0.05 clamp is never reached. A slow-mo shows as a ratio of 0 or 0.25.
- D1/D2 expected prices: the plan's numbers were rounded by hand; `upgradeCost` rounds up (`Math.ceil`), so every price is $1-3 higher than the plan's list. The scenario asserts the real prices.
- C17: three gnomes are eaten while the group has n = 4 (0.5 each), not four: one gnome must stay in the ball so the two late joiners join the same hold. That last original then pays 0.408 like the late joiners, as the group's n is read at eat time.
- C18 re-grab: the scenario sets the throw cooldown and `noGrabUntil` to 0 (the player waiting it out) so the gnomes are re-grabbed before they land; money stays deterministic.
- SPEC line with the model's minutes (`Drogi do poziomu 12`): kept and marked "sprzed zmiany XP …, czasów nie przeliczono" instead of a new range (R8).

### Self-check

- Completeness: 41/41 Done-when lines plus "All" run in this session with output above.
- Discipline: every new field, parameter and branch comes from a plan step (xpGroup step 3-4, `'kick'` step 4, `machine` parameter and `FEED_XP` step 5, caps step 6). Nothing extra.
- Ladder: fuse caps reuse `UPGRADES`/`TOOL_IDS`; no new helper, no dependency.
- Patterns: comments one line, same style as the neighbours.
- Tests: the scenario drives the real paths (LMB batch grab, RMB throw, kick, pound, plow push, blower, trampoline, fan, crate dump and tip, vacuum, robot tip, cannon removal, shop buy, blueprint LOAD, Tab key) and reads state; `LOGS:` empty.
- Order: `git status` shows only this batch's files, plus `docs/ai-work/2026-10-21-plan-endgame.md` (modified) and `docs/ai-work/2026-10-21-plan-tree-expansion.md` (new) from another session, not touched here. `src/systems/slowmo.ts` deletion is staged (`git rm`).

Rejected: none.

## Review round 1 (code-reviewer → fix-finding, 2026-10-21)

- [PASS] C20 — a gnome that slips off a held ball and is re-grabbed no longer counts twice: red `0.447213 n=5` → `0.5 n=4`.
- [PASS] B7 — the rumble from the deleted slow-mo is back at combo 60, combo 100 and the King: red `0` → `3` calls.
- Lean: hard-coded "(44)" and "220" comment numbers removed from machines.ts.
- Accepted: combo 60 and a King in the same eat now rumble twice (slow-mo had a 5 s cooldown); two short sounds, no gameplay effect.
