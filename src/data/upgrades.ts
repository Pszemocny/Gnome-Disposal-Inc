export type Tab = 'Plow' | 'Magnet' | 'Factory' | 'Movement' | 'Tools' | 'Combos' | 'Bonuses' | 'Land' | 'Deep';
// every shop tab is drawn as a tree (column = hole level / requires); see src/ui/shop.ts

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
}

const U = (id: string, tab: Tab, name: string, desc: string, max: number, cost: number, growth: number, hole = 1, requires?: string): Upgrade => ({ id, tab, name, desc, max, cost, growth, hole, requires });

// Balance: an ordinary gnome is worth $1 x hole multiplier (x1..x10). Prices grow gently
// (x1.25-x2.5 per level) and level caps are low, so this is not an idle clicker.
export const UPGRADES: Upgrade[] = [
  // tree tabs: data order is the layout order (a root, then its children, then the next root)
  U('kick', 'Plow', 'Steel Toes', '+20% kick power and area.', 5, 40, 1.6),
  U('tractor', 'Plow', 'Plow Tractor', 'Press C to drive a tractor with a plow blade. It pushes every gnome in front of it.', 1, 1500, 1, 3),
  U('plowWidth', 'Plow', 'Wider Plow', '+0.8 m plow blade width (needs the Plow Tractor).', 5, 700, 1.7, 3, 'tractor'),
  // mid-tier like the Magnet Gun and the Cooling Fan
  U('blower', 'Plow', 'Leaf Blower', 'Press C to hold a leaf blower. Hold LMB to blow gnomes away in a cone.', 1, 150, 1),
  U('blowPower', 'Plow', 'Turbo Fan', '+25% blow power (needs the Leaf Blower).', 4, 80, 1.6, 1, 'blower'),
  U('blowRange', 'Plow', 'Long Nozzle', '+1.5 m blow range (needs the Leaf Blower).', 4, 100, 1.6, 1, 'blower'),

  U('magGun', 'Magnet', 'Magnet Gun', 'Hold LMB to pull lots of gnomes at once into a ball. Heavy gnomes slip off more easily.', 1, 300, 1),
  U('magPower', 'Magnet', 'Magnet Coil', '+0.2 m magnet ball radius (fits more gnomes), a stronger grip and +0.6 m reach (needs the Magnet Gun).', 10, 25, 1.45, 1, 'magGun'),
  U('magRange', 'Magnet', 'Magnet Dish', '+1.2 m magnet range and a wider cone (widest on the Magnet Gun).', 5, 60, 1.6, 2),
  U('throw', 'Magnet', 'Strong Arm', '+15% throw power. Heavy gnomes still fly shorter.', 6, 15, 1.5),
  U('scope', 'Magnet', 'Trick Scope', 'A sight for throws. Lvl 1: the crosshair turns green over the hole, gold for a trick. Lvl 2: a reflex glass at the centre names the trick. Lvl 3: the glass adds the distance and the multiplier.', 3, 300, 2),

  // Factory and Combos level caps doubled so they last through 12 hole levels (PP 2026-10-20);
  // Gnome Permit stays at 5 (320 gnomes is the most the yard can simulate smoothly)
  U('factorySpeed', 'Factory', 'Factory Gears', 'The gnome factory runs 15% faster.', 16, 40, 1.55),
  U('batch', 'Factory', 'Bigger Batches', '+1 gnome per factory cycle.', 6, 500, 2.5, 2, 'factorySpeed'),
  // growth 1.9 → 1.5 (F9): 12 levels cost about $154k
  U('autocrank', 'Factory', 'Auto Crank', 'The factory runs by itself (about 1 gnome every 12 s per level). Switch it off at the lever beside the factory.', 12, 600, 1.5, 4, 'batch'),
  U('value', 'Factory', 'Premium Gnomes', '+10% money from every gnome.', 20, 50, 1.5),
  U('permit', 'Factory', 'Gnome Permit', '+40 max gnomes in the yard.', 5, 300, 1.8, 2),
  // 3 levels (F11): awake gnomes barely matter once machines ragdoll them
  U('glue', 'Factory', 'Gnome Glue', 'Statues wake up 15% less often.', 3, 400, 1.8, 3),

  U('speed', 'Movement', 'Running Shoes', '+12% move speed.', 5, 20, 1.6),
  U('jump', 'Movement', 'Spring Socks', '+15% jump height.', 3, 30, 1.7),
  U('boots', 'Movement', 'Gnome Boots', 'Double jump, and the ground pound (J in the air) reaches 5.5 m and pushes 1.5x harder. Gnomes hate these boots.', 1, 600, 1, 3),
  U('magnetRange', 'Movement', 'Coin Magnet', '+1.2 m coin pickup radius.', 6, 20, 1.5),
  U('laptop', 'Movement', 'Laptop', 'Open the shop anywhere with B.', 1, 150, 1),

  // every crate step costs a flat $70, about one full crate sold (PP 2026-10-19): buy, fill, sell, upgrade, sell...
  // limits doubled after playtest (PP 2026-10-19): 6 crates, up to 60 gnomes per crate
  U('box', 'Tools', 'Wooden Crate', '+1 crate. Drop or throw gnomes in, drag it into the hole with the magnet for a big combo.', 6, 70, 1),
  U('crateSize', 'Tools', 'Bigger Crate', '+6 gnomes fit in every crate (12 at start).', 8, 70, 1, 1, 'box'),
  // trampoline, fan and conveyor are affordable on hole level 1 after a few hundred dollars (PP 2026-10-19)
  U('trampoline', 'Tools', 'Trampoline', '+1 trampoline. Bounces gnomes the way it faces.', 4, 100, 1.8),
  U('panel', 'Tools', 'Metal Panel', '+1 metal panel. Make covers, tunnels, ramps to guide gnomes into the hole.', 10, 60, 1.25),
  U('fan', 'Tools', 'Cooling Fan', '+1 fan. Gently blows gnomes away in a cone.', 4, 200, 1.9),
  U('conveyor', 'Tools', 'Conveyor Belt', '+1 conveyor. Carries gnomes the way it faces. Tilt it to make a ramp.', 6, 250, 1.5),
  U('wheel', 'Tools', 'Kicking Wheel', '+1 kicking wheel. Boots on a wheel. Kicks everything in front of it.', 2, 500, 2.5, 4),
  // F9 (2026-10-20): cut so the crate and automation paths can pay them near the unlock level
  U('magnet', 'Tools', 'Gnome Magnet', '+1 magnet. Pulls gnomes in a big radius. Place it next to the hole.', 1, 2000, 1, 5),
  U('cannon', 'Tools', 'Gnome Cannon', '+1 cannon. Loads gnomes that walk in and fires them into the hole.', 2, 4000, 2.5, 6),
  U('vacuum', 'Tools', 'Vacuum Tower', '+1 tower. Sucks gnomes around it straight into the hole.', 2, 8000, 2.5, 8),
  U('blackhole', 'Tools', 'Mini Black Hole', '+1 mini hole. Eats gnomes on the spot at full value.', 1, 50000, 1, 10),
  // cleaning robots: mid-tier prices (PP 2026-10-20 "niech nie będą super drogie"), about the Conveyor / Kicking Wheel tier
  // 12 robots at x1.3 (2026-10-20 "jest ich za malo"): the first 4 cost $2.5k, all 12 cost $30k, about two Vacuum Towers
  U('robot', 'Tools', 'Cleaning Robot', '+1 robot. Collects gnomes around its home post onto its bed and tips them into the hole. Takes dangerous gnomes first (saboteurs top), then those lying still longest.', 12, 400, 1.3, 2),
  U('robotBed', 'Tools', 'Bigger Bed', '+3 gnomes per robot load (5 at start).', 4, 150, 1.6, 2, 'robot'),
  U('robotSpeed', 'Tools', 'Faster Motor', '+0.6 m/s robot speed (2.5 m/s at start).', 4, 120, 1.6, 2, 'robot'),
  U('robotArea', 'Tools', 'Wider Area', '+2 m robot work radius (6 m at start).', 4, 150, 1.6, 2, 'robot'),
  // saboteur armour (PP 2026-10-20 "bezpieczniki"): L fuses, the tool breaks on hit L + 1
  U('fuses', 'Tools', 'Fuses', '+1 fuse on every tool and robot. A saboteur blows one fuse per hit; a tool breaks only when no fuse is left. Press E on the tool to fix it and swap a fuse.', 5, 300, 1.8, 5),

  U('comboWindow', 'Combos', 'Combo Window', '+0.4 s to keep a combo alive.', 10, 60, 1.6),
  U('comboCap', 'Combos', 'Combo Cap', '+0.5x maximum combo multiplier.', 12, 150, 1.7),
  U('comboInsurance', 'Combos', 'Combo Insurance', 'A dropped combo keeps half of its count.', 1, 2500, 1, 4),
  U('jackpot', 'Combos', 'Jackpot', 'Every 25 combo spits a coin fountain.', 1, 6000, 1, 5),

  U('mushChance', 'Bonuses', 'Spore Bag', '+30% mushroom drop chance.', 5, 100, 1.6),
  U('mushTime', 'Bonuses', 'Long Trip', '+20% mushroom effect duration.', 4, 200, 1.7),
  U('goldChance', 'Bonuses', 'Gold Fever', 'More golden gnomes.', 4, 500, 1.8),
  U('piggy', 'Bonuses', 'Piggy Bank', 'Coins fly into your bank by themselves. Greedy gnomes cannot steal them.', 1, 800, 1, 2),
  U('hunger', 'Bonuses', 'Hole Hunger', '+10% hole XP.', 5, 150, 1.7),
  U('lucky', 'Bonuses', 'Four-leaf Clover', 'Events happen more often.', 3, 1000, 1.9, 2),

  { id: 'dValue', tab: 'Deep', name: 'Deep Value', desc: '+20% money forever.', max: 10, cost: 1, growth: 1.5, currency: 'shards' },
  { id: 'dStart', tab: 'Deep', name: 'Head Start', desc: 'Start each run with money ($100 x 3^level).', max: 5, cost: 2, growth: 2, currency: 'shards' },
  { id: 'dTools', tab: 'Deep', name: 'Keep Tools', desc: 'Keep tool upgrades after rebirth.', max: 1, cost: 8, growth: 1, currency: 'shards' },
  { id: 'dCombo', tab: 'Deep', name: 'Deep Combo', desc: '+0.5x combo cap forever.', max: 4, cost: 3, growth: 2, currency: 'shards' },
  { id: 'dXp', tab: 'Deep', name: 'Deep Hunger', desc: '+25% hole XP forever.', max: 6, cost: 2, growth: 1.7, currency: 'shards' },
];

export const UPGRADE_BY_ID: Record<string, Upgrade> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// placeable tools (the crate and robot level upgrades live in the Tools tab but are not tools you place)
const NOT_PLACEABLE = new Set(['crateSize', 'robotBed', 'robotSpeed', 'robotArea', 'fuses']);
export const TOOL_IDS = UPGRADES.filter((u) => u.tab === 'Tools' && !NOT_PLACEABLE.has(u.id)).map((u) => u.id);
// what the Deep upgrade Keep Tools carries through a rebirth: every Tools upgrade (also the non-placeable ones)
// plus the drivable and hand-held tools in Movement with their upgrades
export const KEEP_TOOL_IDS = [...UPGRADES.filter((u) => u.tab === 'Tools').map((u) => u.id), 'tractor', 'plowWidth', 'blower', 'blowPower', 'blowRange'];

export function upgradeCost(u: Upgrade, level: number): number {
  return Math.ceil(u.cost * Math.pow(u.growth, level));
}
