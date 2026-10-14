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
