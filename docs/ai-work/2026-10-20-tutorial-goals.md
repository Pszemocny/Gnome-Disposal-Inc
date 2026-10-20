# Tutorial goals and lessons (mushrooms, multipliers, gnome types)

Interpretation: PP asked "pierwsze gole pokazywaly mechaniki gry mushrooms, mnozniki, gnomy" and decided (Slack via hub, 2026-10-20 23:00) "9. Od pierwszej minuty, grzybek pewny". So the LESSON line opens right after the tutorial goal "Collect coins" (option b), not after "Reach hole level 2", and the mushroom lesson drop is guaranteed (option a). The rest is `## Plan (plan-senior, final)` in `2026-10-20-plan-tutorial-goals.md`; the other open items take the plan's recommendation.

## Problem

The goal panel taught only the tutorial and a few skills. A new player did not learn about mushrooms, multipliers or the gnome types from the goals.

## Summary

- GOAL track: make, grab, feed, coins, combo 5 (new, $15), buy, level 2, level 4, the Land goal (Garden, one separate entry), levels 6/8/10/12, The Deep. No goal in it needs a hand throw.
- LESSON track (19 lessons) opens after "Collect coins". Every unlocked lesson counts at the same time; the panel shows the first one not done (gnome types before trick shots). Lessons done in the same frame pay together with one toast (`Lesson done! +$X` or `N lessons done! +$X`). When nothing is unlocked, the line reads `Next lesson at hole level N`.
- Saves store `goalsDone` (ids) and `goalStart` (start value per running relative goal). Old saves are migrated once from `goal` / `goal2` (and the pre-F8 single list), each id pays once.
- Mushroom lesson: while it runs and no mushroom lies on the grass, the next eaten gnome drops one. `stats.mushrooms` is counted at pickup, so the BOOZE code no longer passes it.
- New stats `heavies` (heavy or massive eaten, any feeder) and `trickShots` (player throw that bounced off a trampoline).
- Contracts start after the first finished goal (`goals.firstDone`) or after 2 minutes, as before.
- HUD second head reads `LESSON`. After "Reach hole level 2" the waypoint follows the lesson target (crate, trampoline) when the lesson has one.

Ladder: rung 6 for `goalsDone`/`goalStart`/`from` and the parallel lesson loop (nothing in the repo tracks goals by id); rung 2 for the trampoline waypoint (same as the crate one) and the forced drop (one line in `maybeDrop`); rung 5 for the label and the stat move.

Counter contract for the physical-loads plan (R12): `stats.crated` +1 when a gnome is accepted as a crate's load (today `machines.ts` `updateCrate`, `ctx.gnomes.stash`), `stats.crateDumps` +1 when a crate with at least one gnome is dumped into the hole. The `crate` and `dump` lessons read only these counters.

Documented behaviour (R6): an old save in the middle of the tutorial (current goal `buy` or later) gets `combo5` marked done without the $15: paying it would pay for a goal the player never saw.

## Odstępstwa from the final plan

1. Lessons open after `coins` instead of `lvl2` (PP decision 9). `from` moved from 2 to 1 for the lessons whose thing exists at hole level 1: mushroom (drop at every level), heavy (heavy tier 5 % at level 1, `rollTier`), crate and trampoline lessons (`upgrades.ts` unlock 1), combo 15, LONG SHOT, AIR. `greedy` stays 2 (unlock 2), the rest as planned (bullseye 4, types at their unlock levels).
2. Waypoint rule R11 kept as written: the lesson target wins only after `lvl2`. Before that the tutorial arrows (factory, hole, shop) stay, because the lesson line now runs next to them.
3. Done when 4, 17, 32 adapted: "lvl2 done" read as "coins done" (the moment the track opens). Done when 14: after rebirth at level 1 the line shows the first unlocked lesson; the check uses a save where every level-1 lesson is done, so it reads `Next lesson at hole level 2`.
4. Done when 12: `goalStart.long` is 4, not undefined. `long` is still a lesson and was the running old skill (index 3, `goalBase2` 4), so it keeps its base (matrix row 12 "running goal keeps its base"); the plan line contradicted its own matrix.
5. Done when 13: save `{goal: 9}` (no `goal2`) means old single-list index 9 = skill `long` running, so GOAL is `Reach hole level 4` (not 6) and done = tutorial + `lvl2` + `[crate, dump, combo15]`. The plan's expected values mis-mapped the old list.
6. King text: "Feed the KING GNOME: an event from hole level 10. 40 kg, use machines" instead of "a rare event", because PP decision 6b (same message) makes the King appear always at level 10 (`2026-10-20-plan-balance-batch.md`, A5); the neutral text is true before and after that change. Done when 19 grep adjusted (no timer, no "rare").
7. Greedy text trimmed to 68 characters ("it steals coins, runs for the fence") to keep the 70-character cap (R5).
8. `grab` keeps today's text "Use the magnet: hold LMB while looking at a gnome" (the plan said "as in v0"; the current text names the magnet, which is the tool the player holds).
9. Done when 27: the scratchpad scenarios named in R10 (`scenario-contracts.js` and others) are not on disk anymore (old session scratchpads are gone); `tools/smoke` has no `state.goal`, `goal2` or `goals.start` reference, so nothing to rewrite. New scenario: session scratchpad `smoke/scenario-tutorial-goals.js` + `smoke/scenario-tutorial-goals-shot.js`.
10. The migration writes a `goalStart` entry only for relative goals (absolute goals ignore the base).

## Rejected

- Copying the scenario into `tools/smoke`: the CLAUDE.md rule keeps scripts in the scratchpad unless they become permanent; nobody asked.

## Work progress

Commands (dev server `npx vite --port 5195 --host 127.0.0.1`):
- `npx tsc --noEmit` → no output (clean).
- `DEV_PORT=5195 CDP_PORT=9387 MAXPOLL=1400 node tools/smoke/smoke.mjs <out> smoke/scenario-tutorial-goals.js` → 28 PASS lines, 0 FAIL (run twice after the last edit).
- `DEV_PORT=5195 CDP_PORT=9385 node tools/smoke/smoke.mjs <out> smoke/scenario-tutorial-goals-shot.js` → `goal=16-163 card=167-229 contract=combo`, screenshot checked by eye.

### Done when (plan-senior final, adapted where noted)

- [PASS] 1 fresh boot → GOAL + Make gnomes, no LESSON — `PASS 1 "GOALMake gnomes: stand at the GNOME FACTORY and hold E0 / 5"`
- [PASS] 2 tutorial chain, money 65, throw stats only in LESSONS — `PASS 2 done=make,grab,feed,coins texts=Reach a 5 combo…,Buy an upgrade…,Reach hole level 2 money=65`; `rg -n "longShots|airShots|bullseyes|trickShots" src/systems/goals.ts` → lines 79-82, inside `LESSONS` (63-83)
- [PASS] 3 maxCombo 9 before combo5 → +15 once — `PASS 3 money=15`
- [PASS] 4 (adapted: coins done) → LESSON + Eat a MUSHROOM — `PASS 4 "...LESSONEat a MUSHROOM: the hole spits one o"`
- [PASS] 5 forced mushroom, no forced second — `PASS 5 wants=true after1=1 after21=1`
- [PASS] 6 mushroom done, 200 consumes at random 0.5 → 0 — `PASS 6 len=0`
- [PASS] 7 walk over a mushroom → +40, GREEDY GNOME — `PASS 7 money=40 mush=1`
- [PASS] 8 greedy fed before unlock → paid once on unlock — `PASS 8 before=false money=40`
- [PASS] 9 Next lesson at hole level 3, 2 / 3, waypoint hole, bullseye base 7 — `PASS 9 p2=Next lesson at hole level 3 nums=2 / 4,2 / 3 tpHole=true base=7`
- [PASS] 10 heavies — `PASS 10 0->1->1`
- [PASS] 11 trickShots player only — `PASS 11 0->1->1`
- [PASS] 12 F8 save (expected `goalStart.long` = 4, Odstępstwo 4) — `PASS 12 done=make,grab,feed,coins,combo5,buy,lvl2,lvl4,garden,crate,dump,combo15 start={"long":4,...} money=0`
- [PASS] 13 pre-F8 save goal 9 (expected values corrected, Odstępstwo 5) — `PASS 13 done=make,grab,feed,coins,combo5,buy,lvl2,crate,dump,combo15 goal=Reach hole level 4 start={"long":2}`
- [PASS] 14 rebirth keeps goalsDone/goalStart, no GOAL head, Next lesson at hole level 2 — `PASS 14 heads=LESSON txt=LESSONNext lesson at hole level 21 / 2 same=true`
- [PASS] 15 daily: Make gnomes, save unchanged after 15 s — `PASS 15 "GOALMake gnomes: stand at the GNOME FACT"`
- [PASS] 16 contracts wait for the first goal — `PASS 16 before=null after=combo`
- [PASS] 17 (adapted: coins done) heads GOAL, LESSON — `PASS 17 ["GOAL","LESSON"]`
- [PASS] 18 trampoline waypoint desk → trampoline — `PASS 18 shown=TRICK x3:  desk=true tramp=true`
- [PASS] 19 king +2000; text without timer (text changed, Odstępstwo 6) — `PASS 19 money=2000`; `rg -n -i "timer|rare" src/systems/goals.ts` → only the golden text ("rare, runs away")
- [PASS] 20 no lesson for sniper/strike/volley/parade/mood — `rg -n "sniper|strike|volley|parade|mood" src/systems/goals.ts` → no output (rc 1)
- [PASS] 21 four lesson ids angry/dwarf/wizard/fat, no shadow — `rg` → lines 67, 68, 73, 74; `rg -n "shadow"` → no output
- [PASS] 22 level 3: ANGRY shown, not AIR — `PASS 22 Feed an ANGRY GNOME (dark red)`
- [PASS] 23 three AIR shots in the background → +60, one toast, ANGRY still shown — `PASS 23 money=60 toasts=1 shown=Feed an ANGRY GNOME`
- [PASS] 24 old save cascade → six ids, +700 once, one toast — `PASS 24 added=angry,dwarf,boom,saboteur,wizard,fat money=700 toasts=["6 lessons done! +$700"]`
- [PASS] 25 BOOZE does not count — `PASS 25 mushrooms=0`
- [PASS] 26 lesson waypoint after lvl2 (desk), factory on a fresh save — `PASS 26 cur=lvl4 cur2=crate desk=true factory=true`
- [PASS] 27 (adapted, Odstępstwo 9) no old goal model in scenarios — `rg -n "state\.goal\b|goal2|goals\.start" tools/smoke <scratchpad>/smoke` → only the crafted legacy save in `scenario-tutorial-goals.js:224` (Done when 12)
- [PASS] 28 640x360 GOAL lvl2 + LESSON TRICK + contract — `goal=16-163 card=167-229`, screenshot `smoke/t28/28-goal-lesson-640.png`: both texts, bars and counters fully visible, contract card below, no overlap
- [PASS] 29 crate counters — `PASS 29 crated 0->1 dumps 0->1->1`
- [PASS] 30 old save goal 4 → combo5 done unpaid, Buy an upgrade — `PASS 30 done=make,grab,feed,coins,combo5 money=7`
- [PASS] 31 one `new Set` — `rg -n "new Set" src/systems/goals.ts` → `116: this.done = new Set(s.goalsDone);` (constructor)
- [PASS] 32 (adapted: coins done) bases read the frame the track opens — `PASS 32 {"mushroom":0,"heavy":0,"crate":3,"dump":0,"long":2,"air":0,"trick":0}` (combo15 absent)
- [PASS] 33 `npx tsc --noEmit` → clean (no output)

### Self-check

- Completeness: 33/33 lines above with evidence from this run.
- Discipline: every new field, getter and branch maps to a plan step (state stats, goals rewrite, forced drop, stat move, contracts, rebirth copy, label). Nothing extra.
- Ladder: crate/trampoline waypoint reuses the crate pattern; no new helper, no dependency.
- Tests: the scenario drives the real game objects (`hole.consume`, `mushrooms.update`, `machines.place`, physics for the crate), real saves in localStorage loaded by a second game in an iframe.
- Order: no stray files in the repo; scenarios stay in the session scratchpad.

## Review round 1 (code-reviewer → fix-finding, 2026-10-21)

- [PASS] Bomb lesson from level 2, golden from level 1, matching where they spawn: red `FAIL 34 boom@2=false golden@1=false` → `PASS 34 boom@2=true golden@1=true`.
- [PASS] Mushroom lesson looked up by id, not list position (no behaviour change today, no red test).
- [PASS] Forced lesson mushroom turns 45° up to 8 times until it lands clear of a placed tool: red `FAIL 35 d=0.00 landed=true` → `PASS 35 d=2.91`.
- Lean: lessons got their own type with a required `from` (two `?? 1` gone); the start value is computed only for relative goals. Rejected: deleting `s.goalStart ??= {}`, because a save with `goalsDone` and no `goalStart` (test 24) crashes on the first goal update without it.
- Rejected: left column at 640x360 in the first minute. `.hud-left` stops 94 px above the bottom and clips vertically, so with GOAL + LESSON + contract + EFFECTS the toasts (from y 264) fall under the clip at that height; the newest toast is the one shown when there is room. Same accepted limit as SPEC's 640 px line: a 360 px tall window has no room for every card at once.
- Scenario copied to `tools/smoke/scenario-tutorial-goals.js` (34/34 PASS, LOGS empty).
