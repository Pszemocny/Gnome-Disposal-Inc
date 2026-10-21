# Changelog

Newest build first. Each build lists what changed and what to test. Shown in the start menu (button "What's new").

## 2026-10-25 16:00

- Dumping a crate into the hole now pays full hole XP for every gnome in it. A crate tipped over at the rim still pays a quarter.
- A Magnet Gun ball flies as one body at the speed of its heaviest gnome, so the whole ball lands in one clump.
- Golden gnomes no longer drop extra mushrooms: every gnome has the same chance, only the wizard drops more.
- New Factory upgrade Feeding Frenzy (hole level 4, 5 levels): more Massive gnomes per level, all of them at level 5. While you own it, gnomes give normal XP and fly as far as light ones.
- Golden gnomes shine like metal, and Gold Midas turns every gnome in the yard gold while it lasts. Hats keep their colour.
- New mushroom Eclipse Cap: x2 money for 20 s while the sky slowly swings between day and night.
- The Piggy Bank is gone: Coin Magnet now has 10 levels, and level 10 sends coins to your bank by itself. Old saves get the $800 back.
- The shop trees are tidy rows: each tool reads left to right, the tool, its upgrades, then its Fuses. Rows go from the cheapest unlocked tool down to the locked ones, and no line crosses another row.

## 2026-10-25 12:00

- A moved robot's area ring shows again: its post now always lands on the ground, even when you place it aiming far ahead.
- The leaderboard asks for one name or nickname, up to 20 characters; digits and . _ - ' are fine, a full first and last name is no longer asked for.
- You sign the leaderboard only after jumping into the hole (and at the end of a daily); Leaderboard in the Esc menu just shows the boards.
- New tab FASTEST LVL 12: your unpaused time to hole level 12, sent with every rebirth. The money tab is now called MOST MONEY and counts money earned in the run, spent or not.

## 2026-10-24 18:00

- You can now own up to 20 Cooling Fans, and they are cheaper per fan than before. Big Blades, a new fan upgrade, makes every fan blow harder.
- Wide Belt makes every conveyor belt wider, so gnomes ride side by side. Placed belts widen at once; a belt with no room goes back to your inventory.
- Every tool now has its own Fuses upgrade in the Tools tree. An old save gives every tool the Fuses level you already had.
- The highest upgrade levels cost more, so the shop lasts to the end of a run; tools, crates and the Deep keep their prices. A maxed save keeps its levels, the new prices apply from your next rebirth.
- The Deep has more levels to spend Hole Shards on.
- Esc in the shop, blueprints or legend now always takes you back into the game, never to the pause menu. The "Click or press W to capture the mouse" note is gone.
- A new game opens with a short intro about the company, the factory and the hole. Click or press a key to move on, or just wait.
- A mushroom never stays inside the hole any more: it hops out to just past the rim.
- The start screen now tells the story in two sentences; all controls are under H.

## 2026-10-21 12:00

- The UFO and the King come more often: the UFO about every 9 minutes from hole level 4, the King about every 16 minutes from level 10, and the King always arrives once, 6 s after the hole reaches level 10. Test: play a save at hole level 9 up to level 10 and wait 6 s for the King.
- Nothing slows the game down any more: combo 60, combo 100 and an eaten King keep the big text, the shake and the sound, but the game runs at full speed. Only the Tab tool wheel still slows the game while you hold it. Test: build a combo past 60 and feed the King; the game must not stutter.
- Hole XP depends on how you feed it (money stays the same): a gnome thrown or dropped by hand gives its full XP, a Magnet Gun ball of n gnomes gives 1/√n per gnome (4 gnomes: half each), and gnomes fed by machines, crates, robots, the plow, the blower or a kick give a quarter. The King always gives his full 200 XP. A crate tipped over next to the hole now counts like a crate dump (no trick shots). Test: throw one gnome by hand and watch the XP bar move by 1; feed the same with a crate dump and see a quarter.
- Up to 10 Cooling Fans and 10 Conveyor Belts (was 4 and 6). The new ones get more expensive (the 10th fan costs $64.5k); every placed tool keeps its own fuses. Test: buy a 5th fan and a 7th belt in the shop, place them, let a saboteur hit one fan and check the other keeps all its green fuses.

## 2026-10-21 08:00

- Errors from the online version are reported to the developers (no names, no addresses), so a crash on GitHub Pages is no longer lost. The game keeps running when the report cannot be sent. Test (Pages version): play normally; nothing changes on screen.
- Smoother near the factory and the hole: the default graphics (Medium) are lighter, with lower sharpness on high-resolution screens and a shorter shadow reach, so shadows end closer to you (about 25 m). High is now the old Medium look: pick it in the pause menu to compare. The materials of everything in your yard are prepared on the title screen. Test: walk factory → house → hole for a minute on Medium, then on High; open the game with `?stats` after the address, play a minute, then take a screenshot (P) or a system screenshot of the two lines in the top-left corner. The lines stop while the game is paused, so they still show the game's numbers in the pause menu.

## 2026-10-21 02:00

- Leaderboard: one shared online board for everyone playing the GitHub Pages version (ALL-TIME and today's DAILY). Your score is always saved on your computer first; when the online board cannot be reached you see your local scores and a short notice. Names are shown publicly online, so the name fields no longer suggest your real name. Test (Pages version): open the Leaderboard, submit a run, switch tabs, then turn Wi-Fi off and submit again.
- Goals teach the game: the tutorial now ends with "Reach a 5 combo", and right after "Collect coins" a second LESSON line opens. Each lesson shows one mechanic: the mushroom (the next eaten gnome is sure to drop one, and it never lands inside a placed tool), every gnome type as soon as it can appear, heavy gnomes, the crate, combo 15 and the trick shots (LONG SHOT, AIR, TRICK, BULLSEYE). Lessons you can do count at the same time, and gnome types come before trick shots, so a throw you cannot make never blocks the rest. Several lessons done at once pay together with one message. Old saves keep the goals they did and are not paid twice; lessons an old save already did (for example gnome types it fed) pay once, with one message. Test: start a new game, finish the first four goals, check the LESSON line and that a mushroom pops out of the hole after the next gnome; on an old save check you get at most one "lessons done" message.
- The factory is solid: you, gnomes and cleaning robots can no longer walk into the chute or under it, or through the pedestal with the button or the big gear; robots drive around the factory. Gnomes leave the chute just above its edge and land on the same orange ring. A burst, a parade or the king come out one after another instead of all at once, so they no longer pile up on the chute; a gnome that bounces back onto the chute stays there until you grab it, and robots leave it alone. A tool from an old save that stood inside the factory goes back to your inventory. With the mouse captured, the game now asks the browser for raw mouse movement (no system acceleration), so the sensitivity slider may feel different in Chrome. When the view jumps, the game writes a line "[gnome] mouse-jump ..." (and "[gnome] slow-frame ..." for slow frames next to the factory) to the browser console. Test: walk into the chute from the front and from the side; put a robot post next to the factory; turn fast next to the factory and check the sensitivity slider; if the view jumps, open the browser console (F12) and copy the "[gnome]" lines.

## 2026-10-21 00:30

- Shadows on the grass no longer crawl and shimmer while you walk (most visible around the hole and far away). Test: walk slowly past the hole and watch the grass and the shadows of the fence and tools.

## 2026-10-20 22:50

- Esc takes you straight back into the game: one Esc in the pause menu resumes, one Esc in the shop (also blueprints and legend) closes it and you can walk at once. No more "Click to play" screen. When the browser does not give the mouse back right away, the game still runs and a small "Click or press W to capture the mouse" note shows under the hole bar; until then the mouse turns the view only up to the window edge (leaving the window and coming back does not spin the view), and the first click (any button) only captures the mouse (it does not throw). RESUME in the pause menu works like Esc. The Tab tool wheel works then too, and switching to another window pauses the game. Test: press Esc in the game, then Esc in the pause menu and walk with W; open the shop with B, press Esc and walk; hold Esc for a second in the shop.

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
