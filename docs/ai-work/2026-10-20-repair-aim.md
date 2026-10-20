# Repair a broken tool with E while aiming at it

## Problem

PP: "Maszyna ma dzialac tylko po najechaniu ten przycisk e bo teraz jak postawie cos blisko maszyny to nie moge naprawic jak gnom to zepsuje."
When the player places a tool next to a machine and a saboteur breaks that machine, E does not repair it.

Done when (PP: bez planu, trivial: one gameplay file plus its prompt line):
1. `zz-repair-aim.js` cases A-F (crate, trampoline, conveyor next to the fan; saboteur break with a gnome near; player places a crate / trampoline and still has more) → `brokenAfterE: false`.
2. Same run: G (aim at a crate in front of the broken fan) → `brokenAfterE: true`; H, I (LMB grabs crate, gnome) → `true`; J (E at the desk) → `isOpen: true`.
3. `npx tsc --noEmit` → exit 0.

Ladder: rung 2, reuse `ctx.machines.repair` and the existing `lookAt`; no new helper.

## Summary

Cause (current code): after a placement, `updatePlacement` keeps the ghost out while more of that tool are left (`available(type) > 0`). In that state `Player.update` calls `updatePlacement()` instead of `actions()`, and only `actions()` reads E. The ray in `updateLook` already sees the broken machine; nearby tools and gnomes do not block it (cases A-D were already green).
The HUD showed the placement hint instead of "E repair", so the prompt hid the repair too.

Fix:
- `src/player/player.ts`, `updatePlacement`: E repairs `lookAt.machine` when it is broken.
- `src/ui/hud.ts`: the "E repair" prompt now wins over the placement hint.

Rejected: cancelling placement on repair (nobody asked; the ghost stays so PP can keep placing).

## Work progress

- Red: `CDP_PORT=9397 MAXPOLL=500 node scratchpad/smoke/smoke.mjs ./out-repair-red zz-repair-aim.js` → E and F `"placing":"box"/"trampoline"`, prompt `LMB place · ...`, `"brokenAfterE":true`; A-D, G-J as expected.
- Green, same command → all A-F `"brokenAfterE":false`, E/F prompt `E repair Cooling Fan`; G `true`; H `true`; I `true`; J `{"desk":true,"isOpen":true}`; no logs.
- `npx tsc --noEmit` → exit 0.
- Regression `zz-scenario15-scope.js` → all steps return values, no exceptions.

Self-check:
- [PASS] line 1 — green run, A-F `brokenAfterE:false`.
- [PASS] line 2 — G `true`, H `true`, I `true`, J `isOpen:true`.
- [PASS] line 3 — `tsc_exit=0`.
