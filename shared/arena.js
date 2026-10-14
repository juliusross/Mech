// Shared by the browser client and the room server so both agree on the arena.
export const TARGET_HP = 3;
export const TARGETS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: ((i % 4) - 1.5) * 9,
  z: -15 - Math.floor(i / 4) * 12,
}));
export const MAX_AMMO = 60;
export const FIRE_INTERVAL = 0.16;
export const BULLET_SPEED = 60;
export const BULLET_LIFE = 2;
export function hitsTarget(p, t) {
  return Math.abs(p[0] - t.x) < 2 && Math.abs(p[2] - t.z) < 1.8 && p[1] < 6;
}
