import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  createPilot,
  fire,
  step,
  view,
  droneCount,
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

test("drones hunt the nearest pilot and their bolts wear down armor", () => {
  const world = createWorld(fixed);
  assert.equal(world.drones.length, droneCount(1));
  const pilot = createPilot([0, 0, 8]);
  run(world, [pilot], 12);
  assert.ok(pilot.armor < MAX_ARMOR, "pilot took damage");
  assert.equal((MAX_ARMOR - pilot.armor) % BOLT_DAMAGE, 0);
  for (const d of world.drones) {
    const gap = Math.hypot(d.pos[0] - 0, d.pos[2] - 8);
    assert.ok(gap < 25, `drone ${d.id} closed in (${gap.toFixed(1)})`);
  }
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

test("shots destroy drones for two points and waves need drones cleared too", () => {
  const world = createWorld(fixed);
  const pilot = createPilot([0, 0, 8]);
  for (const t of world.targets) t.hp = 0;
  const [first, ...rest] = world.drones;
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
  assert.equal(view(world).drones.length, droneCount(2));
  assert.ok(view(world).targets.every((hp) => hp === 3));
});

test("targets alone do not clear a wave while drones remain", () => {
  const world = createWorld(fixed);
  for (const t of world.targets) t.hp = 0;
  step(world, [], 0.05, 50);
  assert.equal(world.waveAt, 0);
});

import { repair, setClass, drainEvents, PVP_DAMAGE, PVP_KO_SCORE } from "../shared/sim.js";
import { CLASSES, REPAIR_AMOUNT } from "../shared/arena.js";

test("classes set armor, and heavy shots deal double damage", () => {
  const world = createWorld(fixed);
  world.drones = [];
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
    world.drones = [];
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
  world.drones = [];
  const pilot = createPilot([0, 0, 8]);
  world.targets[1].hp = 1;
  fire(world, pilot, [-4.5, 2.5, -6], [0, 0, -1]);
  run(world, [pilot], 0.4);
  const kinds = drainEvents(world).map((e) => e.kind);
  assert.ok(kinds.includes("boom"));
});
