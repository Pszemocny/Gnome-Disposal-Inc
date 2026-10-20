# Push broom and plow tractor (PP via hub T-20261019-03, 2026-10-19)

## Problem

PP (Slack, verbatim): "niech doda grabie albo zmiotke i jako upgrade traktorek ze spychem gdzie upgrade poszerza spych".
Translation: add a rake or a broom; as its upgrade a small tractor with a plow blade; a further upgrade widens the blade.
Hub acceptance: the tools are bought and shown like the existing ones (same shop, same pricing model, same UI).

## Choice: broom, not rake

A broom pushes things away from you, a rake pulls them towards you. The goal of the game is to get gnomes into a hole in front of you, so pushing is the useful direction, and the tractor's plow blade also pushes. Broom → plow is one mechanic that grows (same push, wider and faster), a rake would be a different mechanic that the tractor then replaces.

## Plan (orchestrator, final)

Written by the orchestrator (hub task, no interactive questions allowed). New code goes to a new file `src/player/sweeper.ts` (class `Sweeper`, owned by the player, called from `player.update`). Touch points: `src/data/upgrades.ts`, `src/player/player.ts` (hooks only), `src/ui/hud.ts` (status line + help panel H), `src/world/models.ts` (broom and tractor models from primitives), `docs/PLAN.md`.

1. **Shop (Movement tab, same `U(...)` entries, same buy flow):**
   - `broom` "Push Broom": "Press C to hold a broom. Hold LMB to sweep gnomes forward." max 1, $60, growth 1, hole 1.
   - `tractor` "Plow Tractor": "Upgrade for the broom: press C to drive a tractor with a plow blade. It pushes every gnome in front of it (needs the Push Broom)." max 1, $1500, growth 1, hole 3.
   - `plowWidth` "Wider Plow": "+0.8 m plow blade width (needs the Plow Tractor)." max 5, $700, growth 1.7, hole 3.
   Movement tab, so `TOOL_IDS` (placeable tools, Tools tab) does not change and digit hotkeys stay the same. The shop's now/next preview (polish C) gets lines for the three ids if it has a per-id table.
2. **Equip (key C):** C cycles hands → broom → tractor (if owned) → hands. Without the broom C shows the toast "Buy the Push Broom in the shop (Movement)." Equipping drops whatever the magnet holds (`dropAll()`), cancels placement; while the broom or tractor is out, LMB does not grab and RMB does not throw. Selecting a tool to place (digits, G) puts the broom away. The equipped state is not saved (starts as hands).
3. **Broom:** a broom model held in front of the camera (view model, bottom right), sways while sweeping. Hold LMB = sweep: each physics step every gnome in a box in front of the player (0.3..1.5 m ahead, 1.4 m wide, feet to 1.2 m above the feet) that is not `held`/`stashed`/`falling` becomes `ragdoll` (use the existing gnomes helper that knocks a gnome down, the way kick does) and its horizontal velocity is steered towards the player's forward direction at `max(3.5, playerSpeed + 1.5)` m/s (steer, not teleport; keep vertical velocity, add a small lift 0.5 m/s only when it is on the ground). Mass-independent (set velocity, not impulse) so every weight class is swept the same. Swish sound from `audio` (reuse an existing synthesised sound if there is a suitable one, otherwise a short noise burst in `audio.ts`).
4. **Tractor:** the player rides it: a tractor model under the camera (body, 4 wheels that spin with speed, a blade in front), camera 0.4 m higher. Move speed x1.25, no sprint bonus, jumping stays. The blade sits 1.6 m in front of the player, width `2.6 + 0.8 x plowWidth` m (blade mesh scaled to the width), height 0.9 m. Every gnome inside the blade box (depth 0.9 m) is pushed exactly like the broom, but always (no LMB) and only while the tractor moves forward (forward speed > 0.5 m/s); push speed = tractor forward speed + 1. Engine hum while driving is optional: skip it unless `audio` already has a loop helper. Gnomes are pushed, not run over: the tractor itself has no extra collider (the player's kinematic capsule stays the same) so it never blocks placement checks or falls through.
5. **Not pushed:** the crate, props, machines, coins (out of scope, keeps physics simple). The king is pushed like any gnome.
6. **HUD:** a small line above the hotbar "BROOM (C)" / "TRACTOR · plow 3.4 m (C)" while equipped; the help panel H gets "C: broom / tractor". The magnet panel and the magnet beam do not show while the broom or tractor is out.
7. **Rules from CLAUDE.md:** collect gnomes from the query first, change bodies after; skip gnomes removed in the same frame.

8. **Roast fixes (all accepted, they override points 2-5 where they differ):**
   - The king is never pushed, by the broom or by the tractor (same guard as kick and magnet: the King event stays a job for machines).
   - The sweeper clears `g.throwPos` (and trick flags) on every gnome it pushes, so sweeping never pays SNIPER/LONG SHOT.
   - C equips the tractor whenever it is owned, even without the broom; C cycles only through owned items.
   - "Put the broom/tractor away" lives inside `selectTool` (covers digits and G). KeyC is read in `hotkeys()` (runs also while placing).
   - After the broom/tractor goes away, LMB is ignored until it is released (no instant grab).
   - The blade box runs from the front of the player capsule to 2.05 m ahead, so gnomes right in front or met while strafing are pushed.
   - The tractor raises `eye` (the aiming ray origin used for placement, targets, repair), not only the camera.
   - The push runs inside the locked and not-paused branch, once per frame using `dt` for steering.
   - The HUD prompt "hold LMB magnet" is hidden while the broom or tractor is out.
   - Rejected: a confirm before driving into the hole at max level, because walking in has the same effect today.

Gotowe, gdy (headless scenarios on 5199, harness `scratchpad/smoke/smoke.mjs`):
- the king in front of the broom and the plow is not pushed (moves less than 0.5 m)
- tractor owned without the broom: C equips the tractor
- `ctx.shop` buy (or `state.upgrades` set + shop render) of `broom` → Movement tab lists "Push Broom", `upgrades.broom = 1`
- C without the broom → toast text contains "Push Broom", nothing equipped
- broom: 5 awake gnomes in a row 1 m in front, hold LMB and walk forward 3 s → at least 4 of them moved at least 3 m along the walk direction
- broom equipped: LMB on a gnome does not grab it (`held` stays null)
- tractor (owned): C twice → tractor; drive forward 3 s into gnomes placed at lateral offsets 0, ±1.0, ±1.6 m → with `plowWidth` 0 (width 2.6) the ±1.6 m ones are not pushed, with `plowWidth` 1 (width 3.4) they are; blade mesh width follows
- weights: a 0.5 kg and a 3 kg gnome in front of the plow end up within 1 m of each other after 2 s of driving
- C from tractor → hands, LMB grabs again
- `npx tsc --noEmit` clean, no exceptions in any scenario log; regression `scenario15.js`, `scenario-polish-c.js` still pass

## Review: roast (plan-roaster)

Verdict: CONCERNS

Steel-man: One push mechanic that grows (broom, then tractor, then a wider blade) fits a game about getting gnomes into a hole, and it reuses what is there: shop rows via `U(...)`, the kick's `ragdoll()` helper, `isFree()` to skip held/stashed/falling gnomes, `dropAll()`/`cancelPlacement()`. Key C is really free (only W/A/S/D/E/F/G/X/B/R/T/V/Q/H/Tab/digits are bound; typed cheat codes BOOZE and GNOMERAIN have no C). Setting velocity instead of an impulse matches the "weight matters only for throws" rule (`player.ts:382`). No extra collider for the tractor keeps placement and the KCC untouched. Strong points: Movement tab keeps `TOOL_IDS` and digit hotkeys stable; `EFFECT` in `shop.ts:10` is a per-id table, so the now/next line for `plowWidth` is one entry; equipped state not saved avoids save migration.

Findings:
- [Major] The King boss becomes a $60 broom target.
  Assumption: pushing the king like any gnome is harmless.
  Scenario: King event at hole level 10+; player equips the broom, holds LMB, walks him into the hole. The push sets velocity, so his 40 kg do not matter.
  Checked: the game says the king is for machines only, in four places: kick gives him zero impulse (`player.ts:545`, `g.type.id === 'king' ? 0 : 1`), magnet excludes him (`player.ts:488`), HUD prompt "The King is too heavy for any magnet. Use machines!" (`hud.ts:298`), event text "He is very heavy. Use your machines!" (`events.ts:26`); `docs/PLAN.md:71` "push him in with machines"; `plan-arcade.md:107` calls the exclusion a "boss exploit guard".
  Impact: the boss event (biggest payout of the game) is solved by the cheapest item; the HUD keeps telling the player to use machines.
  Recommendation: skip `g.type.id === 'king'` in the sweeper, like kick and magnet. Whether the tractor (not the broom) may push him slowly is a product question for PP (below).
- [Minor] A swept gnome that was thrown a moment ago pays SNIPER / LONG SHOT.
  Scenario: throw a gnome from 15 m, it lands 2 m short of the hole (still `ragdoll`, `throwPos` set). Sweep it in within ~3 s, or keep it in the plow box (each frame re-ragdolls it, so `standUp`, which clears `throwPos`, never runs). `consume` pays x2 SNIPER.
  Checked: `ragdoll()` does not clear `throwPos` (`gnomes.ts:152-158`); only `standUp` does (`gnomes.ts:419`); `consume` pays tricks when `throwPos && thrownBy === 'player'` (`hole.ts:73-93`).
  Recommendation: the sweeper sets `g.throwPos = null` on every gnome it pushes.
- [Minor] Tractor bought without the broom is dead money.
  Scenario: player at hole level 3 with $1500 buys "Plow Tractor" first; C shows "Buy the Push Broom", so the $1500 does nothing until the $60 item is bought. Same for "Wider Plow" before the tractor.
  Checked: `shop.ts:100-114` has no prerequisite check; "needs X" is only text (like Magnet Coil, but Magnet Coil still helps bare hands via `player.ts:407`).
  Recommendation: C equips the tractor when `lvl('tractor')` is owned, even without the broom; cycle is hands → (broom if owned) → (tractor if owned) → hands.
- [Minor] G (move a placed tool) opens a placement ghost while the broom/tractor stays out.
  Checked: G calls `selectTool` directly from `actions()` (`player.ts:342-346`), not from the digit loop.
  Recommendation: put "put the broom away" inside `selectTool()` itself, not in the digit handler.
- [Minor] C does nothing while a placement ghost is open if it is read in `actions()`.
  Checked: `actions()` is skipped while placing (`player.ts:183-184`); only `hotkeys()` runs in both modes (`player.ts:185`).
  Recommendation: read KeyC in `hotkeys()`.
- [Minor] Putting the broom away with LMB still held grabs the gnome in front at once.
  Checked: the gnome grab is not gated on `leftPressed` (`player.ts:297-311`); with the Magnet Gun it starts collecting a swarm.
  Recommendation: after unequip, ignore LMB until it is released (or set `grabCd`).
- [Minor] Gnomes inside the tractor body are not pushed.
  Scenario: strafe (A/D) or turn into a group; a gnome ends up 0.5-1.15 m ahead, visually under the hood/blade. The box starts at 1.15 m (1.6 - 0.45), and strafing gives forward speed < 0.5, so nothing pushes it; the capsule bumps it via KCC impulses (`player.ts:64`).
  Recommendation: box from the capsule front (~0.4 m) to the blade front (2.05 m), and push whenever speed (not only forward speed) > 0.5 with the push along the tractor's forward.
- [Minor] Camera 0.4 m higher but rays still at `EYE`.
  Checked: `updateLook`, placement and cone targeting use `eye` (`player.ts:160-162`), the camera uses `EYE` separately (`player.ts:681`). On the tractor E/X/G prompts target a point under the crosshair.
  Recommendation: add the tractor offset in the `eye` getter, which the camera then uses too.
- [Minor] Plowing drives the player towards the hole; at max hole level a fall is a forced rebirth with no cancel.
  Checked: `fellIn` at `MAX_HOLE_LEVEL` opens `hud.deep` (`player.ts:240-243`), whose only button is "Be reborn" (`hud.ts:186-189`); rebirth resets all Movement upgrades, the tractor included (`hole.ts:340-356`, only `TOOL_IDS` kept). Hole radius 6.0 at max, physical gap half-side 4.24 (`environment.ts:191-198`), so the player falls ~1.8 m after the gnomes start falling.
  Recommendation: none required (walking has the same risk); see question below.
- [Minor] Plan says "each physics step"; the push actually runs once per frame.
  Checked: `player.update` runs once per frame before up to 3 `physics.step()` calls (`main.ts:144-155`). Fine, but do not loop over substeps.
- [Minor] Sweeper must run only inside the `inp.locked && !ctx.paused` branch.
  Checked: `player.update(0)` still runs while the shop is open (`main.ts:179`) and `vel` keeps its last value when dt is 0 (`player.ts:228`); a sweeper placed outside the guard keeps re-ragdolling gnomes behind the shop.
- [Minor] HUD context prompt still says "hold LMB magnet ..." while the broom is out (`hud.ts:298-300`); plan item 6 only hides the panel and the beam.

Scenarios checked (break the plan: yes/no):
- Gnome pushed into the hole during a combo: no. `startFalling` runs in `gnomes.update` after `player.update` (`gnomes.ts:331-334`); falling gnomes fail `isFree`; `consume` refreshes the combo timer (`hole.ts:68-69`). Sweeping does not freeze the combo (`hole.ts:322`), which is consistent.
- Walk gnome stands up and walks away: no, while it is in the box (each `ragdoll()` resets the timer, stand-up needs timer <= 0 and speed < 0.77 m/s, `gnomes.ts:361`). After leaving the box it gets 3 s, then walks off and steers away from the hole within r + 2.2 (`gnomes.ts:398`). Expected.
- Statue gnomes: no. `ragdoll()` on a statue keeps `awake = false`, so it never stands up until the wake roll (`gnomes.ts:203-215, 296`); same as kick today.
- Gnome pushed against a wall in front of the blade: no crash, cosmetic only (blade mesh clips the wall, capsule stops on the gnome).
- Gnome removed in the same frame: no, as long as the sweeper does not keep `Gnome` references across frames (hole/vacuum/black hole remove bodies later in the frame).
- Placement ghost open, shop open: covered by the G, C and pause findings above.

Pre-mortem: A week later PP writes that the King event "is broken, I just swept him in", or that the tractor "does nothing" after he bought it before the broom. Both come from rules the plan wrote as one-liners ("king pushed like any gnome", "needs the broom") without checking what the rest of the game says about them.
Inversion worth considering: none.
Investigate first: PP to decide one thing: a) the king is immune to broom and tractor (matches "use machines"), b) the tractor pushes him at reduced speed (tractor counts as a machine), c) both push him (plan as written). Recommendation: a.
