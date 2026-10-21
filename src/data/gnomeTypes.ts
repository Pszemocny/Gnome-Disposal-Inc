export type Behaviour = 'wander' | 'steal' | 'charge' | 'flee' | 'sabotage' | 'stalk' | 'cast' | 'boss';

export interface GnomeType {
  id: string;
  name: string;
  hat: number;
  shirt: number;
  pants: number;
  beard: number;
  skin: number;
  scale: number;
  mass: number;
  value: number;
  xp: number;
  speed: number;
  behaviour: Behaviour;
  unlock: number; // hole level
  weight: number; // spawn weight once unlocked
  statue: boolean; // spawns as a sleeping statue that may wake up
  emissiveEyes?: boolean;
  staff?: boolean;
  crown?: boolean;
  goggles?: boolean;
  fuse?: boolean; // black hat stripes and a burning fuse on the tip
  capacity: number; // instanced mesh slots
  lines: string[];
}

export const GNOME_TYPES: GnomeType[] = [
  {
    id: 'classic', name: 'Garden Gnome', hat: 0xd8352a, shirt: 0x2f6fd0, pants: 0x3a3a52, beard: 0xf4f1ea, skin: 0xf2c6a0,
    scale: 1, mass: 1, value: 1, xp: 1, speed: 1.3, behaviour: 'wander', unlock: 1, weight: 100, statue: true, capacity: 500,
    lines: ['Oi!', 'Put me down!', '#@!%', 'Not the hole!', 'Rude.', 'I have a family!', 'Unhand me!'],
  },
  {
    id: 'blue', name: 'Blue Gnome', hat: 0x2f6fd0, shirt: 0xd8352a, pants: 0x3a3a52, beard: 0xf4f1ea, skin: 0xf2c6a0,
    scale: 1, mass: 1, value: 1, xp: 1, speed: 1.3, behaviour: 'wander', unlock: 1, weight: 70, statue: true, capacity: 400,
    lines: ['Hey!', 'Help!', '*grumble*', 'Why me?!', 'Bah!'],
  },
  {
    id: 'golden', name: 'Golden Gnome', hat: 0xffd23f, shirt: 0xe8b923, pants: 0xc99a10, beard: 0xfff3b0, skin: 0xffe08a,
    scale: 1, mass: 1.5, value: 100, xp: 10, speed: 3.6, behaviour: 'flee', unlock: 1, weight: 0, statue: false, capacity: 320, // Golden Hour turns a full yard golden (max 120 + 5 permits x 40)
    lines: ['Catch me if you can!', 'Shiny and free!', 'Never!'],
  },
  {
    id: 'greedy', name: 'Greedy Gnome', hat: 0x2e9e4f, shirt: 0xe0b03a, pants: 0x4a3a20, beard: 0xd9d2c0, skin: 0xe9b890,
    scale: 0.95, mass: 1, value: 3, xp: 2, speed: 2.6, behaviour: 'steal', unlock: 2, weight: 18, statue: false, capacity: 120,
    lines: ['Mine!', 'Finders keepers!', 'Shiny!', 'Ka-ching!'],
  },
  {
    // weight 0: rolled on its own at BOOM_CHANCE, see Gnomes.pickSpawnType; explodes when the hole eats it
    id: 'boom', name: 'Boom Gnome', hat: 0xd01818, shirt: 0x3a3a3a, pants: 0x1c1c1c, beard: 0xe8e0d0, skin: 0xf2c6a0,
    scale: 1, mass: 1, value: 3, xp: 2, speed: 1.3, behaviour: 'wander', unlock: 2, weight: 0, statue: false, fuse: true, capacity: 30,
    lines: ['Tick... tick...', 'Don\'t shake me!', 'I\'m da bomb!', 'Kaboom?'],
  },
  {
    id: 'angry', name: 'Angry Gnome', hat: 0x5a1010, shirt: 0x8a1c1c, pants: 0x222222, beard: 0x6b4a3a, skin: 0xd98a70,
    scale: 1.05, mass: 1.3, value: 4, xp: 2, speed: 3.1, behaviour: 'charge', unlock: 3, weight: 12, statue: false, capacity: 100,
    lines: ['FIGHT ME!', 'You\'re dead, giant!', '*spits*', 'RAAAH!', 'Square up!'],
  },
  {
    id: 'dwarf', name: 'Dwarf Gnome', hat: 0x7a4a24, shirt: 0x5b7a2a, pants: 0x3b2a1a, beard: 0xb5651d, skin: 0xe9b890,
    scale: 0.65, mass: 0.5, value: 8, xp: 3, speed: 4.2, behaviour: 'flee', unlock: 4, weight: 10, statue: false, capacity: 100,
    lines: ['Too slow!', 'Nyeh!', 'Wheee!'],
  },
  {
    id: 'saboteur', name: 'Saboteur Gnome', hat: 0x333840, shirt: 0x4b5260, pants: 0x1f2228, beard: 0x9a9a9a, skin: 0xd9b090,
    scale: 1, mass: 1.1, value: 6, xp: 3, speed: 2.7, behaviour: 'sabotage', unlock: 5, weight: 8, statue: false, goggles: true, capacity: 60,
    lines: ['Oops, did I break that?', 'Unionise!', '*wrench noises*', 'Down with machines!'],
  },
  {
    id: 'shadow', name: 'Shadow Gnome', hat: 0x08080a, shirt: 0x0c0c10, pants: 0x050506, beard: 0x111114, skin: 0x0a0a0c,
    scale: 1.25, mass: 2, value: 66, xp: 13, speed: 2.2, behaviour: 'stalk', unlock: 6, weight: 0, statue: false, emissiveEyes: true, capacity: 10,
    lines: ['...', 'deeper...', 'it is hungry', 'we see you'],
  },
  {
    id: 'wizard', name: 'Gnome Wizard', hat: 0x5b2a9a, shirt: 0x4a2380, pants: 0x2a1450, beard: 0xffffff, skin: 0xf2c6a0,
    scale: 1.15, mass: 1.4, value: 25, xp: 6, speed: 1.6, behaviour: 'cast', unlock: 7, weight: 4, statue: false, staff: true, capacity: 30,
    lines: ['Abra-gnome-dabra!', 'You shall not pass... into the hole!', 'Levitas!', 'Begone!'],
  },
  {
    id: 'fat', name: 'Fat Gnome', hat: 0xe36f1e, shirt: 0xf0e0c0, pants: 0x6a4020, beard: 0xe8e0d0, skin: 0xf2c6a0,
    scale: 1.6, mass: 6, value: 20, xp: 5, speed: 0.8, behaviour: 'wander', unlock: 8, weight: 8, statue: true, capacity: 60,
    lines: ['Oof.', 'Is there cake?', 'I\'m big boned!'],
  },
  {
    id: 'king', name: 'King Gnome', hat: 0xb01030, shirt: 0x7a0a20, pants: 0x30101a, beard: 0xffffff, skin: 0xf2c6a0,
    scale: 3, mass: 40, value: 1000, xp: 200, speed: 1.0, behaviour: 'boss', unlock: 99, weight: 0, statue: false, crown: true, capacity: 2,
    lines: ['KNEEL!', 'I AM THE GARDEN!', 'GUARDS!', 'You dare?!'],
  },
];

export const TYPE_BY_ID: Record<string, GnomeType> = Object.fromEntries(GNOME_TYPES.map((t) => [t.id, t]));

// Share of factory and rain gnomes that come out as Boom Gnomes (from its unlock level).
export const BOOM_CHANCE = 0.015;
// Boom Gnome blast: gnomes this far outside the hole edge fly off at this speed (m/s, outwards and up).
export const BOOM = { reach: 4, out: 8, up: 6, shake: 0.3 };

// Walking gnomes back off from a player closer than `near` m and calm down `calm` s after the player is
// further than `far` m. Flee speed = type speed x `speed` x the weight class `flee` (the king: x `king`).
export const FLEE = { near: 4, far: 6, calm: 2, speed: 1.3, king: 0.4 };

// Fixed weight classes, the same for every gnome type (PP 2026-10-19): 1.2 / 2 / 3 kg.
// Nothing under 1 kg: lighter gnomes flew too far (PP 2026-10-19).
export interface WeightTier {
  id: 'normal' | 'heavy' | 'massive';
  mass: number; // kg, the gnome's real physics mass
  scale: number; // bigger = heavier, the visual tell
  value: number; // scales money and hole XP
  flee: number; // flee speed factor, heavier = slower
}

export const WEIGHT_TIERS: Record<WeightTier['id'], WeightTier> = {
  normal: { id: 'normal', mass: 1.2, scale: 1, value: 1, flee: 1 },
  heavy: { id: 'heavy', mass: 2, scale: 1.12, value: 1.6, flee: 0.75 },
  massive: { id: 'massive', mass: 3, scale: 1.25, value: 2.3, flee: 0.55 },
};

// Feeding Frenzy closes the gap to 100 % Massive by a fifth per level (PP 2026-10-24)
export function massiveOdds(holeLevel: number, frenzy = 0): number {
  const pm = Math.max(0, Math.min(0.25, 0.03 * (holeLevel - 3)));
  return pm + ((1 - pm) * frenzy) / 5;
}

// The deeper the hole, the more often the heavy classes come out of the factory. One draw gives the tier and the
// natural tier (the same draw at Frenzy 0), which pays hole XP: Frenzy only ever moves a draw up to Massive, and the
// share it adds pays tier XP x1 (2026-10-25, Q1 a)
export function rollTiers(holeLevel: number, minId: WeightTier['id'] = 'normal', rnd: () => number = Math.random, frenzy = 0): { tier: WeightTier; xpTier: WeightTier } {
  const r = rnd();
  return { tier: tierFor(r, holeLevel, minId, frenzy), xpTier: tierFor(r, holeLevel, minId, 0) };
}

function tierFor(draw: number, holeLevel: number, minId: WeightTier['id'], frenzy: number): WeightTier {
  const L = holeLevel - 1;
  const pm = massiveOdds(holeLevel, frenzy);
  // Heavy stays first so the daily seed gives the same gnomes as before; capped so Massive can reach 100 %
  const odds: [WeightTier['id'], number][] = [
    ['heavy', Math.min(0.3, 0.05 + 0.025 * L, 1 - pm)],
    ['massive', pm],
  ];
  const order: WeightTier['id'][] = ['normal', 'heavy', 'massive'];
  const allowed = (id: WeightTier['id']) => order.indexOf(id) >= order.indexOf(minId);
  let r = draw;
  for (const [id, p] of odds) {
    if (!allowed(id)) continue;
    if (r < p) return WEIGHT_TIERS[id];
    r -= p;
  }
  return allowed('normal') ? WEIGHT_TIERS.normal : WEIGHT_TIERS[minId];
}
