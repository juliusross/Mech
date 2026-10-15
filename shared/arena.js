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

export const CLASSES = {
  assault: {
    name: "Assault",
    blurb: "Balanced all-rounder",
    armor: 100,
    speed: 9,
    fireInterval: 0.16,
    damage: 1,
    dodgeCooldown: 1.5,
    scale: 1,
    visor: "#00d9ff",
  },
  scout: {
    name: "Scout",
    blurb: "Fast and fragile, quick dodge",
    armor: 70,
    speed: 13,
    fireInterval: 0.12,
    damage: 1,
    dodgeCooldown: 0.8,
    scale: 0.8,
    visor: "#ffd84a",
  },
  heavy: {
    name: "Heavy",
    blurb: "Slow and tough, double damage",
    armor: 160,
    speed: 6.5,
    fireInterval: 0.3,
    damage: 2,
    dodgeCooldown: 2.5,
    scale: 1.25,
    visor: "#ff5a4a",
  },
  support: {
    name: "Support",
    blurb: "G repairs you and nearby pilots",
    armor: 90,
    speed: 9,
    fireInterval: 0.2,
    damage: 1,
    dodgeCooldown: 1.5,
    scale: 1,
    visor: "#5dff9a",
    repair: true,
  },
};
export const classOf = (id) => CLASSES[id] || CLASSES.assault;
export const REPAIR_AMOUNT = 30;
export const REPAIR_RANGE = 14;
export const REPAIR_COOLDOWN = 10;

// Hangar loadouts. Multipliers apply to the mech class's base fire interval,
// damage and the standard bullet speed.
export const WEAPONS = {
  plasma: { name: "Plasma cannon", blurb: "Balanced bolts", rate: 1, damage: 1, speed: 1, spread: 0, kind: "normal" },
  rail: { name: "Rail gun", blurb: "Slow, hard-hitting slugs (×3)", rate: 2.4, damage: 3, speed: 2.4, spread: 0, kind: "rail" },
  minigun: { name: "Minigun", blurb: "Rapid, light rounds", rate: 0.4, damage: 0.5, speed: 1.1, spread: 0.035, kind: "minigun" },
  rockets: { name: "Rocket pod", blurb: "Slow rockets that explode", rate: 2.8, damage: 2, speed: 0.6, spread: 0, kind: "rocket" },
};
export const WEAPON_IDS = Object.keys(WEAPONS);
export const weaponOf = (id) => WEAPONS[id] || WEAPONS.plasma;
