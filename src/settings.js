import { CLASSES, WEAPONS } from "../shared/arena.js";
import { PLANETS, cleanPaint, DEFAULT_PAINT } from "../shared/planets.js";

// Per-browser preferences. Storage may be unavailable (private mode), so every
// access is guarded and the game works with defaults.
const KEY = "mechverse-settings";
export const DEFAULTS = {
  name: "",
  cls: "assault",
  weapon: "plasma",
  paint: DEFAULT_PAINT,
  planet: "proving",
  cleared: [],
  volume: 0.7,
  sensitivity: 1,
  invertY: false,
};

export function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
    // Older builds stored only the class.
    const legacy = localStorage.getItem("mechverse-class");
    if (legacy && !saved.cls) saved.cls = legacy;
  } catch {}
  const s = { ...DEFAULTS, ...saved };
  return {
    ...s,
    name: typeof s.name === "string" ? s.name.slice(0, 20) : "",
    cls: CLASSES[s.cls] ? s.cls : "assault",
    weapon: WEAPONS[s.weapon] ? s.weapon : "plasma",
    paint: cleanPaint(s.paint),
    planet: PLANETS[s.planet] ? s.planet : "proving",
    volume: Math.min(1, Math.max(0, Number(s.volume) || 0)),
    sensitivity: Math.min(3, Math.max(0.2, Number(s.sensitivity) || 1)),
    invertY: Boolean(s.invertY),
    cleared: Array.isArray(s.cleared) ? s.cleared.filter((id) => PLANETS[id]) : [],
  };
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export const PAINT_PRESETS = [
  { name: "Ronin", primary: "#e17b35", secondary: "#405775", visor: "#00d9ff" },
  { name: "Vanguard", primary: "#d9dee5", secondary: "#2b3a52", visor: "#4aa8ff" },
  { name: "Crimson", primary: "#b3262e", secondary: "#2a2a30", visor: "#ffcc33" },
  { name: "Jungle", primary: "#5f7a3a", secondary: "#3b4a2c", visor: "#c8ff5a" },
  { name: "Arctic", primary: "#eef5fb", secondary: "#8aa7bd", visor: "#33e0ff" },
  { name: "Phantom", primary: "#2b2d36", secondary: "#14151a", visor: "#c05aff" },
];
