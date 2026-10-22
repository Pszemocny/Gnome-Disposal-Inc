# Darker shaft, a real heap and the King who eats you (The Deep)

Interpretation: PP 2026-10-22 (verbatim, screenshot "IT WAS LONELY."): "to musi byc bardziej mroczne bez swiecacych wasow, i tylko lekko swiecoce oczy mniej niz jest. Przejscie na wrzucone rzeczy dodaj tam stracone ufo i krola na ta kupe, tak aby to wygladalo jak kupa tj ilosc gnomow powoduje ze jest wieksza gorka + widac rzeczy ktore wrzuciles, flamingi fotle ufo itd. Ale dluzej bo teraz to tylko na chwile sie zamienia a zrob tak ze jak kamera to pokaze to juz nie przerywa tylko np krol do ciebie idzie i cie pozera albo cos takiego". Go-ahead without a plan round (PP: "zrob wszystko z boardu najpierw implementuj wszystko"). The earlier decisions stay: O1 no skip, O2 the heap line rule, O3 letters on the pile (`2026-10-22-outro-3d.md`).

Assumptions:
1. "Beards glow" = white beards lit by the rim light and the lamp read as bright arcs: the shaft gnomes get beards at 30 % brightness and the white eye spheres of `emissiveEyes` types become dark, no emissive anywhere on the bodies.
2. The heap is a dirt mound whose radius grows with `stats.gnomesEaten` (lifetime, log scale, capped at 4 m in a 6 m shaft), with gnome bodies lying on it (count from the same number, capped).
3. UFOs: not tracked until now; a new additive `stats.ufos` (old saves read 0), counted when a UFO crashes. Kings: `stats.typesEaten.king`, capped at 6 on the heap.
4. The heap scene and the devouring King run whenever a heap exists (any gnome, armchair, flamingo or letter eaten). The heap line keeps PP's O2 rule word for word: UFOs and kings do not change it.
5. Timeline after "It was lonely.": the camera flies down to the heap and stays; the heap line holds 5.2 s instead of 2.6 s; the King rises from the heap, walks to the camera and bites; the screen goes black; "THE DEEP" and "Be reborn" come only after the bite.

Gotowe, gdy (`tools/smoke/scenario-outro-3d.js`, FAKELOCK=1, private dev server):
- PASS 27: no white vertex (min channel > 0.8) in the shaft gnome meshes, their material has no emissive, the brightest near-eye channel <= 0.45 (was 1.0)
- PASS 28: mound radius and heap gnome count with 5000 gnomes eaten > with 50
- PASS 29: 2 UFOs and 3 kings on the heap (instances), plus the devouring King
- PASS 30: the King rises with a scale strictly between 0 and full, then walks to the camera: >= 10 samples, z strictly growing, faster in the middle than at both ends (eased, not linear)
- PASS 31: no cut: from the heap line to the bite the pitch never goes above 0.8 rad, no camera jump > 1 m per frame, the black is 0 before the bite and 1 after it, the bite pulls back before it lunges and overshoots, "THE DEEP" only after `devoured`
- PASS 32: an old save without `ufos` reads 0; a crashing UFO adds 1
- PASS 1-26 (17 changed: the camera stays down after the heap line)
- `npx tsc --noEmit -p .` exit 0
- screenshots `outro-heap.png`, `outro-king.png`, `outro-devour.png` checked by eye

## Problem

The shaft looked too bright (white beards as glowing arcs, strong eyes), and the heap was only a short camera turn to a few loose props.

## Summary

- Darker: the shaft gnomes use their own models (`gnomeGeometry` with the beard at 20 % linear brightness and dark eye spheres), eye points at 40 % brightness and a bit smaller, hemisphere 0.35 → 0.2, rim 1.0 → 0.5, the lamp follows the camera (2.4).
- Save: `stats.ufos`, +1 when a UFO crashes (`events.ts`), old saves read 0 through the stats merge in `loadState`.
- Heap (`Outro.buildHeap`): lumpy dirt mound, radius `min(4, 1 + 0.75 log10(1 + gnomesEaten))`, height 0.45 x radius; gnome bodies `min(250, 5 sqrt(gnomesEaten))` (Low 100) with per-instance tints; armchairs, flamingos (old caps), UFOs (max 4, 2 m), eaten kings (max 6) and letters. Hidden (not drawn) until the heap line, compiled at start.
- One `InstancedMesh` holds the eaten kings and, as instance 0, the King who eats you (king model + a dark mouth).
- Timeline `DEVOUR` (s after the heap line): camera flies to the view (y damp 4, z damp 1.2, clears the mound), King pops out of the heap at 3.5 (scale outBack 0.25 s, rise outBack 1 s, rumble, squash on landing), walks 4.8-8.4 (inOutSine, bob/roll/lean from his speed, footstep sounds), stares, bite at 9.0: pull-back 0.1 s, lunge outBack 0.45 s (overshoot), camera inQuad into the mouth, black plane outCubic from 9.2 to 9.45, `devoured` at 10.1.
- HUD: the heap line holds 5.2 s, the camera never goes back up, "THE DEEP" waits for `devoured`. Fallers that reach the heap land on it (squash) instead of falling through.

Gotowe, gdy (run `odh-g4`, `URL_QUERY='' FAKELOCK=1 MAXPOLL=2800 CDP_PORT=9843 DEV_PORT=5243 node tools/smoke/smoke.mjs <scratchpad>/odh-g4 tools/smoke/scenario-outro-3d.js`, 31 PASS lines, no FAIL, no exception):
- [PASS] 27 — `PASS 27 meshes=13 whiteVerts=0 emissive=0 eyeMax=0.400` (red run: `whiteVerts=888 eyeMax=1.000`)
- [PASS] 28 — `PASS 28 r50=2.28 r5000=3.77 h=1.03/1.70 gnomes=35/250`
- [PASS] 29 — `PASS 29 ufos=2 kings=3 kingMesh=4 noUfo=true soloKing=1`
- [PASS] 30 — `PASS 30 riseMid=5 full=3.20 walkSamples=216 zStrictlyUp=true z=0.40..3.60 v=0.68,1.34,0.66`
- [PASS] 31 — `PASS 31 devouredAt=10.12 maxPitch=0.481 maxJump=0.142 blackEarly=0 blackEnd=1 bite=3.25<3.60..4.62>4.50 deepAfter=true`
- [PASS] 32 — `PASS 32 oldSave=0 before=0 after=1` (red run: `oldSave=undefined`)
- [PASS] 1-26 — all PASS in `odh-g4` (17: `down=-0.203`, the camera stays down; 20/24 `calls=16`); 19: `scenario-intro-pressf.js` run `odh-intro` → 30 PASS lines, no FAIL
- [PASS] tsc — `npx tsc --noEmit -p .` → exit 0
- [PASS] screenshots by eye (`odh-g4`): `outro-eyes.png` eyes clearly dimmer than run 3, no bright beards; `outro-heap.png` the pile in the lower half under the text, UFO dome, kings' crowns, pink flamingos, armchairs, the letter on top, dark mood; `outro-king.png` the King walking at the camera; `outro-devour.png` the King's face fills the frame under the text right before the bite; `outro-final.png` "THE DEEP" on black.

Red run (`odh-red`, before the code): 27, 32, 17, 30 FAIL, 31 threw (no heap timeline).

## Work progress

Ladder: models from `src/world/models.ts` (`gnomeGeometry`, `ufoGeometry`, `build`, `armchairGeometry`, `flamingoGeometry`, `letterGeometry`) rung 2; eases from `src/core/ease.ts` and `THREE.MathUtils.damp` rung 2/3; the stats merge in `loadState` gives old saves `ufos: 0` with no new code (rung 2); the timeline is new code in `Outro` (rung 6, nothing on disk plays a cutscene).

Rejected:
- Camera shake on the bite: the screen is already going black, a shake would not be seen.
- An opening mouth: one instanced king geometry cannot move a part; the camera flies into the mouth and the black covers it.

Not checked: PP's real machine (only the headless Metal GPU); the King's dark mouth is not visible in `outro-devour.png` (it sits on the beard under the nose, too small at that distance); draw calls on the heap page are not budgeted (19 seen on the letters page).
