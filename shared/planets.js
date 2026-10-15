// Planet definitions shared by the browser and the room server. Visual fields
// are only used by the client; hazards are simulated in shared/sim.js.
export const PLANETS = {
  proving: {
    name: "Proving Grounds",
    blurb: "Training arena. No hazards.",
    sky: "#0a1526",
    fog: [45, 140],
    ground: "#15283b",
    grid: ["#346381", "#243c50"],
    rock: "#263b50",
    sun: "#ffffff",
    ambient: 1.1,
    gravity: 17,
    grip: 1,
  },
  ember: {
    name: "Ember",
    blurb: "Volcanic world. Lava pools burn your armor.",
    sky: "#2a0d07",
    fog: [35, 120],
    ground: "#2b1a14",
    grid: ["#6b2e18", "#3d1d12"],
    rock: "#3a2016",
    sun: "#ffb07a",
    ambient: 0.9,
    gravity: 17,
    grip: 1,
    lava: [
      { x: -22, z: -4, r: 6 },
      { x: 24, z: -30, r: 7 },
      { x: -10, z: -52, r: 6 },
      { x: 30, z: 20, r: 5 },
    ],
  },
  cryo: {
    name: "Cryo",
    blurb: "Frozen moon. Ice makes Titans slide.",
    sky: "#cfe6f5",
    fog: [40, 150],
    ground: "#dbeef8",
    grid: ["#9cc4dc", "#bcd8e8"],
    rock: "#8fb3c9",
    sun: "#e8f6ff",
    ambient: 1.3,
    gravity: 17,
    grip: 0.18,
  },
  selene: {
    name: "Selene",
    blurb: "Low gravity. Jump high and fall slowly.",
    sky: "#05060c",
    fog: [70, 200],
    ground: "#3b3d44",
    grid: ["#5c5f68", "#46484f"],
    rock: "#55575e",
    sun: "#f2f2ff",
    ambient: 0.8,
    gravity: 5,
    grip: 1,
  },
  tempest: {
    name: "Tempest",
    blurb: "Storm world. Lightning strikes glowing zones.",
    sky: "#141a24",
    fog: [30, 110],
    ground: "#1d2530",
    grid: ["#3f5266", "#2a3644"],
    rock: "#2c3846",
    sun: "#b8c8ff",
    ambient: 0.8,
    gravity: 17,
    grip: 1,
    lightning: true,
  },
  verdant: {
    name: "Verdant",
    blurb: "Jungle ruins. Thick mist hides the drones.",
    sky: "#0f2418",
    fog: [12, 70],
    ground: "#1b3324",
    grid: ["#2f5a3d", "#22442d"],
    rock: "#2d4a34",
    sun: "#d9ffd0",
    ambient: 1,
    gravity: 17,
    grip: 1,
  },
};
export const PLANET_IDS = Object.keys(PLANETS);
export const planetOf = (id) => PLANETS[id] || PLANETS.proving;
export const LAVA_DPS = 12;
export const STRIKE_WARNING = 1.5;
export const STRIKE_RADIUS = 5;
export const STRIKE_DAMAGE = 25;
export const inLava = (planet, position) =>
  position[1] < 0.6 &&
  (planetOf(planet).lava || []).some(
    (z) => Math.hypot(position[0] - z.x, position[2] - z.z) < z.r,
  );

// Paint jobs: three colours per pilot.
export const DEFAULT_PAINT = {
  primary: "#e17b35",
  secondary: "#405775",
  visor: "#00d9ff",
};
const HEX = /^#[0-9a-f]{6}$/i;
export function cleanPaint(paint) {
  const out = { ...DEFAULT_PAINT };
  if (paint && typeof paint === "object")
    for (const k of Object.keys(DEFAULT_PAINT))
      if (typeof paint[k] === "string" && HEX.test(paint[k]))
        out[k] = paint[k].toLowerCase();
  return out;
}

export const FUSE_RANGE = 8;
export const FUSE_WINDOW = 3000;
export const FUSE_DURATION = 20000;
export const FUSE_COOLDOWN = 30000;
export const FUSE_SCALE = 1.8;
export const FUSE_DAMAGE = 3;
