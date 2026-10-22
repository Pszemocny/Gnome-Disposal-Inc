# Hole without magnet or pull

## Problem

PP 2026-10-22: "zmien aby dziura nie miala zadnego magnesu ani przyciagania".
The hole caught a free gnome as soon as its centre was within the radius and below 1.4 x scale, so a gnome flying 1 m over the hole was swallowed in mid-air. After the catch, `startFalling` added a velocity of `(centre - p) * 1.5`, so the gnome slid to the middle.

Interpretation: no attraction of any kind from the hole itself. A gnome is swallowed only when it is really in the opening (below 0.6 x scale, a gnome standing on the ground has its centre at 0.44 x scale). A falling gnome keeps 30 % of its horizontal speed and cannot pass through the tube wall. Machines and events the player sees (Vacuum Tower, Gnome Magnet, tornado drop, earthquake, ground pound bias) are not the hole and stay.

Run mode: no plan round; the orchestrator ran a mini-roast (CONCERNS, three findings, all folded into the spec).

Gotowe, gdy:
1. `scenario-mushroom-rim.js` → `PASS h1` (gnome at 1.0 m over the centre at 16 m/s is not swallowed).
2. `scenario-mushroom-rim.js` → `PASS h2` (gnome dropped onto the hole is swallowed, keeps 0.3 x its horizontal speed with no inward part, never further than r from the centre while it falls).
3. `scenario-mushroom-rim.js` → `PASS h3` (gnome resting on the corner strip inside the circle is swallowed).
4. `grep -n "SWALLOW_Y" src/entities/gnomes.ts src/player/player.ts` → free gnome, held gnome and arc preview use `SWALLOW_Y (0.6) * scale`; `grep -rn "1.4 \* g.scale\|p.y < 0.8" src` → nothing.
5. `npx tsc --noEmit` → no output.

Ladder: step 2 (existing code): the catch check and `startFalling` already exist, the change edits the threshold, removes the pull term and adds a clamp in the existing `falling` branch with the existing `savePose`.

## Summary

- `src/entities/gnomes.ts`: new `SWALLOW_Y = 0.6` (x scale). Free gnome and held gnome are caught only inside r and below `0.6 * scale` (was 1.4). `startFalling` keeps `v * 0.3` sideways, no `(centre - p) * 1.5` pull. While falling, the gnome is clamped to `r - 0.2 * scale` from the centre (setTranslation + savePose, outward velocity removed); this is the tube wall from mini-roast finding 1 and keeps STRIKE positions inside the rim.
- `src/player/player.ts`: arc preview uses `SWALLOW_Y * first held gnome's scale` (1 for a crate), was a fixed 0.8.
- `tools/smoke/scenario-mushroom-rim.js`: h1-h4 (gnomes and physics stepped by hand at 60 Hz, game paused).

Hole attraction check (spec item 4), nothing removed:
- The hole itself had two attractions, both gone now: the mid-air catch at 1.4 x scale and the centre pull in `startFalling`.
- Player machines (kept): Gnome Magnet (`machines.ts:1114`), Vacuum Tower (`machines.ts:1130`, `1202`).
- Events (kept): Earthquake pushes every free gnome toward the hole for 5 s (`events.ts:89-101`, "Everything slides towards the hole!"); the tornado drops its riders onto the hole centre when it is within r + 5 (`tornado.ts:184-188`).
- Player action with a hidden bias (kept, open question): ground pound within 15 m of the hole tilts the fling direction toward the hole by 0.8 (`pound.ts:16-17`, `92`). This works like an aim assist toward the hole.
- Non-gnome catches (kept, open question): the crate is eaten within r + 0.3 and below 1.3 m (`machines.ts:912`), props within r below 1.5 m (`props.ts:126`); both catch in mid-air, the crate even past the rim.
- Not an attraction: walking gnomes are pushed away from the hole (`gnomes.ts:609`), the wizard's cast throws gnomes outward.

Rejected:
- Changing the crate/prop catch and the ground-pound bias: outside the ordered files and spec item 4 says report, not remove → separate order if PP wants it.

## Work progress

- Red (before the code change): `DEV_PORT=5191 CDP_PORT=9471 node tools/smoke/smoke.mjs <scratchpad>/hnp-red tools/smoke/scenario-mushroom-rim.js` → `FAIL h1 fell=true d=1.87 R=2.8 minY=-1.20 scale=1`, `FAIL h2 fellAt=7 gone=true vBefore=2.96,0.00 vAfter=1.94,0.00 maxD=0.70 R=2.8`, `PASS h3`.
- Green: same command → `PASS h1 fell=false d=5.45 R=2.8 minY=0.45 scale=1`, `PASS h2 fellAt=20 gone=true vBefore=2.87,0.00 vAfter=0.86,0.00 maxD=0.17 R=2.8`, `PASS h4 fell=true maxD=2.60 wall=2.60 framesAtWall=8 R=2.8`, `PASS h3 fell=true start d=2.38 square half=1.98 R=2.8`, a b c d PASS. h4 was added after the code change (h2 never reached the wall), so it has no red run.
- `npx tsc --noEmit` → exit 0, no output.
- Related scenarios on the new code: `scenario-balance.js` 0 FAIL (42 PASS), `scenario-small-batch.js` 0 FAIL (69 PASS), `scenario-endgame-boost.js` 0 FAIL (25 PASS).

Self-check:
- [PASS] 1 — mushroom-rim → `PASS h1 fell=false d=5.45 R=2.8 minY=0.45`.
- [PASS] 2 — mushroom-rim → `PASS h2 ... vAfter=0.86 (0.3 x 2.87) maxD=0.17`, plus `PASS h4 maxD=2.60 wall=2.60`.
- [PASS] 3 — mushroom-rim → `PASS h3 fell=true start d=2.38 square half=1.98`.
- [PASS] 4 — grep → `gnomes.ts:513`, `gnomes.ts:552`, `player.ts:305` use `SWALLOW_Y`; the old-threshold grep exits 1 (no match).
- [PASS] 5 — `npx tsc --noEmit` → exit 0.
- Discipline: only the threshold, the removed pull, the wall clamp, the arc rule and the tests; no new files besides this note.
- Animation rule 9: the wall clamp calls `savePose` after `setTranslation`.
