# Playtest round 1 (PP, 2026-10-19)

## Problem

PP's playtest feedback on the first build:
- no gnome machine → PP decided: no mushroom houses, a gnome factory where you hold a button to produce gnomes
- wooden box should be a container for gnomes
- graphics too angular, use free textures
- the shop PC was hard to notice
- throwing only, no dropping; no progress bar; unclear what the sack is for; could carry only one gnome
- gnomes came out of houses in lines
- "A greedy gnome got away" crashed the game
- thrown gnomes were re-caught by the grab
- economy too fast: 5 fans + 2 panels = full automation, $119m, felt like an idle clicker

## Summary

- Gnome factory (hold E) replaced the houses; gnomes leave the chute with random spread.
- Carry model: hold LMB to pick up (3 + Strong Arms), release to drop, RMB throws all. Thrown gnomes cannot be re-grabbed for 1.5 s.
- Wooden crate: open-top physics box, gnomes landing inside are stored (12), carry it with LMB, dumping it into the hole eats all at once.
- Goal panel with progress bars (16 guided goals), bigger hole XP bar with numbers, factory progress bar.
- CC0 Poly Haven textures (grass, wood, metal, roof, plaster, bark, dirt), smooth shading, more segments, textured house, SHOP and GNOME FACTORY signs.
- Crash fix: gnome removed inside `decide()` was still moved afterwards.
- Rebalance: hole multiplier x1..x10 (was x100), XP curve ~11k gnomes, gentle price growth, weaker fans, Auto Crank from hole level 4. Table in `docs/PLAN.md`.
- Port 5300 fixed in `vite.config.ts`; playtest build served from `release/`.

## Work progress

- [x] all items above, verified by headless scenarios (factory, grab/drop over hole, throw, crate fill + dump, greedy escape, re-grab after throw)
- Rejected: downloading a CC0 gnome model (itch.io needs a manual download step); procedural smooth gnomes instead.
