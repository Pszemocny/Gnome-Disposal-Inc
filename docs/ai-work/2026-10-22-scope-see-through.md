# Trick Scope Lvl 3: see-through held gnomes

Gotowe, gdy:
1. `node tools/smoke/smoke.mjs sst-out tools/smoke/scenario-scope-see-through.js` (scope 3, gnome in hand, a classic parts gnome and a one-piece fat gnome) → `PASS S1` (alpha sampled over >= 10 frames reaches <= 0.12 with a value strictly between 0.12 and 1) and `PASS S3` (after the throw alpha is back to 1 within 15 frames, with an in-between value).
2. Same run, scope 3, Magnet Gun ball of 4 gnomes → `PASS S2` (every ball gnome drawn at alpha <= 0.12).
3. Same run, scope 2, gnome in hand → `PASS S4` (alpha stays 1 for 20 frames, nothing drawn in the see-through pass).

## Problem

PP (2026-10-22): "ostatni level tego celownika niech sprawia ze gnomy ktre trzymaja sie na magnesie sa tak w 90% przezroczyste aby bylo widac gdzie sie rzuca". A held gnome (hand or Magnet Gun ball) covers the place the player throws at.

## Summary

- At Trick Scope Lvl 3 every gnome the player holds (in the hand or on the Magnet Gun, also while it flies into the ball) fades to 10 % opacity over 0.15 s (outCubic), and fades back over 0.15 s once it is let go or thrown.
- Shape: each gnome type gets a second InstancedMesh (same geometry, a transparent copy of the gnome material with a per-instance `see` alpha attribute). A gnome with any fade (`seeT > 0`) is drawn there instead of the normal mesh or its moving parts; the normal pass stays opaque and untouched. The see-through pass casts no shadow, so a near-invisible gnome leaves no dark shadow. The Midas gold, night hat glow and hat colour come from the same shader code, so they look the same, just faded.
- Ladder: step 2 (reused the gnome material hook, `outCubic`, the existing InstancedMesh pattern); one new mesh per type, no new helper.
- A classic gnome (moving parts) is drawn as one piece while faded: held gnomes do not walk, so the parts are at rest and the switch is not visible.
- Texts: shop description (also shown in the legend), shop EFFECT line, SPEC, CHANGELOG.

## Rejected

- Per-instance alpha on the main gnome material: all gnomes would go to the transparent pass, and the moving-part BatchedMesh has no per-instance attribute.
- Held props, letters and the crate: out of scope (order).
- Fading the shadow with the alpha: three's shadow pass ignores alpha without a custom depth material; the faded gnome simply casts no shadow.

## Work progress

- `src/entities/gnomes.ts`: material built by `gnomeMat(t, see)`, a see-through InstancedMesh per type, `seeT` per gnome (fades in `update`, reset on `stash` so a gnome leaves a crate opaque), drawn in `writeInstances`.
- `src/systems/replay.ts`: the see-through meshes hide during the instant replay like the part meshes (the replay draws every gnome opaque from its recorded bodies).
- Texts: `src/data/upgrades.ts` (shop and legend), `src/ui/shop.ts` (EFFECT), `docs/SPEC.md` (mechanic + PP decision), `CHANGELOG.md` (2026-10-28 14:00).
- `npx tsc --noEmit -p .` → no output (clean).
- `URL_QUERY='' FAKELOCK=1 MAXPOLL=4000 CDP_PORT=9821 DEV_PORT=5221 node tools/smoke/smoke.mjs <scratchpad>/sst-out tools/smoke/scenario-scope-see-through.js` (private dev server on 5221, stopped after) → 6/6 PASS, errors [].
- Screenshots checked by eye: scope 3 shows a faint gnome with the hole visible through it and no dark shadow; scope 2 shows the same gnome fully opaque.

Self-check:
- [PASS] 1 — S1 classic alpha 0.732,0.523,…,0.1 (15 frames); S1 fat 0.732,…,0.1; S3 classic and fat 0.101,…,0.733,1 after the throw.
- [PASS] 2 — S2 last alpha per ball gnome 0.1,0.1,0.1,0.1.
- [PASS] 3 — S4 alpha at scope 2 = 1 for 20 frames, see-through instances 0.
- Scope: only held gnomes at Lvl 3; props, letters and the crate untouched. No new dependency, ease from `src/core/ease.ts`, fade driven by `dt`.

Uncertain:
- A classic gnome grabbed mid-stride switches from moving parts to one piece in the first faded frame (alpha 0.73), so its legs can snap straight once. Not visible in the screenshots.
- The return curve uses the same `outCubic(seeT)` as the Trick Scope preview fade, so the gnome comes back slowly, then fast (0.15 s in total).
