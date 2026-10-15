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

export const MAX_ARMOR = 100;
export const BOLT_DAMAGE = 6;
export const RESPAWN_MS = 3000;
export const WAVE_DELAY = 4000;
// In versus rooms one point of cannon damage removes this much armor.
export const PVP_DAMAGE = 5;
export const PVP_KO_SCORE = 5;
const DRONE_HP = 4;
const DRONE_SPEED = 7;
const DRONE_RANGE = 45;
const DRONE_RADIUS = 1.8;
const ORBIT = 16;
const BOLT_SPEED = 24;
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
  return classOf(p.cls).scale * (p.fusion?.driver === p ? FUSE_SCALE : 1);
}
// A fused gunner rides inside the driver's Titan, so only the driver is hit.
const targetable = (p) => !p.downUntil && !isGunner(p);

export function createPilot(spawn, cls = "assault") {
  return {
    position: [...spawn],
    spawn: [...spawn],
    cls: CLASSES[cls] ? cls : "assault",
    armor: classOf(cls).armor,
    downUntil: 0,
    respawns: 0,
    score: 0,
    repairAt: 0,
    fusion: null,
    fuseAt: null,
    fuseReadyAt: 0,
    burn: 0,
  };
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
    wave: 1,
    waveAt: 0,
    targets: [],
    drones: [],
    bolts: [],
    shots: [],
    events: [],
  };
  startWave(world);
  return world;
}

export const droneCount = (wave) => Math.min(2 + wave, 8);

function startWave(world) {
  world.targets = TARGETS.map((t) => ({ ...t, hp: TARGET_HP }));
  const n = droneCount(world.wave);
  world.drones = Array.from({ length: n }, (_, i) => ({
    id: world.nextId++,
    slot: i,
    pos: [((i + 0.5) / n - 0.5) * 90, 3, -72],
    hp: DRONE_HP,
    cooldown: 2 + world.random() * 2,
  }));
  world.bolts = [];
}

const event = (world, kind, pos) =>
  world.events.push({ id: world.nextId++, kind, p: pos.map((v) => Math.round(v * 100) / 100) });

/** Returns and clears the effect events (hits, explosions, repairs, downs). */
export function drainEvents(world) {
  const events = world.events;
  world.events = [];
  return events;
}

export function fire(world, pilot, origin, dir) {
  world.shots.push({
    id: world.nextId++,
    by: pilot,
    damage: classOf(pilot.cls).damage * (isGunner(pilot) ? FUSE_DAMAGE : 1),
    pos: [...origin],
    dir: [...dir],
    life: BULLET_LIFE,
  });
}

/** Support pulse: repairs the caster and every active pilot in range. */
export function repair(world, pilot, pilots, now) {
  if (!classOf(pilot.cls).repair || pilot.downUntil || now < pilot.repairAt)
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
  if (pilot.fusion || pilot.downUntil || now < pilot.fuseReadyAt) return false;
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
  f.gunner.position = [Math.max(-65, Math.min(65, d[0] + 3.5)), d[1], d[2]];
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
  p.armor = Math.max(0, p.armor - amount);
  if (p.armor) return false;
  p.downUntil = now + RESPAWN_MS;
  event(world, "down", chest(p));
  return true;
}

export function step(world, pilots, dt, now) {
  let changed = false;
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
      for (const d of world.drones)
        if (d.hp > 0 && Math.hypot(d.pos[0] - st.p[0], d.pos[2] - st.p[2]) < STRIKE_RADIUS) d.hp = Math.max(0, d.hp - 2);
      event(world, "strike", st.p);
      changed = true;
      return false;
    });
  }

  for (const d of world.drones) {
    if (d.hp <= 0) continue;
    changed = true;
    let target = null,
      best = Infinity;
    for (const p of alive) {
      const k = dist(d.pos, chest(p));
      if (k < best) [best, target] = [k, p];
    }
    if (!target) continue;
    // Each drone circles its target at its own angle so the swarm spreads out.
    const a = d.slot * 2.4 + now / 4000;
    const goal = [
      target.position[0] + Math.sin(a) * ORBIT,
      3 + Math.sin(now / 600 + d.slot) * 0.6,
      target.position[2] + Math.cos(a) * ORBIT,
    ];
    const gap = dist(goal, d.pos);
    const move = Math.min(gap, DRONE_SPEED * dt);
    if (gap > 0.01)
      for (let i = 0; i < 3; i++) d.pos[i] += ((goal[i] - d.pos[i]) / gap) * move;
    d.pos[0] = clamp(d.pos[0], -65, 65);
    d.pos[2] = clamp(d.pos[2], -85, 65);
    d.cooldown -= dt;
    if (d.cooldown <= 0 && best < DRONE_RANGE) {
      d.cooldown = 2.4 + world.random() * 1.2;
      const aim = chest(target);
      const len = dist(aim, d.pos) || 1;
      world.bolts.push({
        id: world.nextId++,
        pos: [...d.pos],
        dir: aim.map((v, i) => (v - d.pos[i]) / len),
        life: BOLT_LIFE,
      });
    }
  }

  const steps = 4,
    h = dt / steps;
  world.bolts = world.bolts.filter((b) => {
    for (let i = 0; i < steps && b.life > 0; i++) {
      for (let a = 0; a < 3; a++) b.pos[a] += b.dir[a] * BOLT_SPEED * h;
      b.life -= h;
      const hit = alive.find(
        (p) => targetable(p) && dist(b.pos, chest(p)) < PILOT_RADIUS * sizeOf(p),
      );
      if (hit) {
        damagePilot(world, hit, BOLT_DAMAGE, now);
        event(world, "hit", b.pos);
        b.life = 0;
      }
    }
    if (world.bolts.length) changed = true;
    return b.life > 0;
  });

  // Sub-steps keep 60 u/s bullets from tunnelling through targets and drones.
  world.shots = world.shots.filter((s) => {
    for (let i = 0; i < steps && s.life > 0; i++) {
      for (let a = 0; a < 3; a++) s.pos[a] += s.dir[a] * BULLET_SPEED * h;
      s.life -= h;
      const credit = pilots.includes(s.by);
      const t = world.targets.find((t) => t.hp > 0 && hitsTarget(s.pos, t));
      const d =
        !t && world.drones.find((d) => d.hp > 0 && dist(s.pos, d.pos) < DRONE_RADIUS);
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
        t.hp = Math.max(0, t.hp - s.damage);
        if (!t.hp) {
          if (credit) s.by.score++;
          event(world, "boom", [t.x, 1.8, t.z]);
        }
      } else if (d) {
        d.hp = Math.max(0, d.hp - s.damage);
        if (!d.hp) {
          if (credit) s.by.score += 2;
          event(world, "boom", d.pos);
        }
      } else if (rival) {
        if (damagePilot(world, rival, s.damage * PVP_DAMAGE, now) && credit)
          s.by.score += PVP_KO_SCORE;
      }
      if (t || d || rival) {
        if (!(t && !t.hp) && !(d && !d.hp)) event(world, "hit", s.pos);
        s.life = 0;
        changed = true;
      }
    }
    return s.life > 0;
  });

  if (
    !world.waveAt &&
    world.targets.every((t) => !t.hp) &&
    world.drones.every((d) => d.hp <= 0)
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
    drones: world.drones
      .filter((d) => d.hp > 0)
      .map((d) => ({ id: d.id, p: d.pos.map(r2), hp: d.hp })),
    bolts: world.bolts.map((b) => ({ id: b.id, p: b.pos.map(r2) })),
    wave: world.wave,
    cleared: Boolean(world.waveAt),
    pvp: world.pvp,
    planet: world.planet,
    strikes: world.strikes.map((st) => ({ id: st.id, p: st.p })),
  };
}
