# Grass by the hole seems to swirl

Gotowe, gdy:
1. `DEV_PORT=5197 URL_QUERY= DPR=1 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-swirl.js` before the fix → `RESULT` shows `outside>0` changed pixels on hole level 2 or level 12 while only the swirl turns (RED). If `outside=0` on both levels: the swirl does not reach the grass, no swirl fix, report that.
2. Same command after the fix → `outside=0` on level 2 and level 12 over 20 frames, and `inside>0` (the swirl still turns inside the hole).
3. `npm run build` → exit 0; screenshot of the rim at the peak frame checked by eye.

## Problem

PP (Slack, 2026-10-20 23:57): "Trawa przy dziurze się rusza jakby wtórowała może animacja jest szersza niż dziura." When the player stands by the hole, the grass next to it looks like it turns with the swirl.

## Summary

The swirl does not reach the grass, so there is no swirl fix. When only the swirl turns, not one pixel outside the hole changes, on hole level 2 and on level 12, from 3 m and from 0.5 m, on Low and Medium quality (High was not measured; it only changes pixel ratio and shadow map size). The swirl disc sits 0.9 m deep inside the tube, and the grass mesh in front of it covers everything past the opening. In the screenshots the visible swirl is a smaller circle inside the opening, with a dark band of tube wall around it.

Why PP may still see the grass "turn" (inference, not measured): the earlier fix (`2026-10-20-grass-shadow.md`) stopped shadow edges crawling while the player walks; that fix is already in the working tree but not on 5300 yet. Next to it the turning swirl inside the hole can make the still grass next to it look like it moves (an optical effect of motion beside still texture), mostly while the camera moves.

Land slide (code read, not measured): the swirl is a child of the hole group, and the grass mesh moves by the same offset in the same function, so the opening and the swirl move together.

Drabina: step 1, the fix does not need to exist; no change in `src`. Tools: the scenario `tools/smoke/scenario-swirl.js` stays as a guard, and `smoke.mjs` takes `DEV_PORT` (default 5199), because the dispatcher assigned this task port 5197.

Odrzucone:
- Masking or clipping the swirl to the radius: it already stays inside; the mask would change nothing on screen.
- Texture shimmer on the grass while walking (anisotropy is 8 in `textures.ts`): a render quality setting, which is a separate task → osobne zlecenie if PP still sees it on the next 5300 build.

No SPEC.md or CHANGELOG.md line: nothing in the game changes.

## Work progress

Scenario: fixed camera and player, 1.7 m eye height; only `swirl.rotation.z` turns, 0.15 rad per frame, 20 frames; `gl.readPixels` right after `renderer.render`. Two measures: (a) pixels on 5 rings at 1.02-1.4 x radius outside the rim and 4 rings at 0.3-0.9 x radius inside; (b) every changed pixel of the whole frame, whose view ray meets the ground more than 1.01 x radius from the centre (or misses the ground).

Run (`DEV_PORT=5197 CDP_PORT=9347 URL_QUERY= DPR=1 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-swirl.js`):
```
lvl2 r=2 from_rim=3m outside=0 of 1677 per_frame=0,...,0 inside=266 of 955 changed_px_outside_rim=0
lvl2 r=2 from_rim=0.5m outside=0 of 767 per_frame=0,...,0 inside=289 of 450 changed_px_outside_rim=0
lvl12 r=6 from_rim=3m outside=0 of 1581 per_frame=0,...,0 inside=403 of 1192 changed_px_outside_rim=0
lvl12 r=6 from_rim=0.5m outside=0 of 168 per_frame=0,...,0 inside=57 of 61 changed_px_outside_rim=0
```
`URL_QUERY=?lowfx` (Low, 3 m pose only): the same `outside=0`, `changed_px_outside_rim=0`.

Screenshots `swirl-lvl2-3m.png`, `swirl-lvl2-0.5m.png`, `swirl-lvl12-3m.png`, `swirl-lvl12-0.5m.png` (scratchpad `swirl-red3/`) checked by eye: the swirl ends inside the opening, the grass and the worn dirt patches around it are clean.

Self-check:
- [PASS] 1. RED attempt → `outside=0` and `changed_px_outside_rim=0` on level 2 and 12 (run above): the bug as described does not exist, reported.
- [PASS] 2. The same scenario as a guard → `outside=0` on both levels, `inside=266`/`403` (the swirl turns inside the hole).
- [PASS] 3. `npx tsc --noEmit -p .` → exit 0 (no `src` change; `npm run build` skipped so `dist/` stays untouched); screenshots checked.
- Discipline: no change in `src`; `smoke.mjs` +1 env option; one new scenario file.
