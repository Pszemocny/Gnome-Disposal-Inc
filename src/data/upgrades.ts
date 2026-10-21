export type Tab = 'Plow' | 'Magnet' | 'Factory' | 'Movement' | 'Tools' | 'Combos' | 'Bonuses' | 'Deep';
// every shop tab is drawn as a tree: one row per root, in data order; see src/ui/shop.ts

export interface Upgrade {
  id: string;
  tab: Tab;
  name: string;
  desc: string;
  max: number;
  cost: number;
  growth: number;
  hole?: number; // hole level needed to unlock
  requires?: string; // id of an upgrade that must be owned first
  currency?: 'money' | 'shards';
  downgrade?: boolean; // right-click in the shop lowers the level by 1, paid like the next level
}

const U = (id: string, tab: Tab, name: string, desc: string, max: number, cost: number, growth: number, hole = 1, requires?: string): Upgrade => ({ id, tab, name, desc, max, cost, growth, hole, requires });

// Balance: an ordinary gnome is worth $1 x hole multiplier (x1..x10). Prices grow gently
// (x1.25-x2.5 per level, x1.3 extra per level above the 5th since 2026-10-20) and level caps are low, so this is not an idle clicker.
const BEFORE_TOOLS: Upgrade[] = [
  // tree tabs: data order is the layout order (a root, then its children, then the next root)
  U('kick', 'Plow', 'Steel Toes', '+20% kick power and area.', 5, 40, 1.6),
  U('tractor', 'Plow', 'Plow Tractor', 'A tractor with a plow blade: take it from the tool wheel (hold Tab). It pushes every gnome in front of it.', 1, 1500, 1, 3),
  U('plowWidth', 'Plow', 'Wider Plow', '+0.8 m plow blade width (needs the Plow Tractor).', 5, 700, 1.7, 3, 'tractor'),
  // mid-tier like the Magnet Gun and the Cooling Fan
  U('blower', 'Plow', 'Leaf Blower', 'Take the leaf blower from the tool wheel (hold Tab). Hold LMB to blow gnomes away in a cone.', 1, 150, 1),
  U('blowPower', 'Plow', 'Turbo Fan', '+25% blow power (needs the Leaf Blower).', 4, 80, 1.6, 1, 'blower'),
  U('blowRange', 'Plow', 'Long Nozzle', '+1.5 m blow range (needs the Leaf Blower).', 4, 100, 1.6, 1, 'blower'),

  U('magGun', 'Magnet', 'Magnet Gun', 'Hold LMB to pull lots of gnomes at once into a ball. Heavy gnomes slip off more easily.', 1, 300, 1),
  U('magPower', 'Magnet', 'Magnet Coil', '+0.2 m magnet ball radius (fits more gnomes), a stronger grip and +0.6 m reach (needs the Magnet Gun).', 10, 25, 1.45, 1, 'magGun'),
  U('magRange', 'Magnet', 'Magnet Dish', '+1.2 m magnet range and a wider cone (widest on the Magnet Gun).', 5, 60, 1.6, 2),
  // downgrade only here so far (PP 2026-10-21 "downgrade siły"): the last level makes weight irrelevant, a step down brings it back
  { ...U('throw', 'Magnet', 'Strong Arm', '+15% throw power. Heavy gnomes fly shorter, but at the last level every gnome flies the same, by hand or by Magnet Gun.', 6, 15, 1.5), downgrade: true },
  U('scope', 'Magnet', 'Trick Scope', 'A sight for throws. Lvl 1: the crosshair turns green over the hole, gold for a trick. Lvl 2: a reflex glass at the centre names the trick. Lvl 3: the glass adds the distance and the multiplier.', 3, 300, 2),
  // level 10 is the old Piggy Bank, about $90k (PP 2026-10-24 "bardzo drogi np 100k"); Magnet tab since PP 2026-10-21
  U('magnetRange', 'Magnet', 'Coin Magnet', '+1.2 m coin pickup radius. Level 10: coins fly into your bank by themselves and greedy gnomes cannot steal them.', 10, 20, 2.2),

  // Factory and Combos level caps doubled so they last through 12 hole levels (PP 2026-10-20);
  // Gnome Permit stays at 5 (320 gnomes is the most the yard can simulate smoothly)
  U('factorySpeed', 'Factory', 'Factory Gears', 'The gnome factory runs 15% faster.', 16, 40, 1.55),
  U('batch', 'Factory', 'Bigger Batches', '+1 gnome per factory cycle.', 6, 500, 2.5, 2, 'factorySpeed'),
  // growth 1.9 → 1.5 (F9); 12 levels cost about $670k with the late surcharge (first 5: $7.9k, unchanged by F9's cut)
  U('autocrank', 'Factory', 'Auto Crank', 'The factory runs by itself (about 1 gnome every 12 s per level). Switch it off at the lever beside the factory.', 12, 600, 1.5, 4, 'batch'),
  U('value', 'Factory', 'Premium Gnomes', '+10% money from every gnome.', 20, 50, 1.5),
  U('permit', 'Factory', 'Gnome Permit', '+40 max gnomes in the yard.', 5, 300, 1.8, 2),
  // 3 levels (F11): awake gnomes barely matter once machines ragdoll them
  U('glue', 'Factory', 'Gnome Glue', 'Statues wake up 15% less often.', 3, 400, 1.8, 3),
  // PP 2026-10-24: 5 levels raise the Massive share to 100 %, no off switch
  U('frenzy', 'Factory', 'Feeding Frenzy', 'Every level makes the factory turn out more Massive gnomes (3 kg, x2.3 money); level 5: all of them.', 5, 2000, 2.2, 4),

  U('speed', 'Movement', 'Running Shoes', '+12% move speed.', 5, 20, 1.6),
  U('jump', 'Movement', 'Spring Socks', '+15% jump height.', 3, 30, 1.7),
  U('boots', 'Movement', 'Gnome Boots', 'Double jump, and the ground pound (J in the air) reaches 5.5 m and pushes 1.5x harder. Gnomes hate these boots.', 1, 600, 1, 3),
  U('laptop', 'Movement', 'Laptop', 'Open the shop anywhere with B.', 1, 150, 1),
];

// the Tools tab; the per-tool Fuses rows below are generated from these rows
const TOOLS: Upgrade[] = [
  // every crate step costs a flat $70, about one full crate sold (PP 2026-10-19): buy, fill, sell, upgrade, sell...
  // limits doubled after playtest (PP 2026-10-19): 6 crates, up to 60 gnomes per crate
  U('box', 'Tools', 'Wooden Crate', '+1 crate. Drop or throw gnomes in, drag it into the hole with the magnet for a big combo.', 6, 70, 1),
  U('crateSize', 'Tools', 'Bigger Crate', '+6 gnomes fit in every crate (12 at start).', 8, 70, 1, 1, 'box'),
  // trampoline, fan and conveyor are affordable on hole level 1 after a few hundred dollars (PP 2026-10-19)
  U('trampoline', 'Tools', 'Trampoline', '+1 trampoline. Bounces gnomes the way it faces.', 4, 100, 1.8),
  U('panel', 'Tools', 'Metal Panel', '+1 metal panel. Make covers, tunnels, ramps to guide gnomes into the hole.', 10, 60, 1.25),
  // PP 2026-10-20: "wiecej fanow np z 10 i raili" (fans 4 -> 10, belts 6 -> 10)
  // 20 fans, growth 1.9 -> 1.4 (PP 2026-10-21 "wiecej wiatrakow"): 11th $5.8k, 20th $120k; the Tools tab has no late surcharge
  U('fan', 'Tools', 'Cooling Fan', '+1 fan. Blows gnomes away in a cone. Press N on a placed fan to set its power.', 20, 200, 1.4),
  U('fanPower', 'Tools', 'Big Blades', '+25% push on every Cooling Fan (needs a Cooling Fan).', 4, 150, 1.6, 1, 'fan'),
  U('conveyor', 'Tools', 'Conveyor Belt', '+1 conveyor. Carries gnomes the way it faces. Tilt it to make a ramp.', 10, 250, 1.5),
  U('beltWidth', 'Tools', 'Wide Belt', '+0.6 m belt width on every Conveyor Belt: more gnomes side by side (needs a Conveyor Belt).', 3, 400, 1.8, 1, 'conveyor'),
  U('wheel', 'Tools', 'Kicking Wheel', '+1 kicking wheel. Boots on a wheel. Kicks everything in front of it.', 2, 500, 2.5, 4),
  // F9 (2026-10-20): cut so the crate and automation paths can pay them near the unlock level
  U('magnet', 'Tools', 'Gnome Magnet', '+1 magnet. Pulls gnomes in a big radius. Place it next to the hole.', 1, 2000, 1, 5),
  U('cannon', 'Tools', 'Gnome Cannon', '+1 cannon. Loads gnomes that walk in and fires them into the hole.', 2, 4000, 2.5, 6),
  U('vacuum', 'Tools', 'Vacuum Tower', '+1 tower. Sucks gnomes around it straight into the hole.', 2, 8000, 2.5, 8),
  U('blackhole', 'Tools', 'Mini Black Hole', '+1 mini hole. Eats gnomes on the spot at full value.', 1, 50000, 1, 10),
  // cleaning robots: mid-tier prices (PP 2026-10-20 "niech nie będą super drogie"), about the Conveyor / Kicking Wheel tier
  // 12 robots at x1.3 (2026-10-20 "jest ich za malo"): the first 4 cost $2.5k, all 12 cost $30k, about two Vacuum Towers (no late surcharge)
  U('robot', 'Tools', 'Cleaning Robot', '+1 robot. Collects gnomes around its station onto its bed and tips them into the hole. Takes dangerous gnomes first (saboteurs top), then those lying still longest.', 12, 400, 1.3, 2),
  U('robotBed', 'Tools', 'Bigger Bed', '+3 gnomes per robot load (5 at start).', 4, 150, 1.6, 2, 'robot'),
  U('robotSpeed', 'Tools', 'Faster Motor', '+0.6 m/s robot speed (2.5 m/s at start).', 4, 120, 1.6, 2, 'robot'),
  U('robotArea', 'Tools', 'Wider Area', '+2 m robot work radius (6 m at start).', 4, 150, 1.6, 2, 'robot'),
  // a catcher for what the fans blow (PP 2026-10-25 "rure do lapania taki lejek"): $1500 x1.8 from hole level 4 (PP 2026-10-21)
  U('funnel', 'Tools', 'Gnome Funnel', '+1 funnel. Hang it in the air where you look: gnomes that fall or fly into its mouth shoot out of the elbow towards the hole.', 3, 1500, 1.8, 4),
];

// saboteur armour, one upgrade per tool (PP 2026-10-21 "kazde narzedzie ma osobne fuzes jako ulepszenie"):
// L fuses, the tool breaks on hit L + 1. Short node names so they fit the 136 px shop label.
export const FUSE_NAMES: Record<string, string> = { trampoline: 'Trampoline', fan: 'Fan', conveyor: 'Belt', wheel: 'Wheel', magnet: 'Magnet', cannon: 'Cannon', vacuum: 'Vacuum', blackhole: 'Black Hole', robot: 'Robot', funnel: 'Funnel' };
export const FUSE_TOOLS = Object.keys(FUSE_NAMES);
const FUSE_ROWS = FUSE_TOOLS.map((id) => {
  const t = TOOLS.find((u) => u.id === id)!;
  return U(`${id}Fuses`, 'Tools', `${FUSE_NAMES[id]} Fuses`, `+1 fuse on every ${t.name}. A saboteur blows one fuse per hit; the tool breaks only when no fuse is left. Press E on it to fix it and swap a fuse.`, 5, 1000, 1.8, Math.max(5, t.hole ?? 1), id);
});

const AFTER_TOOLS: Upgrade[] = [
  U('comboWindow', 'Combos', 'Combo Window', '+0.4 s to keep a combo alive.', 10, 60, 1.6),
  // 18 levels (PP 2026-10-21 "wieksze combo maxymalne ... za duza kase"): 13th $712k ... 18th $37.6m with the late surcharge
  U('comboCap', 'Combos', 'Combo Cap', '+0.5x maximum combo multiplier.', 18, 150, 1.7),
  U('comboInsurance', 'Combos', 'Combo Insurance', 'A dropped combo keeps half of its count.', 1, 2500, 1, 4),
  U('jackpot', 'Combos', 'Jackpot', 'Every 25 combo spits a coin fountain.', 1, 6000, 1, 5),

  U('mushChance', 'Bonuses', 'Spore Bag', '+30% mushroom drop chance.', 5, 100, 1.6),
  U('mushTime', 'Bonuses', 'Long Trip', '+20% mushroom effect duration.', 4, 200, 1.7),
  U('goldChance', 'Bonuses', 'Gold Fever', 'More golden gnomes.', 4, 500, 1.8),
  U('hunger', 'Bonuses', 'Hole Hunger', '+10% hole XP.', 5, 150, 1.7),
  U('lucky', 'Bonuses', 'Four-leaf Clover', 'Events happen more often.', 3, 1000, 1.9, 2),
  // endgame rows (PP 2026-10-21: level 10, $70M, nothing to buy; "od 8 poziomu ceny podwójne"): hole 8, about $213M together
  U('xpBoost', 'Bonuses', 'Bottomless Hunger', '+25% hole XP (needs Hole Hunger).', 5, 800000, 2.5, 8, 'hunger'),
  U('mushStorm', 'Bonuses', 'Spore Storm', '+50% mushroom drop chance (needs the Spore Bag).', 5, 500000, 2.5, 8, 'mushChance'),
  U('goldSpores', 'Bonuses', 'Midas Spores', '+18% of all mushrooms come out as Gold Midas (needs the Spore Storm).', 5, 2000000, 2.5, 8, 'mushStorm'),

  // caps raised (PP 2026-10-20 "wiecej poziomow" for shards): a post-batch run gives 30-90 shards, the old catalogue (302) was gone in a few rebirths
  { id: 'dValue', tab: 'Deep', name: 'Deep Value', desc: '+20% money forever.', max: 15, cost: 1, growth: 1.5, currency: 'shards' },
  { id: 'dStart', tab: 'Deep', name: 'Head Start', desc: 'Start each run with money ($100 x 3^level).', max: 7, cost: 2, growth: 2, currency: 'shards' },
  { id: 'dTools', tab: 'Deep', name: 'Keep Tools', desc: 'Keep all Tools, the tractor and the blower, with upgrades, after rebirth.', max: 1, cost: 8, growth: 1, currency: 'shards' },
  { id: 'dCombo', tab: 'Deep', name: 'Deep Combo', desc: '+0.5x combo cap forever.', max: 6, cost: 3, growth: 2, currency: 'shards' },
  { id: 'dXp', tab: 'Deep', name: 'Deep Hunger', desc: '+25% hole XP forever.', max: 9, cost: 2, growth: 1.7, currency: 'shards' },
];

export const UPGRADES: Upgrade[] = [...BEFORE_TOOLS, ...TOOLS, ...FUSE_ROWS, ...AFTER_TOOLS];

export const UPGRADE_BY_ID: Record<string, Upgrade> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// placeable tools: the Tools rows without a parent (crate size, robot, fan, belt and fuse upgrades all need their tool)
export const TOOL_IDS = UPGRADES.filter((u) => u.tab === 'Tools' && !u.requires).map((u) => u.id);
// what the Deep upgrade Keep Tools carries through a rebirth: every Tools upgrade (also the non-placeable ones)
// plus the drivable and hand-held tools in the Plow tab with their upgrades (not Steel Toes)
export const KEEP_TOOL_IDS = [...UPGRADES.filter((u) => u.tab === 'Tools').map((u) => u.id), 'tractor', 'plowWidth', 'blower', 'blowPower', 'blowRange'];

// levels above the 5th cost extra x1.3 per level: the shop ran out at hole level 8 (PP 2026-10-20 "drozsze najwyzsze levele");
// not for flat prices (crates), shards, or placeable tools
export const LATE_PRICE = 1.3;

export function upgradeCost(u: Upgrade, level: number): number {
  // placeable tools stay off the late surcharge: 20 fans at x1.4 already end late (PP 2026-10-21 "wiecej wiatrakow")
  return Math.ceil(u.cost * Math.pow(u.growth, level) * (u.growth > 1 && u.currency !== 'shards' && !TOOL_IDS.includes(u.id) ? Math.pow(LATE_PRICE, Math.max(0, level - 4)) : 1));
}

// the price of the next level change: a downgradable upgrade prices every paid change, up or down, as the next level,
// so up, down, up pays three times, each dearer (PP 2026-10-21); a save without the count starts at the level
export function changeCost(u: Upgrade, level: number, paid: Record<string, number> | undefined): number {
  return upgradeCost(u, u.downgrade ? (paid?.[u.id] ?? level) : level);
}
