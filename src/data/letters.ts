// The secret word: five gold letters the player feeds to the hole for Green Grog (BOOZED). Once per save,
// like the golden shovel: an eaten letter is stored in `state.secrets` as `letter-<ch>` (PP 2026-10-21).
export const WORD = 'GNOME';

// Fixed spots like the shovel (PP 2026-10-20: fixed, so players can share hints), two on the largest land.
// Each is >= 6.8 m from the hole's line, >= 2 m inside its land's fence and >= 5 m beyond the previous land's +x or
// +z fence, so it lies in sight until the hole reaches that land's level (PP 2026-10-21).
// L0 in tools/smoke/scenario-letters.js is the proof.
export const LETTER_SPOTS: { ch: string; land: number; x: number; z: number }[] = [
  { ch: 'G', land: 0, x: 15, z: -15 },
  { ch: 'N', land: 1, x: 36, z: -10 },
  { ch: 'O', land: 2, x: -8, z: 58 },
  { ch: 'M', land: 3, x: 86, z: 10 },
  { ch: 'E', land: 3, x: 10, z: 88 },
];
