# Hanging magnet over the hole, no hole rim (PP, 2026-10-20)

Plan: `2026-10-20-plan-magnet-arm-no-rim.md`, section "Plan (orchestrator, final)".

## Gotowe, gdy (from the plan)

1. magnet placed with its base 0.5 m outside the hole edge, arm pointing at the hole centre: head ground point inside the hole radius; 10 gnomes 4-10 m around → at least 8 eaten within 15 s game time
2. same magnet turned away from the hole: at least 6 gnomes within 2 m of the head ground point after 10 s, all gnome y below 1.5 m
3. a 1.2 kg and a 3 kg gnome at the same distance reach the head line within 20 % of the same time
4. the ghost drop-point marker is green over the hole, not green elsewhere
5. no hole rim mesh exists; eating a gnome changes no torus scale; screenshot of the hole without a rim checked by eye
6. regression `scenario15-wait.js` passes; no exceptions; `npx tsc --noEmit` clean

## Problem

PP: "niech magnes do postawienia będzie zakrzywiony jak L, tylko przewrócone, aby można go było powiesić bezpośrednio nad dziurą. Usuń animację ze zjadania dziury, tj. niech obwódki dziury nie będzie".

## Summary

- Ladder: step 2 (repo) for everything. The visual reuses `build()`, the effect reuses the fan's "acceleration x body mass" pattern, and the hint ring rides on `machineVisual`, which the placement ghost in `player.ts` already calls. `player.ts` is untouched.
- `machines.ts`, magnet visual: heavy base, a 3.2 m post, a 3.7 m arm along local +Z (the way the ghost faces), a short rod and a red horseshoe at the arm's end, opening down. Head point `MAGNET_HEAD` = (0, 2.45, 3.5) in the tool's frame.
- Colliders: base, post and a thin arm at 3.3 m. Nothing under the head. `MACHINE_BOX.magnet` covers base + post only (half 0.6/1.7/0.6), so the arm can hang over the hole.
- Effect: gnomes within 13 m of the head get 30 m/s² horizontally towards the head's vertical line, times body mass, so weight does not matter. They get 8 m/s² up only while low (below 0.6 x scale above the base), so they slide and hop but never float. Within 1.2 m of the line the pull stops and they drop. Wake-up (`walk`/`statue` → ragdoll, `'machine'`) and `g.timer` stay as before. The old "near the hole, pull to the hole centre" branch is gone: the head decides now.
- Ghost hint: the magnet visual has a ring named `drop`. At render time it moves to the ground under the head (world space, so tilting does not move it off the ground). It is green (`66ff88`) when that point is inside the hole radius, yellow (`ffcc33`) elsewhere. `place()` removes the ring, so placed magnets do not show it.
- `environment.ts`: the rim torus, `env.rim`, its pulse timer and the `PULSE` constant are gone. `holePulse()` now only speeds up the swirl. Swirl, combo tint of the swirl, glow, coin fountain and sounds stay. `hole.ts` calls `holePulse()` without the strength argument (strength only drove the rim). `gnomes.ts` needed no change.

Rejected:
- Fixing that the placement check "in the hole" only fires when the box centre is below 1.2 m: rejected, it is in `player.ts` (owned by another implementer) and it was the same for the old magnet (centre 1.3 m) and the vacuum; a magnet sunk into the hole is still blocked because its centre then sits low.
- The `Math.min(1, dt * ...)` lines left in `environment.ts` (swirl tint, night): rejected, older code, not part of this change.

## Work progress

Scenario: `<scratchpad>/smoke/scenario-magnet-arm.js`, run `run-marm` (port 9372), regression `run-marm-reg15` (port 9373). Hole level 1, radius 1.6.

- [PASS] 1. over the hole — `over_hole`: head 1.4 m from the centre (radius 1.6), 10/10 eaten (stats +10), last one after 1.45 s.
- [PASS] 2. turned away — `heap`: 10/10 within 2 m of the head ground point (max 1.2 m), 0 gone, highest gnome y after 2 s = 0.57 m. Spawn sector facing the hole was left empty, so nobody gets pulled across it.
- [PASS] 3. weight — `weight`: body mass 1.2 and 3, both reach the head line (< 1.3 m) after 0.8 s, difference 0 %.
- [PASS] 4. ghost marker — `ghost_marker`: over the hole `66ff88`, ring at (-1.12, 0.04, 0.73); away `ffcc33`, ring at (8.78, 0.04, 4.73); placed magnet has no ring.
- [PASS] 5. no rim — `no_rim`: `env.rim` undefined, 0 tori at the hole (1 torus in the scene: the hoop), one massive gnome eaten, 0 torus scale changes over 2 s; screenshot `40-hole-no-rim.png` shows the hole without a rim.
- [PASS] 6. regression — `scenario15-wait.js` all steps OK (fan ratio 0.99, arc green, hoop bullseye, parade 16/16), `LOGS:` empty in both runs; `npx tsc --noEmit` → exit 0.
- Screenshots checked by eye: `21-magnet-side.png` (upside-down L, horseshoe at the arm's end, gnome heap under it), `30-ghost-over-hole.png`, `31-ghost-away.png` (yellow ring on the grass), `40-hole-no-rim.png`.
