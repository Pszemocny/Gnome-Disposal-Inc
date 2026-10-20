# Changelog

Newest build first. Each build lists what changed and what to test. Shown in the start menu (button "What's new").

## 2026-10-20 21:46

- The game is now called Gnome Disposal Inc.: new logo in the start menu and new browser tab title. Your save, blueprints and leaderboard stay. Test: open the game, check the logo and the tab title, press Continue and check your money is still there.

## 2026-10-20 21:38

- Offline earnings are gone: no "While you slept" card and no money for the time the game was closed. Machines and the factory only work while the game is open. Old saves load as before. Test: close the game for a few minutes with Auto Crank and a cannon, open it again: no card, money unchanged.

## 2026-10-20 19:00

- Trick shots no longer slow down time: a BULLSEYE still shows the big text, pays the bonus and plays sparks, fanfare and shake, but the game keeps its normal speed. A combo of 60 or 100 and an eaten King still play a short slow-mo. Test: score a BULLSEYE through the golden ring and check the game does not slow down.

## 2026-10-20 18:30

- Garden Gnomes (red-hat classic) waddle and swing their arms so you can see it from behind at 6-10 m: longer, thicker arms hang out to the side and flap outward on every back swing, the whole body sways and rolls from side to side with each step, and the hat tip whips after the body roll. All other gnome types sway and roll the same way and have the new arms, still as one piece. Legs and step speed are unchanged. Test: walk up behind a group of classic gnomes so they run away from you and watch them from 6-10 m.

## 2026-10-20 17:00

- Bottom row: the magnet panel no longer covers hotbar slot 1. The hotbar sits between the magnet panel and the same margin on the right and its slots get smaller when there is not enough room; on a narrow window (700 px or less) the hotbar moves right of the magnet panel with small slots and fits the window, and the magnet panel drops its key hint line (the H card has it). Test: own all 10 placeable tools, take the Magnet Gun, look at the bottom row at 1280x720 and in a small window.

## 2026-10-20 16:55

- Garden Gnomes (the red-hat classic only) are built from moving parts: legs and arms swing with every step (the step follows the distance walked, so feet do not slide), the hat and beard lag behind on starts and turns, a standing gnome breathes and its hat wobbles. Other gnome types still walk as one piece. Fans, wheels, vacuums, black holes, conveyor belts, the factory gear, mushrooms and the UFO now wind up and down instead of starting and stopping in one frame (the push itself still starts and stops at once). In the instant replay classic gnomes show as one piece. Add ?noparts to the URL to see the old look. Test: walk next to a group of classic gnomes, scare them so they start and stop, place a fan and let a saboteur break it.
- Shop: a big dark computer screen now (almost the whole screen) with a title bar, tabs like a taskbar, console font and faint screen lines; it switches on with a short flash. The title bar shows "AVAILABLE: n", how many things you can buy right now (all tabs together, grey 0 without money). Nodes and pictures are bigger, all of Tools fits a 1280x720 screen without scrolling. The bottom bar repeats the last buy message ("Trampoline bought! Press 2 to place it."). Test: open the shop with some money, buy a few things fast, switch tabs, check the counter and the bottom bar.
- One column on the left, nothing on top of anything: GOAL, then CONTRACT, then a new EFFECTS card in the same style (mushrooms with seconds left, Midas, Golden Hour, OVERTIME, wind), then the messages, newest on top. At most 4 messages; a fifth pushes the oldest out, the same message again shows "×2" instead of a second card, achievements land here too. Cards slide in and fold away, the rest of the column moves up smoothly. "Crate full!" now floats above the crate itself. Buying in the shop no longer adds a message (the shop's bottom bar says it). The H controls card moved to the right under the money. Test: eat two mushrooms while a contract runs, let a greedy gnome escape, fill a crate, press H; try a small window too.

## 2026-10-20 15:55

- Fan: gnomes walking at the far end of a fan's stream (9-10 m) no longer get knocked over again every time they stand up, so a saboteur in front of a fan does not lie there for ever. Test: put a gnome 9.5 m in front of a fan.
- Magnet Gun is a hand tool now, next to Hands, Plow Tractor and Leaf Blower. C switches between the tool in your hand and bare hands (and back to the same tool); hold Tab to pick which tool (Hands, Magnet Gun, tractor, blower, plus the Cleaning Robot). Placeable tools stay on 1-0. The line above the hotbar shows the tool and what C gives. Buying the gun puts it in your hand, a page load starts with it. Every switch drops what you hold. Test: with the gun, press C (bare hands grab one gnome), C again (gun back); take the blower from Tab, C, C.
- With Trick Scope Lvl 2+ held gnomes say nothing, so "Let go!" no longer covers the glass. Test: hold one gnome with the scope glass on.

- Cleaning robots ignore gnomes in the air (thrown, bouncing, launched by a fan or trampoline) and no longer drive in circles under them. They pick only gnomes that walk or lie on the ground; a flying gnome becomes a target again once it lands. Test: throw a gnome over a robot, or bounce one on a trampoline next to its post, with another gnome lying farther away.
- Trick Scope has 3 levels ($300 → $600 → $1.2k). Lvl 1: while you hold something the crosshair becomes a ring: green when the throw lands in the hole, gold for a trick, white for a miss. Lvl 2: a round glass around the crosshair names the trick (or IN THE HOLE); the label above the hole is gone. Lvl 3: the glass adds the distance and the multiplier, e.g. "LONG SHOT · 9.2 m · x5". Old saves keep Lvl 1. Test: fill the Magnet Gun, aim at the hole from far away, then through the ring, at each level.
- P saves a screenshot of the whole screen (game, HUD, toasts, shop, menus, booze colours) to logs/shots/<time>.png, plus a .json with money, hole level, gear, tool, fps and the visible text, on the dev machine; dev/preview builds only. Toasts now show above the shop and menus. Test: press P in game, paused, in the shop; a toast says saved or why not.

## 2026-10-20 15:40

- Shop: a green number on each tab shows how many things you can buy there right now. No money, no number. Test: earn money, open the shop, buy something and watch the number change and pop.
- Magnet Gun: the beam is gone. Hold LMB and every gnome in the cone flies into the ball in the same moment, as many as the ball fits (Coil 5: 75); the rest waits on the ground until there is room. Test: stand in front of a crowd with the gun and hold LMB.
- A Magnet Gun ball with more than 3 gnomes stays quiet: no speech bubbles over the crosshair. Test: pull a big ball and aim through it.

## 2026-10-20 15:10
- Fuses (Tools tab, from hole level 5, up to 5 levels): every tool gets a small fuse box. A saboteur hit turns one fuse red; the tool breaks only on hit L+1. The first E on a broken tool makes it work again and swaps one red fuse for a green one; each further E swaps one more. Test: buy Fuses, let saboteurs hit a fan or robot, press E several times and watch red → green.
- Factory lever next to the factory: E flips Auto Crank on/off (yellow knob, lamp). OFF stops only automatic production; hold E and events still make gnomes. Test: flip it, watch the factory label.

- Volley (Magnet Gun ball) big text names the trick shots, e.g. "VOLLEY · LONG SHOT x2.5 + AIR x2 = x5 (7 gnomes)". Volley cap raised from x4 to x8, so AIR adds on top of LONG or SNIPER. Test: throw a full gun through the air into the hole.

## 2026-10-20 13:40

- Shop is a skill tree on every tab: columns by hole level, lines to the upgrade it needs. Tools show a picture of their own 3D model, stat upgrades an emoji. Green pulse = you can afford it, blue = owned, gold = max, lock = hole level too low. Buying pops the badge. Land and Deep are trees too. Test: buy several things fast, hover for the description, check every tab.
- The first shop open in a session renders the tool pictures (about 0.15 s on a good GPU). Test: tell if the first open stutters.

## 2026-10-20 12:45

- "What's new" button in the start menu and the pause menu shows this list. Test: open it, scroll, Back.

## 2026-10-20 12:20

- Crash fixed: the game froze with "recursive use of an object" when a robot chased a gnome that vanished (Golden Hour, UFO, greedy gnome). Test: robots + Golden Hour.
- Errors are saved: every error goes to `logs/errors.log` on the computer serving the game, and a box with a Copy button shows in the bottom left.
- E repairs the machine under the crosshair also while you still hold a tool to place (green ghost). Test: place a tool next to a broken one, press E.
- Up to 12 cleaning robots (was 4), cheaper: $400 x1.3. Test: buy more robots.
- Robots pick dangerous gnomes first (saboteur, greedy, shadow, wizard, angry), then the gnome lying still the longest, then the nearest. Two robots do not chase the same gnome. Test: saboteurs near machines.

## 2026-10-20 11:40

- Robots drive around placed tools and no longer get stuck between trampolines. They back off and turn when stuck, give up a gnome they cannot reach, and go back to their post after 15 s without progress.
- Robots no longer stall on the ground seam near the hole.
