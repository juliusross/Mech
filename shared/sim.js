// Co-op combat simulation. The room server runs one world per room; solo play
// runs the same world in the browser, so both modes behave identically.
import {
  TARGETS,
  TARGET_HP,
  BULLET_SPEED,
  BULLET_LIFE,
  hitsTarget,
  CLASSES,
  classOf,
  weaponOf,
  WEAPONS,
  REPAIR_AMOUNT,
  REPAIR_RANGE,
  REPAIR_COOLDOWN,
} from "./arena.js";
import {
  PLANETS,
  planetOf,
  inLava,
  LAVA_DPS,
  STRIKE_WARNING,
  STRIKE_RADIUS,
  STRIKE_DAMAGE,
  FUSE_RANGE,
  FUSE_WINDOW,
  FUSE_DURATION,
  FUSE_COOLDOWN,
  FUSE_SCALE,
  FUSE_DAMAGE,
} from "./planets.js";
import { ENEMY_TYPES, waveRoster } from "./enemies.js";
import { DROP_TYPES, POWERUPS } from "./powerups.js";
import { terrainHeight, WORLD_EDGE } from "./terrain.js";

export const MAX_ARMOR = 100;
export const BOLT_DAMAGE = 6;
export const RESPAWN_MS = 3000;
export const WAVE_DELAY = 4000;
// In versus rooms one point of cannon damage removes this much armor.
export const PVP_DAMAGE = 5;
export const PVP_KO_SCORE = 5;
const BOLT_LIFE = 4;
const PILOT_RADIUS = 1.7;

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// Chest height of the Titan model, scaled with its size.
const chest = (p) => [p.position[0], p.position[1] + 3 * sizeOf(p), p.position[2]];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const maxArmor = (p) => classOf(p.cls).armor;
const isGunner = (p) => p.fusion?.gunner === p;
/** Hit-box scale: class size, enlarged while driving a fused Titan. */
export function sizeOf(p) {
  if (p.onFoot) return 0.32;
  return classOf(p.cls).scale * (p.fusion?.driver === p ? FUSE_SCALE : 1);
}
// A fused gunner rides inside the driver's Titan, so only the driver is hit.
const targetable = (p) => !p.downUntil && !isGunner(p);

export function createPilot(spawn, cls = "assault") {
  return {
    position: [...spawn],
    spawn: [...spawn],
    mechPosition: [...spawn],
    mechHeading: 0,
    onFoot: false,
    cls: CLASSES[cls] ? cls : "assault",
    armor: classOf(cls).armor,
    downUntil: 0,
    respawns: 0,
    score: 0,
    repairAt: 0,
    weapon: "plasma",
    fusion: null,
    fuseAt: null,
    fuseReadyAt: 0,
    burn: 0,
    special: null,
    speedUntil: 0,
    shield: 0,
  };
}

/** The pilot can leave a landed Titan and re-enter it from nearby. */
export function toggleMech(pilot, heading = 0, planet = "proving") {
  if (pilot.downUntil || pilot.fusion) return false;
  if (pilot.onFoot) {
    if (dist(pilot.position, pilot.mechPosition) > 4.5) return false;
    pilot.position = [...pilot.mechPosition];
    pilot.onFoot = false;
  } else {
    if (pilot.position[1] > terrainHeight(planet, pilot.position[0], pilot.position[2]) + 0.2) return false;
    pilot.mechPosition = [...pilot.position];
    pilot.mechHeading = heading;
    pilot.position = [
      clamp(pilot.position[0] + Math.cos(heading) * 2.8, -WORLD_EDGE, WORLD_EDGE),
      0,
      clamp(pilot.position[2] - Math.sin(heading) * 2.8, -WORLD_EDGE, WORLD_EDGE),
    ];
    pilot.position[1] = terrainHeight(planet, pilot.position[0], pilot.position[2]);
    pilot.onFoot = true;
  }
  return true;
}

export function setWeapon(pilot, weapon) {
  if (WEAPONS[weapon]) pilot.weapon = weapon;
}

export function setClass(pilot, cls) {
  if (!CLASSES[cls]) return;
  // Keep the same armor percentage so switching is never a free heal.
  const ratio = pilot.armor / maxArmor(pilot);
  pilot.cls = cls;
  pilot.armor = Math.round(ratio * maxArmor(pilot));
}

export function createWorld(
  random = Math.random,
  { pvp = false, planet = "proving" } = {},
) {
  const world = {
    random,
    pvp,
    planet: PLANETS[planet] ? planet : "proving",
    strikes: [],
    nextStrikeAt: 0,
    fusions: [],
    nextId: 1,
    now: 0,
    wave: 1,
    waveAt: 0,
    targets: [],
    enemies: [],
    bolts: [],
    shots: [],
    drops: [],
    events: [],
  };
  startWave(world);
  return world;
}

const typeOf = (e) => ENEMY_TYPES[e.type];
const centerOf = (e) => [e.pos[0], e.pos[1] + typeOf(e).center, e.pos[2]];
export const enemyCount = (wave) =>
  Object.values(waveRoster(wave)).reduce((a, b) => a + b, 0);

function spawnPoint(world, type, i, n) {
  const r = world.random;
  if (type === "drone") return [((i + 0.5) / n - 0.5) * 90, 3, -72];
  if (type === "vehicle") return [(i % 2 ? 1 : -1) * 60, 0, -30 - r() * 30];
  if (type === "soldier") {
    // Infantry arrive in squads of four.
    const squad = Math.floor(i / 4);
    return [(squad - 1) * 28 + (r() - 0.5) * 6, 0, -78 + (r() - 0.5) * 6];
  }
  return [((i + 0.5) / n - 0.5) * 70, 0, -80];
}

function startWave(world) {
  world.targets = TARGETS.map((t) => ({ ...t, hp: TARGET_HP }));
  world.enemies = [];
  let slot = 0;
  for (const [type, n] of Object.entries(waveRoster(world.wave)))
    for (let i = 0; i < n; i++) {
      const T = ENEMY_TYPES[type];
      world.enemies.push({
        id: world.nextId++,
        type,
        slot: slot++,
        pos: spawnPoint(world, type, i, n),
        hp: T.hp,
        heading: 0,
        aim: 0,
        cooldown: T.cooldown[0] * (0.6 + world.random() * 0.8),
        burstLeft: 0,
        burstTimer: 0,
      });
    }
  world.bolts = [];
  world.drops = [];
}

function shoot(world, e, target) {
  const T = typeOf(e);
  const from = centerOf(e);
  if (e.type === "tank") from[1] += 0.6;
  const aim = chest(target);
  const len = dist(aim, from) || 1;
  const dir = aim.map((v, i) => (v - from[i]) / len);
  // Aim error, so infantry and buggies miss some of the time.
  for (let i = 0; i < 3; i++) dir[i] += (world.random() - 0.5) * 2 * T.spread;
  const n = Math.hypot(...dir) || 1;
  world.bolts.push({
    id: world.nextId++,
    pos: from,
    dir: dir.map((v) => v / n),
    life: BOLT_LIFE,
    damage: T.damage,
    speed: T.boltSpeed,
    kind: T.bolt,
  });
}

const event = (world, kind, pos) =>
  world.events.push({ id: world.nextId++, kind, p: pos.map((v) => Math.round(v * 100) / 100) });

// Small enemies rarely drop power-ups, medium ones sometimes, large ones often.
export const DROP_CHANCE = { soldier: 0.06, drone: 0.08, vehicle: 0.22, tank: 0.45, mech: 0.45 };
function dropFrom(world, enemy) {
  if (world.random() >= (DROP_CHANCE[enemy.type] ?? 0)) return;
  const type = DROP_TYPES[Math.floor(world.random() * DROP_TYPES.length)];
  world.drops.push({ id: world.nextId++, type, p: [enemy.pos[0], 1.1, enemy.pos[2]] });
}

function defeatEnemy(world, enemy, credit, how = "shot") {
  if (credit) credit.score += typeOf(enemy).score;
  if (how === "stomp") event(world, "splat", [enemy.pos[0], enemy.pos[1] + 0.05, enemy.pos[2]]);
  else if (enemy.type === "soldier") event(world, "ouch", centerOf(enemy));
  else event(world, "boom", centerOf(enemy));
  dropFrom(world, enemy);
}

function hurtEnemy(world, enemy, amount, credit, how) {
  if (enemy.hp <= 0) return;
  enemy.hp = Math.max(0, enemy.hp - amount);
  if (!enemy.hp) defeatEnemy(world, enemy, credit, how);
}

/** Titans crush infantry they walk over. */
function stomp(world, pilots) {
  let crushed = false;
  for (const p of pilots) {
    if (p.onFoot || p.downUntil || isGunner(p) || p.position[1] > 1.2) continue;
    const reach = 1.5 * sizeOf(p);
    for (const e of world.enemies)
      if (e.type === "soldier" && e.hp > 0 && Math.hypot(e.pos[0] - p.position[0], e.pos[2] - p.position[2]) < reach) {
        hurtEnemy(world, e, e.hp, p, "stomp");
        crushed = true;
      }
  }
  return crushed;
}

function hurtTarget(world, target, amount, credit) {
  if (target.hp <= 0) return;
  target.hp = Math.max(0, target.hp - amount);
  if (!target.hp) {
    if (credit) credit.score++;
    event(world, "boom", [target.x, 1.8, target.z]);
  }
}

function blast(world, pos, credit, pilots = []) {
  for (const enemy of world.enemies)
    if (enemy.hp > 0 && dist(pos, centerOf(enemy)) < 7) hurtEnemy(world, enemy, 3, credit);
  for (const target of world.targets)
    if (target.hp > 0 && Math.hypot(pos[0] - target.x, pos[2] - target.z) < 6)
      hurtTarget(world, target, 2, credit);
  if (world.pvp)
    for (const rival of pilots)
      if (rival !== credit && targetable(rival) && dist(pos, chest(rival)) < 7)
        if (damagePilot(world, rival, 3 * PVP_DAMAGE, world.now) && credit) credit.score += PVP_KO_SCORE;
  event(world, "boom", pos);
}

function laserHit(world, pilot, origin, dir, pilots) {
  let hit = null;
  let hitAt = 70;
  // A short ray march is stable against network tick timing and thin targets.
  for (let range = 0; range <= 70; range += 0.75) {
    const p = origin.map((v, i) => v + dir[i] * range);
    const target = world.targets.find((t) => t.hp > 0 && hitsTarget(p, t));
    const enemy = world.enemies.find((e) => e.hp > 0 && dist(p, centerOf(e)) < typeOf(e).radius);
    const rival = world.pvp && pilots.find((other) => other !== pilot && targetable(other) && dist(p, chest(other)) < PILOT_RADIUS * sizeOf(other));
    if (target || enemy || rival) { hit = { target, enemy, rival, p }; hitAt = range; break; }
  }
  if (hit?.target) hurtTarget(world, hit.target, 1, pilot);
  if (hit?.enemy) hurtEnemy(world, hit.enemy, 1, pilot);
  if (hit?.rival && damagePilot(world, hit.rival, PVP_DAMAGE, world.now)) pilot.score += PVP_KO_SCORE;
  const end = origin.map((v, i) => v + dir[i] * hitAt);
  world.events.push({ id: world.nextId++, kind: "beam", p: origin.map((v) => Math.round(v * 100) / 100), q: end.map((v) => Math.round(v * 100) / 100) });
}

/** Returns and clears the effect events (hits, explosions, repairs, downs). */
export function drainEvents(world) {
  const events = world.events;
  world.events = [];
  return events;
}

export function fire(world, pilot, origin, dir, pilots = [pilot]) {
  const weapon = pilot.special?.type;
  const now = world.now || 0;
  if (weapon === "sword" && now >= pilot.special.until) pilot.special = null;
  const active = pilot.special?.type;
  if (active === "sword") {
    pilot.slashes = (pilot.slashes || 0) + 1;
    const power = pilot.slashes % 3 === 0 ? 5 : 3;
    for (const enemy of world.enemies) {
      const offset = [enemy.pos[0] - pilot.position[0], enemy.pos[2] - pilot.position[2]];
      if (enemy.hp > 0 && Math.hypot(...offset) < 7 && offset[0] * dir[0] + offset[1] * dir[2] > 0)
        hurtEnemy(world, enemy, power, pilot);
    }
    for (const target of world.targets)
      if (target.hp > 0 && Math.hypot(target.x - pilot.position[0], target.z - pilot.position[2]) < 6 && (target.x - pilot.position[0]) * dir[0] + (target.z - pilot.position[2]) * dir[2] > 0)
        hurtTarget(world, target, power, pilot);
    if (world.pvp)
      for (const rival of pilots) {
        const offset = [rival.position[0] - pilot.position[0], rival.position[2] - pilot.position[2]];
        if (rival !== pilot && targetable(rival) && Math.hypot(...offset) < 7 && offset[0] * dir[0] + offset[1] * dir[2] > 0)
          if (damagePilot(world, rival, power * PVP_DAMAGE, world.now)) pilot.score += PVP_KO_SCORE;
      }
    event(world, "slash", origin.map((v, i) => v + dir[i] * 3));
    return "sword";
  }
  if (active === "laser") {
    laserHit(world, pilot, origin, dir, pilots);
    pilot.special.ammo -= 2;
    if (pilot.special.ammo <= 0) pilot.special = null;
    return "laser";
  }
  const loadout = weaponOf(pilot.weapon);
  const damage = classOf(pilot.cls).damage * loadout.damage * (isGunner(pilot) ? FUSE_DAMAGE : 1);
  const shots = active === "shotgun" ? 8 : 1;
  for (let i = 0; i < shots; i++) {
    const spread = active === "shotgun" ? 0.13 : active ? 0 : loadout.spread;
    const direction = [dir[0] + (world.random() - 0.5) * 2 * spread, dir[1] + (world.random() - 0.5) * 2 * spread, dir[2] + (world.random() - 0.5) * 2 * spread];
    const n = Math.hypot(...direction) || 1;
    world.shots.push({
      id: world.nextId++, by: pilot, damage: active === "shotgun" ? 1 : active === "cannon" ? 4 : damage,
      pos: [...origin], dir: direction.map((v) => v / n),
      life: active === "shotgun" ? 0.42 : BULLET_LIFE,
      speed: active === "laser" ? 240 : active === "cannon" ? 34 : active ? BULLET_SPEED : BULLET_SPEED * loadout.speed,
      kind: active || loadout.kind,
    });
  }
  if (active && active !== "sword") {
    pilot.special.ammo--;
    if (pilot.special.ammo <= 0) pilot.special = null;
  }
  return active || loadout.kind;
}

/** Support pulse: repairs the caster and every active pilot in range. */
export function repair(world, pilot, pilots, now) {
  if (!classOf(pilot.cls).repair || pilot.onFoot || pilot.downUntil || now < pilot.repairAt)
    return false;
  pilot.repairAt = now + REPAIR_COOLDOWN * 1000;
  for (const p of pilots)
    if (!p.downUntil && dist(chest(p), chest(pilot)) <= REPAIR_RANGE)
      p.armor = Math.min(maxArmor(p), p.armor + REPAIR_AMOUNT);
  event(world, "repair", pilot.position);
  return true;
}

/** Asks to fuse; two requests from nearby pilots within a few seconds pair up. */
export function requestFuse(world, pilot, now) {
  if (pilot.onFoot || pilot.fusion || pilot.downUntil || now < pilot.fuseReadyAt) return false;
  pilot.fuseAt = now;
  return true;
}

function startFusion(world, driver, gunner, now) {
  const f = {
    id: world.nextId++,
    driver,
    gunner,
    until: now + FUSE_DURATION,
    armor: driver.armor + gunner.armor,
    max: maxArmor(driver) + maxArmor(gunner),
  };
  driver.fusion = gunner.fusion = f;
  driver.fuseAt = gunner.fuseAt = null;
  gunner.position = [...driver.position];
  world.fusions.push(f);
  event(world, "fuse", chest(driver));
}

function endFusion(world, f, now, destroyed) {
  world.fusions = world.fusions.filter((x) => x !== f);
  for (const p of [f.driver, f.gunner]) {
    p.fusion = null;
    p.fuseReadyAt = now + FUSE_COOLDOWN;
    if (destroyed) {
      p.armor = 0;
      p.downUntil = now + RESPAWN_MS;
    } else p.armor = Math.max(1, Math.round((f.armor * maxArmor(p)) / f.max));
  }
  const d = f.driver.position;
  f.gunner.position = [Math.max(-WORLD_EDGE, Math.min(WORLD_EDGE, d[0] + 3.5)), d[1], d[2]];
  event(world, destroyed ? "down" : "unfuse", chest(f.driver));
}

function damagePilot(world, p, amount, now) {
  if (p.fusion) {
    const f = p.fusion;
    f.armor = Math.max(0, f.armor - amount);
    if (f.armor) return false;
    endFusion(world, f, now, true);
    return true;
  }
  const blocked = Math.min(p.shield || 0, amount);
  p.shield = Math.max(0, (p.shield || 0) - blocked);
  p.armor = Math.max(0, p.armor - (amount - blocked));
  if (p.armor) return false;
  p.downUntil = now + RESPAWN_MS;
  event(world, "down", chest(p));
  return true;
}

export function step(world, pilots, dt, now) {
  world.now = now;
  let changed = false;
  for (const p of pilots) {
    if (p.special?.type === "sword" && now >= p.special.until) { p.special = null; changed = true; }
    if (p.speedUntil && now >= p.speedUntil) { p.speedUntil = 0; changed = true; }
    if (p.downUntil) continue;
    const index = world.drops.findIndex((drop) => dist(p.position, drop.p) < 3.8);
    if (index >= 0) {
      const [drop] = world.drops.splice(index, 1);
      const power = POWERUPS[drop.type];
      if (drop.type === "speed") p.speedUntil = now + power.duration;
      else if (drop.type === "armor") p.shield = Math.max(p.shield, power.shield);
      else p.special = { type: drop.type, ammo: power.ammo || 0, until: power.duration ? now + power.duration : 0 };
      event(world, "pickup", drop.p);
      changed = true;
    }
  }
  if (world.waveAt && now >= world.waveAt) {
    world.wave++;
    world.waveAt = 0;
    startWave(world);
    changed = true;
  }
  for (const p of pilots)
    if (p.downUntil && now >= p.downUntil) {
      p.downUntil = 0;
      p.armor = maxArmor(p);
      p.position = [...p.spawn];
      p.mechPosition = [...p.spawn];
      p.onFoot = false;
      p.respawns++;
      changed = true;
    }

  // Fusion: end expired or abandoned pairs, keep gunners inside, pair requests.
  for (const f of [...world.fusions])
    if (now >= f.until || !pilots.includes(f.driver) || !pilots.includes(f.gunner))
      endFusion(world, f, now, false);
    else f.gunner.position = [...f.driver.position];
  const ready = pilots.filter(
    (p) =>
      !p.downUntil && !p.fusion && p.fuseAt !== null && now - p.fuseAt <= FUSE_WINDOW,
  );
  for (let i = 0; i < ready.length; i++)
    for (let j = i + 1; j < ready.length; j++) {
      const [a, b] = [ready[i], ready[j]];
      if (a.fusion || b.fusion) continue;
      if (dist(a.position, b.position) > FUSE_RANGE) continue;
      // Whoever asked first drives; the other becomes the gunner.
      if (a.fuseAt <= b.fuseAt) startFusion(world, a, b, now);
      else startFusion(world, b, a, now);
      changed = true;
    }

  const alive = pilots.filter(targetable);
  if (stomp(world, pilots)) changed = true;

  // Planet hazards.
  for (const p of alive)
    if (inLava(world.planet, p.position)) {
      p.burn += LAVA_DPS * dt;
      const dmg = Math.floor(p.burn);
      if (dmg) {
        p.burn -= dmg;
        damagePilot(world, p, dmg, now);
        changed = true;
      }
    } else p.burn = 0;
  if (planetOf(world.planet).lightning) {
    if (!world.nextStrikeAt) world.nextStrikeAt = now + 3000;
    if (now >= world.nextStrikeAt) {
      const near = alive[Math.floor(world.random() * alive.length)];
      const base = near ? near.position : [0, 0, -20];
      world.strikes.push({
        id: world.nextId++,
        p: [
          clamp(base[0] + (world.random() - 0.5) * 16, -60, 60),
          0,
          clamp(base[2] + (world.random() - 0.5) * 16, -80, 60),
        ],
        at: now + STRIKE_WARNING * 1000,
      });
      world.nextStrikeAt = now + 2500 + world.random() * 2500;
      changed = true;
    }
    world.strikes = world.strikes.filter((st) => {
      if (now < st.at) return true;
      for (const p of alive)
        if (!p.downUntil && Math.hypot(p.position[0] - st.p[0], p.position[2] - st.p[2]) < STRIKE_RADIUS)
          damagePilot(world, p, STRIKE_DAMAGE, now);
      for (const e of world.enemies)
        if (e.hp > 0 && Math.hypot(e.pos[0] - st.p[0], e.pos[2] - st.p[2]) < STRIKE_RADIUS) hurtEnemy(world, e, 2, null);
      event(world, "strike", st.p);
      changed = true;
      return false;
    });
  }

  for (const e of world.enemies) {
    if (e.hp <= 0) continue;
    changed = true;
    const T = typeOf(e);
    let target = null,
      best = Infinity;
    for (const p of alive) {
      const k = dist(centerOf(e), chest(p));
      if (k < best) [best, target] = [k, p];
    }
    if (!target) continue;
    // Each enemy holds its own bearing around the target so groups spread out;
    // orbiting types sweep around it over time.
    const a = e.slot * 2.4 + (T.orbit ? now / (e.type === "vehicle" ? 2500 : 4000) : now / 20000);
    const goal = [
      target.position[0] + Math.sin(a) * T.keep,
      T.fly ? 3 + Math.sin(now / 600 + e.slot) * 0.6 : 0,
      target.position[2] + Math.cos(a) * T.keep,
    ];
    const gap = dist(goal, e.pos);
    const move = Math.min(gap, T.speed * dt);
    if (gap > 0.01) {
      for (let i = 0; i < 3; i++) e.pos[i] += ((goal[i] - e.pos[i]) / gap) * move;
      if (move > 0.01) e.heading = Math.atan2(-(goal[0] - e.pos[0]), -(goal[2] - e.pos[2]));
    }
    e.pos[0] = clamp(e.pos[0], -65, 65);
    e.pos[2] = clamp(e.pos[2], -85, 65);
    e.aim = Math.atan2(-(target.position[0] - e.pos[0]), -(target.position[2] - e.pos[2]));
    if (gap < 1) e.heading = e.aim;
    if (e.burstLeft > 0) {
      e.burstTimer -= dt;
      if (e.burstTimer <= 0) {
        shoot(world, e, target);
        e.burstLeft--;
        e.burstTimer = T.burstGap;
        if (!e.burstLeft) e.cooldown = T.cooldown[0] + world.random() * (T.cooldown[1] - T.cooldown[0]);
      }
    } else {
      e.cooldown -= dt;
      if (e.cooldown <= 0 && best < T.range) {
        e.burstLeft = T.burst;
        e.burstTimer = 0;
      }
    }
  }

  const steps = 4,
    h = dt / steps;
  world.bolts = world.bolts.filter((b) => {
    for (let i = 0; i < steps && b.life > 0; i++) {
      for (let a = 0; a < 3; a++) b.pos[a] += b.dir[a] * b.speed * h;
      b.life -= h;
      const hit = alive.find(
        (p) => targetable(p) && dist(b.pos, chest(p)) < PILOT_RADIUS * sizeOf(p),
      );
      if (hit) {
        damagePilot(world, hit, b.damage, now);
        event(world, "hit", b.pos);
        b.life = 0;
      }
    }
    if (world.bolts.length) changed = true;
    return b.life > 0;
  });

  // Sub-steps keep 60 u/s bullets from tunnelling through targets and enemies.
  world.shots = world.shots.filter((s) => {
    for (let i = 0; i < steps && s.life > 0; i++) {
      for (let a = 0; a < 3; a++) s.pos[a] += s.dir[a] * (s.speed || BULLET_SPEED) * h;
      s.life -= h;
      const credit = pilots.includes(s.by);
      const t = world.targets.find((t) => t.hp > 0 && hitsTarget(s.pos, t));
      const d =
        !t &&
        world.enemies.find((e) => e.hp > 0 && dist(s.pos, centerOf(e)) < typeOf(e).radius);
      const rival =
        world.pvp &&
        !t &&
        !d &&
        alive.find(
          (p) =>
            p !== s.by &&
            !(s.by.fusion && p.fusion === s.by.fusion) &&
            targetable(p) &&
            dist(s.pos, chest(p)) < PILOT_RADIUS * sizeOf(p),
        );
      if (t) {
        hurtTarget(world, t, s.damage, credit ? s.by : null);
      } else if (d) {
        hurtEnemy(world, d, s.damage, credit ? s.by : null);
      } else if (rival) {
        if (damagePilot(world, rival, s.damage * PVP_DAMAGE, now) && credit)
          s.by.score += PVP_KO_SCORE;
      }
      if (t || d || rival) {
        if (!(t && !t.hp) && !(d && !d.hp)) event(world, "hit", s.pos);
        if (s.kind === "cannon" || s.kind === "rocket") {
          s.exploded = true;
          blast(world, s.pos, credit ? s.by : null, pilots);
        }
        s.life = 0;
        changed = true;
      }
    }
    if ((s.kind === "cannon" || s.kind === "rocket") && s.life <= 0 && !s.exploded) {
      s.exploded = true;
      blast(world, s.pos, pilots.includes(s.by) ? s.by : null, pilots);
    }
    return s.life > 0;
  });

  if (
    !world.waveAt &&
    world.targets.every((t) => !t.hp) &&
    world.enemies.every((e) => e.hp <= 0)
  ) {
    world.waveAt = now + WAVE_DELAY;
    changed = true;
  }
  if (world.events.length) changed = true;
  return changed;
}

const r2 = (v) => Math.round(v * 100) / 100;
export function view(world) {
  return {
    targets: world.targets.map((t) => t.hp),
    enemies: world.enemies
      .filter((e) => e.hp > 0)
      .map((e) => ({ id: e.id, t: e.type, p: e.pos.map(r2), hp: e.hp, h: r2(e.heading), a: r2(e.aim) })),
    bolts: world.bolts.map((b) => ({ id: b.id, p: b.pos.map(r2), k: b.kind })),
    drops: world.drops.map((d) => ({ id: d.id, type: d.type, p: d.p.map(r2) })),
    wave: world.wave,
    cleared: Boolean(world.waveAt),
    pvp: world.pvp,
    planet: world.planet,
    strikes: world.strikes.map((st) => ({ id: st.id, p: st.p })),
  };
}
