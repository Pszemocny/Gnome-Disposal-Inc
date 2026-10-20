# Magnet Gun look: a gun in hand and a soft spark ball (PP, 2026-10-19)

## Problem

PP (verbatim): "popraw ten hud, bo to kółko od magnesu jest straszne. Daj tam, że jak jest magnes kupiony, to on trzyma w rękach jakiś pistolet z magnesem na końcu, i jak kupujesz te ulepszenia, to podczas klikania robi się taka kula iskier, tylko żeby nie było to bardzo rażące".
Translation: the magnet circle looks awful. When the Magnet Gun is bought, the player holds a gun with a magnet at its tip; while clicking, a ball of sparks forms (its size follows the upgrades); it must not be glaring.

The "circle" is the translucent cyan sphere `ballMesh` in `src/player/player.ts` (radius = `ballR`, drawn while LMB pulls with the gun). Seen from the camera it reads as a big flat cyan disc.

## Plan (orchestrator, final)

1. **Remove the sphere** (`ballMesh`) completely.
2. **Gun view model** (built from primitives in `src/world/models.ts`, attached to the camera like the broom in `src/player/sweeper.ts`): bottom right of the view, a short barrel/body with a grip and a coil ring, and a red horseshoe magnet with silver tips at the muzzle. Visible only when `magGun` is owned, the gear is hands (not broom/tractor), and no tool is being placed. Small idle sway with the walk bob; while LMB pulls, the coil glows softly (emissive pulse, no runtime lights) and the gun trembles a little; on RMB throw a short recoil (anticipation ≤ 0.1 s, kick, follow-through with `outBack`, rule 4; the throw happens on the kick frame as today, only the gun animates). Without the gun upgrade nothing is drawn in hand (as today).
3. **Spark ball** instead of the sphere: while LMB pulls with the gun, about 60 small additive points (round `glowTexture()`, size about 0.05-0.08 m, colour pale cyan/white, low opacity ~0.35) orbit slowly on and inside a sphere of radius `ballR` at `ballCentre`, flickering a little. It fades in over ~0.2 s (`outCubic`) and out over ~0.2 s on release (rule 3). Its radius follows `ballR`, so Magnet Coil upgrades visibly make it bigger. It must not be glaring: no solid surface, no disc, points thin enough that gnomes inside stay clearly visible.
4. **Beam** starts at the gun's muzzle (world position of the magnet tip) when the gun is shown, otherwise from the hand point as today. Beam opacity unchanged.
5. HUD text panel stays as it is (`MAGNET GUN n gnomes · ball 0.8 m`).
6. Follow the project `## Animation rules` in `CLAUDE.md`.

Gotowe, gdy (headless; screenshots checked by eye):
- `ballMesh` no longer exists; with the gun pulling, no mesh in the scene is a sphere of radius `ballR` (only Points)
- gun owned + hands → the gun model is visible on screen (screenshot); without `magGun`, broom out, tractor out, or while placing → not visible
- LMB held with the gun: the spark points' centre ≈ `ballCentre` (< 0.2 m) and their max distance ≈ `ballR` (±15%) at Coil 0 and Coil 5; opacity rises over ≥ 3 frames from 0 and falls to 0 after release
- RMB throw: the gun's local offset goes back and returns with overshoot (sampled ≥ 10 frames)
- the beam starts within 0.15 m of the muzzle world position
- screenshot with ~15 gnomes in the ball: gnomes clearly visible, sparks subtle (checked by eye)
- regression `scenario-magnet-gun.js`, `scenario-broom.js` pass; no exceptions; `npx tsc --noEmit` clean
