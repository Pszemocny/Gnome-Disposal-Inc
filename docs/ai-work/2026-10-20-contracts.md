# Round contracts (BOARD "Hub 7", 2026-10-20)

Night task, PP asleep. Plan: the orchestrator's final plan in the task envelope (stands in for plan-senior). Decisions below are mine, written down for PP.

## Gotowe, gdy (from the plan, run headless)

1. A contract panel appears after the first goal (or 2 min game time) with title, progress, timer and reward.
2. "Feed N gnomes" completes when N gnomes are eaten in time: reward paid once (money delta = reward), big text shown, next contract within 1 s.
3. Letting the timer run out: "Contract failed" toast, next contract after 10 s.
4. The pool never offers a plow contract without the tractor, nor a king contract without a king.
5. Pause: the timer does not advance while `ctx.paused`.
6. Regression `scenario15-wait.js` passes; no exceptions; `npx tsc --noEmit` clean; one screenshot of the panel checked by eye.

## Problem

BOARD "Hub 7": round contracts ("drop 20 gnomes in 60 s", "push the king in with the plow") with a cash reward. One active contract with a timer; completing it pays the reward and rolls the next one; failing it rolls a new one after 10 s.

## Summary

- New `src/systems/contracts.ts` (class `Contracts`): contract table, logic and its own DOM panel. Styles live in a `<style>` element the module creates (no edit to `src/ui/style.css`). The panel is inserted into the HUD right after the GOAL panel, so it dims with the HUD in pause and the controls help still covers it like it covers the goal panel. Its `top` follows the goal panel's bottom + 8 px (16 px when every goal is done).
- `src/core/context.ts`: field `contracts`. `src/main.ts`: `new Contracts()` in boot, `ctx.contracts.update(dt)` after `ctx.goals.update()` (runs only while not paused, so the timer stops in pause).
- No change in `hole.ts`: progress comes from `ctx.state.stats` counters (increase since the contract started) and `ctx.hole.combo` (highest value seen). Two counters the game does not keep are tracked in the module each frame:
  - full crate dumps: `stats.crateDumps` grew this frame and a crate that held `crateCap()` gnomes last frame is now empty;
  - kings eaten while the player drives the tractor: `stats.typesEaten.king` grew while `ctx.player.sweeper.gear === 'tractor'`.

Contract table (L = hole level, reward R = 25 x (1 + Bigger Batches level) x `hole.valueScale`, hard ones x1.5):

| id | title | target | time | hard | offered when |
|---|---|---|---|---|---|
| feed | Feed N gnomes to the hole | min(50, 10 + 4 L) | 60 s | no | always |
| long | N LONG SHOTs (throw from 8 m+) | 3 | 90 s | no | always |
| air | N AIR shots (into the hole, no bounce) | 5 | 90 s | no | always |
| bullseye | BULLSEYE: throw through the golden hoop | 1 | 120 s | yes | the hoop exists (`hole.ring`) |
| crate | Dump a FULL crate into the hole | 1 | 120 s | yes | a crate is placed |
| king | Push the KING into the hole with the plow tractor | 1 | 180 s | yes | tractor owned and a king in the yard |
| combo | Reach a xN combo | 15 (L1-3), 30 (L4-7), 60 (L8+) | 60 s | yes | no combo running (`hole.combo === 0`), else a combo already above the target would pay at once |
| haul | N HEAVY HAUL (feed massive gnomes) | 1 (L4-6), 3 (L7+) | 90 s | yes | L >= 4 |

Reward numbers: `valueScale` = hole multiplier x Premium Gnomes x Deep Value x shovel. Level 1 without upgrades: $25 / $38. Level 6 (x4): $100 / $150. Level 12 (x10) with Premium 10 and Batches 3: 25 x 4 x 20 = $2000 / $3000. Why 25 gnomes: the factory makes about 0.9 gnome/s while cranking (x(1 + batch)), and the player cranks about half of the time, so about 45 s of play feeds about 20-25 gnomes; the batch factor keeps the reward in step with production.

Flow:
- The first contract appears when `state.goal >= 1` (first goal done) or after 120 s of game time (`ctx.time`).
- Done: coin fountain from the hole (`coins.burst(R, holeOrigin, 2)`, so the money arrives as coins, like every other payout), big text `CONTRACT DONE` with the gold `+$R` line (the existing animated `hud.bigText`), money pulse, `fanfare(4)`, 24 green sparks at the hole. Next contract after 0.6 s.
- Failed (timer ran out, or the contract became impossible, e.g. the king eaten on foot or the crate removed): toast `Contract failed`, deny sound, next contract after 10 s.
- The same contract is not offered twice in a row when anything else is possible.
- Not saved: a reload starts without a contract and rolls one at once if the first goal is done.
- Animation: the panel pops in with `outBack` over 0.3 s and shrinks out with `inQuad` over 0.2 s, plus the existing `audio.toast()` cue on a new contract; the timer bar drains linearly (a timer is linear).

Decisions taken here (PP asleep):
1. "Eat 3 heavy or massive gnomes": the game counts only massive gnomes (`stats.hauls`), there is no heavy counter and I may not edit `hole.ts`. The contract is "HEAVY HAUL (massive)" from hole level 4, target 1 (3 from level 7), because massive gnomes are rare early (3 % at level 4).
2. The king contract counts the king eaten while the tractor is out. The plow itself skips the king (decision in the broom-tractor note); the tractor's body still shoves him (4.7 m in 1 s, measured in that note). So the contract means "drive him in with the tractor".
3. The combo target grows with the level (15/30/60, the combo tier names) because a x15 combo is trivial at high production.
4. The reward is paid as coins (the plan says "paid with a coin fountain"); coins left alone fly to the player after 40 s at the latest, so the money always arrives.
5. Trick contracts are offered to every player, also before they did that trick once. A failed contract costs only 10 s.

Ladder: shelf 2 for everything shown (`hud.bigText`, `hud.toast`, `coins.burst`, `fx.burst`, `audio.fanfare/toast/deny`, `ease.ts`, `crateCap`, `pick`, `money/num`); new code only for the table, the timer and the panel.

Rejected:
- Counting heavy gnomes: no counter, `hole.ts` is owned by another agent tonight → the contract uses massive only (decision 1).
- Saving the active contract: the plan says not saved.

Found on the way, outside my files (→ separate task, not fixed): a crate dump that levels the hole up crashes the game. `Machines.updateCrate` calls `hole.consume` for each gnome in the crate; the level-up inside it (`Hole.levelUp`) removes machines standing at the hole, which includes the crate being dumped, and `Machines.remove` calls `gnomes.release` on gnomes already eaten. Rapier throws `RuntimeError: unreachable` in `rbSetEnabled`, then `recursive use of an object` every frame; the game is dead. Seen in `run-contracts3` (crate with 12 gnomes dumped at hole level 1 near the level threshold). Files: `src/entities/machines.ts` (dump loop, `remove`), `src/systems/hole.ts` (`levelUp`).

## Work progress

Scenario `<scratchpad>/smoke/scenario-contracts.js` (rolls a chosen contract through the real `roll()` by narrowing the `ok` checks for one call; piggy bank on so coins reach the money on their own). Runs: `run-contracts` hung (the crate crash above, no output), `run-contracts2`/`3` found the crash, `run-contracts4` passed with the hole XP kept below the next level during the crate dumps; then the combo contract got its "no running combo" gate (self-check: a contract rolled during a x20 combo paid at once), and `run-contracts5` is the final run (same numbers as run 4 below, plus `comboRunning: [feed, long, air, bullseye]`).

Check (run 2026-10-20, locally on the dev server 5199):
- [PASS] 1. Panel after the first goal / 2 min — `CDP_PORT=9369 MAXPOLL=1400 node smoke.mjs run-contracts5 scenario-contracts.js` (run 4 values quoted; run 5 rolled other kinds, same layout) → before: `{"goal":0,"time":2,"current":null,"display":""}`; after `goal = 1`: `"title":"Feed 14 gnomes to the hole","reward":"+$25","have":"0 / 14","time":"58 s","bar":"96.25%"`, contract top 133 px under the goal bottom 125 px, pop scale `1.09, 1.09, 1.03, 1, ...` (overshoot, settles); 2 min path: `{"before":null,"after":"air","display":"block"}`.
- [PASS] 2. Feed N — `{"N":14,"reward":25,"progressBefore":"13 / 14","moneyDelta":26.05,"gnomeCoins":1.05,"moneyMinusGnome":25,"rewardBursts":1,"contractBigTexts":["CONTRACT DONE +$25"],"nextAfter":0.65}` (money delta minus the last gnome's own coins = reward, one reward burst, one big text, next contract 0.65 s later).
- [PASS] 3. Fail — `{"failedToast":true,"currentAfter9s":null,"nextAfter":10.05}`.
- [PASS] 4. Pool — 300 rolls each: no tractor/no king `[air,bullseye,combo,feed,long]`; tractor/no king same; king/no tractor same; tractor + king adds `king`. King eaten on foot → contract fails at once (`contractAfter: null, plowKings: 0`); eaten while gear is `tractor` → `plowKings 1, have 1`, done. Crate: partial dump (3 gnomes) counts 0, full dump (12) counts 1.
- [PASS] 5. Pause — `{"before":59.5,"afterPause90frames":59.5,"after1sPlay":58.48}`.
- [PASS] 4c. Combo running (combo 7) → pool `[feed, long, air, bullseye]`, no `combo` (run 5).
- [PASS] 6b. Regression `CDP_PORT=9368 MAXPOLL=2400 node smoke.mjs run-contracts-reg15c scenario15-wait.js` → `fan ratio 0.99`, `massive y 1.25`, `eatenAfterGreenThrow 1`, `full_crate_lifts inside 9 y 1.25`, `hoop bullseye true`, `parading 16`, `LOGS:` empty. Two earlier attempts (`reg15`, `reg15b`) broke on hot reloads: other agents' half-saved `audio.ts`/`hud.ts` (`prefs is not defined`, `reading 'open'`), and my own combo edit reloading the page mid-run.
- [PASS] 6. `LOGS:` of `run-contracts4` and `run-contracts5` have only the scenario's own `LOG:` lines, no exception; `npx tsc --noEmit` → exit 0; screenshot `run-contracts-shot/panel-clean.png` checked by eye: gold-bordered CONTRACT panel under the GOAL panel, `+$38` green on the right, "Reach a x15 combo", draining bar, `0 / 15` and `57 s`, readable at 640x360. Regression: line 6b.

Self-check: only the plan items were built; nothing outside `contracts.ts`, `context.ts` (one field), `main.ts` (import, boot, update); `grep -n "Math.min(1, dt" src/systems/contracts.ts` → nothing; timed values use `outBack`/`inQuad`.
