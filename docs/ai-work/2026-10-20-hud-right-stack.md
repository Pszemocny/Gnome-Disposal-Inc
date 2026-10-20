# HUD right stack, Trick Scope levels, shop tab badges, Magnet Gun pull

Plan: `docs/ai-work/2026-10-20-plan-hud-right-stack.md`, `## Plan (plan-senior, final)`.

## Batch 1 (steps 1-5: C badges, D pull without beam, B8 quiet ball)

Interpretation: PP asked for (C) a green number over each shop tab with the count of things he can buy now, nothing when he cannot buy anything; (D) no magnet beam on LMB and the Magnet Gun pulling all gnomes at once instead of one every 0.08 s. Question 2 = a: the pull takes as many as the ball fits (`ballCap`), all in the same frame; the rest stays on the ground until there is room. Batch 2 (steps 6-13) is not part of this run. `VOLLEY_CAP` stays 8 (not touched).

### Problem

- The gun pulled one gnome every 0.08 s, so a crowd came in visibly one by one.
- A cyan beam was drawn from the hand or gun to the target on every LMB hold.
- The shop showed no hint which tab has something affordable.
- A big ball of gnomes spoke, so speech bubbles covered the crosshair.

### Summary

- `src/player/player.ts`: beam mesh, `MUZZLE`, `collectCd` and the idle beam branch deleted. New `ballCap` getter (`ceil(22 * (ballR / 0.8)^1.5)`: 22 / 75 / 145 at Coil 0 / 5 / 10). New `coneTargets()` (every grabbable gnome in the cone, best dot first); `coneTarget()` returns its first. Gun branch: one batch per frame, `min(N, ballCap - swarm.length)`, the gnome under the crosshair first, the whole batch pushed into `swarm` before `hold`, one whoosh when the pull starts. `grab()` no longer whooshes; the hand branch does.
- `src/entities/gnomes.ts`: the hold line and the struggle line are skipped while the player's swarm has more than 3 gnomes.
- `src/ui/shop.ts`: `affordCount(tab)` (the same rule as the green pulse: `rowData().afford`, Land: the next tier), `.tab-n` pill in each tab, a changed non-zero count pops with the existing `pop()` (callers now pass the full selector).
- `src/data/upgrades.ts`: Magnet Dish desc says "a wider cone".
- `CHANGELOG.md`: three lines (C, D, B8).
- Ladder: rung 1 (beam, `collectCd`, the timed collect deleted), rung 2 (`forEachNear`, `rowData().afford`, `landItems()`, `shop.pop`, `say` guard), rung 5 (`ballCap` one line), rung 6 (`coneTargets` ~12 lines, badge loop ~5 lines).

Odstępstwa (from the plan):
- Step 3: the tab template uses a block-body arrow (`const n = this.affordCount(t)` inside `tabs.map`), as the plan's text says, instead of a helper.
- Done-when D1/D12/D2/D13: the test field uses Magnet Dish 5 (wider cone) so 80/150 gnomes fit the cone; the cap and the counts do not depend on Dish.
- Done-when D10: "outside the cone dot" cannot be built: `lookAt.gnome` comes from the crosshair ray (≤ 4.5 m), so it is always in the cone. Tested instead: the gnome under the crosshair, with 10 others in the cone, is `swarm[0]`.
- Done-when D6: setting only `s.out = 1` on an in-ball gnome does nothing (`updateSwarm` resets `out` while `inBall`); the test moves the gnome out of the ball first, then sets `out`.
- Done-when D2: "median non-increasing" is checked with 0.1 m tolerance; once the gnomes reach the ball surface the median jitters by ~0.05 m.
- Done-when C3: buying Steel Toes keeps the Plow count (3 → 3), so nothing pops (correct by C3's row). The test buys Leaf Blower at $400 / hole 1 instead (Plow 2 → 3, Turbo Fan and Long Nozzle unlock).

Odrzucone:
- none.

Niepewne:
- Gnomes on the ground still say their wake-up line ("*yawn*") near a full ball (`gnomes.ts:305`, not the hold or struggle line); B8 covers only the ball. Seen once in `gun-cap150.png`.

### Gotowe, gdy (batch 1) — evidence

Scenarios (scratchpad `smoke/`): `scenario-gun-pull.js` (B8, D1-D13), `scenario-shop-badges.js` (C1-C7); dev 5199, `CDP_PORT=9391/9392`, headless Chromium 640x360 on Metal.

- [PASS] B8 — `"B8_bubbles":{"frames1to30Max":0,"max20over5s":0,"swarm20":19,"max2over5s":2,"swarm2":2,"pass":true}`
- [PASS] B9 — `grep -n "1.2 + this.ballR" src/player/player.ts` → `605: return this.eye.addScaledVector(this.dir, 1.2 + this.ballR);` (unchanged line)
- [PASS] B10 (batch 1 part, step 4) — `grep -n "wider beam" src/data/upgrades.ts` → nothing; `grep -n "wider cone"` → `33:`
- [PASS] C1 — `"magnet":4,"ownMagnet":4,"bg":"rgb(58, 223, 106)"`, all 7 money tabs equal the scenario's own count (Plow 3, Magnet 4, Factory 4, Movement 5, Tools 11, Combos 4, Bonuses 6)
- [PASS] C2 — money 0 → `"n":0`
- [PASS] C3 — Leaf Blower buy: `after {"Plow":3,"Magnet":1,"Tools":4,...}`, `pops {"Plow":1,"Magnet":1,"Tools":1,"Factory":0,"Movement":0,"Combos":0,"Bonuses":0}` (only changed non-zero counts pop), Steel Toes `kickPop 0`, tab switch → `afterSwitch` all 0
- [PASS] C4 — `"hole3":1,"hole1":0`
- [PASS] C5 — `"deep":4,"ownDeep":4,"deepTabHidden":true`
- [PASS] C6 — 640 px: `.tl` display `none`, pill `[90,80,106,96]` on the tab `[69,82,102,128]` corner (within the designed -2/-4 px); screenshot `out-badges/badges-640.png` checked by eye (pills readable on all 8 tabs)
- [PASS] C7 — hole 1, $1e9: Plow badge `2` = own filter (tractor and plowWidth excluded) of 6 Plow ids
- [PASS] D1 — `caps {"0":22,"5":75,"10":145}`; 80 in the cone → `"firstFrame":1,"swarm1":75`; 20 → `"swarm":20` after 1 frame
- [PASS] D2 — median samples `4.55, 4.55, 4.36, 3.92 … 1.52, 1.52, 1.5, 1.47`, `rises 0`, `inBall 71` (range 64-75)
- [PASS] D3 — `beamField` undefined, `grep -c "beam\|MUZZLE\|collectCd" src/player/player.ts` → `0`, opacity-0.7 cylinders: gun 0, hand holding 0, idle LMB 0
- [PASS] D4 — `"sparks":true,"coil":0.4`
- [PASS] D5 — gnome put in the cone with LMB held → `"joinedOnFrame":1`
- [PASS] D6 — `"left":true,"lock":0.98,"backWithin1s":false,"backAfter":true`
- [PASS] D7 — Coil 10, Dish 5, 320 in the cone, 300 frames: `spikeMs 1.7` (max frames 1-10) ≤ 3 × `steadyMs 2.02` (frames 100-300); `player.update` 0.56 ms pulling vs 0.18 ms empty cone; `physics.step` 1.31 ms empty cone; swarm 145 = cap
- [PASS] D8 — no gun: `"heldGnome":true,"swarm":0,"whooshes":1`
- [PASS] D9 — prop in the cone, gun, 1 s → `"held":null,"propMoved":0`
- [PASS] D10 — `"lookAtIsIt":true,"first":true` (see Odstępstwa)
- [PASS] D11 — scenarios that read the deleted beam (broken by design): `scenario15.js`, `scenario15-wait.js`, `scenario-gun-look.js`, `scenario-broom.js`; `zz-scenario15-scope.js` only logged `beam.visible`, that field was removed from it. `scenario-fuses.js:37` still reads the newest toast (step list 30/31 green, below)
- [PASS] D12 — 150 in the cone, 180 frames: `"maxSwarm":75` (≤ 80), `"ground":72` (≥ 60); screenshot `out-gunpull/gun-cap150.png` checked by eye
- [PASS] D13 — 80 in the cone: `"whooshOnBurst":1,"whooshFrames2to10":0`; `grep -n "puff" src/player/player.ts` → nothing
- [PASS] tsc — `npx tsc --noEmit` → exit 0
- [PASS] `grep -rn "Math.min(1, dt" src` → 6 old lines (sweeper, environment ×2, coins, events, gnomes:510), none in this diff
- [PASS] `LOGS:` empty in every batch 1 run

### Regression list

- `scenario-magnet-gun.js` — 3a Coil 0 held 15 (15-25), 3b Coil 5 held 67 / maxSwarm 75, 7a/7b crate held, `LOGS:` empty. Fix in the scenario: 7a waits for `grabCd` to reach 0. Step 5's throw sets 0.4 s, the paused shop step does not count it down, so at 60 fps 7a pressed LMB while the cooldown still ran (failed 2/2 before the wait, also 2 of 7 older runs).
- `scenario-volley-tricks.js` — volleys of 6 and 8 eaten, big texts `VOLLEY · LONG SHOT x2.5 + AIR x2 = x5 (8 gnomes)`, `LOGS:` empty.
- `scenario-skill-tree.js` — 20/20 pass, `LOGS:` empty.
- `zz-scenario15-scope.js` — after dropping the `beam` field: `massive_lifts_at_base` y 1.18, `arc_green_when_aimed_at_hole` green at 0.15 and eaten 1, hoop bullseye, `LOGS:` empty.
- `scenario-fuses.js` — 30/31 on the second run. `29_icon_effect` expected `1 fuses`; `shop.ts` EFFECT now says `1 fuse` (singular), so the expectation was updated to `1 fuse, 2 hits to break` → pass. `24_real_saboteur` failed 2 of 3 runs (one blow, then no second in 40 s) and passed on the third (blows at 0.5 s and 12.7 s, break at 28.3 s); the fuses note already calls this run flaky. Batch 1 touches only the speech line in the saboteur's path, and a solo probe (`tmp-sab24.js`) blows at 1 s and 13 s.

Orchestrator (2026-10-20): batch 1 built to 5300 (`index-Wlcno-gA.js`). The flaky `24_real_saboteur` went to its own investigation (result in `2026-10-20-fuses.md`). Rejected: silencing the "*yawn*" of gnomes waking on the ground next to a full ball — they stand on the ground, not in the ball in front of the crosshair, and a wake line lasts about a second; PP's complaint was the swarm covering the centre.

## batch 2: A (left)

Interpretation: PP's later decision overrides the plan's right column. One column on the LEFT: GOAL, contract, then the mushroom effects card in the contract's style, then the messages (newest on top, "a gnome escaped" included), nothing on top of anything. Money stays top right. "Crate full" is floating text above that crate, not a message. Plan item A (steps 9-11, 13 A parts) adapted to the left.

Gotowe, gdy (A rows of the plan, adapted to the left, plus the new ones):
- L1 column on body, children GOAL, contract, effects, messages; contract pops (scale > 1.05 then 1)
- A2 effects card under the contract: `EFFECTS`, row `🍄 Red Combo Cap 20 s`, border `rgb(192, 138, 255)`
- A3/A16 last effect ends: height samples between full and 0, rows stay until hidden, then empty; the message below moves up by height + 8 px
- A4 Midas / Golden Hour / OVERTIME / Wind rows, `Midas x3` with `15 gnomes`
- A5 a message is the last DOM child, drawn at the top; grows in (height and slide samples), leaves after 4.2 s, opacity near 0 before removal; `grep -c setTimeout src/ui/hud.ts` → 1
- A6 five messages → 5 cards, the oldest leaving at once, 4 after 0.5 s; A7 the same text 3x → one card ending `×3`
- A8 (changed, see Odstępstwa) paused → GOAL / contract / effects hidden, messages visible and still leave after 4.2 s
- A9 achievement card in the message list, gold border, gone after ~5 s; no `.hud-ach`
- A10 1280x720, GOAL + contract + 6 effect rows + 4 messages + combo 30: no pair overlaps, column bottom above the magnet panel, combo clear
- N1280 / N1920 / N640 neighbours: help card (H), first-use hint, banner, tool line, magnet panel, hotbar, combo, hole bar, money: none intersects the visible column; at 1280 and 1920 the help card intersects none of banner, hint, combo, money, hole bar, glass, tool line, hotbar, magnet panel; hole bar clear of money at $123k; at 640x360 the newest message is fully visible and `.ef-head` is hidden
- A15 contract done → hidden ≤ 0.25 s, the next one is child 2 of the column again
- A17 effect starts during the leave → panel never hides, new row shown, height never drops
- S shop open, two buys → 0 new messages, status bar has the message, GOAL hidden behind the shop
- K crate fills → `Crate full!` float text 1.2 m+ above the crate (within the ±0.6 m jitter), on screen above it, no message
- tsc → exit 0; no new `Math.min(1, dt`; regression scenarios green, `LOGS:` empty

### Summary (batch 2: A)

- `src/ui/hud.ts`: new `left` column (on `document.body`, so messages stay over the shop and menus as the screenshot batch decided) holding the GOAL panel, the effects card and the message list; `Contracts` inserts its panel as child 2. Messages and achievements are `Card`s animated in `Hud.update` (grow 0.3 s: height, padding, gap with `outCubic`, slide with `outBack`; hold 4.2 s / 5 s; collapse 0.35 s with `inQuad`), at most 4 live, a repeat bumps `×N`. No `setTimeout` for messages. The effects card uses the same curve, keeps its rows while it collapses and grows back if an effect starts during the leave. Midas row says x3 (the code multiplies by 3). The column gets class `paused` while the game is paused. Tool line styles moved from inline `cssText` to `style.css` so a media rule can move it.
- `src/ui/style.css`: `.hud-left` (left 16, top 16, bottom 94 = above the magnet panel, width 300, flex column, gap 8, clips at the bottom so the oldest messages go first, z 35), `.hud-left.paused` hides the panels, `.hud-effects` / `.ef-*` / `.toast` / `.toast.ach`; GOAL no longer absolute; old `.hud-buffs`, `.buff`, `.hud-ach`, `@keyframes ach/tin`, `.toast.out` deleted. `max-height: 480px` compacts the panels; `max-width: 700px` narrows the column to 210 px and moves the hole bar, tool line, hint and banner right of it (money 30 px). Help card (H) moved to the right under the money and the banner (top 164, 550 px, two text columns); while it is open the combo sits at 70 % height.
- `src/systems/contracts.ts`: panel CSS without position, inserted into the column, the `top` computation and `goalEl` deleted.
- `src/entities/machines.ts`: the crate-full toast became `ctx.fx.floatText(above the crate, 'Crate full!', green)` (one line).
- `src/ui/shop.ts`: `say()` no longer sends a HUD toast; the status bar is the buy message.
- `BOARD.md` (Interfejs), `CHANGELOG.md` (next build).
- Ladder: rung 1 (`setTimeout` toasts, `.hud-ach`, `@keyframes`, contract `top` math, shop buy toast deleted), rung 2 (`h()`, `outBack/outCubic/inQuad`, `fx.floatText`, the contract card style), rung 3 (flex column, `column-reverse`, CSS columns, `:has`, media queries), rung 6 (`Card` + `animCard` + `effects()` ~60 lines).

Shop decision (brief: buy toasts duplicate the status bar and cover the tree at 640x360): the shop no longer sends buy toasts. Simplest fix: one deleted line; the status bar already shows the message. Toasts stay on top of the shop for everything else (the P screenshot "📸 saved" is the one PP needs to see there). Rejected: hiding the whole message list while the shop is open, because then "📸 saved" would not show in the shop (screenshot batch row 3); shifting it, because the shop window is 96 % wide and there is no free side.

Odstępstwa:
- A1/A14 (plan: right column, legend "on the right"): PP moved everything to the left; the legend line 58 ("under the GOAL panel") stays true, not changed.
- A8 (plan: message timers stop while paused): timers keep running in real time, as before this change. The plan paused them so a buy message is read after the shop closes; buy messages are gone now, and a frozen message would sit over the shop or menu until it closes.
- A10/A11 numbers: the column starts at the top under nothing (GOAL is in it), bottom 94 px (magnet panel), not top 96 / bottom 100; 640x360 checks the newest message, not "contract + 2 effects + 1 toast all visible" with GOAL added on top (GOAL + contract + 2 effects + 1 message fit; more messages clip from the oldest).
- Not in the plan: the help card (H) moved to the right (it sat on the left edge, centred, where the column grows); combo at 70 % while help is open; at ≤ 700 px width the hole bar, tool line, hint and banner move right of the column and money is 30 px.
- Contract pop overshoot (outBack ~1.1) briefly covers ~8 px of the card below for 0.2 s when a contract rolls; kept (existing animation, plan A15 accepted the same).

Odrzucone:
- Magnet panel touching hotbar slot 1 at 1280x720 with 10 tools and the gun in hand (`1280-neighbours.png`): bottom row, not the column; needs a hotbar/magnet panel layout → osobne zlecenie.
- At 640x360 the hotbar with 10 tools is wider than the window and under the magnet panel: same, → osobne zlecenie.
- At 640 px width the help card (opened with H) covers the hint, banner and combo: no free area that size on a 640x360 screen; it is opened and closed by the player.
- Crash box (bottom left, z 100) covers the bottom of the column when an error shows: it is the error overlay and must stay on top.
- `scenario-broom.js` not run: broken by design since batch 1 (reads the deleted beam).

Niepewne:
- At 640x360 the column holds GOAL + contract + 2 effects + the newest message; a second message shows cut at the column bottom (oldest clip first, as designed).

### Gotowe, gdy (batch 2: A) — evidence

Scenario `scenario-left-stack.js` (scratchpad `smoke/`), `CDP_PORT=9399`, dev 5199, out `ls2-scenario-left-stack/`, `LOGS:` empty. Screenshots checked by eye: `1280-full.png`, `1280-neighbours.png`, `1920-neighbours.png`, `640-neighbours.png`, `640-shop.png`, `1280-crate-full.png`.

- [PASS] L1 — `{"parentIsBody":true,"kids":["hud-goal","hud-contract","hud-effects","hud-toasts"],"pop":[0.242 … 1.099 … 1.005,1,…]}`
- [PASS] A2 — `{"head":"EFFECTS","row":"🍄 Red Combo Cap20 s","border":"rgb(192, 138, 255)","below":true}`, height samples `9.6 … 60.3px`
- [PASS] A3/A16 — `{"h":61,"between":20,"rows":[1 x20],"display":"none","inner":"","moved":69}` (61 + 8)
- [PASS] A4 — 5 rows, `"✨ Midas x315 gnomes"`
- [PASS] A5 — `{"isLast":true,"mid":17,"tx":[-22.8 … 0.56 … 2.97 …],"goneMs":4167,"minOpBeforeRemoval":0.001}`; `grep -c setTimeout src/ui/hud.ts` → `1`
- [PASS] A6/A7 — `{"n5":5,"oldestOp":"0.41","after":["two","three","four","five"],"merged":["same×3"],"tops":[["old",269],["new",230]]}`
- [PASS] A8 (changed) — `{"vis":["hidden","hidden","hidden"],"toastVis":"visible","goneWhilePausedMs":4398,"back":"visible"}`
- [PASS] A9 — `{"found":true,"border":"rgb(255, 210, 63)","goneMs":5032,"oldAch":null}`
- [PASS] A10 — `{"n":8,"lowest":591,"colBottom":626,"sackTop":634,"pair":false}`, combo `[997,409,1240,600]` clear of the column
- [PASS] N1280 — `"hits":[],"helpHits":[],"holeMoney":false`, help `[714,164,1264,368]`, combo 72 `[930,378,1242,626]`, banner `[455,90,825,158]`
- [PASS] N1920 — `"hits":[],"helpHits":[],"holeMoney":false`, help `[1354,164,1904,368]`, combo `[1568,623,1884,878]`
- [PASS] N640 — `"col":[16,16,226,266],"hits":[],"holeMoney":false,"newestRect":[205.6,241.2],"efHead":"none"` (help card overlaps accepted, see Odrzucone)
- [PASS] A13 — `grep -n "downpour\|crave\|parade" src/ui/hud.ts` → nothing; rows only for mushrooms, Midas, Golden Hour, OVERTIME, Wind
- [PASS] A15 — `{"hideT":0.2,"next":"bullseye","second":true}`
- [PASS] A17 — `{"at":60.63,"min":60.88,"hidden":false,"row":"EFFECTS🍄 Blue Zoomies19 s"}`
- [PASS] S — `{"n0":0,"n1":0,"bar":"Trampoline bought! Press 2 to place it.","goalVis":"hidden"}`
- [PASS] K — `{"cap":12,"queue":12,"found":true,"dx":0.4,"dy":1.9,"dz":0.4,"textRect":[623,259,755,293],"crateScreen":[640,415],"toastFull":false}`
- [PASS] tsc — `npx tsc --noEmit` → exit 0
- [PASS] `grep -rn "Math.min(1, dt" src | wc -l` → `0`; `grep -rn "hud-ach\|hud-buffs\|achEl\|buffsEl" src` → nothing
- [PASS] regression (`CDP_PORT=9399`, `LOGS:` empty in all): `scenario-shop-computer.js` 21/21 pass, `shot.js` rows 1-3 (`toastTop:true`, `toastClickThrough:true` over the shop), `scenario-gear-wheel.js` 28 pass / 0 false, `scenario-contracts.js` (pop `0.62 … 1.1 … 1.05`, `failedToast:true`), `scenario11.js` (`hudWind:true`), `scenario-fuses.js` (toasts `Auto Crank ON`, `Auto Crank OFF (buy Auto Crank …)`), `scenario-wheel.js`, `scenario-blower.js`, `scenario-tractor.js`, `scenario-hints-fall.js`, `scenario-robots2.js`, `scenario-settings.js`, `scenario-scope.js` ran to `RESULT`.
- Fixture changes (expected values after the decided behaviour change): `scenario-shop-computer.js` `20_msg` expects 0 HUD toasts (was 2); `scenario-gear-wheel.js` `G13` and `K1_K2` read the buy message from `.shop-msg` instead of the HUD toast; `scenario11.js` reads `.hud-effects` instead of `.hud-buffs`. `scenario-blower.js` now logs `…hands.×7` (seven equal C-key messages merged, A7); `scenario-robots2.js` `buyToast` logs the previous message (the buy has none); neither asserts these.
- First regression run of `scenario-left-stack.js` stopped after `A9` without `RESULT`, cause not checked; the rerun (after the 640 compaction tweak) finished, all 17 steps pass.


Interpretation: PP wants the Trick Scope to work at the crosshair, not above the hole. Lvl 1: the crosshair turns green when the throw ends in the hole, gold on a trick. Lvl 2: a round reflex glass around the crosshair names the trick (the label above the hole goes away from Lvl 2). Lvl 3: the glass adds the distance and the multiplier. Only item B (steps 6, 7, 8, B parts of 9-10, 12, B part of 13); item A (stacked column, now on the LEFT) is not in this run. `VOLLEY_CAP` stays 8.

Gotowe, gdy (from the plan's `### Done when`, B rows; B8-B10 batch-1 parts already PASS above):
- B1 scope 0 holding → no `.crosshair.on`, `.hud-glass` opacity 0, `arc.visible` false
- B2 scope 1 → classes `on hole` + green border, hoop → `trick` gold, away → neither; pop: scale > 1.1 then 1; one animation on the change frame
- B3 release → no `on`, width 8px
- B4 scope 2 → glass opacity 0 → 1 over ≥ 3 frames, scale > 1 then 1; release → 0 in 0.3 s; readout stroke 3px
- B5 scope 2 LONG SHOT → glass text `LONG SHOT`, `.aim-label` hidden; scope 1 → `.aim-label` `LONG SHOT`; away → glass text empty, no hole/trick class; text pop > 1.1 then 1
- B6 scope 3 hoop at 9.2 m → `BULLSEYE · 9.2 m · x20`; ball of 5 → `x8`; miss → empty, `aimMult` 1
- B7 z-index crosshair 6, glass 5, big 5
- B10 rest → 3 pips, $300 / $600 / $1.2k, desc has `reflex glass`
- B11 save scope 1 → L1 behaviour, glass 0
- B12 scope 2 holding + placing → glass 0, crosshair plain
- B13 crate at the hole → `hole`, `IN THE HOLE`, `aimMult` 1
- B14 screenshots 1280 ball + crate, checked by eye; plus crosshair green, gold, glass L2 and L3 at 1280x720 and 640x360
- B15 640x360 combo 60 → combo and glass do not intersect, combo top ≈ 72px
- `npx tsc --noEmit` → exit 0; no new `Math.min(1, dt`; regression scenarios green, `LOGS:` empty

### Summary (batch 2: B)

- `src/systems/hole.ts`: `TRICK_CAP` and `VOLLEY_CAP` exported (values 20 and 8 unchanged).
- `src/data/upgrades.ts`: Trick Scope max 3, growth 2 ($300 / $600 / $1.2k), desc names the three levels.
- `src/player/player.ts`: `scopeT` public; `predict` sets `aimInHole`, `aimDist` (release point to hole centre) and `aimMult` (distance band x AIR 2 x hoop 5, capped 20, or 8 with more than one gnome held; 1 on a miss or a crate).
- `src/ui/hud.ts`: crosshair element kept; class `on` + `hole`/`trick` while holding (Lvl 1+), a 250 ms outBack pop on a state change (Web Animations, not restarted while running); `.hud-glass` with `.glass-read` (Lvl 2+): opacity = preview fade, scale `0.85 + 0.15 * outBack(scopeT)`, readout = trick name or IN THE HOLE, Lvl 3 adds `· 9.9 m · x20`; empty on a miss; readout pops 0.2 s on a new text. The label by the landing ring shows at Lvl 1 only.
- `src/ui/style.css`: `.crosshair` z 6 + transitions, `.crosshair.on` ring + dot, `.hole` green, `.trick` gold; `.hud-glass` (z 5) and `.glass-read` with the `.aim-label` stroke; at width ≤ 700 px a smaller combo at the right edge.
- `src/ui/shop.ts`: `EFFECT.scope` per level.
- `docs/PLAN.md` (controls line, Magnet tab line), `CHANGELOG.md` (`## next build (not on 5300 yet)`).
- Ladder: rung 2 (existing crosshair element, `predict` thresholds, `outBack`, the `shop.pop` animate pattern, the `.aim-label` stroke), rung 3 (CSS transitions, Web Animations), rung 6 (glass block ~20 lines in `hud.ts`, ~15 CSS lines).

Odstępstwa:
- B15: the plan's `@media (max-width: 700px) { .hud-combo { top: 20%; } }` assumed the combo at `right: 340px` next to item A's right column. A moved to the left, so the combo stays at `right: 40px`; with `top: 20%` the 60-combo box went off the top of the screen (rect top -49) and still crossed the glass. Replaced with a smaller combo at ≤ 700 px (`right: 12px`, number 24 px, ring 56 px). `top ≈ 72px` is not asserted; the no-intersection check is.
- B2/B5 pops: not restarted while one is running (a path on the hole edge flips state every few frames; each flip restarted the pop). B2's "`getAnimations().length === 1`" counts only the pop: CSS transitions on the same element are also listed by `getAnimations()`.
- B6: the readout text at 9.9 m through the hoop is `LONG SHOT + BULLSEYE · 9.9 m · x20` (the plan's example dropped `LONG SHOT +`). The volley case held 4-5 gnomes (a turn sheds one now and then); the cap is 8 for any ball with more than one.
- B11: tested by setting `state.upgrades.scope = 1` (what the loader fills), not by loading a saved file.
- B12: placing mode is entered with `player.selectTool('fan')`, which drops what is held, as in the game (pressing a tool key).

Odrzucone:
- none.

Niepewne:
- A single hand-held gnome still speaks; at 1280x720 its bubble can sit under the readout (`glass-L2-1280.png`, readout still readable over it). B8 covers only balls of more than 3.

### Gotowe, gdy (batch 2: B) — evidence

Scenario `scenario-scope-levels.js` (scratchpad `smoke/`), `CDP_PORT=9392`, dev 5199, out `out-scope/`; `LOGS:` empty.

- [PASS] B1 — `{"held":true,"on":false,"glassOp":"0","arc":false}`
- [PASS] B2 — green `{"cls":"crosshair hole on","border":"rgb(58, 255, 138)"}`, gold `{"cls":"crosshair trick on","border":"rgb(255, 210, 63)"}`, away `"crosshair  on"` (white), pop scales `1, 1.2, 1.34, 1.21 … 0.93 … 1`, `changeAnims 1`
- [PASS] B3 — release → `{"cls":"crosshair ","w":"8px"}`
- [PASS] B4 — opacity `0, 0.23, 0.42 … 1`, scale `0.85 … 1.01 … 1`, release `0.93 … 0.23, 0` within 0.3 s, stroke `3px`
- [PASS] B5 — Lvl 2 `"text":"LONG SHOT"`, `.aim-label` display `none`; Lvl 1 `.aim-label` `"LONG SHOT"`; away text `""`, class `"hud-glass "`; text pop `1.2, 1.11, 1.05 … 0.97 … 1`
- [PASS] B6 — one gnome `"LONG SHOT + BULLSEYE · 9.9 m · x20"`, ball of 4 `"LONG SHOT + BULLSEYE · 10.1 m · x8"`, miss `{"text":"","aimMult":1}`
- [PASS] B7 — `{"cross":"6","glass":"5","big":"5"}`
- [PASS] B10 (rest) — `{"pips":3,"c0":"$300","c1":"$600","c2":"$1.2k","descData":true}`
- [PASS] B11 — Lvl 1 run: B2 holds, `"glassOp":"0"`
- [PASS] B12 — `{"before":"1","placing":"fan","op":"0","cls":"crosshair "}`
- [PASS] B13 — `{"heldCrate":true,"cls":"crosshair hole on","text":"IN THE HOLE","aimMult":1}`
- [PASS] B14 — `{"swarm":64,"cls":"crosshair hole on","text":"IN THE HOLE","op":"1"}`; screenshots checked by eye: `cross-green-640/1280`, `cross-gold-640/1280` (gold ring + LONG SHOT by the landing ring), `glass-L2-640/1280`, `glass-L3-640/1280`, `1280-ball-scope.png` (ring and readout readable over 61 gnomes), `1280-crate-scope.png` (prompt crosses the ring, readable)
- [PASS] B15 — 640x360, combo 60: combo `[453,101,630,262]`, glass `[250,110,390,250]`, `hit false`; `640-combo-glass.png` checked by eye
- [PASS] tsc — `npx tsc --noEmit` → exit 0
- [PASS] `grep -rn "Math.min(1, dt" src` → 6, the same old lines as batch 1
- [PASS] regression: `zz-scenario15-scope.js` (arc green at 0.15, eaten 1, hoop bullseye), `scenario-magnet-gun.js` (3a held 15, 3b 63 / maxSwarm 75, 7a/7b crate held), `scenario-gun-pull.js` (all pass), `scenario-volley-tricks.js` (volleys of 9 and 6 eaten, `LONG SHOT x2.5 + AIR x2 = x5`), `scenario-skill-tree.js` (20/20); `LOGS:` empty. The first `zz-scenario15-scope` run hung after `[vite] server connection lost` (the dev server restarted while another session edited files); two reruns passed.
