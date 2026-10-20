# Crate price $70, doubled crate limits, stronger fan (PP, 2026-10-19)

## Problem

PP (verbatim):
- "niech upgrade kosztuje tyle, ile można wyciągnąć z 12 gnomów, czyli 70, tak aby działało to tak, że kupujesz box, sprzedajesz, kupujesz ulepszenie, sprzedajesz ulepszenie, sprzedajesz itd." Asked to choose, PP answered "tak 70": option a (only the crate and its upgrade) at a flat $70.
- "niech limity będą większe, tak z 2 razy większe, i fany niech działają mocniej, bo teraz niewiele dają".

## Summary

- `src/data/upgrades.ts`: Wooden Crate and Bigger Crate cost a flat $70 per level (growth 1; were $40 x2.5 and $120 x1.8). Their level caps doubled: 6 crates (was 3), Bigger Crate 8 levels, so up to 12 + 48 = 60 gnomes per crate (was 36).
- "Limits" read as the crate limits, because the message continues the crate loop discussion. Other upgrade caps are unchanged: doubling all of them would e.g. give +120% run speed, a 4.8 m magnet ball and 520 gnomes in the yard (Gnome Permit), which is a different balance question.
- `src/entities/machines.ts` fan: range 7 → 10 m (`FAN_RANGE`), acceleration 28 → 55 m/s² at the fan, cone a bit wider (cos 0.85 → 0.8). Still mass-independent.

## Work progress

- `npx tsc --noEmit` clean.
- `scenario-crate-price.js` (headless, shop DOM): Wooden Crate $70 / $70 / $70 then MAX at the old cap 3 (run before the cap change), Bigger Crate $70 at levels 0-3; buying either takes exactly $70 (1000 → 930). PASS.
- `scenario-fan-strong.js`: in 1.5 s a 1.2 kg gnome 2.5 m in front moved 7.26 m (before: 2.73 m), a 3 kg gnome 10.91 m (weight still does not slow it), a gnome 8 m away 2.97 m (before: out of range). PASS, no exceptions.
