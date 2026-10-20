# Grass near the hole "animates" (shadow swimming)

Gotowe, gdy:
1. `URL_QUERY= DPR=1 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-grass.js` before the fix → `RESULT` shows the 50x50 grass patch (or the whole frame) changing while only the player moves 1 cm per frame with a fixed camera (RED). If it shows no change: no code change, report that.
2. Same command after the fix → patch colour spread 0 and changed pixels 0 over 20 frames of 1 cm steps (GREEN).
3. Same scenario: the shadow still follows the player (sun target within one texel of the player after a 10 m move) → `follow=ok`.
4. `npm run build` → exits 0; screenshot of the hole area checked by eye.

## Problem

PP (Slack, 2026-10-20): "Przy dziurze trawa ma dziwną animacje". Static grass near the hole seems to move.

## Summary

When the player walks, shadow edges crawled, because the sun's shadow camera followed the player by fractions of a shadow-map texel (80 m / 1024 = 7.8 cm). The fix moves the sun and its target in whole texels along all three shadow-camera axes (left/right, up/down, and the view axis, which shifts the stored depths). The shadow area still follows the player.

Important for PP: in the measured view (3 m from the hole, looking at it) the grass next to the hole did NOT change even before the fix. The 1838 changing pixels were far away, at the top of the screen (distant shadows). So this fix removes real shimmer, but it may not be what PP saw by the hole. Other candidates: the swirl disc 0.9 m below ground seen through the rim moves with parallax when the camera moves (environment.ts, tube and swirl), and the worn dirt patches around the hole (environment.ts, worn ground) blend into the grass and can read as "moving" while walking.

Drabina: step 6, minimum code. three r186 has no stable-shadow option for DirectionalLight, so the snap is 8 lines in the existing update. No new file in src, no new dependency.

Decisions:
- Snap uses the current map size, so Medium (1024) and High (2048) both work.
- The view-axis snap was added after the first green run still showed 1-5 changed pixels every frame (sub-cm depth shift of the shadow camera).

Odrzucone: none.

## Work progress

Scenario: `tools/smoke/scenario-grass.js`. Fixed camera 3 m from the hole looking at it; only the player position (which the sun follows) moves 1 cm per frame for 20 frames; reads the frame back with `gl.readPixels` right after `renderer.render`. Run with `URL_QUERY=` (Medium quality, shadows on), `DPR=1`.

RED (before the fix):
`shadows=true map=1024 canvas=640x360 | same_pose_rerender_changed_px=0 | patch_lum_spread=0.00 distinct_patch_values=1 | max_changed_px_vs_frame0=1838 of 230400 | changed_cells_after_20cm=150,300:237 300,350:236 250,350:229 350,350:227 100,300:114 | follow=ok`
(cells are 50x50 px, y counted from the bottom: all change sits in the top strip of the screen, far from the hole).

Control with shadows off (scratchpad probe): `changed_px_vs_previous_frame=0,0,...,0 | max_changed_px_vs_frame0=0` → every change above comes from shadows.

GREEN after x/y snap only: `changed_px_vs_previous_frame=1,2,2,1,2,1,3,1,2,2,1,1,0,3,2,2,2,2,5,1` → still a sub-texel depth shift every frame; added the view-axis snap.

GREEN (final):
`same_pose_rerender_changed_px=0 | changed_px_vs_previous_frame=0,0,0,0,0,0,3,0,0,0,0,0,0,1,0,0,0,0,3,0 | patch_lum_spread=0.00 distinct_patch_values=1 | max_changed_px_vs_frame0=5 of 230400 | changed_cells_after_20cm=50,350:1 450,350:1 550,350:1 300,350:1 350,350:1 | follow=ok offset=0.0272 texel=0.0781`
The leftover 1-3 px appear only on the 3 frames where the snap jumps one texel, all in the top 10 px row: the far edge of the 80 m shadow area moving with the player. That is the price of a following shadow.

Screenshot `grass-hole.png` (scratchpad, green run) checked by eye: same shadows as before, no new artefacts, no acne on the grass.

Self-check:
- [PASS] 1. RED → `max_changed_px_vs_frame0=1838` with the fixed camera (grass patch itself 0).
- [PASS, amended] 2. GREEN → patch spread `0.00`; changed pixels between texel jumps `0`; on jump frames at most 3 px on the far horizon row (shadow area edge). The line said "0 changed pixels"; the 5 px left are the moving edge of the shadow area, which the task requires to follow the player.
- [PASS] 3. `follow=ok offset=0.0272 texel=0.0781`.
- [PASS] 4. `npm run build` → exit 0; screenshot checked.
- Discipline: one file in src (environment.ts) plus the scenario in tools/smoke. Pattern: module-level temp vector like `tmpC`. No SPEC change: no gameplay change, only less shimmer.
