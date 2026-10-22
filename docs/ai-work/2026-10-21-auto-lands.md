# Auto-lands: the yard grows by itself with the hole level

## Problem
PP (Slack via hub 2026-10-20 23:00): "11 land kupuje się automatycznie a raczej zmienia ci kilka poziomów dziury." PP (terminal 2026-10-20): the map must always grow in one direction, factory → hole → bigger land, never "szukac gdzies dziury za domem". PP (letters): "musi sie dac zlozyc slowo".

Interpretation (confirmed by the orchestrator, PP 2026-10-21: "recommendations taken, may override"): execute `## Plan (plan-senior, final)` of `2026-10-20-plan-auto-lands.md`, corrected by `## Refresh 2026-10-21`; every open question takes its recommendation: L1 a (letter spots G (15,−15), N (36,−10), O (−8,58), M (86,10), E (10,88)), L2 a (goal "Reach hole level 5: the yard grows into the Neighbour's Lawn", $300, arrow to the hole, id `garden`), L3 a (FASTEST entries stay), L4 a (one-time refund, max $49 500), L5 a (`LAND_STEP = 4`), Land tab a (removed, legend keeps the table).

## Summary
- Lands come at hole levels 3 / 5 / 8 (`landFor`), the LAND shop tab is gone, an old save that bought lands gets the price back once (save `version` 1 → 2).
- The yard is a rectangle from the fixed corner (−22, −22) to `2·half − 22` on x and z; every yard reader uses `env.min` / `env.max` and the helpers `inside`, `clampTo`, `randomPoint`, `edgePoint`.
- Every hole spot lies on the line from the factory: `DIR · (4·land + 1.2·(level − 1))`. A land switch slides the hole 1 s (dust, rumble, shake) and grows the new fence out of the ground in 0.3 s (`outBack`).
- Saved tools beyond the fence or in the hole go back to the inventory on load, counted in the existing note "N tools are back in your inventory: no room there."
- A crate whose home the moving hole will cover gets a home 1 m past the new rim, beside the hole's path.
- Letters moved to the new spots; the word can be finished from hole level 8.

Ladder: `landFor`, `LAND_STEP`, `DIR` (rung 5-6, no level → tier helper existed); `inside` / `clampTo` / `randomPoint` (rung 6) replace the `half` square and the per-file `clamp` helpers (rung 1, deleted); slide, `carry`, `loadNotes`, `restore` count, `edgePoint` reused (rung 2); the LAND tab, `buyLand`, `LAND_ICONS`, `anchor` deleted (rung 1). No new dependency.

## Work progress

### Deviations from the plan
1. `env.min` / `env.max` are plain `{ x, z }` objects, not `THREE.Vector2`: the plan's own checks read `env.max.z`, which a Vector2 does not have.
2. Fog: `near = half of the longer side + 15` (37 m on the Backyard, as today and as the refresh's "near 37 m"), not "longer side + 15" (59 m), which would have pushed the fog 22 m back on every land.
3. Crate home (R1): pushed to `newR + 1` from the new centre BESIDE the hole's path (perpendicular to the move, on the home's side), not radially. Reason: radially out from the new centre puts the home on the ground the hole slides over (the 2→3 slide passes DIR·2.4..6.4, a radial push of a home at DIR·4.2 lands at DIR·3.0), so the crate would respawn into the sliding hole again and again for about 0.7 s. The trigger is "home within `newR + 1` of the path old centre → new centre", so a home the slide sweeps is caught too. With no move it stays radial.
4. A fence rise (0.3 s, `outBack` on the fence group's height) is added; the plan's assumption 6 kept the fence instant. The orchestrator asked for a transition and a cue for the land change (animation rule 3); the slide is the cue, the rise is the transition of the new object.
5. `machines.restore` keeps its counter name `inFactory` (the refresh asked for `skipped`): the file is being edited by the fan/funnel agent, so the edit stayed one block plus the comment.
6. `scenario-letters.js` L22 / L22held: the house now stands beyond the back fence on every land, so a letter on its roof goes home at once by the fence rule. L22 now checks that, and the 3 s "resting high up" rule on the factory top (inside the fence) with the same thresholds idea (rest → home after 3 s, flying → not). Not listed in the refresh; without it L22 fails on every land.
7. `scenario-auto-lands.js` 04 "robot not in rescue": robots have no `rescue` state (`RobotState` = idle/seek/pick/drive/tip/return); the check counts frames with the truck below y = −1 (fell into the hole) and asserts 0, plus the station out of the hole within 2 s.
8. 05 "placement ghost at (0,0,30) / (0,0,−23)": checks the predicate the ghost uses (`env.inside(x, z, 0.5)`), not a driven ghost (driving the ghost needs camera aiming that I could not verify without running).

### Checks written (not run: the order was "DO NOT run scenarios", only `tsc`)
`FAKELOCK=1 URL_QUERY='' DEV_PORT=5199 CDP_PORT=9373 MAXPOLL=4000 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-auto-lands.js`
- 01_formula (48 rows on the line, distance, margin ≥ 2, ≥ 8 m from desk/house/shovel), 01_formula_L12 (12.6, 21.8), 01_formula_dist 15,19,23,27.
- 02_levelup_garden (crate dump at the rim brings the Garden: land 1, max 42, min −22, slide ≤ 1.5 s and monotonic, fan A gone, fan B rim 1.0 ± 0.3, toast), 02_crate (home ≥ 3.4, one respawn, rests, still placed), 02_fence_rise (a sample strictly between 0 and 1 and an overshoot), screenshot `auto-lands-slide-mid`.
- 03_levelup_plain (3→4: land 1, moved 1.2, no slide).
- 04_lawn (land 2, max 66, hole DIR·12.8), 04_robot (station out of the hole in 2 s, never fell in over 20 s), 04_forest (land 3, max 94, DIR·20.4, achievement `land`), 04_chain (4→5→6 in one XP gain during the slide, no exception, hole at its spot).
- 05_bounds (placement rule, gnome target inside, crate behind the back fence back by the desk, robot in the new strip feeds the hole, tornado inside for 60 frames).
- 06_old_saves a-e (iframe boots: derived land, no money change, 2 tools back with the note; Forest refund 49 500 once, saved as version 2, second boot same money; version 2 no refund; boot at a land boundary without a slide; robot station behind the house not built, note).
- 07_fresh_daily (land 0, max 22, hole (0,0)).
- 08_shop (no LAND tab, AVAILABLE = sum of tab counts), 08_legend (3 columns, new text), 08_goal (`garden` text, where `hole`, done at 5, pays 300).
- 09_blueprint_tramp (Garden layout reloads 3 tools; a Lawn fan 30 m past the hole is skipped on the Garden; trampoline 9.75 m/s = 0.75; combo cap 2.5).
- 10_scenery_grass / _fireflies / _ufo / _far_gnome.
- 11_letters_reach (G only at start; GN after 2→3, nothing moved; GNO after 4→5; all five after 7→8, home error < 1.5, spots as in `letters.ts`).
- `scenario-letters.js` L0 (rectangle maths, one hole line), L2/L3 (level-ups instead of `buyLand`, `max.x`, M (86,·), E (·,88)), L7 (`maxOf(2)`), L21 (`max.x`), L22/L22held (see deviation 6).
- `scenario-tree-expansion.js` P5b and F3, `scenario-endgame-boost.js` E12/E13/E20: `g.env.half` → `g.env.max.x`; F3 sets hole level 10 before land 3.
- Syntax of all four scenario files: `node -e "new Function(...)"` → ok.

### Gotowe, gdy (final list 1-26 + refresh 27-30)
- [PASS] 15 `npx tsc --noEmit -p .` → no output; `grep -rn "env\.half" src` → 0 lines.
- [PASS] 8 (second half) `grep -c "LAND\[0\]\.half" src/systems/hole.ts` → 1.
- [PASS] 16 (second half) `grep -c "LAND_STEP = 4" src/data/land.ts` → 1.
- [PASS] 30 (second half) `grep -rnE "g\.shop\.buyLand|env\.half" tools/smoke src | wc -l` → 0.
- [NOT RUN] every scenario line (1-7, 9-14, 15 `05_bounds`, 17-29): written above, not run by order of the orchestrator.

### Rejected
- Renaming `inFactory` to `skipped` in `machines.restore`: the other agent edits that file; the name is local, the behaviour is the same.
- (Fixed, no longer rejected) Fireflies frustum culling: their bounding sphere was computed once from zero positions, so they could be culled when the origin was off screen; now `frustumCulled = false` (check `10_scenery_fireflies`).
- Roaster minors already rejected by plan-senior (salvo on grass at 2→3, player on the slide path, double refund with two tabs).

### Review round (2026-10-21)
- A crate's new home is tested against every placed tool (at the spot it glides to; a tool the hole swallows does not count, one hanging more than 2.5 m above does not count), the factory and the fence (1 m inside). Order: the home's side of the path, the other side, then 2 m and 3 m past the rim; with no move, four directions around the rim. Footprints are circles (crate 1.13 m + the tool's half-diagonal). Code: `Hole.moveCrateHomes`, run at the end of `carry`. Check: `12_crate_home_tool` (a fan where the old rule put the home).

### Uncertain
- 02/04/05 depend on game time at ~5 fps headless; 05's robot step may need up to 40 s of game time.

## L6: hole changes side

### Problem
PP (Slack 2026-10-21 23:23): "Dziura musi zmieniać stronę". It replaces the 2026-10-20 rule "always one direction": with every land the hole moves to the other side of the yard. Kept: 15 / 19 / 23 / 27 m from the factory at level 1 of each land (+1.2 m per level), never behind the house, the yard rectangle growing from the fixed corner (-22, -22) toward +x / +z. Order: "PP: bez planu", implement, tests once at the end.

Interpretation: each land gets its own direction from the factory point on today's line (`-15 · DIR`, so the Backyard spots stay exactly where they are). The Backyard keeps `DIR`; Garden, Lawn and Dark Forest turn it alternately to one side and the other. The hole still slides 1 s in a straight line from the old spot to the new one, now sideways.

### Gotowe, gdy
1. `scenario-auto-lands.js` 01_formula → PASS: 48 rows, each on its own land's direction, at 15 + 4 L + 1.2 (n - 1) m from the factory, ≥ radius + 2 m inside its land, ≥ 8 m (edge) from desk, house and shovel.
2. `scenario-auto-lands.js` 01_formula_side → PASS: Garden, Lawn and Forest holes lie on alternating sides of the Backyard line, each ≥ 5 m off it.
3. `scenario-auto-lands.js` 02_levelup_garden, 02_crate, 02_fence_rise, 03_levelup_plain, 04_lawn, 04_robot, 04_forest, 04_chain, 06_old_saves_d, 11_letters_reach, 12_crate_home_tool → PASS (sideways slide, tools carried / back to inventory, robot station steps out, letters completable).
4. `scenario-auto-lands.js` 10_scenery_grass → PASS with 0 tufts and 0 mushrooms within 6.8 m of any hole path segment (`Environment.holePath()`).
5. `scenario-letters.js` all checks PASS, L0 against every hole path segment.
6. `scenario-robot-stations.js` and `scenario-endgame-boost.js` all checks PASS.
7. `npx tsc --noEmit -p .` → no output.
8. Screenshots `l6-land-0..3` show the hole on each land (by eye).

Ladder: `holeCenterFor` keeps its signature (rung 2), the direction per land is one number on the existing `LAND` table (rung 6, data, no new helper); `distToSegment` reused for several segments (rung 2). No new dependency.

### Work progress (L6)
- Probe (scratchpad `l6/probe.mjs`): allowed turns for all 12 levels per land (rectangle margin >= radius + 2, edge >= 8 m from desk, house, shovel): Garden -30..+28°, Lawn -43..+28°, Forest -60..+30° (+ = toward +z). Letters never bind (>= 11.6 m from every path segment for any pick in range).
- Pick: Backyard 0°, Garden -25°, Lawn +25°, Forest -40°. Why: each new land's hole crosses the yard's diagonal (60° → 35° → 85° → 20° from +x), so it really sits on the other side of the yard; 3-20° slack to the limits. Results: rectangle margin >= 11.6 m, edge to desk/house/shovel >= 9.3 m, letters >= 11.6 m, lateral jump 9.0 / 11.8 / 22.8 m off the Backyard line, slides 9.6 / 21.8 / 35.5 m in the same 1 s.
- Done: `LAND[].turn`, `holeCenterFor` per land, `Environment.holePath()` (4 land lines + 3 slides) for tufts and mushrooms, comments; auto-lands 01_formula / 01_formula_L12 / new 01_formula_side / 04_forest / 06_old_saves_d / 10_scenery_grass. `npx tsc --noEmit -p .` → no output.
- Paused once: other edits appeared in the checkout. The orchestrator said they come from parallel agents of the same session (combo board, Strong Arm downgrade, No Scope) and said to carry on with small edits anchored on text, without running scenarios (PP: tests once at the end, run by the orchestrator).
- Orchestrator decision: the 35.5 m Forest slide in 1 s is too fast. The slide time is now distance / 12 m/s, clamped to 1-3 s (Garden 1 s, Lawn 1.82 s, Forest 2.96 s). The rumble and the tool glides use the same time; the dust trail stays. Check: 04_forest measures the slide at 2.5-3.5 s; 02_levelup_garden keeps `arrived <= 1.5`.
- Letters L0 checks every `holePath()` segment. The new 13_hole_shots step saves `l6-land-0..3` (the hole seen from beside the factory). SPEC: the hole-position rule, a new PP decision with its why, a session decision on the slide speed, and the yard line. CHANGELOG: one bullet in `## 2026-10-27 14:00`.
- `npx tsc --noEmit -p .` → no output. Both edited scenario files pass a syntax check (`new Function`). Scenarios NOT run, by the orchestrator's order: Gotowe, gdy lines 1-6 and 8 are open until the final run.
- Rejected: robot-stations A4-A6 call `holeCenterFor(lv + 1)` with the current land. This is right for the levels they use (no land change), so I left it unchanged.

## L6 test round (2026-10-21)

- Real bug fixed: when the hole changes side, it slid over a truck parked at the new spot (one frame in the hole). `clearSlide(from, to, newR)` in robots.ts, called from `rebuildLand` at the slide start, moves stations near the slide path beside the new spot (own side first, inside the fence, pole not blocked) and sends trucks on the path to their station.
- Rejected: a scale-in for the truck that jumps to its station; it uses the same `toPost` puff as today's fall recovery, and the only pop-in helper is private to blueprints.ts. One cue (the puff) is kept.
- Scenario fixes: 09 far fan on the x axis (Lawn (34.92,14.70) inside, Garden (50.03,-0.71) outside); robot-stations A4-A6 and mushroom-rim b run on the Garden from level 3 to 4, so the land does not change.

## L6 clearSlide review fixes (2026-10-22)

- Fixed: when two stations stood beside the new spot on the same side, both got the same spot (pole bodies move only next frame, so `poleBlocked` did not see the first one). Now every moved post keeps 3.3 m (`STATION_SPACE`) from every other post, and candidates go around the new rim on both sides of the path.
- Fixed: a station that `stepOutPost` keeps around the old hole (even behind it) jumped up to 23 m across the yard. Now only posts ahead of the old spot move (projection t > 0), checked with the old radius along the path and the new radius at the new spot. `clearSlide` takes `oldR`.
- Fixed: a station that stood on a tool was moved at the tool's height and floated. A moved post now stands on the ground (y 0, the ground top outside the hole).
- Not fixed, needs a plan: a carried fan can end on a moved station, because `clearSlide` checks poles against tools where they stand now. The glide targets live in `Hole.glides` (private, `src/systems/hole.ts`), outside this package.
- Red check (new `04_slide_posts` in scenario-auto-lands, 4 robots on the Garden -> Lawn slide): `3 FAIL / 29 PASS`, all four posts at (-3.52,8.81), behind post moved 22.72 m, belt post y 0.35 -> 0.35.
- After the fix: auto-lands `32 PASS`, minGap 3.61 m, 0 blocked, behind post moved 0.00 m, belt post y 0.00. robot-stations `35 PASS / 1 FAIL` (D1 `truckAtNew:false`, a G move with no land change, earlier run p1/r6 had the same flake), rerun `36 PASS`. `npx tsc --noEmit -p .` no output.
- tree-expansion alone: `53 PASS / 1 FAIL`, F3 `updateMax 9.7` (gate 8), worst frame 207, next 5.9 ms, p95 1 ms. The measured window is `machines.update` after set-up; `rebuildLand` and `clearSlide` run before it, so this change is not on that path. Not investigated further (test-run limit).

## L6 carried fan vs moved post (2026-10-22, finding 3 of the clearSlide review)

- Fixed: when the hole changed side and carried a fan from its old rim, the fan could glide onto a robot post that `clearSlide` had just moved beside the new spot, because `clearSlide` checked the pole only against tools where they stood before the glide. Now `Hole.glideTargets` (read-only getter over the private glides) goes from `rebuildLand` into `clearSlide`, which rejects a spot whose pole (1.2 m behind the post) is within a gliding tool's footprint radius + 0.26 m of where that tool ends; a tool gliding in above the pole top (1.6 m) does not count. Same idea as `Hole.moveCrateHomes`.
- Red check (new `04_slide_fan` in scenario-auto-lands: a fan 1.4 m past the old rim on the post's side, the post's pole facing the new hole): `1 FAIL / 32 PASS`, `{"poleFan":0.3,"blocked":true}`.
- After the fix: auto-lands `33 PASS`, `{"post":"(-0.96,19.20)","poleFan":11.9,"blocked":false}` (the post took the other side of the path, the next candidate in the existing order); 04_slide_posts unchanged (minGap 3.61, 0 blocked).

## L8: the hole moves 8 m further with each land (2026-10-22)

### Problem
PP (terminal, 2026-10-22): "automatyczne landy powinny dziure oddalac za kazdym razem aby byla dalej i dalej i trudniej bylo do niej dotrzec maszynami" and "poprosze wieksze odleglosci jak napisales". The proposal: 8 m per land instead of 4 m, so the hole stands 15 / 23 / 31 / 39 m from the factory at level 1 of each land (was 15 / 19 / 23 / 27 m), plus 1.2 m per level as before. Order: "PP: bez planu", no job or migration.

Interpretation: only `LAND_STEP` changes; the L6 turns stay unless the probe says a constraint breaks. The slide keeps about 12 m/s; the clamp grows when a slide needs more than 3 s.

### Gotowe, gdy
1. `STEP=8 node <scratchpad>/l8/probe.mjs '[0,-25,25,-40]'` → every land `mm >= 2` and `mf >= 8`, every letter >= 6.8 m.
2. `scenario-auto-lands.js` → all PASS, `01_formula_dist` = `15,23,31,39`, `01_formula_L12` at (41.55, 4.88), `04_forest` slide 3.4-4.4 s.
3. `scenario-letters.js` → all PASS.
4. `scenario-robot-stations.js` → all PASS.
5. `scenario-tree-expansion.js` (alone) → all PASS.
6. `npx tsc --noEmit -p .` → no output.
7. Screenshots `l6-land-0..3` show the hole on each land, inside the fence (by eye).

Ladder: rung 5, one constant (`LAND_STEP`) and the slide clamp's upper bound; no new code.

### Work progress (L8)
- Probe (scratchpad `l8/probe.mjs`, the L6 probe with the step as `STEP`): with 8 m and the L6 turns 0 / -25 / +25 / -40 every constraint holds. Fence margin (edge) >= 4.6 m (Backyard, unchanged) and >= 12.3 m on the new lands; desk, house, shovel >= 12.2 m on the new lands; letters G 15.6, N 12.1, O 27.3, M 44.7, E 58.6 m from every hole path. Allowed turns with 8 m: Garden -43..+28°, Lawn -60..+32°, Forest -60..+37°, so the picks keep 3-20° slack. No turn and no letter moved.
- Slides: Garden 12.7 m, Lawn 27.7 m, Forest 46.6 m. At 12 m/s the Forest slide needs 3.9 s, so the clamp goes from 1-3 s to 1-4 s (Garden 1.06 s, Lawn 2.31 s, Forest 3.88 s). Dust and rumble unchanged.
- Done: `LAND_STEP` 4 -> 8 (`src/data/land.ts`), slide clamp 1-3 s -> 1-4 s and its comment (`src/world/environment.ts`). auto-lands: 01_formula comment, 01_formula_L12 (30.28, 0.77) -> (41.55, 4.88), 01_formula_dist `15,19,23,27` -> `15,23,31,39`, 04_forest slide window 2.5-3.5 s -> 3.4-4.4 s. Letters, robot-stations, mushroom-rim and endgame read spots through `holeCenterFor` or use Backyard spots, so they needed no change. SPEC (distance rule, new PP decision with the quote, slide decision), CHANGELOG `## 2026-10-28 18:00`, BOARD.
- New distances from the factory (level 1 -> level 12 on the same land): Backyard 15 -> 28.2 m, Garden 23 -> 36.2 m, Lawn 31 -> 44.2 m, Dark Forest 39 -> 52.2 m. In real play the hole reaches each land at level 3 / 5 / 8: Garden 25.4 m, Lawn 35.8 m, Forest 47.4 m.

### Check (L8), one run each on a private server (port 5227, CDP 9861, FAKELOCK=1, URL_QUERY='')
- [PASS] 1. probe — `STEP=8 node l8/probe.mjs '[0,-25,25,-40]'` → mm 4.57 / 13.85 / 12.34 / 20.76, mf 13.41 / 12.15 / 12.82 / 23.84, letters G 15.64, N 12.08, O 27.31, M 44.74, E 58.57.
- [PASS] 2. auto-lands — `33 PASS / 0 FAIL`; `01_formula_dist 15,23,31,39`, `01_formula_L12 (41.55,4.88)`, `01_formula_side lateral m 10.7,-15.1,30.5`, `04_forest slideTime 3.9`, `10_scenery_grass ... on the hole path 0`.
- [PASS] 3. letters — `26 PASS / 0 FAIL`, `L0 bad []`.
- [PASS] 4. robot-stations — `39 PASS / 0 FAIL`.
- [PASS] 5. tree-expansion (alone) — `54 PASS / 0 FAIL` (F3 passed this time).
- [PASS] 6. `npx tsc --noEmit -p .` → no output, exit 0.
- [PASS] 7. Screenshots. The `l6-land-0..3` shots from 13_hole_shots show only the controls panel and the factory sign, so they prove nothing. A scratch scenario (`l8/zz-shots.js`: HUD hidden, player 6 m from the factory looking at the hole) saved `l8/shots/hole-L<land>-n<level>.png`. By eye: the hole is visible on every land, on open grass inside the fence, and it gets clearly further away with each land.
- Rejected: fixing the 13_hole_shots camera in the scenario; outside this order (distances), the scratch shots cover the check → separate order if PP wants permanent shots.
- Rejected (orchestrator, 2026-10-22): fixing the camera of 13_hole_shots in scenario-auto-lands.js. Its shots show the controls panel and the factory sign, not the hole; the hole positions are asserted numerically by 01_formula*, and the by-eye check for L8 used clean scratch shots (HUD hidden, view from the factory). Remove or fix the step when the next visual change to the hole needs lasting screenshots.
