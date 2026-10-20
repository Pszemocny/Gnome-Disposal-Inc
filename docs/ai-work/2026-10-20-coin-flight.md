# Coins fly to the money counter (Hub 4) (2026-10-20)

Plan: final plan from the orchestrator (night task, hub item 4). Only `src/entities/coins.ts` is edited.

Gotowe, gdy (from the task, headless, CDP port 9357):
1. A burst of 6 coins collected → 6 HUD coins appear, each reaches the counter within 0.7 s; money after all arrivals = burst value (±0.01).
2. The HUD coin position sampled over ≥ 10 frames moves monotonically towards the counter with an ease-out shape (bigger steps first).
3. 100 coins at once → at most 24 DOM flyers alive, money total still exact.
4. Pause mid-flight → no money lost after resume.
5. No exceptions; `npx tsc --noEmit` clean; one screenshot mid-flight checked by eye.

Enumeration check (all paths that pay a collected coin today): the `flying` branch in `Coins.update` covers the pickup radius, Piggy Bank (`piggy && age > 1.6`) and the 40 s auto-collect, all three set `flying` in one `if`. Not changed on purpose: the burst overflow (`list.length + n > CAP` pays at once, no coin exists) and the refund of a coin that fell into the hole (`p.y < -5`, the coin was not collected).

Ladder: rung 2/3. `outCubic` from `src/core/ease.ts`, `Camera.project` from three, `getBoundingClientRect` for the counter. A quadratic Bezier is one line; no Tween.js needed for a position driven by `dt` inside the existing update.

## Problem

Today a coin flies to the player and the money appears in the counter at once. PP wants the coin to visibly travel to the money counter, and the money to arrive with it.

## Summary

- When a coin reaches the player (pickup radius, Piggy Bank, 40 s auto-collect: one shared branch), `launch` turns it into a HUD coin: a pooled `div.coin-flyer` in the coin's tier colour, placed at the coin's projected screen position (clamped to the screen; behind the camera it starts from the bottom centre).
- The HUD coin travels to the centre of `.hud-money .money` (read once at launch) in 0.5 s along a quadratic Bezier with the control point pushed sideways by 20 % of the distance. Progress is `outCubic(t / 0.5)`, size shrinks from 1 to 0.6. Driven by `dt` inside `Coins.update`, so it stops when the game is paused.
- On arrival `pay` adds the money (`ctx.hole.earn`) and plays the chime (same rising-pitch chain as before, now at arrival time).
- More than 24 flyers alive, or no visible money counter: the coin pays at once, as today. The pool never holds more than 24 DOM elements.
- Reload: a `beforeunload` listener registered in the `Coins` constructor (before the one in `main.ts` that saves) pays every flyer at once, so the save includes it.
- Styles: one `<style>` element appended by the module. No other file edited.

Rejected:
- Rebirth hook: rebirth builds the new state and blocks saves before the page unloads, so the in-flight money (at most 0.5 s of coins) lands in the old run, exactly like coins lying on the grass today. A real hook needs `hole.ts`, which is not mine; the run money is reset by rebirth anyway.
- Pop-in scale on spawn (Animation rule 3): the HUD coin replaces the 3D coin at the same spot in the same frame, so there is no visible appear; the arrival has the chime and the counter pulse as its cue.
- `clearAll` flush: `clearAll` has no callers.

## Work progress

Headless scenario `scratchpad/smoke/coinflight.js` (port 9357), result:
`{"burst6":{"coins":6,"flyerStarts":6,"maxDur":0.5,"moneyAtFirstFlyer":0,"delta":10000,"earnCalls":6,"earnSum":10000},"curve":{"samples":18,"monotonic":true,"firstStep":45.82,"lastStep":0.39},"hundred":{"coins":102,"maxLive":24,"flyerStarts":51,"domFlyers":24,"delta":170000,"expected":170000},"pause":{"liveAtPause":1,"moneyAtPause":0,"liveAfterWait":1,"moneyAfterWait":0,"delta":10000},"reload_flush":{"liveBefore":1,"before":0,"liveAfter":0,"after":1666.67,"plusCoinsStillIn3D":10000}}`, LOGS empty.

Completeness:
- [PASS] 1. burst of 6 → 6 HUD coins, each 0.5 s game time (≤ 0.7), money +10000 of 10000, and +0 at the moment the first flyer appeared — `burst6` above.
- [PASS] 2. 18 samples of one flyer (loop paused, `update(0.025)` by hand), distance to the counter 300 → 255 → 214 → … → 0, every step positive, first step 45.8 px, last 0.4 px — `curve` above.
- [PASS] 3. 102 coins at once → at most 24 live flyers, 24 DOM elements in total, 51 flew and 51 paid at once, money +170000 of 170000 — `hundred` above.
- [PASS] 4. pause with a flyer in the air: after 2 s real time still 1 flyer, money unchanged; after resume +10000 of 10000. Reload: `beforeunload` paid the flyer at once (+1666.67, the rest still in 3D) — `pause`, `reload_flush` above.
- [PASS] 5. LOGS empty (no exceptions); `npx tsc --noEmit` → no output, exit 0; screenshot `run-coinflight/coin-midflight.png`: a blue tier-3 HUD coin just left of `$10k`, on its way in.

Self-check: only `src/entities/coins.ts` changed; every new piece (flyer list, pool, style, beforeunload, pay) maps to a sentence in the task. Animation rule 1: no new `Math.min(1, dt`. Rule 2: progress via `outCubic`. Rule 12: scenario samples 18 frames and asserts the shape, one screenshot checked.
