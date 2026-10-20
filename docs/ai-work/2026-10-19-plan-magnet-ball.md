# Magnet Gun: a ball that takes as many as fit (PP, 2026-10-19)

## Problem

PP (verbatim, after playing the Magnet Gun build): "magnes trzeba przerobić, niech łapie ile wlezie, ale w jakimś tam okręgu czy działa, i upgrade zwiększają tę kulę, tak bardziej rzeczywiście będzie".
Translation: rework the magnet: it should grab as many gnomes as fit, inside some sphere where it works, and upgrades make that ball bigger; that feels more real.

Today (`docs/ai-work/2026-10-19-magnet-gun.md`): the gun holds a fixed count `6 + 3 x Magnet Coil` gnomes; they jostle on a small sphere 2.2 m in front of the camera.

## Plan (orchestrator, final)

1. **The capacity is a volume, not a number.** The gun has a hold ball in front of the camera with radius `R = 0.8 + 0.2 x Magnet Coil` m (Coil 0: 0.8 m, Coil 10: 2.8 m). The ball centre moves further from the camera as it grows (`1.2 + R` m), so a big ball does not fill the view.
2. **"As many as fit":** the gun keeps pulling every free gnome in its beam towards the ball. A gnome counts as held while its centre is inside the ball (plus 0.3 m margin); gnomes are attracted to the centre (spring acceleration, mass-independent as today), so they pack physically and the ones that do not fit stay outside, pushed out by the others. Those are not "held": they are dropped (ragdoll, 1 s no-grab like a slip today) once they have stayed outside the ball for 0.4 s. No fixed count: bigger gnomes take more room on their own, because they are bigger (weight tiers scale the body).
3. **Heavy slip off:** keep today's rule (grip distance shrinks with mass, small random chance), measured from the ball centre, with the grip distance scaled by `R / 0.8` so a bigger ball does not shake everything off.
4. **Visible ball:** a faint translucent sphere (or a ring facing the camera) of radius R shows the ball while LMB is held with the gun; no runtime lights (CLAUDE.md).
5. **Upgrades:** Magnet Coil "+0.2 m magnet ball radius (fits more gnomes) and a stronger grip (needs the Magnet Gun)". Magnet Dish unchanged (beam range and width). The HUD panel shows `MAGNET GUN n gnomes · ball 1.2 m`; the shop preview shows the radius now/next.
6. Hands (no gun) unchanged: one object.

Gotowe, gdy (headless):
- Coil 0, 40 gnomes in front, hold LMB 4 s → held count between 5 and 15, every held gnome inside R + 0.3 m of the ball centre
- Coil 5 (R 1.8 m) → held count at least 3x the Coil 0 count
- 3 kg gnomes take more room: a ball of only 3 kg gnomes holds fewer than a ball of only 0.5 kg gnomes
- turning 180° in 0.5 s still drops more 3 kg than 0.5 kg gnomes
- RMB throws all held, speed J/mass as today
- the ball sphere mesh is visible while holding and hidden otherwise; no exceptions; `npx tsc --noEmit` clean; regression `scenario-magnet-gun.js` (update its capacity lines to the new rule), `scenario15.js`
