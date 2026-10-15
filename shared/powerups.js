// Pickups are chosen and collected by the shared simulation, never by a client.
export const POWERUPS = {
  shotgun: { name: "Scatter shotgun", color: "#ffb65b", ammo: 12, interval: 0.65 },
  laser: { name: "Beam laser", color: "#6ceeff", ammo: 80, interval: 0.1 },
  cannon: { name: "Explosive cannon", color: "#ff6655", ammo: 8, interval: 0.9 },
  sword: { name: "Energy sword", color: "#b18cff", duration: 20000, interval: 0.48 },
  speed: { name: "Overdrive", color: "#8dff79", duration: 18000 },
  armor: { name: "Armor shield", color: "#74a9ff", shield: 45 },
};
export const DROP_TYPES = Object.keys(POWERUPS);
