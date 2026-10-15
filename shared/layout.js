// Deterministic world layouts per planet. Everything is generated from a seed
// so every pilot in a room sees the same towns, forests and roads.
// The combat zone (x −65…65, z −85…65) stays open; settlements sit around it.

export function rng(seed) {
  let x = seed % 2147483647 || 1;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}
const PLAY = { x0: -68, x1: 68, z0: -88, z1: 68 };
const inPlay = (x, z, pad = 0) => x > PLAY.x0 - pad && x < PLAY.x1 + pad && z > PLAY.z0 - pad && z < PLAY.z1 + pad;
const inRect = (x, z, r) => x > r[0] && x < r[2] && z > r[1] && z < r[3];

/** Scatter n items in rect [x0,z0,x1,z1], rejecting any `avoid` rects. */
function scatter(rand, n, rect, avoid = [], make = (x, z) => ({ x, z })) {
  const out = [];
  let guard = n * 20;
  while (out.length < n && guard-- > 0) {
    const x = rect[0] + rand() * (rect[2] - rect[0]);
    const z = rect[1] + rand() * (rect[3] - rect[1]);
    if (avoid.some((a) => (typeof a === "function" ? a(x, z) : inRect(x, z, a)))) continue;
    out.push(make(x, z));
  }
  return out;
}
const tree = (rand, kind, s0 = 0.8, s1 = 1.5) => (x, z) => ({ x, z, kind, s: s0 + rand() * (s1 - s0), r: rand() * 6.28 });

/** A grid of city blocks with buildings, filling rect. */
function city(rand, rect, { minH, maxH, palette, gap = 14, lot = 9 }) {
  const out = [];
  for (let x = rect[0]; x < rect[2]; x += gap)
    for (let z = rect[1]; z < rect[3]; z += gap) {
      if (rand() < 0.12) continue;
      const w = lot * (0.6 + rand() * 0.4),
        d = lot * (0.6 + rand() * 0.4);
      const h = minH + Math.pow(rand(), 2) * (maxH - minH);
      out.push({ x: x + gap / 2, z: z + gap / 2, w, d, h, color: palette[Math.floor(rand() * palette.length)], lit: rand() });
    }
  return out;
}
function houses(rand, rect, n, avoid, roof) {
  return scatter(rand, n, rect, avoid, (x, z) => ({
    x,
    z,
    w: 5 + rand() * 3,
    d: 6 + rand() * 3,
    h: 3 + rand() * 1.5,
    r: Math.round(rand() * 3) * (Math.PI / 2),
    wall: ["#d8cbb3", "#c9b79c", "#e6e0d4", "#b9a58a", "#a8b8c4"][Math.floor(rand() * 5)],
    roof: roof || ["#8a3b2b", "#5d4037", "#46525e", "#7a4a2a"][Math.floor(rand() * 4)],
  }));
}
const grass = (rand, n, colors) =>
  scatter(rand, n, [-90, -110, 90, 90], [], (x, z) => ({ x, z, s: 0.5 + rand() * 0.8, r: rand() * 6.28, c: colors[Math.floor(rand() * colors.length)] }));

const LAYOUTS = {
  // Sunny coastal base: town, highway, beach and ocean, construction site, forest.
  proving(rand) {
    const avoidPlay = (x, z) => inPlay(x, z, 6);
    return {
      day: true,
      sun: [120, 160, 60],
      ocean: { x0: 120, x1: 420, z0: -300, z1: 300, color: "#2b6f9e" },
      beach: { x0: 98, x1: 124, z0: -300, z1: 300, color: "#d9c79a" },
      roads: [
        { x0: 80, z0: -260, x1: 80, z1: 260, w: 16, highway: true },
        { x0: -230, z0: 40, x1: 80, z1: 40, w: 9 },
        { x0: -120, z0: -150, x1: -120, z1: 160, w: 8 },
      ],
      houses: houses(rand, [-200, -70, -82, 120], 34, [avoidPlay, [-126, -200, -114, 200], [-240, 34, 90, 46]]),
      buildings: city(rand, [-230, -70, -180, 120], { minH: 6, maxH: 18, palette: ["#b8b2a6", "#9fa7ad", "#c9c1b0"] }),
      construction: [{ x: -95, z: -125, r: 0.3 }],
      trees: [
        ...scatter(rand, 260, [-260, -280, 70, -100], [avoidPlay, [-130, -150, -60, -95]], tree(rand, "oak")),
        ...scatter(rand, 60, [-200, -70, -82, 130], [avoidPlay, [-126, -200, -114, 200], [-240, 34, 90, 46]], tree(rand, "oak", 0.7, 1.1)),
      ],
      palms: scatter(rand, 70, [96, -280, 122, 280], [], tree(rand, "palm", 0.9, 1.3)),
      rocks: scatter(rand, 30, [-100, -100, 95, 90], [avoidPlay], (x, z) => ({ x, z, s: 0.5 + rand() * 1.5, r: rand() * 6 })),
      cover: true,
      grass: grass(rand, 900, ["#4f7a35", "#5f8a3d", "#6b9442"]),
      ground: "#5d7a3e",
      groundAlt: "#4b6a33",
    };
  },
  // Volcanic: lava rivers, scorched trees, ruined refinery town, ash.
  ember(rand) {
    const avoidPlay = (x, z) => inPlay(x, z, 6);
    return {
      day: false,
      sun: [-80, 40, -120],
      volcano: { x: 40, z: -320, r: 120, h: 110 },
      lavaRivers: [
        [[-260, -110], [-150, -95], [-60, -120], [40, -105], [150, -130], [260, -110]],
        [[-90, 260], [-95, 150], [-80, 90], [-100, 20], [-85, -95]],
      ],
      buildings: city(rand, [90, -60, 200, 120], { minH: 5, maxH: 22, palette: ["#3a2f2a", "#4a3a30", "#2c2622"], gap: 16 }).map((b) => ({
        ...b,
        ruined: true,
      })),
      stacks: scatter(rand, 8, [100, -50, 190, 110], [], (x, z) => ({ x, z, h: 20 + rand() * 18 })),
      roads: [{ x0: 75, z0: -250, x1: 75, z1: 250, w: 12, highway: true, cracked: true }],
      trees: scatter(rand, 160, [-260, -280, 260, 260], [avoidPlay, [85, -70, 210, 130]], tree(rand, "dead", 0.8, 1.6)),
      rocks: scatter(rand, 70, [-200, -200, 200, 200], [avoidPlay], (x, z) => ({ x, z, s: 0.8 + rand() * 2.4, r: rand() * 6 })),
      cover: true,
      grass: [],
      ground: "#2b1a14",
      groundAlt: "#3a2219",
    };
  },
  // Snowy day: frozen lake, pine forest, alpine village, highway.
  cryo(rand) {
    const avoidPlay = (x, z) => inPlay(x, z, 6);
    return {
      day: true,
      sun: [-90, 110, 100],
      lake: { x: 130, z: -40, rx: 55, rz: 80, color: "#bfe3f5", ice: true },
      roads: [{ x0: -85, z0: -260, x1: -85, z1: 260, w: 14, highway: true, snowy: true }],
      houses: houses(rand, [-200, 70, -100, 200], 26, [[-92, -300, -78, 300]], "#f2f6f8"),
      trees: [
        ...scatter(rand, 380, [-280, -300, 280, 300], [avoidPlay, (x, z) => ((x - 130) / 60) ** 2 + ((z + 40) / 85) ** 2 < 1, [-92, -300, -78, 300], [-205, 65, -95, 205]], tree(rand, "pine", 0.8, 1.7)),
      ],
      rocks: scatter(rand, 40, [-100, -100, 95, 90], [avoidPlay], (x, z) => ({ x, z, s: 0.6 + rand() * 1.6, r: rand() * 6 })),
      construction: [{ x: 90, z: 110, r: -0.4 }],
      cover: true,
      grass: [],
      ground: "#e6f1f7",
      groundAlt: "#d3e6f0",
    };
  },
  // Lunar night: domed colony, habitat modules, landing pads, construction yard.
  selene(rand) {
    const avoidPlay = (x, z) => inPlay(x, z, 6);
    return {
      day: false,
      sun: [150, 90, -60],
      earth: true,
      domes: scatter(rand, 9, [-200, -60, -90, 140], [avoidPlay], (x, z) => ({ x, z, r: 8 + rand() * 10 })),
      modules: scatter(rand, 22, [-210, -80, -85, 160], [avoidPlay], (x, z) => ({ x, z, l: 10 + rand() * 10, r: rand() * 3.14 })),
      pads: [
        { x: 110, z: -20 },
        { x: 120, z: 50 },
        { x: 100, z: -110 },
      ],
      construction: [
        { x: 95, z: 120, r: 0.2 },
        { x: -120, z: -140, r: -0.6 },
      ],
      craters: scatter(rand, 60, [-260, -280, 260, 260], [avoidPlay], (x, z) => ({ x, z, s: 1 + rand() * 4 })),
      rocks: scatter(rand, 70, [-200, -200, 200, 200], [avoidPlay], (x, z) => ({ x, z, s: 0.5 + rand() * 1.8, r: rand() * 6 })),
      cover: true,
      grass: [],
      trees: [],
      ground: "#5a5c63",
      groundAlt: "#4a4c52",
    };
  },
  // Storm city: skyscrapers, street grid, elevated highway, river with bridge.
  tempest(rand) {
    const avoidPlay = (x, z) => inPlay(x, z, 10);
    const river = [[95, -300], [100, -150], [92, 0], [104, 150], [96, 300]];
    const downtown = [
      ...city(rand, [-260, -260, -80, 220], { minH: 14, maxH: 70, palette: ["#3c4654", "#2f3844", "#495565", "#2a3038"], gap: 18, lot: 12 }),
      ...city(rand, [-80, -260, 80, -100], { minH: 14, maxH: 60, palette: ["#3c4654", "#2f3844", "#495565"], gap: 18, lot: 12 }),
      ...city(rand, [120, -260, 260, 220], { minH: 10, maxH: 45, palette: ["#3c4654", "#495565", "#56606e"], gap: 18, lot: 12 }),
    ].filter((b) => !avoidPlay(b.x, b.z));
    return {
      day: false,
      sun: [60, 80, 40],
      buildings: downtown,
      roads: [
        { x0: -300, z0: 85, x1: 300, z1: 85, w: 18, highway: true, elevated: 9 },
        { x0: -75, z0: -300, x1: -75, z1: 300, w: 10 },
        { x0: -300, z0: -95, x1: 120, z1: -95, w: 10 },
        { x0: 112, z0: -300, x1: 112, z1: 300, w: 9 },
      ],
      river: { points: river, w: 22 },
      bridges: [{ x: 98, z: -95, w: 30 }],
      streetlights: true,
      trees: scatter(rand, 50, [-70, 70, 70, 80], [], tree(rand, "oak", 0.6, 0.9)),
      rocks: [],
      cover: true,
      grass: grass(rand, 300, ["#34503a", "#3d5a40"]),
      ground: "#26303a",
      groundAlt: "#1f2830",
    };
  },
  // Jungle day: dense canopy, river, beach, temples, stilt village, light rain.
  verdant(rand) {
    const avoidPlay = (x, z) => inPlay(x, z, 4);
    const river = [[-300, 110], [-150, 95], [-40, 120], [80, 100], [180, 130], [300, 115]];
    const nearRiver = (x, z) => z > 80 && z < 150;
    return {
      day: true,
      hazy: true,
      sun: [80, 120, -90],
      river: { points: river, w: 20 },
      ocean: { x0: -420, x1: 420, z0: 230, z1: 520, color: "#1f7f86" },
      beach: { x0: -420, x1: 420, z0: 200, z1: 236, color: "#e2d3a3" },
      temples: [
        { x: -110, z: -120, s: 1.4 },
        { x: 110, z: -60, s: 1.0 },
        { x: -60, z: -170, s: 0.8 },
      ],
      huts: scatter(rand, 16, [-80, 70, 80, 85], [], (x, z) => ({ x, z, r: rand() * 6.28 })),
      trees: [
        ...scatter(rand, 420, [-280, -300, 280, 200], [avoidPlay, nearRiver, (x, z) => [[-110, -120], [110, -60], [-60, -170]].some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 26)], tree(rand, "jungle", 0.9, 1.8)),
        ...scatter(rand, 60, [-280, 160, 280, 205], [], tree(rand, "palm", 0.9, 1.4)),
      ],
      bushes: scatter(rand, 260, [-120, -130, 120, 110], [], (x, z) => ({ x, z, s: 0.6 + rand() * 1.1, r: rand() * 6 })),
      rocks: scatter(rand, 25, [-100, -100, 95, 90], [avoidPlay], (x, z) => ({ x, z, s: 0.5 + rand() * 1.4, r: rand() * 6 })),
      cover: true,
      grass: grass(rand, 1100, ["#2f6b3a", "#3b7d42", "#4a8a3f"]),
      ground: "#2c4a26",
      groundAlt: "#243f20",
    };
  },
};

const cache = new Map();
export function layoutFor(planet) {
  if (!cache.has(planet)) {
    const make = LAYOUTS[planet] || LAYOUTS.proving;
    cache.set(planet, make(rng(planet.length * 7919 + planet.charCodeAt(0) * 31)));
  }
  return cache.get(planet);
}
