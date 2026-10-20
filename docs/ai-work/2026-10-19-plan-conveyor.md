# Conveyor belt that really carries gnomes (PP, 2026-10-19)

## Problem

PP (verbatim): "pasy transportowe w ogóle nie działają, dodaj im jakąś ładną animację, aby przenosiły faktycznie te gnomy o taką długość jaka jest, mogą nawet je wyrzucać nieco na końcu. Mogłyby mieć jakieś ścianki, aby nie wypadały gnomy."
Translation: conveyor belts do not work at all. Add a nice animation, make them really carry the gnomes along their whole length, they may even toss them a bit at the end. Add side walls so gnomes do not fall off.

## Plan (plan-senior, final)

Written by the orchestrator at PP's explicit request ("uruchom implementera"). Code: `src/entities/machines.ts`, ONLY the conveyor parts: `machineVisual` case `'conveyor'`, the conveyor colliders in `place()`, the conveyor branch in `effect()`, and `MACHINE_BOX.conveyor` if the size changes. Another implementer (Magnet Gun) may edit the crate code in the same file at the same time: re-read the file right before every edit, keep edits small and local, never rewrite whole functions you do not own.

1. Find out why gnomes are not carried today (reproduce with a headless scenario first: place a conveyor, drop a gnome on its start, measure where it is after 2 s). Likely suspects: the local-frame zone check, the belt surface height vs the gnome centre, gnomes in `walk`/`statue` state vs `ragdoll` timers, friction fighting `setLinvel`, the gnome standing up again (`standUp`) and walking off.
2. Carrying: every gnome whose centre is above the belt surface (in the belt's local frame: within the belt width, along its length, up to ~1.3 m above the surface) moves along the belt's local +Z at 4.5 m/s, keeps being kept in `ragdoll` (no standing up / walking away while on the belt), is gently centred sideways, and follows a tilted belt (ramp) upwards. Works for every weight class the same.
3. Toss at the end: when a gnome reaches the last ~0.3 m of the belt it gets a toss: forward 6 m/s + up 3 m/s along the belt's axes, then is free (normal ragdoll). Mark machine-tossed gnomes `thrownBy = 'machine'` unless they were a player throw (keep `throwPos`/trick flags of player throws intact).
4. Side walls: two low rails (0.35 m high, thin) along both long sides, with colliders (same collision group as the belt), so gnomes do not fall off the sides; the ends stay open.
5. Animation: the belt surface visibly moves in the carrying direction (scrolling texture with chevron arrows pointing the right way — check the UV direction of the belt box so it scrolls along local Z and the arrows point to +Z), rollers at both ends and in the middle spin, small arrow decals or a coloured stripe on the rails showing the direction.
6. Keep `MACHINE_BOX.conveyor` in sync with the new size (placement uses it for resting on surfaces and blocking overlaps).

Gotowe, gdy (headless scenarios):
- flat conveyor, gnome (1.2 kg) dropped on its start end → within 2 s it passed the far end and landed at least 1 m beyond it
- the same for a 3 kg and a 0.5 kg gnome (same behaviour)
- gnome dropped near a side rail → stays on the belt (does not fall off the side) until the end
- conveyor tilted 20° up (rotate the placement quaternion around its local X) → gnome carried up to the top end and tossed
- belt texture offset changes over time in the direction that moves the arrows towards local +Z (check the sign against the gnome's travel direction)
- no exceptions in the logs

## Tests

Headless CDP harness `/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-boozed/844ac005-e3c6-4341-b0ea-34b547159d26/scratchpad/smoke/smoke.mjs` (`CDP_PORT=<port> MAXPOLL=4000 node smoke.mjs <outDir> <scenario.js>`; use ports 9371-9379 only, kill a `chrome-headless-shell` you started if a run hangs). Dev server `http://localhost:5199` (already running; if not, start `npx vite --port 5199 --host 127.0.0.1 --strictPort` in the background). Machines are placed with `g.machines.place(type, pos, quaternion)` (`new g.camera.quaternion.constructor()`); see `scenario15.js` in the same folder for the pattern. Do NOT build `release/` and do not touch port 5300 (the orchestrator publishes after all agents finish). `npx tsc --noEmit` must be clean for your changes. Write `docs/ai-work/2026-10-19-conveyor.md`.
