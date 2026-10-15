// Enemy roster. All enemy behaviour is simulated in shared/sim.js from these
// numbers, so the server and solo play agree.
//   center: height of the hit-box centre above the enemy's feet
//   keep:   preferred distance from its target pilot
//   orbit:  circles the target instead of holding a fixed bearing
//   burst:  shots per volley (burstGap seconds apart)
//   spread: aim error in radians
export const ENEMY_TYPES = {
  drone: {
    name: "Drone",
    hp: 4,
    speed: 7,
    radius: 1.8,
    center: 0,
    fly: true,
    range: 45,
    keep: 16,
    orbit: true,
    cooldown: [2.4, 3.6],
    burst: 1,
    burstGap: 0,
    damage: 6,
    boltSpeed: 24,
    spread: 0,
    score: 2,
    bolt: "plasma",
  },
  soldier: {
    name: "Infantry",
    hp: 1,
    speed: 2.6,
    radius: 0.95,
    center: 0.9,
    range: 38,
    keep: 24,
    cooldown: [2.6, 3.6],
    burst: 1,
    burstGap: 0,
    damage: 2,
    boltSpeed: 28,
    spread: 0.07,
    score: 1,
    bolt: "bullet",
  },
  vehicle: {
    name: "Gun buggy",
    hp: 5,
    speed: 12,
    radius: 2.1,
    center: 1,
    range: 40,
    keep: 20,
    orbit: true,
    cooldown: [3, 4],
    burst: 3,
    burstGap: 0.18,
    damage: 3,
    boltSpeed: 32,
    spread: 0.05,
    score: 2,
    bolt: "bullet",
  },
  tank: {
    name: "Tank",
    hp: 12,
    speed: 3.2,
    radius: 2.9,
    center: 1.4,
    range: 55,
    keep: 32,
    cooldown: [3.6, 4.8],
    burst: 1,
    burstGap: 0,
    damage: 14,
    boltSpeed: 18,
    spread: 0.02,
    score: 4,
    bolt: "shell",
  },
  mech: {
    name: "Hostile mech",
    hp: 10,
    speed: 5,
    radius: 2.2,
    center: 2.8,
    range: 45,
    keep: 22,
    cooldown: [2.2, 3.2],
    burst: 2,
    burstGap: 0.25,
    damage: 7,
    boltSpeed: 24,
    spread: 0.03,
    score: 4,
    bolt: "plasma",
  },
};
// The Warlord: a giant siege mech that ends every planet chapter.
ENEMY_TYPES.boss = {
  name: "Warlord",
  hp: 90,
  speed: 2.6,
  radius: 4.6,
  center: 5,
  range: 75,
  keep: 30,
  cooldown: [1.8, 2.6],
  burst: 5,
  burstGap: 0.15,
  damage: 8,
  boltSpeed: 26,
  spread: 0.07,
  score: 40,
  bolt: "shell",
};
export const ENEMY_IDS = Object.keys(ENEMY_TYPES);
/** Every fourth wave (after three missions) is a boss fight. */
export const BOSS_EVERY = 4;
export const isBossWave = (wave) => wave % BOSS_EVERY === 0;

/** How many of each enemy type a wave brings. */
export function waveRoster(wave) {
  if (isBossWave(wave))
    return { boss: 1, drone: 2 + Math.floor(wave / BOSS_EVERY), soldier: 4, vehicle: 0, tank: 0, mech: 0 };
  return {
    drone: Math.min(2 + wave, 6),
    soldier: Math.min(2 + 2 * wave, 12),
    vehicle: wave >= 2 ? Math.min(wave - 1, 3) : 0,
    tank: wave >= 2 ? Math.min(Math.floor(wave / 2), 3) : 0,
    mech: wave >= 3 ? Math.min(wave - 2, 3) : 0,
  };
}
