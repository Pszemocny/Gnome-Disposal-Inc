# Hole moves with each Land, weaker trampoline that grows with Land, longer Magnet Gun reach (PP, 2026-10-20)

## Problem

PP (verbatim):
- "pojedyncza trampolina działa zbyt dobrze, niech przy każdym nowym landzie jest większy mnożnik" — after the options, PP: "to wszystko do zrobienia, ale dziura z każdym kupionym landem ucieka gdzieś indziej, albo randomowo, albo wylosuj kilka miejsc na mapie, albo nie losuj i daj je na stałe".
- "super, ten pistolet działa świetnie, mógłby mieć większy zasięg na odległość z każdym levelem".

Today: the trampoline always launches with 13 m/s along its normal + 6.5 m/s forward (≈ 8.5 m), so one trampoline under the factory landing circle feeds the hole by itself. The hole moves 1.2 m per hole level away from the factory (`holeCenterFor(level)` in `src/world/environment.ts`). Land tiers (`src/data/land.ts`): Backyard half 22 m, Garden 32 m, Neighbour's Lawn 44 m, Dark Forest 58 m. Magnet Gun beam range `7 + 1.2 x Magnet Dish`.

## Plan (orchestrator, final)

1. **Trampoline weaker at start, stronger with every Land:** launch speed x `0.6 x 1.25^landTier` (Backyard 0.6 → about 5 m; Garden 0.75; Neighbour's Lawn 0.94; Dark Forest 1.17 of today's speed). Same direction rules. One trampoline under the factory circle no longer reaches the hole on the Backyard.
2. **The hole moves to a new fixed spot with every bought Land** (not random, so the player can plan a contraption for it): one hand-picked anchor per land tier, inside that tier's fence and at least 8 m from the factory, the house, the desk and the fence (e.g. Backyard: today's spot; Garden: towards the far left corner; Neighbour's Lawn: far right; Dark Forest: behind the house side), each further from the factory than the last. The per-hole-level drift (1.2 m per level away from the factory) continues from that anchor. On purchase: the hole slides to the new spot over ~1 s with a dust puff (Animation rule 3), placed tools that would end up inside the new hole get pushed back to the inventory with a toast ("The hole moved! Tools in its way went back to your inventory."), gnomes in the old spot are unaffected, the golden hoop and the arrow/target marker follow the hole, the save stores nothing new (the spot comes from `state.land` + `holeLevel`).
3. **Magnet Gun reach grows with every level:** beam range `7 + 1.2 x Magnet Dish + 0.6 x Magnet Coil` (Coil 10 → +6 m); update the Magnet Coil description ("+0.2 m ball, +0.6 m reach, stronger grip").

Gotowe, gdy (headless):
- Backyard: a gnome dropped on a flat trampoline flies ≤ 60% of the old distance; with `state.land = 3` it flies ≥ 110% of the old distance
- for land 0..3 the hole centre equals that tier's anchor (+ level drift), every anchor is inside its fence and ≥ 8 m from factory/house/desk/fence, and each anchor is further from the factory than the previous
- buying the Garden in the shop moves the hole within 1.5 s; a tool standing on the new hole spot goes back to the inventory with the toast; the hoop is 2.5 m from the new hole edge
- Magnet Gun: with Coil 0 a gnome 8 m away is not pulled; with Coil 5 (range 10 m) it is
- regression `scenario15-wait.js`, `scenario-magnet-arm.js`, `scenario-magnet-gun.js` pass; no exceptions; `npx tsc --noEmit` clean
