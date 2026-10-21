# Secret letters GNOME + shiny shovel

## Problem

PP: "to slowo zamien na literki (o fizyce jak gnomy) porozrzucane po landach (najwiecej w najwiekszym landzie) ktore trzeba wrzucic ale nazwe gry albo skrot jakis np gnome a nie booze" and "ta lopata niech tez bedzie obiektem blyszczacym".
Plan: `docs/ai-work/2026-10-21-plan-secret-letters.md`, section `## Plan (plan-senior, final)`, with PP's answers (Slack 2026-10-21 13:01) at the end.

Interpretation (PP's answers override the senior where they differ):
- The typed code BOOZE is gone. Five gold block letters G N O M E lie in the yard: G on Backyard, N on Garden, O on Neighbour's Lawn, M and E on Dark Forest. Feeding all five to the hole, in any order, gives Green Grog (BOOZED), the Properly Boozed achievement and a coin fountain.
- Once per save, like the shovel (Q3 b): an eaten letter never comes back, also not after a rebirth.
- Letters of lands not bought yet lie at their spots beyond the fence from the first second (Q4 b). The wall keeps the player out until the land is bought. Buying a land never removes or moves a letter. Trees never stand on a letter spot; bushes may cover it, the letter stays reachable (bushes have no collider).
- The golden shovel gets the same pulsing gold glint as the letters.

## Gotowe, gdy (adapted from the senior's "Done when")

Run: `FAKELOCK=1 DEV_PORT=5171 URL_QUERY='' node tools/smoke/smoke.mjs <out> tools/smoke/scenario-letters.js`.
1. L1: fresh save → 5 letters, `G` inside the Backyard fence; pop sampled with a value strictly between 0 and 1 and one above 1, ends at 1; radius 0.5..0.7; dynamic, dominance 0, mass 1.
2. L2: on Backyard N O M E lie outside the fence at their spots and no tree stands within 5 m of any spot (the widest canopy is 4.2 m); after buying Garden all 5 letters are still at their spots and `N` is inside the fence.
3. L3: after Lawn and Dark Forest all 5 letters are inside the fence, still at their spots.
4. L4: `E` fed from the hand → body disabled, mesh hidden, `respawn === Infinity`, still in `list` and `byCollider`; `secrets` has `letter-E`; toast `_ _ _ _ E`; money unchanged; `held === null`.
5. L5: the other four fed → buff, achievement, 250 x valueScale paid, final toast; `consumeLetter('E')` again → no second buff or coins.
6. L6: once per save: all five eaten → a new `Props()` spawns 0 letters; `freshState(st)` (rebirth) keeps the `letter-*` secrets.
7. L7: reload with G, N, O eaten on land 2 → only M and E spawn, both beyond the fence.
8. L8: `freshState(st)` with secrets `shovel`, `letter-G` keeps both.
9. L9: letter at y -12 returns home.
10. L10: reverse order E M O N G completes.
11. L11a / L11b: typed BOOZE does nothing, GNOMERAIN still starts rain; `rg -n "consumeTyped" src` → one call, GNOMERAIN.
12. L12: old save with achievement `booze` and no letter secrets → 5 letters, achievement kept.
13. L13: daily path `freshState()` → no letter secrets, 5 letters; `daily.ts` calls `blockSaves()`, so the main save never sees daily letters.
14. L14: a placed magnet tool leaves a letter alone (< 0.2 m), a kick moves it (> 1 m).
15. L15: a gnome pushes a letter (> 0.1 m); `rg -n "setDominanceGroup" src/entities/props.ts` → 1 line.
16. L0: every spot >= 6.8 m from all 4 hole paths and all 3 slide segments, inside live `env.half - 2` of its land, at least 5 m outside the previous land's fence.
17. L17: shovel glow sprite pulses (>= 3 distinct scales), gone after pickup; screenshots day and night show the glint.
18. L18: HUD says `Letter G` when looking at G.
19. L19: `rg -n "ctx\.props" src/systems/hole.ts` → 0 lines.
20. L20: 26 achievements, `booze` secret with desc `Feed the hole the word GNOME.`; `rg -n "BOOZE\b" src docs/SPEC.md docs/PLAN.md` → 0 lines.
21. L21: own-land letter at `half + 5` → home; chair at `half + 5` stays; a locked-land letter at its spot beyond the fence stays there.
22. L22: letter resting on the house box at y 6.5 → home after ~3 s; a letter flying over the house is not home after 3 frames.
23. Screenshots by eye: letters on grass (pop), a letter beyond the fence, shovel day and night.
24. `npx tsc --noEmit -p .` → no output; `scenario-tutorial-goals.js` → all PASS.

## Summary

- `src/data/letters.ts` (new): the word and the five fixed spots (the senior's spots; L0 proves them).
- `src/world/models.ts`: `letterGeometry(ch)`, block letters from 0.14 m cubes on a 5x7 bitmap.
- `src/entities/props.ts`: letters are props of kind `letter` (gnome physics: no dominance group, mass 1, friction 0.7, bounce 0.15), spawned at boot for every letter not in `secrets`; 0.25 s `outBack` pop-in with a gold burst; pulsing glow sprite; an eaten letter takes the chair's hide path with `respawn = Infinity`; letter-only "send home" when outside the fence and more than 2 m from home, or resting above 2.5 m for 3 s (house, factory), with a new pop and a burst. The shovel gets a wider pulsing glow sprite at the bush's top.
- `src/systems/hole.ts`: `consumeLetter(ch)`: stores `letter-<ch>` in `secrets`, slurp, burst, progress toast; the full word gives Green Grog, the achievement, $250 x valueScale and a save. Early return for a letter already eaten.
- `src/world/environment.ts`: no tree within 5 m of a letter spot (the widest canopy is 4.2 m); bushes stay random.
- `src/main.ts`: typed BOOZE removed, GNOMERAIN and its 120 s cooldown kept. Texts: achievement desc, HUD `Letter G`, mushroom comment, SPEC, PLAN, CHANGELOG, auto-lands plan Reach line.

Ladder: rung 2 for the prop kind, the hide path, the glow sprite (mushroom pattern), progress in `secrets` (the shovel's and the fountain's flag store) and the scenario; rung 6 only for the spot table and `letterGeometry` (no font file allowed).

Odstępstwa from the senior's plan (all forced by PP's answers Q3 b and Q4 b, or found while testing):
1. No `state.letters` field (step 2 dropped): once per save means the same lifetime as the shovel, so eaten letters are `letter-<ch>` entries in `state.secrets`, which `freshState` already keeps through a rebirth. No old-save handling needed.
2. No `spawnLetters()` and no hook in `shop.buyLand` (step 6 dropped): all letters spawn at boot, also on lands not bought. So the shader-program check on a mid-game pop (R12, row 23) has nothing to check and is dropped.
3. Fence rule (R2) adds "and more than 2 m from home": a letter of a land not bought rests at its home beyond the fence and must not be teleported.
4. Tree keep-out around the spots in `rebuildLand` (new): Q4 b puts letters among the forest trees, and PP's answer says the spot must be clear of trees.
5. Row 6 / L6 changed: no second completion exists in a save; L6 now proves "once per save" (reload and rebirth spawn no letters). L7 now expects M and E (beyond the fence) instead of zero letters. L8 checks that `freshState` keeps the letter secrets.
6. Daily challenge rule: the daily starts from `freshState()` and `daily.ts` blocks saves, so it has all five letters and its progress never reaches the main save. No special case.
7. The shovel glint is a scene sprite at the bush's top (y 1.3, scale 3 +- 0.4), not a child at the shovel: as a child it sat inside the bush and was invisible in the day screenshot.
8. L22 runs on Garden: on the Backyard the house stands beyond the fence (z -27.5, fence 22), so the fence rule already sends the letter home at once.

Odrzucone:
- Gold sparks over the shovel every 2 s: tried, not visible in the headless screenshot at 640x360, removed; the wider glow carries the shine.
- A gnome pushing a letter that lies flat: a flat letter is 0.16 m high and gnomes step over it; physics like a gnome, no extra rule.

## Work progress

Commands (dev server `npx vite --port 5171 --host 127.0.0.1 --strictPort --config <scratchpad>/slb/vite.nohmr.config.mjs`, stopped at the end):
- `npx tsc --noEmit -p .` → exit 0, no output.
- `FAKELOCK=1 URL_QUERY='' DEV_PORT=5171 CDP_PORT=9471 MAXPOLL=2200 node tools/smoke/smoke.mjs <scratchpad>/lt-out tools/smoke/scenario-letters.js` → 23/23 PASS, `errors []`.
- `FAKELOCK=1 DEV_PORT=5171 CDP_PORT=9472 MAXPOLL=1600 node tools/smoke/smoke.mjs <scratchpad>/tg-out tools/smoke/scenario-tutorial-goals.js` → 31 PASS, 0 FAIL.

Test fixes on the way (scenario, not game code): L1 sampled 12 frames, the GPU runs near 60 fps so the 0.25 s pop takes 15; L9 dropped the letter at (0, -12, 0), which is under the hole, so it counted as eaten (correct game behaviour), moved to (10, -12, 10); L15 the kicked letter lay flat and the gnome stepped over it, the test now stands the letter up first.

Gotowe, gdy:
1. [PASS] L1 — `PASS L1 letters 5 G inside true scale [0.285,0.519,0.706,0.849,0.956,1.029,1.074,1.096,1.099,...,1.007,1,1] radius 0.539 dominance 0 mass 1.00`
2. [PASS] L2 — `PASS L2 beyond fence on Backyard true nearest tree 5.3 m, after Garden all at home true N inside true`
3. [PASS] L3 — `PASS L3 land 3 all inside at home true [G 0.00,N 0.00,O 0.00,M 0.00,E 0.00]`
4. [PASS] L4 — `PASS L4 enabled false visible false respawn Infinity secrets [letter-E] paid 0 held null toasts "The hole swallowed E: _ _ _ _ E"`
5. [PASS] L5 — `PASS L5 buff true paid 250.00 want 250.00 toasts "... GNOME! The hole is properly boozed."` (second `consumeLetter('E')`: paid and secrets unchanged)
6. [PASS] L6 — `PASS L6 after reload 0, after rebirth 0`
7. [PASS] L7 — `PASS L7 letters ME`
8. [PASS] L8 — `PASS L8 [shovel,letter-G]`
9. [PASS] L9 — `PASS L9 from home 0.00 m`
10. [PASS] L10 — `PASS L10 buff true achievement toasts 1`
11. [PASS] L11a / L11b — `PASS L11a buff false achievements []`, `PASS L11b rain 3.9667`; `grep -rn "consumeTyped(" src` outside input.ts → `src/main.ts:282: ... consumeTyped('GNOMERAIN') ...` (one line)
12. [PASS] L12 — `PASS L12 letters 5 achievements [booze]`
13. [PASS] L13 — `PASS L13 daily secrets [] boot letters 5`; `src/systems/daily.ts:87: blockSaves();`
14. [PASS] L14 — `PASS L14 magnet moved it 0.003 m, kick 6.30 m`
15. [PASS] L15 — `PASS L15 moved 0.40 m`; `grep -n "setDominanceGroup" src/entities/props.ts` → one line (98, the chair/flamingo branch)
16. [PASS] L0 — `PASS L0 bad [] per land 1,1,1,2`
17. [PASS] L17 — `PASS L17 sprite Sprite distinct scales 10 shovel gone true night shade 1.00`; `shovel.png` (day: faint gold halo over the bush) and `shovel-night.png` (bright halo) checked by eye
18. [PASS] L18 — `PASS L18 "MAGNET · Letter G"`
19. [PASS] L19 — `grep -c "ctx\.props" src/systems/hole.ts` → `0`
20. [PASS] L20 — `PASS L20 26 "Feed the hole the word GNOME."`; `grep -rnE "BOOZE\b" src docs/SPEC.md docs/PLAN.md | wc -l` → `0`
21. [PASS] L21 — `PASS L21 G from home 0.00 bursts 1 chair outside true N from home 0.00 -> 0.00`
22. [PASS] L22 — `PASS L22 on the house at y 6.49, home after 4 s true; flying y 6.57 home false`
23. [PASS] screenshots by eye — `letters-pop.png` (G at scale 1.096 on the grass, gold glow), `letter-beyond-fence.png` (N glowing among the trees beyond the fence, no tree on it), shovel day and night as in 17
24. [PASS] `npx tsc --noEmit -p .` → exit 0; `scenario-tutorial-goals.js` → 31 PASS, 0 FAIL

Self-check: every new file, field and branch maps to the spec or a PP answer above; no new dependency; `grep -rn "Math.min(1, dt" src` → 0; Rapier rules kept (no body change inside a query; `savePose` after every teleport; an eaten letter is hidden, never removed). Known limit: the day glint of the shovel is subtle (it sits under a bush on purpose).

## Review fix round

Three findings from the local review, all fixed in `src/entities/props.ts`, checks in `tools/smoke/scenario-letters.js`.

1. A letter slid and spun longer than a gnome, because its body had no damping. It now uses the gnome's damping (linear 0.15, angular 0.6). Check: `PASS L1damp linear 0.15000000596046448 angular 0.6000000238418579` (red before: `FAIL L1damp linear 0 angular 0`).
2. When the player carried a crate with a letter in it up high for 3 s, the letter jumped home out of the crate, because the "rests high" rule only skipped a letter held by hand. The rule now waits while the player holds anything. Check: `PASS L22held held crate true letter y 6.08 home false` (red before: `letter y 0.08 home true`).
3. Animation rule 3: a letter sent home (fence, roof, off the map) vanished with no cue at the old spot, and the shovel glint vanished in one frame on pickup. Now a gold burst (12 particles) marks the old spot before the teleport, and the glint shrinks to 0 over 0.2 s with `inQuad`, then leaves the scene. Checks: `PASS L21burst bursts at [27.0,0.0 n 12,15.0,-15.0 n 12]`; `PASS L17 ... glint fade [3.383,3.36,3.289,3.172,3.007,2.795,2.537,2.231,1.88,1.48,1.033,0.541,0.003,0]`.

Run: `FAKELOCK=1 URL_QUERY='' DEV_PORT=5175 CDP_PORT=9377 MAXPOLL=1600 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-letters.js` → 26/26 PASS, no errors; `npx tsc --noEmit -p .` → exit 0.
