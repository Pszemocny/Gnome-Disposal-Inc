# Golden Hour turns every gnome golden (PP, 2026-10-19)

## Problem

PP (verbatim): "golden hour chyba nie działa, niech zamienia wszystkie gnomy w złote i niech złote będą drogie".
Translation: Golden Hour seems not to work; it should turn all gnomes golden, and golden gnomes should be valuable.

Today (`src/systems/events.ts`, `src/entities/gnomes.ts` around `goldChance`): the event only multiplies the golden roll chance for NEW gnomes by 25 (0.4% → 10%) for 25 s. Gnomes already in the yard stay as they are, and the factory makes only a few gnomes in 25 s, so the player sees almost no golden gnome: the event looks broken.

## Plan (orchestrator, final)

1. **Reproduce first** (red): start the event in a headless scenario with ~30 gnomes in the yard and count golden ones after 2 s and at the end (expected today: about 0-3).
2. **Turn every free gnome golden** when Golden Hour starts: every gnome in `walk`, `statue` or `ragdoll` state (not `held`, `stashed`, `falling`; not the king) becomes a golden gnome at the same place, same velocity, same weight class (replace the gnome: remove and spawn `golden` with the old position, velocity, yaw and `tier`; keep `throwPos`/`thrownBy`/`bullseye` flags if the gnome is in flight). A golden sparkle burst and a coin chime on each converted gnome (staggered over ~0.5 s so it reads as a wave, not one frame).
3. **New gnomes during Golden Hour** (factory, rain, parade) also come out golden.
4. **When Golden Hour ends**, golden gnomes created by the event that were not eaten turn back into the type they had (same replacement path, with a small grey puff). Natural golden gnomes (from the normal roll) stay golden.
5. **Valuable:** golden gnomes keep their type value (100 x the normal gnome, times the hole multiplier and the weight class) and their `flee` behaviour, so catching them is the challenge. The HUD buff line "Golden Hour Ns" stays. The event subtitle becomes "Every gnome turns to gold for 25 s! Catch them!".
6. Rules from CLAUDE.md: collect gnomes first, replace after; never touch a removed gnome's body again in the same loop; follow `## Animation rules` (rule 3: a short scale transition on the replaced gnome, and a cue).

Gotowe, gdy (headless):
- red before the fix: golden count after the event start is low (record the number)
- after the fix: 2 s after the start, every free non-king gnome is golden (held/stashed/falling untouched), count before = count after (no gnome lost or added)
- a gnome made by the factory during the event is golden
- 1 s after the end, event-made golden gnomes are back to their old types; a natural golden gnome is still golden
- a golden gnome eaten during the event pays 100x a normal gnome of the same weight class (same combo/hole multipliers)
- regression `scenario15-wait.js` passes; no exceptions; `npx tsc --noEmit` clean
