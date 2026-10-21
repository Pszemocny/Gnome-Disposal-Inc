// The secret word: five gold letters the player feeds to the hole for Green Grog (BOOZED). Once per save,
// like the golden shovel: an eaten letter is stored in `state.secrets` as `letter-<ch>` (PP 2026-10-21).
export const WORD = 'GNOME';

// Fixed spots like the shovel (PP 2026-10-20: fixed, so players can share hints), two on the largest land.
// Each is >= 6.8 m from every land's hole path and slide line, >= 2 m inside its land's fence and >= 5 m outside
// the previous land's fence, so it lies in sight beyond the fence until that land is bought (PP 2026-10-21).
// Auto-lands (2026-10-20 plan) must re-pick these for its rectangle; L0 in tools/smoke/scenario-letters.js is the proof.
export const LETTER_SPOTS: { ch: string; land: number; x: number; z: number }[] = [
  { ch: 'G', land: 0, x: 15, z: -15 },
  { ch: 'N', land: 1, x: -27, z: 24 },
  { ch: 'O', land: 2, x: 38, z: 30 },
  { ch: 'M', land: 3, x: -50, z: -20 },
  { ch: 'E', land: 3, x: 30, z: -52 },
];
