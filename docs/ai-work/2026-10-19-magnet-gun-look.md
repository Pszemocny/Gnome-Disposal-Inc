# Magnet Gun look: a gun in hand and a soft spark ball (2026-10-19)

Plan: `docs/ai-work/2026-10-19-plan-magnet-gun-look.md`, section "Plan (orchestrator, final)".

## Gotowe, gdy (from the plan)

1. `ballMesh` no longer exists; with the gun pulling, no mesh in the scene is a sphere of radius `ballR` (only Points)
2. gun owned + hands → the gun model is visible on screen (screenshot); without `magGun`, broom out, tractor out, or while placing → not visible
3. LMB held with the gun: the spark points' centre ≈ `ballCentre` (< 0.2 m) and their max distance ≈ `ballR` (±15%) at Coil 0 and Coil 5; opacity rises over ≥ 3 frames from 0 and falls to 0 after release
4. RMB throw: the gun's local offset goes back and returns with overshoot (sampled ≥ 10 frames)
5. the beam starts within 0.15 m of the muzzle world position
6. screenshot with ~15 gnomes in the ball: gnomes clearly visible, sparks subtle (checked by eye)
7. regression `scenario-magnet-gun.js`, `scenario-broom.js` pass; no exceptions; `npx tsc --noEmit` clean

## Problem

PP: "popraw ten hud, bo to kółko od magnesu jest straszne. Daj tam, że jak jest magnes kupiony, to on trzyma w rękach jakiś pistolet z magnesem na końcu, i jak kupujesz te ulepszenia, to podczas klikania robi się taka kula iskier, tylko żeby nie było to bardzo rażące".
The translucent cyan ball read as a big flat disc. PP wants a gun with a magnet in the hand and a soft ball of sparks whose size follows the Magnet Coil upgrades.

## Summary

- `src/world/models.ts`: `magnetGunGeometry()` (dark body, rail, grip, barrel, red horseshoe magnet with silver tips, tip face at z -0.485) and `magnetGunCoilGeometry()` (two copper rings, own material so they can glow).
- `src/player/player.ts`:
  - `ballMesh` removed.
  - Gun view model on the camera, bottom right (`GUN_POS`). Shown when `magGun` is owned, gear is hands and nothing is being placed. Slides in/out from below over 0.2 s (`outCubic`, rule 3). Sways with the walk bob, trembles and the coils glow (emissive pulse, no light) while LMB pulls. Throw recoil: 0.04 s nudge forward, 0.05 s kick back, settle with `outBack` overshoot (0.26 s), rule 4.
  - Spark ball: 60 additive points (`glowTexture()`, size 0.09 m, pale cyan to white), 2/3 near the surface, 1/3 inside, mirrored in pairs so the cloud is centred exactly on `ballCentre`. Object scale = `ballR`, so the Coil makes it bigger. Spins slowly (`damp`ed angular speed, rule 7), per-point alpha flicker 0.6-1.0. Fades in and out over 0.2 s with `outCubic`, peak opacity 0.6.
  - The beam starts at the magnet tip while the gun is shown, otherwise from the hand point as before. Beam opacity unchanged.
  - `gunPulling` getter: the old ball condition, now shared by the gun glow and the sparks.
- `docs/PLAN.md`: LMB row mentions the gun in hand and the spark cloud.

Ladder: shelf 2. Reuses `build()`/`vcMat()`, `glowTexture()`, `ease.ts`, `THREE.MathUtils.damp`, the broom's camera attachment. No new dependency. `sweeper.ts` and `fx.ts` untouched (the gun reads `sweeper.gear`; the sparks live in the player like the old ball).

Deviations from the plan:
- Spark opacity 0.6 and size 0.09 m instead of "~0.35" and "0.05-0.08". With 0.35 / 0.065 the sparks were invisible in the screenshots (`run-psparks/p-sparks-c0.png`); 0.6 / 0.09 reads as a faint cloud, gnomes stay fully visible (`run-psparks2/*.png`).
- The throw itself still happens on the RMB frame (as the plan says: only the gun animates). So the gnomes leave 0.04 s before the gun's kick phase; rule 4 asks for the effect on the contact frame. Delaying the throw would change gameplay timing, which the plan excludes.

Rejected: none.

## Work progress

Scenario `<scratchpad>/smoke/scenario-gun-look.js`, run `CDP_PORT=9386 MAXPOLL=1200 node smoke.mjs run-gunlook4 scenario-gun-look.js`; `LOGS:` only the scenario's own step lines, no exceptions. (The first run, `run-gunlook`, hung after the first screenshot with no log; rerun unchanged passed. Cause not found.)

- [PASS] 1 — `hasBallMesh: false`, `spheres: []` (no visible SphereGeometry mesh of radius ≈ ballR), `isPoints: true`, at Coil 0 and Coil 5; `grep -rn ballMesh src` → 0.
- [PASS] 2 — no `magGun`: `visible: false`; gun + hands: `visible: true`, `inView: true` (grip NDC 0.42/-0.68, tip 0.17/-0.32), slide-in samples 0.25/0.5/0.75/1; broom, tractor, placing `fan`: `visible: false`, back to hands `true`. Screenshot `run-gunlook4/gun-idle.png`.
- [PASS] 3 — Coil 0: centre offset 0, max distance 0.80 (R 0.8, ratio 1.00); Coil 5: offset 0, max 1.80 (R 1.8). Fade in 0 → 0.347 → 0.525 → 0.557 → 0.578 → 0.6 (5 rising frames), fade out 0.6 → 0.591 → 0.525 → 0.347 → 0, sparks hidden after.
- [PASS] 4 — live frames (dt 0.05) z offset: 0.023, 0.058, 0.016, -0.003, -0.007, -0.003, 0 ×6; curve at 0.025 s steps: 0, -0.008 (forward), 0.023, 0.068 (peak back), … -0.007 (overshoot), … 0. `goesForwardFirst`, `overshoot`, `settles` all true.
- [PASS] 5 — `beamOff: 0` m at Coil 0 and Coil 5.
- [PASS] 6 — `run-psparks2/p-ball15.png` (16 gnomes in the ball): gnomes fully visible, sparks hidden behind them or faint; `run-psparks2/p-sparks-c0.png`, `p-sparks-c5.png`: a soft speckled cloud, no disc, no solid surface. Also `run-gunlook4/gun-ball-15.png`, `gun-ball-coil5.png`.
- [PASS] 7 — `scenario-magnet-gun.js` (`run-look-mg`, ball lines now read `P.sparks`, release check waits 8 frames for the 0.2 s fade): Coil 0 held 22 (15-25), Coil 5 held 71, massive 10 vs normal 21-22, slip 2/15 normal vs 6/10 massive, throw 12.5-14.6 m/s for 1.2 kg (J/m 12.5) and 3.9-5.9 m/s for 3 kg (J/m 5.07), shop, crate, combo 5; `LOGS:` empty. (The "tiny" lines of this scenario now spawn `normal` 1.2 kg gnomes, so the speeds differ from the magnet-ball note; J/m still holds.) `scenario-broom.js` (`run-look-broom2`): all lines as in the broom note, `LOGS:` empty. A first broom run (`run-look-broom`) failed at boot with `ReferenceError: rim is not defined` in `environment.ts`: another session was editing that file at the time; rerun after its edit passed. `npx tsc --noEmit` → exit 0.

Orchestrator decision on the deviation "gnomes leave 0.04 s before the gun recoil" (Animation rule 4): rejected, not changed. The throw must react on the click frame (delaying it to match a 2-frame visual anticipation makes throwing feel laggy); 0.04 s is below 3 frames at 60 fps, and the recoil already starts in the next frame.

Self-check: only `player.ts`, `models.ts`, `docs/PLAN.md` and this note changed. `grep -n "Math.min(1, dt" src/player/player.ts` → nothing. Timed values (slide, fade, recoil) go through `outCubic`/`inQuad`/`outBack`; the spin uses `damp`. No runtime light. No Rapier body touched by the new code.
