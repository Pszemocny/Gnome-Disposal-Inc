# Hanging magnet over the hole, no hole rim (PP, 2026-10-20)

## Problem

PP (verbatim): "niech magnes do postawienia będzie zakrzywiony jak L, tylko przewrócone, aby można go było powiesić bezpośrednio nad dziurą. Usuń animację ze zjadania dziury, tj. niech obwódki dziury nie będzie".
Translation: the placeable Gnome Magnet should be shaped like an upside-down L (a post with an arm) so its magnet hangs straight over the hole. Remove the hole's eating animation, that is: no rim around the hole.

Today: the `magnet` tool (`src/entities/machines.ts`, visual case `'magnet'`, effect case `'magnet'`) is a straight post with a horseshoe on top; it pulls gnomes within 13 m to a point 1.6 m above its base, and near the hole (< 3 m) to the hole centre. The hole has a brown torus rim (`src/world/environment.ts`, `rim`) that swells on every eaten gnome (`holePulse`).

## Plan (orchestrator, final)

1. **Shape:** a post about 3.2 m tall on a heavy base, a horizontal arm 3.5 m long along the tool's local forward (+Z, the direction the placement ghost faces), and the red horseshoe magnet hanging at the arm's end, opening downwards, about 2.6 m above the ground. A short chain or rod between arm and magnet is fine. Colliders: base and post only, plus a thin arm collider high up (gnomes thrown at it can bounce off); nothing under the magnet head, so gnomes can fall through. `MACHINE_BOX.magnet` covers base + post for the ground/overlap check; the arm must not block placement over the hole (the hole has no collider; the base must stand on ground outside the hole).
2. **Effect from the head:** the pull point is the magnet head (world position from `m.pos` + quaternion). Gnomes within 13 m of the head are pulled horizontally towards the point under the head, with a little lift only while they are on the ground (so they slide and hop over the edge), never glued to the head: within 1.2 m horizontally of the head's vertical line the pull stops, so they drop. If that line is over the hole, they drop into the hole; if not, they collect in a heap under it. Weight-independent like the fan (use acceleration x body mass). Keep the "statue/walk → ragdoll" wake-up and the `thrownBy = 'machine'` rule.
3. **Ghost hint:** while placing the magnet, the ghost shows the head's drop point (a small ring or dot on the ground under the head; green when it is over the hole). Reuse the placement ghost code; no new UI.
4. **No rim:** remove the rim torus mesh and its pulse (`rim`, the rim part of `holePulse`). The swirl/vortex, the coin fountain and sounds stay. Remove every reader of `rim` (combo tint etc.), so nothing references it.
5. Rules: `CLAUDE.md` "Rules learned the hard way" and "## Animation rules".

Gotowe, gdy (headless):
- magnet placed with its base 0.5 m outside the hole edge, arm pointing at the hole centre: the head's ground point is inside the hole radius; 10 gnomes spread 4-10 m around → at least 8 eaten by the hole within 15 s (game time)
- same magnet turned away from the hole: gnomes collect under the head (at least 6 within 2 m of the head's ground point after 10 s), none glued in the air (all heads-y below 1.5 m)
- a 1.2 kg and a 3 kg gnome at the same distance reach the head's line within 20% of the same time
- the ghost drop-point marker is green over the hole, not green elsewhere
- no mesh named/stored as the hole rim exists; eating a gnome changes no torus scale; screenshot of the hole without a rim, checked by eye
- regression `scenario15-wait.js` passes; no exceptions; `npx tsc --noEmit` clean
