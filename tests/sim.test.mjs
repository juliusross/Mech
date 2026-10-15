import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  createPilot,
  fire,
  step,
  view,
  enemyCount,
  MAX_ARMOR,
  BOLT_DAMAGE,
  RESPAWN_MS,
} from "../shared/sim.js";

const fixed = () => 0.5;
function run(world, pilots, seconds, start = 0) {
  let now = start;
  for (let t = 0; t < seconds; t += 0.05) {
    now += 50;
    step(world, pilots, 0.05, now);
  }
  return now;
}

test("enemies hunt the nearest pilot and their fire wears down armor", () => {
  const world = createWorld(fixed);
  assert.equal(world.enemies.length, enemyCount(1));
  const pilot = createPilot([0, 0, 8]);
  run(world, [pilot], 12);
  assert.ok(pilot.armor < MAX_ARMOR, "pilot took damage");
  for (const d of world.enemies.filter((e) => e.type === "drone")) {
    const gap = Math.hypot(d.pos[0] - 0, d.pos[2] - 8);
    assert.ok(gap < 25, `drone ${d.id} closed in (${gap.toFixed(1)})`);
  }
});

test("large enemy defeats create a shared drop that only one pilot collects", () => {
  const world = createWorld(() => 0.5);
  const a = createPilot([0, 0, 8]);
  const b = createPilot([0, 0, 8]);
  const enemy = world.enemies[0];
  enemy.type = "tank";
  enemy.hp = 1;
  enemy.pos = [0, 0, -4];
  world.enemies = [enemy];
  world.random = () => 0.4; // below the tank drop chance; picks DROP_TYPES[2]
  fire(world, a, [0, 1.4, 4], [0, 0, -1]);
  for (let now = 50; now <= 300; now += 50) step(world, [a, b], 0.05, now);
  assert.equal(enemy.hp, 0);
  assert.equal(world.drops.length, 1);
  a.position = [...world.drops[0].p];
  b.position = [...world.drops[0].p];
  step(world, [a, b], 0.05, 350);
  assert.equal(world.drops.length, 0);
  assert.equal(a.special?.type, "cannon");
  assert.equal(b.special, null);
  assert.equal(view(world).drops.length, 0);
});

test("special weapons use charge or time instead of base ammunition", () => {
  const world = createWorld(() => 0.5);
  const pilot = createPilot([0, 0, 8]);
  world.enemies = [];
  pilot.special = { type: "shotgun", ammo: 2, until: 0 };
  assert.equal(fire(world, pilot, [0, 3, 8], [0, 0, -1]), "shotgun");
  assert.equal(world.shots.length, 8);
  assert.equal(pilot.special.ammo, 1);
  fire(world, pilot, [0, 3, 8], [0, 0, -1]);
  assert.equal(pilot.special, null);
  pilot.special = { type: "laser", ammo: 2, until: 0 };
  assert.equal(fire(world, pilot, [0, 3, 8], [0, 0, -1]), "laser");
  assert.equal(pilot.special, null);
  assert.ok(world.events.some((event) => event.kind === "beam"));
  pilot.special = { type: "sword", ammo: 0, until: 1000 };
  step(world, [pilot], 0.05, 900);
  assert.equal(fire(world, pilot, [0, 3, 8], [0, 0, -1]), "sword");
  step(world, [pilot], 0.05, 1000);
  assert.equal(pilot.special, null);
});

test("laser beam damages the first enemy and armor shield absorbs incoming damage", () => {
  const world = createWorld(() => 0.5);
  const pilot = createPilot([0, 0, 8]);
  const enemy = world.enemies[0];
  enemy.pos = [0, 3, -6];
  world.enemies = [enemy];
  world.targets = [];
  pilot.special = { type: "laser", ammo: 4, until: 0 };
  fire(world, pilot, [0, 3, 4], [0, 0, -1]);
  assert.equal(enemy.hp, 3);
  assert.equal(pilot.special.ammo, 2);
  pilot.shield = 45;
  world.bolts = [{ id: 10, pos: [0, 3, 9], dir: [0, 0, -1], life: 2, damage: 6, speed: 24 }];
  step(world, [pilot], 0.05, 50);
  assert.equal(pilot.armor, 100);
  assert.equal(pilot.shield, 39);
});

test("special weapons can hit opponents only in versus worlds", () => {
  for (const pvp of [false, true]) {
    const world = createWorld(() => 0.5, { pvp });
    world.enemies = [];
    world.targets = [];
    const shooter = createPilot([0, 0, 8]);
    const rival = createPilot([0, 0, -4]);
    shooter.special = { type: "laser", ammo: 4, until: 0 };
    fire(world, shooter, [0, 3, 6], [0, 0, -1], [shooter, rival]);
    assert.equal(rival.armor, pvp ? 95 : 100);
  }
});

test("explosive cannon damages nearby enemies beyond the direct hit", () => {
  const world = createWorld(() => 0.5);
  const pilot = createPilot([0, 0, 8]);
  const [first, second] = world.enemies;
  Object.assign(first, { type: "tank", hp: 12, pos: [0, 0, -5] });
  Object.assign(second, { type: "tank", hp: 12, pos: [3, 0, -5] });
  world.enemies = [first, second];
  pilot.special = { type: "cannon", ammo: 1, until: 0 };
  fire(world, pilot, [0, 1.4, 4], [0, 0, -1]);
  for (let now = 50; now <= 500; now += 50) step(world, [pilot], 0.05, now);
  assert.ok(first.hp < 12);
  assert.ok(second.hp < 12);
  assert.equal(pilot.special, null);
});

test("a pilot at zero armor goes down, is ignored, then reboots at spawn", () => {
  const world = createWorld(fixed);
  const pilot = createPilot([4, 0, 8]);
  pilot.armor = BOLT_DAMAGE;
  pilot.position = [30, 0, -20];
  let now = 0;
  while (!pilot.downUntil && now < 60000) now = run(world, [pilot], 0.05, now);
  assert.ok(pilot.downUntil, "pilot went down");
  assert.equal(pilot.armor, 0);
  const boltsBefore = world.bolts.length;
  now = run(world, [pilot], 1, now);
  assert.equal(pilot.armor, 0, "downed pilot takes no further damage");
  assert.ok(world.bolts.length <= boltsBefore, "drones stop firing at a downed pilot");
  now = run(world, [pilot], RESPAWN_MS / 1000, now);
  assert.equal(pilot.downUntil, 0);
  assert.equal(pilot.armor, MAX_ARMOR);
  assert.deepEqual(pilot.position, [4, 0, 8]);
  assert.equal(pilot.respawns, 1);
});

test("shots destroy drones for two points and waves need enemies cleared too", () => {
  const world = createWorld(fixed);
  const pilot = createPilot([0, 0, 8]);
  for (const t of world.targets) t.hp = 0;
  const first = world.enemies.find((e) => e.type === "drone");
  const rest = world.enemies.filter((e) => e !== first);
  first.pos = [0, 2.5, -10];
  for (const d of rest) d.hp = 0;
  let now = 0;
  for (let i = 0; i < 4; i++) {
    first.pos = [0, 2.5, -10];
    fire(world, pilot, [0, 2.5, 0], [0, 0, -1]);
    now = run(world, [pilot], 0.3, now);
  }
  assert.equal(first.hp, 0);
  assert.equal(pilot.score, 2);
  assert.ok(world.waveAt, "wave cleared");
  assert.equal(view(world).cleared, true);
  now = run(world, [pilot], 4.1, now);
  assert.equal(world.wave, 2);
  assert.equal(view(world).enemies.length, enemyCount(2));
  assert.ok(view(world).targets.every((hp) => hp === 3));
});

test("targets alone do not clear a wave while enemies remain", () => {
  const world = createWorld(fixed);
  for (const t of world.targets) t.hp = 0;
  step(world, [], 0.05, 50);
  assert.equal(world.waveAt, 0);
});

import { repair, setClass, drainEvents, PVP_DAMAGE, PVP_KO_SCORE } from "../shared/sim.js";
import { CLASSES, REPAIR_AMOUNT } from "../shared/arena.js";

test("classes set armor, and heavy shots deal double damage", () => {
  const world = createWorld(fixed);
  world.enemies = [];
  const heavy = createPilot([0, 0, 8], "heavy");
  const scout = createPilot([4, 0, 8], "scout");
  assert.equal(heavy.armor, CLASSES.heavy.armor);
  assert.equal(scout.armor, CLASSES.scout.armor);
  assert.equal(createPilot([0, 0, 0], "wizard").cls, "assault");
  // Target 1 sits at x = -4.5, z = -15 with 3 hp: two heavy shots destroy it.
  for (let i = 0; i < 2; i++) {
    fire(world, heavy, [-4.5, 2.5, -6], [0, 0, -1]);
    run(world, [heavy], 0.4, i * 400);
  }
  assert.equal(world.targets[1].hp, 0);
  assert.equal(heavy.score, 1);
  heavy.armor = CLASSES.heavy.armor / 2;
  setClass(heavy, "scout");
  assert.equal(heavy.armor, CLASSES.scout.armor / 2, "switching keeps the armor percentage");
});

test("support repair heals nearby pilots and then cools down", () => {
  const world = createWorld(fixed);
  const medic = createPilot([0, 0, 8], "support");
  const near = createPilot([6, 0, 8]);
  const far = createPilot([40, 0, 8]);
  medic.armor = 10;
  near.armor = 50;
  far.armor = 50;
  assert.equal(repair(world, medic, [medic, near, far], 1000), true);
  assert.equal(medic.armor, 10 + REPAIR_AMOUNT);
  assert.equal(near.armor, 50 + REPAIR_AMOUNT);
  assert.equal(far.armor, 50);
  assert.equal(repair(world, medic, [medic, near, far], 2000), false, "cooling down");
  assert.equal(repair(world, near, [near], 1000), false, "only support can repair");
  assert.deepEqual(drainEvents(world).map((e) => e.kind), ["repair"]);
  assert.equal(drainEvents(world).length, 0);
});

test("versus rooms let pilots damage and down each other; co-op rooms do not", () => {
  for (const pvp of [false, true]) {
    const world = createWorld(fixed, { pvp });
    world.enemies = [];
    world.targets = [];
    const a = createPilot([0, 0, 8]);
    const b = createPilot([0, 0, -2]);
    b.armor = PVP_DAMAGE;
    fire(world, a, [0, 2.5, 6], [0, 0, -1]);
    run(world, [a, b], 0.5);
    if (pvp) {
      assert.equal(b.armor, 0);
      assert.ok(b.downUntil);
      assert.equal(a.score, PVP_KO_SCORE);
      assert.ok(drainEvents(world).some((e) => e.kind === "down"));
    } else {
      assert.equal(b.armor, PVP_DAMAGE);
      assert.equal(a.score, 0);
    }
  }
});

test("destroying things emits explosion events", () => {
  const world = createWorld(fixed);
  world.enemies = [];
  const pilot = createPilot([0, 0, 8]);
  world.targets[1].hp = 1;
  fire(world, pilot, [-4.5, 2.5, -6], [0, 0, -1]);
  run(world, [pilot], 0.4);
  const kinds = drainEvents(world).map((e) => e.kind);
  assert.ok(kinds.includes("boom"));
});

import { requestFuse, sizeOf } from "../shared/sim.js";
import {
  LAVA_DPS,
  STRIKE_DAMAGE,
  FUSE_DURATION,
  FUSE_COOLDOWN,
  FUSE_DAMAGE,
  FUSE_SCALE,
} from "../shared/planets.js";

test("lava on Ember burns pilots standing in it, but not elsewhere or on other planets", () => {
  for (const planet of ["ember", "proving"]) {
    const world = createWorld(fixed, { planet });
    world.enemies = [];
    const pilot = createPilot([-22, 0, -4]);
    const safe = createPilot([0, 0, 8]);
    run(world, [pilot, safe], 1);
    if (planet === "ember") assert.ok(MAX_ARMOR - pilot.armor >= LAVA_DPS - 1);
    else assert.equal(pilot.armor, MAX_ARMOR);
    assert.equal(safe.armor, MAX_ARMOR);
  }
  assert.equal(createWorld(fixed, { planet: "nowhere" }).planet, "proving");
});

test("lightning on Tempest warns first, then strikes pilots inside the zone", () => {
  const world = createWorld(fixed, { planet: "tempest" });
  world.enemies = [];
  const pilot = createPilot([0, 0, 8]);
  let now = run(world, [pilot], 3.1);
  assert.ok(world.strikes.length, "a warning zone appeared");
  const zone = world.strikes[0];
  pilot.position = [zone.p[0], 0, zone.p[2]];
  run(world, [pilot], 1.6, now);
  assert.equal(pilot.armor, MAX_ARMOR - STRIKE_DAMAGE);
});

test("two nearby pilots who both request fusion become one big Titan, then split", () => {
  const world = createWorld(fixed);
  world.enemies = [];
  const a = createPilot([0, 0, 8]);
  const b = createPilot([4, 0, 8], "heavy");
  const far = createPilot([40, 0, 8]);
  assert.ok(requestFuse(world, a, 100));
  assert.ok(requestFuse(world, far, 150));
  step(world, [a, b, far], 0.05, 200);
  assert.equal(a.fusion, null, "needs a second nearby request");
  requestFuse(world, b, 300);
  step(world, [a, b, far], 0.05, 350);
  assert.ok(a.fusion && a.fusion === b.fusion);
  assert.equal(a.fusion.driver, a, "first to ask drives");
  assert.equal(far.fusion, null);
  assert.equal(a.fusion.armor, 100 + 160);
  assert.equal(sizeOf(a), FUSE_SCALE);
  a.position = [10, 0, 0];
  step(world, [a, b, far], 0.05, 400);
  assert.deepEqual(b.position, [10, 0, 0], "gunner rides with the driver");
  fire(world, b, [10, 2.5, -1], [0, 0, -1]);
  assert.equal(world.shots.at(-1).damage, CLASSES.heavy.damage * FUSE_DAMAGE);
  a.fusion.armor = 130; // took half damage
  step(world, [a, b, far], 0.05, 350 + FUSE_DURATION);
  assert.equal(a.fusion, null);
  assert.equal(a.armor, 50);
  assert.equal(b.armor, 80);
  assert.notDeepEqual(b.position, a.position, "gunner pops out beside the driver");
  assert.equal(requestFuse(world, a, 400 + FUSE_DURATION), false, "cooldown");
  assert.ok(a.fuseReadyAt >= 350 + FUSE_DURATION + FUSE_COOLDOWN);
});

test("a fused Titan destroyed by damage downs both pilots", () => {
  const world = createWorld(fixed);
  world.enemies = [];
  const a = createPilot([0, 0, 8]);
  const b = createPilot([2, 0, 8]);
  requestFuse(world, a, 0);
  requestFuse(world, b, 10);
  step(world, [a, b], 0.05, 20);
  a.fusion.armor = BOLT_DAMAGE;
  world.bolts.push({ id: 999, pos: [0, 3, 6], dir: [0, 0, 1], life: 1, damage: BOLT_DAMAGE, speed: 24 });
  step(world, [a, b], 0.1, 60);
  assert.ok(a.downUntil && b.downUntil);
  assert.equal(a.fusion, null);
});

import { ENEMY_TYPES, waveRoster } from "../shared/enemies.js";

test("waves bring a growing mix of drones, infantry, buggies, tanks and mechs", () => {
  assert.deepEqual(waveRoster(1), { drone: 3, soldier: 4, vehicle: 0, tank: 0, mech: 0 });
  const w3 = waveRoster(3);
  for (const type of Object.keys(ENEMY_TYPES)) assert.ok(w3[type] > 0, `${type} appears by wave 3`);
  const world = createWorld(fixed);
  world.wave = 3;
  world.waveAt = 1;
  step(world, [], 0.05, 2);
  const types = new Set(world.enemies.map((e) => e.type));
  assert.equal(types.size, Object.keys(ENEMY_TYPES).length);
  const v = view(world).enemies[0];
  assert.ok("t" in v && "h" in v && "a" in v, "view carries type and headings");
});

test("each enemy type fires its own projectile and is destroyed by its own hit points", () => {
  for (const [type, T] of Object.entries(ENEMY_TYPES)) {
    const world = createWorld(fixed);
    world.targets = [];
    const pilot = createPilot([0, 0, 8]);
    world.enemies = [
      { id: 1, type, slot: 0, pos: [0, T.fly ? 3 : 0, -10], hp: T.hp, heading: 0, aim: 0, cooldown: 0, burstLeft: 0, burstTimer: 0 },
    ];
    step(world, [pilot], 0.01, 10);
    step(world, [pilot], 0.01, 20);
    assert.ok(world.bolts.length, `${type} fired`);
    assert.equal(world.bolts[0].kind, T.bolt);
    assert.equal(world.bolts[0].damage, T.damage);
    world.bolts = [];
    const enemy = world.enemies[0];
    enemy.cooldown = 99;
    enemy.burstLeft = 0;
    let now = 30;
    for (let i = 0; i < T.hp; i++) {
      const c = [enemy.pos[0], enemy.pos[1] + T.center, enemy.pos[2]];
      fire(world, pilot, [c[0], c[1], c[2] + 6], [0, 0, -1]);
      now = run(world, [pilot], 0.3, now);
    }
    assert.equal(enemy.hp, 0, `${type} destroyed after ${T.hp} hits`);
    assert.equal(pilot.score, T.score);
  }
});

import { setWeapon, DROP_CHANCE } from "../shared/sim.js";
import { WEAPONS } from "../shared/arena.js";

test("drop chance rises with enemy size and is random", () => {
  assert.ok(DROP_CHANCE.soldier < DROP_CHANCE.vehicle && DROP_CHANCE.vehicle < DROP_CHANCE.tank);
  for (const [type, chance] of Object.entries(DROP_CHANCE)) {
    for (const roll of [chance - 0.01, chance + 0.01]) {
      const world = createWorld(() => 0.5);
      const pilot = createPilot([0, 0, 8]);
      world.targets = [];
      const e = { id: 1, type, slot: 0, pos: [0, ENEMY_TYPES[type].fly ? 3 : 0, -10], hp: 0.5, heading: 0, aim: 0, cooldown: 99, burstLeft: 0, burstTimer: 0 };
      world.enemies = [e];
      world.random = () => roll;
      const c = [e.pos[0], e.pos[1] + ENEMY_TYPES[type].center, e.pos[2]];
      fire(world, pilot, [c[0], c[1], c[2] + 5], [0, 0, -1]);
      run(world, [pilot], 0.3);
      assert.equal(e.hp, 0);
      assert.equal(world.drops.length, roll < chance ? 1 : 0, `${type} at roll ${roll}`);
    }
  }
});

test("walking a Titan over infantry crushes them with a splat", () => {
  const world = createWorld(fixed);
  world.targets = [];
  const pilot = createPilot([0, 0, 8]);
  const soldier = { id: 1, type: "soldier", slot: 0, pos: [0.8, 0, 8.5], hp: 1, heading: 0, aim: 0, cooldown: 99, burstLeft: 0, burstTimer: 0 };
  const tank = { id: 2, type: "tank", slot: 1, pos: [0.5, 0, 7.5], hp: 12, heading: 0, aim: 0, cooldown: 99, burstLeft: 0, burstTimer: 0 };
  world.enemies = [soldier, tank];
  step(world, [pilot], 0.01, 10);
  assert.equal(soldier.hp, 0);
  assert.equal(tank.hp, 12, "only infantry can be stepped on");
  assert.equal(pilot.score, ENEMY_TYPES.soldier.score);
  assert.ok(drainEvents(world).some((e) => e.kind === "splat"));
  // Flying over them does nothing.
  soldier.hp = 1;
  pilot.position = [0.8, 6, 8.5];
  step(world, [pilot], 0.01, 20);
  assert.equal(soldier.hp, 1);
});

test("loadout weapons change damage, speed and explosions", () => {
  for (const [id, w] of Object.entries(WEAPONS)) {
    const world = createWorld(fixed);
    const pilot = createPilot([0, 0, 8]);
    setWeapon(pilot, id);
    assert.equal(pilot.weapon, id);
    fire(world, pilot, [0, 3, 0], [0, 0, -1]);
    const shot = world.shots.at(-1);
    assert.equal(shot.damage, w.damage);
    assert.equal(shot.kind, w.kind);
  }
  const p = createPilot([0, 0, 0]);
  setWeapon(p, "laser-sword");
  assert.equal(p.weapon, "plasma", "unknown loadouts are ignored");
});

import { solidsFor, solidAt, pushOut, arenaStructures } from "../shared/obstacles.js";
import { PLANET_IDS } from "../shared/planets.js";

test("every planet has solid structures, including cover in the combat zone", () => {
  for (const planet of PLANET_IDS) {
    const solids = solidsFor(planet);
    assert.ok(solids.boxes.length > 30, `${planet} has structures`);
    const cover = arenaStructures(planet);
    assert.ok(cover.length >= 15, `${planet} has arena cover`);
    for (const c of cover) assert.ok(Math.hypot(c.x, c.z - 8) >= 22, "spawn stays clear");
  }
});

test("scattered targets change each wave and never sit inside structures", () => {
  const world = createWorld(Math.random, { scatter: true });
  const first = world.targets.map((t) => `${t.x},${t.z}`).join(";");
  assert.equal(world.targets.length, 12);
  for (const t of world.targets) assert.equal(solidAt(world.solids, t.x, 1, t.z), null);
  assert.equal(view(world).targetPos.length, 12);
  world.waveAt = 1;
  step(world, [], 0.05, 2);
  assert.notEqual(world.targets.map((t) => `${t.x},${t.z}`).join(";"), first);
});

test("structures stop shots and enemy fire, and push movers out", () => {
  const world = createWorld(fixed);
  world.enemies = [];
  world.targets = [];
  const wall = world.solids.boxes.find((b) => !b.low && b.h > 3 && Math.abs((b.x0 + b.x1) / 2) < 140);
  const cx = (wall.x0 + wall.x1) / 2,
    cz = (wall.z0 + wall.z1) / 2;
  const pilot = createPilot([cx, 0, wall.z1 + 12]);
  fire(world, pilot, [cx, 1.5, wall.z1 + 6], [0, 0, -1]);
  run(world, [pilot], 0.3);
  assert.equal(world.shots.length, 0, "shot stopped at the wall");
  assert.ok(drainEvents(world).some((e) => e.kind === "hit"));
  world.bolts.push({ id: 9, pos: [cx, 1.5, wall.z0 - 6], dir: [0, 0, 1], life: 2, damage: 50, speed: 24 });
  run(world, [pilot], 1);
  assert.equal(pilot.armor, MAX_ARMOR, "pilot behind cover was not hit");
  const [x, z] = pushOut(world.solids, cx, cz, 1.5, 0);
  assert.equal(solidAt(world.solids, x, 1, z), null, "pushed outside");
  const [fx, fz] = pushOut(world.solids, cx, cz, 1.5, wall.y0 + wall.h + 1);
  assert.deepEqual([fx, fz], [cx, cz], "flying over is allowed");
});
