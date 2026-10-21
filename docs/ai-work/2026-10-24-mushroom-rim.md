# Mushrooms hop out of the hole

Interpretation: a mushroom resting on the ground never stays inside the hole's opening. When it spawns there or the hole grows or slides over it, it hops out in a short eased arc to a spot about 1 m past the rim, clear of placed tools, with one puff of particles.

Gotowe, gdy:
1. `node tools/smoke/smoke.mjs <out> tools/smoke/scenario-mushroom-rim.js` → `PASS a` (mushroom spawned at the hole centre is outside the radius and still alive after 0.5 s)
2. same run → `PASS b` (mushroom 0.5 m past the rim, forced level-up grows the radius past it, it ends outside)
3. same run → `PASS c` (sampled hop has at least one frame strictly between start and end, and lands at rim + about 1 m)
4. same run → `PASS d` (hole centre moved onto a resting mushroom, as in a Land slide, it ends outside)

## Problem

PP (2026-10-24): "grzybki spawnuja mi sie wewnatrz dziury albo dziura powieksza sie tak szybko ze zachodzi grzybki moglaby je przesuwac albo wyrzucac gdzies dalej aby nie trzeba bylo do niej wchodzic".

Cause in the current code: `Mushrooms.update` only checks the hole for a mushroom in flight. A mushroom that rests (velocity zero) is never checked again, so it stays inside the opening when the Mushroom Bloom event or the UFO crash puts it there (both spawn with no velocity at any spot), when a level-up grows the radius over it, or when a Land slide moves the hole onto it.

## Summary

Spawn paths checked (all end in `Mushrooms.update`): the hole drop in `maybeDrop` incl. the lesson mushroom (flies out, already lands only past rim + 0.3), Mushroom Bloom (`events.ts`, 8 random spots, no velocity), UFO crash (`events.ts`, at the UFO, no velocity).

Ladder: rung 6 inside the existing file. The per-frame check reuses `ctx.env.holeDist` / `holeRadius` (rung 2), the tool clearance reuses the lesson's tool check (split into a point test), the arc uses `outCubic` from `src/core/ease.ts`, the cue is `ctx.fx.puff`, the landing squash follows rule 5 (volume kept).

## Work progress

- Red test first, `DEV_PORT=5173 CDP_PORT=9392 node tools/smoke/smoke.mjs <out>/red tools/smoke/scenario-mushroom-rim.js` → `FAIL a d=0.00 R=1.6`, `FAIL c between=0/30`, `FAIL b ... d=1.50 R=2.8`, `FAIL d d=0.00 R=2.8`.
- Fix in `src/entities/mushrooms.ts`: a resting mushroom closer than rim + 0.3 m to the hole centre starts a hop (0.3 s, `outCubic` along the ground, 1.2 m parabola, 8-spark burst in its cap colour at the start), lands at rim + 1 m at a random angle, turning by 45 degrees up to 8 times while the spot is inside a placed tool, then squashes for 0.15 s with the volume kept. After the hop it is checked again, so a Land slide still moving onto it makes it hop once more. The tool check of the lesson mushroom became a point test shared by both.
- Green, same command → `PASS a d=2.60 R=1.6 y=0.00`, `PASS c between=13/30 end=2.60 want~2.60 squashY=0.98 vol=1.00`, `PASS b stay=true covered=true d=3.80 R=2.8`, `PASS d d=3.80 R=2.8`, no console errors.
- Regression: `tools/smoke/scenario-tutorial-goals.js` (forced lesson mushroom) → 31 PASS, 0 FAIL. `npx tsc --noEmit -p .` → no output.
- Peak screenshot (frame 9 of the hop, y = 1.19 m) checked by eye: the mushroom with its glow sits in the air above the hole, sparks visible.
- Note: the first red run on CDP port 9391 hung with no result (Runtime.evaluate never answered); port 9392 worked at once. Not a game problem.

Gotowe, gdy:
- [PASS] 1 — scenario-mushroom-rim → `PASS a d=2.60 R=1.6 y=0.00`
- [PASS] 2 — same run → `PASS b stay=true covered=true d=3.80 R=2.8`
- [PASS] 3 — same run → `PASS c between=13/30 end=2.60 want~2.60 squashY=0.98 vol=1.00`
- [PASS] 4 — same run → `PASS d d=3.80 R=2.8`

Self-check: only `mushrooms.ts` in production; no new dependency (ease.ts, fx.burst, env.holeDist reused); the scale squash is rule 5, the burst is rule 3/6 (8 particles, pool fades them). Mushrooms in flight keep the old behaviour (they already land only past rim + 0.3 m and relaunch when they fall in).

Rejected: none.
