# Wind-up out, Trick Scope in; no floating placement over the hole (PP, 2026-10-20)

## Problem

PP (verbatim): "wind up nie działa poprawnie, trzeba albo to usunąć, albo zmienić, aby zamiast tego kupować ten sniper, czyli pokazywanie trajektorii lotu, ale to powinno lepiej wyglądać niż teraz".
Translation: Wind-up (hold RMB to charge a throw) does not work properly; remove it, or replace it with a purchase that shows the flight trajectory ("the sniper"), and that preview must look better than today.

Also found by the magnet-arm agent (`2026-10-20-magnet-arm-no-rim.md`): when the player holds a tool ghost in the air above the hole, the "in the hole" block does not fire (it only checks a body centre lower than 1.2 m), so a base can be placed floating over the hole.

Today: `charge` upgrade (Movement, $300) in `src/data/upgrades.ts`; RMB charge logic and HUD charge bar in `src/player/player.ts`, `src/ui/hud.ts`, `src/ui/style.css`. The trajectory arc (`arc`, white dots, green when it ends in the hole) is always shown while something is held, for free.

## Plan (orchestrator, final)

1. **Remove Wind-up completely:** the `charge` upgrade, the RMB charge code (RMB always throws at once), the charge bar in the HUD and its CSS, mentions in help/menu/goals/PLAN. Old saves that own `charge` keep loading (unknown upgrade ids must be ignored; if they are not, drop the key on load). Refund: if a save has `charge >= 1`, give the $300 back once on load with a toast "Wind-up was removed: $300 refunded." (keeps PP's playtest save fair).
2. **New upgrade "Trick Scope"** (id `scope`, Movement tab, $300, max 1, hole level 1): "Shows where your throw will fly and which trick it will score." Without it, no trajectory preview at all (the magnet beam stays). With it, the preview is shown while something is held.
3. **Better-looking preview** (replace the white dots):
   - a smooth tapered ribbon or dashed line along the predicted path (thin, slightly transparent, fading towards the end), computed as today from the throw impulse / mass with gravity (and the swarm centre for the Magnet Gun);
   - a landing marker at the end: a flat ring on the ground (or on the surface hit) that pulses gently;
   - colour coding: white = misses the hole; green = lands in the hole; gold = also scores a trick (passes through the golden hoop → BULLSEYE, or from ≥ 8 m → LONG SHOT / ≥ 14 m → SNIPER); a small label next to the landing ring names the trick(s) it would score ("BULLSEYE", "LONG SHOT"), using the HUD DOM label projected from 3D like the floating texts;
   - no runtime lights; follow `## Animation rules` (fade in/out ≤ 0.2 s, eased).
5. **Stacking (PP, 2026-10-20, verbatim: "trzeba zmienić, aby rzeczy można było kłaść na sobie, a nie tylko na ziemi, aby można było tworzyć dziwne contraption"):** the placement ghost rests on whatever surface the aim ray hits first: the ground, or the top (or side) of an already placed tool, the crate, the house slab, the desk. The ghost sits on that surface (base on the hit point, keeping the player's R/T rotation), the overlap check ignores the contact with the supporting object's top face (touching from above is allowed, interpenetration is still BLOCKED). Placed tools stay static (fixed bodies) as today, so a stack holds. Removing (X) or moving (G) a tool that has others on top: the ones on top stay where they are (they are fixed, floating is acceptable for a contraption game) — no cascade. A tool may not be placed on a gnome or on a dynamic prop (chair, flamingo). Works with the L-magnet arm too (a tool can sit on the arm if the arm's top is hit).
4. **Placement fix:** a ghost whose base footprint (the part that stands on the ground, per `MACHINE_BOX`, not an arm or overhang) overlaps the hole radius is BLOCKED at any ghost height. The L-magnet with only its arm over the hole stays placeable.

Gotowe, gdy (headless):
- shop Movement tab: no "Wind-up", "Trick Scope" present; buying sets `upgrades.scope = 1` and takes $300
- a save with `charge: 1` loads without errors, gets $300 back once (second load: no extra money), and RMB throws instantly
- without `scope`: holding a gnome shows no trajectory mesh; with `scope`: visible
- aiming so the path ends in the hole → green; through the hoop into the hole → gold + label contains "BULLSEYE"; from 9 m into the hole → label contains "LONG SHOT"; aiming away → white, no label
- the predicted landing point is within 0.6 m of where a real throw lands (one throw at Strong Arm 0)
- placement: a vacuum/cannon ghost held 2 m above the hole centre → BLOCKED; the L-magnet with its base 0.5 m outside the hole edge and the arm over the hole → placeable
- stacking: a panel aimed at the top of a placed conveyor → ghost rests on the conveyor top (ghost bottom within 0.05 m of the conveyor's top), not BLOCKED, placed; a trampoline on that panel → placed; a gnome dropped on the top trampoline bounces (the stack works physically); a ghost pushed into the side of a tool (interpenetration) → BLOCKED; aiming at a gnome → the ghost goes to the ground behind it, not onto the gnome
- screenshot of the preview in each colour, checked by eye; regression `scenario15-wait.js`, `scenario-magnet-gun.js`, `scenario-trick.js` pass; no exceptions; `npx tsc --noEmit` clean
