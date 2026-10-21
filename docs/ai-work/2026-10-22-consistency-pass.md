# Consistency pass over player-facing texts (board N4)

## Problem

Many features changed in the last days (lands come by themselves, the hole changes side, Golden Hour is a mushroom from hole level 6, Fuses from $1000, Gnome Funnel, fan power on N, robot stations, Strong Arm downgrade, combo mushrooms, BIGGEST COMBO, No Scope, smaller trick bonuses before hole level 4, progress log). Some texts in the shop, legend, HUD, events, mushrooms, CHANGELOG.md and docs/SPEC.md still describe the old game. PP (2026-10-20, board N4): fix every text that contradicts the code; the code wins, unless the text is a PP decision recorded in docs/SPEC.md (then report the conflict). Old CHANGELOG entries get shortened to the rule in CLAUDE.md "Changelog" (one bullet per change, at most two short sentences, no "Test:", no internal names), keeping every section and its facts.

Interpretation: texts only. No game behaviour, numbers or balance change. PP said "bez planu" (2026-10-21), no job/migration/cache/queue, so no mini-roast.

Gotowe, gdy:
1. `npx tsc --noEmit -p .` → exit 0, no output.
2. `grep -c "Test:" CHANGELOG.md` → 0.
3. `grep -rn "Press C to\|the Golden Hour event\|fires them the way it faces\|tractor, cannon, vacuum\|Gently blows\|turns to gold for 25 s" src` → no output (every stale text found below is gone).
4. `grep -n "zawsze 200\|Złota godzina (event\|+3 do limitu combo\|każdy wpis mówi, co testować" docs/SPEC.md` → no output. (First written with the bare phrase "co testować"; that also matches the PP quote in the decision log, which stays, so the check names the stale sentence itself.)

Ladder: rung 1-2, edits of existing strings and comments only; nothing new in code.

## Summary

Eleven player-facing texts, four code comments and six places in SPEC described the old game; all now follow the code. Old CHANGELOG entries are short, without "Test:" and without file names, URL flags or console names. No game behaviour or number changed.

## Work progress

Fixes (file: old → new), each checked against the code named in brackets.

Shop (src/data/upgrades.ts, src/ui/shop.ts)
- Plow Tractor: "Press C to drive a tractor" → "take it from the tool wheel (hold Tab)". C gives nothing until a gear was taken from the wheel, except the Magnet Gun (sweeper.ts `next()`, player.ts hotkeys toast).
- Leaf Blower: "Press C to hold a leaf blower" → "Take the leaf blower from the tool wheel (hold Tab)". Same reason.
- Cooling Fan: "Gently blows gnomes away in a cone" → "Blows gnomes away in a cone. Press N on a placed fan to set its power." (55 m/s², doubled after playtest; N power per fan.)
- Keep Tools: "Keep tool upgrades after rebirth" → "Keep the whole Tools tab, the Plow Tractor and the Leaf Blower with their upgrades after rebirth." (`KEEP_TOOL_IDS`.)
- Comment, Gnome Funnel: "cheap, right after the Kicking Wheel (F1 a)" → "$1500 x1.8 from hole level 4 (PP 2026-10-21)".
- Comment, KEEP_TOOL_IDS: "tools in Movement" → "tools in the Plow tab (not Steel Toes)".
- Comments in shop.ts CSS: "nine tabs" → "eight tabs"; the 950 px wrap note now says it was measured with nine tabs, before Land left.

Legend (src/ui/legend.ts)
- Golden Gnome: "the Golden Hour event" → "the Golden Hour mushroom".
- King: "only machines (tractor, cannon, vacuum...)" → "only the tractor and machines (fans, cannon, black hole...)". The Vacuum Tower skips the King (machines.ts vacuum branch); fans, cannon and black hole take him.
- Mushrooms: added "every big combo text spits one out" (hole.ts combo tiers, PP 2026-10-21 "C").
- Trick shots: flat bonus is "smaller on the first hole levels" (hole.ts `bonus *= min(1, level / 4)`); no numbers, per the legend decision of 2026-10-20.
- Weight classes: "at the last Strong Arm level every gnome flies the same" → "at the last Strong Arm level or with Feeding Frenzy" (player.ts weight check).

HUD (src/ui/hud.ts)
- Gnome Cannon first-use hint: "fires them the way it faces" → "Pulls in nearby gnomes and fires them into the hole. It turns to the hole by itself." (machines.ts `aimAtHole`, 5 m pull.)

Mushrooms and events (src/systems/buffs.ts, src/systems/events.ts)
- Golden Hour mushroom: "Every gnome turns to gold for 25 s" → "Every gnome turns to gold". Golden Hour banner: "Every gnome turns to gold for 25 s! Catch them!" → "Every gnome turns to gold! Catch them!". Long Trip makes it last longer; the legend and the EFFECTS card show the real time.

SPEC (docs/SPEC.md)
- XP line: "król zawsze 200" → "król zawsze 1000" (King `xp: 1000`, decision 2026-10-21).
- Gnomes: "Złota godzina (event, 25 s)" → grzybek Golden Hour od poziomu 6, 25 s, dłużej z Long Trip.
- Plow Tractor and Leaf Blower: "klawisz C" → z koła narzędzi (Tab), potem C przełącza ↔ ręce.
- Mushroom list: Red Combo Cap "+3 do limitu combo" → "+1x do limitu mnożnika combo" (hole.ts `comboCap` +1); Golden Hour added; "od poziomu 6" at Gold Midas, Golden Hour and Rainbow.
- HUD tool line example: "TRACTOR · plow 2,6 m (C)" → "PLOW TRACTOR · plow 2.6 m · C: Hands" (what hud.ts prints).
- Changelog line: "każdy wpis mówi, co testować" → the 2026-10-24 rule; new decision line under Interfejs with PP's quote.

CHANGELOG.md
- Header: "what changed and what to test" → "what changed for the player".
- Every section from 2026-10-21 12:00 down rewritten: one bullet per change, at most two sentences, no "Test:", no `logs/...`, `?stats`, `?noparts` or console line names. Bullets that held several changes were split, so every fact stays as its own bullet. Sections and their dates are unchanged; entries from 2026-10-24 18:00 up already met the rule and are untouched.
- Historical facts stay as they were at that build (for example "the King always gives his full 200 XP" in 2026-10-21 12:00); the newer section says 1000.

Checked and left as is (no contradiction with the code)
- "magnet" for hand grabs (goals, HUD prompts, crate hint): the hand grab is the game's magnet (Magnet Dish widens it, HUD panel "MAGNET · ..."), so "drag the crate into the hole with the magnet (LMB)" matches.
- Goals and lessons: values (x8 dwarf, x100 golden, 40 kg King, x2.5 / x2 / x5 tricks, crate on key 1) match gnomeTypes.ts and hole.ts. No goal text changed, so scenario-tutorial-goals.js was not run.
- Achievements: 27, thresholds match systems/achievements.ts (Gnome Baron $100m, Landlord = Dark Forest, No Scope = SNIPER without Trick Scope).
- Fuses description ("breaks only when no fuse is left"), robot, funnel, Strong Arm, Coin Magnet, Head Start ($100 x 3^level), Auto Crank, shop status-bar messages, H panel, start menu text, hole-level unlock lines.

Conflicts not resolved: none found where a text records a PP decision that the code contradicts.

Rejected
- Hole level 6 unlock line could also name the gold mushrooms: not a contradiction, only a missing mention, so left out.
- No new CHANGELOG section for these text fixes: a section belongs to a 5300 build, which this task does not make.

Checks
- [PASS] 1 — `npx tsc --noEmit -p .` → exit 0, no output.
- [PASS] 2 — `grep -c "Test:" CHANGELOG.md` → 0.
- [PASS] 3 — the src grep → no output (exit 1).
- [PASS] 4 — the SPEC grep with "każdy wpis mówi, co testować" → no output (exit 1); the bare "co testować" only hits the two decision-log lines with PP's quotes.

Self-check: the diff changes strings and comments only (8 files plus this note and the local BOARD.md); no logic, numbers or ids. No files left over besides `.idea/`, which was there before.
