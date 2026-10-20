export interface LandTier {
  name: string;
  half: number; // half size of the fenced square
  cost: number;
  hole: number; // hole level required
  // where the hole sits at hole level 1 on this land (x, z); it drifts 1.2 m per level away from the factory.
  // Fixed, not random, so the player can plan a contraption for it (PP 2026-10-20).
  anchor: [number, number];
}

// Anchors: each at least 8 m from the factory, house, desk and fence, each further from the factory than the
// last (15.0, 19.2, 23.0, 26.7 m), and the level-12 hole (radius 6) still inside the fence.
export const LAND: LandTier[] = [
  { name: 'Backyard', half: 22, cost: 0, hole: 1, anchor: [0, 0] },
  { name: 'Garden', half: 32, cost: 1500, hole: 3, anchor: [-10, 6] },
  { name: 'Neighbour\'s Lawn', half: 44, cost: 8000, hole: 5, anchor: [10, 2] },
  { name: 'Dark Forest', half: 58, cost: 40000, hole: 8, anchor: [-24, -34] },
];
