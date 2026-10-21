export interface LandTier {
  name: string;
  half: number; // the yard runs from (-22, -22) to (2 * half - 22) on x and z
  cost: number; // price before lands came by themselves; only the one-time refund of old saves reads it
  hole: number; // hole level at which the yard grows into this land
}

// The yard grows by itself with the hole level, always toward the hole (factory -> hole), never behind the house
// (PP 2026-10-20). The corner (-22, -22) behind the factory and house stays put.
export const LAND: LandTier[] = [
  { name: 'Backyard', half: 22, cost: 0, hole: 1 },
  { name: 'Garden', half: 32, cost: 1500, hole: 3 },
  { name: 'Neighbour\'s Lawn', half: 44, cost: 8000, hole: 5 },
  { name: 'Dark Forest', half: 58, cost: 40000, hole: 8 },
];

// metres the hole moves further from the factory with each land (15 / 19 / 23 / 27 m at hole level 1)
export const LAND_STEP = 4;

// The land a hole level brings: the highest tier whose level is reached.
export function landFor(level: number): number {
  let land = 0;
  for (const [i, t] of LAND.entries()) if (t.hole <= level) land = i;
  return land;
}
