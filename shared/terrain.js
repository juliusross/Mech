// A deterministic height field shared by rendering, movement, and room validation.
// The original combat arena and built settlements remain level. The new outer
// landscape is traversable and has broad slopes instead of abrupt steps.
export const WORLD_EDGE = 395;

const HILLS = {
  proving: [[-325, -320, 31, 83], [-345, 240, 24, 90], [-260, -355, 18, 65]],
  ember: [[-330, -310, 38, 83], [310, 310, 28, 86], [-325, 270, 22, 72]],
  cryo: [[-325, -315, 36, 91], [325, 295, 31, 90], [300, -320, 23, 75]],
  selene: [[-325, -315, 27, 77], [320, 305, 34, 91], [-320, 275, 18, 66]],
  tempest: [[-335, -315, 25, 74], [335, 300, 27, 78]],
  verdant: [[-330, -300, 32, 88], [315, -315, 27, 83], [-310, -355, 18, 68]],
};
const NEAR_HILLS = {
  proving: [[5, -174, 20, 61], [-63, -204, 14, 52]],
  cryo: [[8, -178, 23, 68], [65, -203, 16, 55]],
};

const smooth = (t) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

export function terrainHeight(planet, x, z) {
  // Existing roads, buildings, lava, and combat targets occupy the inner map.
  const outskirts = smooth((Math.max(Math.abs(x), Math.abs(z)) - 215) / 85);
  const near = smooth((-z - 96) / 34) * smooth((90 - Math.abs(x)) / 20);
  if (outskirts === 0 && near === 0) return 0;
  const hills = HILLS[planet] || HILLS.proving;
  let height = 0;
  for (const [hx, hz, peak, radius] of hills) {
    const dx = (x - hx) / radius;
    const dz = (z - hz) / radius;
    height += peak * Math.exp(-1.6 * (dx * dx + dz * dz));
  }
  const rolling = 2.5 * (Math.sin(x * 0.039 + z * 0.011) * Math.cos(z * 0.035 - x * 0.008) + 1);
  let nearby = 0;
  for (const [hx, hz, peak, radius] of NEAR_HILLS[planet] || []) {
    const dx = (x - hx) / radius;
    const dz = (z - hz) / radius;
    nearby += peak * Math.exp(-1.6 * (dx * dx + dz * dz));
  }
  return outskirts * (height + rolling) + near * nearby;
}
