# Physics feel, spawning, hoop, aim aids (PP, 2026-10-19)

## Problem

PP playtest: the cooling fan must work regardless of weight (treat gnomes like empty boxes); the crate must always be liftable; "everything feels heavy"; gnomes appear by themselves, only the factory should make (at least the ordinary) gnomes; the bullseye ring was too high to hit (make it vertical next to the hole, or horizontal and much lower); gnomes must not be able to move the crate or other things; gnomes should have fixed different weights (PP chose: a few fixed weight classes, independent of type).

## Summary

- Fan: acceleration independent of mass, 28 m/s² near the fan (7 m range) plus a little lift so gnomes tumble along; earlier 11 m/s² never beat grass friction (0.7 x gravity 20). Measured: 1.2 kg and 3 kg gnome both moved ~3.5 m in 1.5 s.
- Magnet: 90 N at the start (lifts 4.5 kg, every weight class), +15% per Magnet Coil. Crate is always liftable regardless of contents.
- Dominance group 1 for the crate and the garden props: gnomes collide with them but cannot push them.
- Spawning: no starting statues; gnome rain drops only special types; the parade recruits gnomes in the yard and the factory makes the missing ones.
- Hoop: vertical, radius 0.8 m, 1.5 m high, circling 2.5 m outside the hole edge and facing the hole; a throw counts when its path between two frames crosses the hoop disc.
- Aim aids: visible magnet beam (dim while searching, bright while holding), predicted throw path dots, green when the throw ends in the hole.
- Weight classes (`WEIGHT_TIERS`): tiny 0.5 / light 0.8 / normal 1.2 / heavy 2 / massive 3 kg, size and value grow with weight; heavier classes become more common with hole level (massive from level 4); fat gnomes are always heavy or massive; king keeps 40 kg. Kicks use one fixed impulse, so heavier gnomes fly shorter.
- Polish round dispatched to 3 implementers: `docs/ai-work/2026-10-19-plan-polish-round.md`.

## Work progress

- [x] scenario15: no gnomes at start, fan ratio 0.94 (3.61 / 3.38 m), massive lifts at base magnet, beam and arc visible, arc green → throw eaten, crate with 10 heavy gnomes lifts (y 1.3), rain only special types, hoop 5.7 m from hole centre at 1.4 m height and counts a crossing, parade produced 16 via the factory
- [ ] weight classes and dominance verified after the polish round (scenarios run with the agents' code)
