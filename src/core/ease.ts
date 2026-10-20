// Easing curves: map k = t / T in 0..1 to a progress value (0 at k = 0, 1 at k = 1).

export const inQuad = (k: number): number => k * k;

export const outCubic = (k: number): number => 1 - (1 - k) ** 3;

// overshoots ~10 % past 1, then settles
export const outBack = (k: number): number => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

// springs past 1 and back a few times
export const outElastic = (k: number): number => (k === 0 || k === 1 ? k : 2 ** (-10 * k) * Math.sin((10 * k - 0.75) * ((2 * Math.PI) / 3)) + 1);

export const inOutSine = (k: number): number => -(Math.cos(Math.PI * k) - 1) / 2;
