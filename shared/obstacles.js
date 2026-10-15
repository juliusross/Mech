// Solid structures. Buildings, houses, temples, domes, construction frames and
// arena cover become axis-aligned boxes shared by rendering, client movement
// and the room server, so they block movement and shots (usable as cover).
import { layoutFor, rng } from "./layout.js";
import { planetOf } from "./planets.js";
import { terrainHeight } from "./terrain.js";

const CELL = 16;
/** Titans can stride over anything lower than this; it still stops shots. */
export const STEP_HEIGHT = 1.4;

// Low cover kept from the original arena (sandbags, crates, barriers).
export const LOW_COVER = [
  [-30, 20, 0], [30, 22, 0.4], [-48, -10, 1.2], [48, -14, -0.8], [-26, -55, 0.3], [28, -60, -0.2], [0, 35, 1.57], [-55, 40, 0.7], [55, 42, -0.6],
];

const STRUCTURE_COLORS = {
  proving: ["#6f7d5c", "#8a8f94", "#a35a3a", "#3f6d9e"],
  ember: ["#4a3a30", "#3a302b", "#6b3a2a"],
  cryo: ["#9fb3c2", "#c9d6df", "#5d7f9e"],
  selene: ["#9aa0a8", "#c9ccd1", "#6d7179"],
  tempest: ["#4a5563", "#3c4654", "#7a5a3a"],
  verdant: ["#7f8a6a", "#5f6b4a", "#8f977a"],
};

/** Containers, concrete walls and bunkers scattered through the combat zone. */
export function arenaStructures(planet) {
  const rand = rng(planet.length * 104729 + 17);
  const P = planetOf(planet);
  const colors = STRUCTURE_COLORS[planet] || STRUCTURE_COLORS.proving;
  const out = [];
  const kinds = [
    { kind: "container", w: 2.6, d: 7.5, h: 2.7 },
    { kind: "wall", w: 1.2, d: 9, h: 3.4 },
    { kind: "bunker", w: 7, d: 6, h: 3.2 },
    { kind: "container", w: 2.6, d: 7.5, h: 5.4 }, // stacked pair
  ];
  let guard = 600;
  while (out.length < 26 && guard-- > 0) {
    const x = (rand() - 0.5) * 220;
    const z = -150 + rand() * 240;
    // Keep the central lane, the spawn area, lava and existing cover clear.
    if (Math.abs(x) < 20 && z > -48 && z < 24) continue;
    if (Math.hypot(x, z - 8) < 22) continue;
    if ((P.lava || []).some((l) => Math.hypot(x - l.x, z - l.z) < l.r + 7)) continue;
    if (LOW_COVER.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 9)) continue;
    if (out.some((o) => Math.hypot(x - o.x, z - o.z) < 13)) continue;
    const k = kinds[Math.floor(rand() * kinds.length)];
    const turned = rand() < 0.5;
    out.push({ ...k, x, z, r: turned ? Math.PI / 2 : 0, color: colors[Math.floor(rand() * colors.length)] });
  }
  return out;
}

function rotatedBox(x, z, w, d, r) {
  const c = Math.abs(Math.cos(r)),
    s = Math.abs(Math.sin(r));
  const hw = (w * c + d * s) / 2,
    hd = (w * s + d * c) / 2;
  return [x - hw, z - hd, x + hw, z + hd];
}

function collect(planet) {
  const L = layoutFor(planet);
  const boxes = [];
  const add = ([x0, z0, x1, z1], h, low = false) =>
    boxes.push({ x0, z0, x1, z1, y0: terrainHeight(planet, (x0 + x1) / 2, (z0 + z1) / 2), h, low });
  for (const b of L.buildings || []) add([b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2], b.h + (b.ruined ? 1.6 : 1.2));
  for (const h of L.houses || []) add(rotatedBox(h.x, h.z, h.w, h.d, h.r), h.h + 2);
  for (const t of L.temples || []) add([t.x - 13 * t.s, t.z - 13 * t.s, t.x + 13 * t.s, t.z + 13 * t.s], 19 * t.s);
  for (const d of L.domes || []) add([d.x - d.r * 0.75, d.z - d.r * 0.75, d.x + d.r * 0.75, d.z + d.r * 0.75], d.r * 0.9);
  for (const s of L.stacks || []) add([s.x - 1.8, s.z - 1.8, s.x + 1.8, s.z + 1.8], s.h);
  (L.construction || []).forEach((c, i) => {
    add(rotatedBox(c.x, c.z, 17, 13, c.r), (3 + (i % 3)) * 3.6);
    // crane tower sits at (-14, 8) in the site's local frame
    const cx = c.x + Math.cos(c.r) * -14 + Math.sin(c.r) * 8;
    const cz = c.z - Math.sin(c.r) * -14 + Math.cos(c.r) * 8;
    add([cx - 0.9, cz - 0.9, cx + 0.9, cz + 0.9], 34);
  });
  for (const s of arenaStructures(planet)) add(rotatedBox(s.x, s.z, s.w, s.d, s.r), s.h);
  for (const [x, z, r] of LOW_COVER) add(rotatedBox(x, z, 4.2, 1.6, r), 1.1, true);
  return boxes;
}

const cache = new Map();
/** Spatial index of solid boxes for a planet. */
export function solidsFor(planet) {
  if (cache.has(planet)) return cache.get(planet);
  const boxes = collect(planet);
  const grid = new Map();
  for (const b of boxes)
    for (let gx = Math.floor(b.x0 / CELL); gx <= Math.floor(b.x1 / CELL); gx++)
      for (let gz = Math.floor(b.z0 / CELL); gz <= Math.floor(b.z1 / CELL); gz++) {
        const key = gx * 10007 + gz;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(b);
      }
  const index = { boxes, grid };
  cache.set(planet, index);
  return index;
}

const near = (index, x, z) => index.grid.get(Math.floor(x / CELL) * 10007 + Math.floor(z / CELL)) || [];

/** The structure containing point (x, y, z), if any. */
export function solidAt(index, x, y, z) {
  for (const b of near(index, x, z))
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y < b.y0 + b.h && y > b.y0 - 0.5) return b;
  return null;
}

/** Pushes a circle of `radius` at (x, z) out of structures taller than a step. */
export function pushOut(index, x, z, radius, y = 0) {
  const seen = new Set();
  for (const [ox, oz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]])
    for (const b of near(index, x + ox, z + oz)) {
      if (seen.has(b) || b.low || b.h < STEP_HEIGHT || y >= b.y0 + b.h - 0.2) continue;
      seen.add(b);
      const cx = Math.max(b.x0, Math.min(x, b.x1)),
        cz = Math.max(b.z0, Math.min(z, b.z1));
      const dx = x - cx,
        dz = z - cz;
      const d = Math.hypot(dx, dz);
      if (d >= radius) continue;
      if (d > 1e-6) {
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      } else {
        // Centre is inside the box: leave by the nearest face.
        const exits = [
          [x - b.x0, b.x0 - radius, z],
          [b.x1 - x, b.x1 + radius, z],
          [z - b.z0, x, b.z0 - radius],
          [b.z1 - z, x, b.z1 + radius],
        ];
        const best = exits.reduce((a, e) => (e[0] < a[0] ? e : a));
        if (best === exits[0] || best === exits[1]) x = best[1];
        else z = best[2];
      }
    }
  return [x, z];
}
