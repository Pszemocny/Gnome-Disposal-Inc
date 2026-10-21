export interface HoleLevel {
  xp: number; // xp needed to reach the next level (1 xp = 1 ordinary gnome thrown by hand)
  radius: number;
  mult: number;
  unlock: string;
  whisper: string;
}

// Gentle curve: about 11 000 gnomes from level 1 to 12, money multiplier grows linearly.
export const HOLE_LEVELS: HoleLevel[] = [
  { xp: 25, radius: 1.6, mult: 1, unlock: '', whisper: '' },
  { xp: 60, radius: 2.0, mult: 1.5, unlock: 'Greedy gnomes and random events', whisper: 'more...' },
  { xp: 120, radius: 2.4, mult: 2, unlock: 'Angry gnomes, land: Garden', whisper: 'they taste of soil and spite' },
  { xp: 220, radius: 2.8, mult: 2.5, unlock: 'Dwarf gnomes, Auto Crank', whisper: 'smaller ones... crunchier' },
  { xp: 380, radius: 3.2, mult: 3, unlock: 'Saboteur gnomes, land: Neighbour\'s Lawn', whisper: 'the little ones are organising' },
  { xp: 600, radius: 3.6, mult: 4, unlock: 'Night falls. Shadow gnomes', whisper: 'do you hear them at night?' },
  { xp: 900, radius: 4.0, mult: 5, unlock: 'Gnome wizards', whisper: 'the old magic stirs' },
  { xp: 1300, radius: 4.4, mult: 6, unlock: 'Fat gnomes, land: Dark Forest', whisper: 'HUNGRY' },
  { xp: 1800, radius: 4.8, mult: 7, unlock: 'Golden gnomes appear more often', whisper: 'gold... gold tastes best' },
  { xp: 2500, radius: 5.2, mult: 8, unlock: 'The King Gnome will come', whisper: 'bring me the KING' },
  { xp: 3400, radius: 5.6, mult: 9, unlock: 'The hole trembles', whisper: 'almost... almost...' },
  { xp: Infinity, radius: 6.0, mult: 10, unlock: 'THE DEEP is open. Jump in.', whisper: 'come down. see what you fed.' },
];

export const MAX_HOLE_LEVEL = HOLE_LEVELS.length;

export function holeLevel(level: number): HoleLevel {
  return HOLE_LEVELS[Math.min(level, MAX_HOLE_LEVEL) - 1];
}
