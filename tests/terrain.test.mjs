import test from "node:test";
import assert from "node:assert/strict";
import { terrainHeight, WORLD_EDGE } from "../shared/terrain.js";
import { createPilot, toggleMech } from "../shared/sim.js";

test("the original arena remains level while the expanded map has climbable hills", () => {
  for (const planet of ["proving", "ember", "cryo", "selene", "tempest", "verdant"]) {
    assert.equal(terrainHeight(planet, 0, 0), 0);
    assert.equal(terrainHeight(planet, 65, -85), 0);
    const hill = terrainHeight(planet, -325, -315);
    assert.ok(hill > 10, `${planet} has a substantial outer hill`);
    assert.ok(hill < 50, `${planet} hill remains below flight ceiling`);
    assert.ok(terrainHeight(planet, -WORLD_EDGE, -315) >= 0);
  }
});

test("a pilot can leave and re-enter a Titan parked on a hillside", () => {
  const x = -325, z = -315;
  const y = terrainHeight("cryo", x, z);
  const pilot = createPilot([x, y, z]);
  assert.equal(toggleMech(pilot, 0, "cryo"), true);
  assert.equal(pilot.position[1], terrainHeight("cryo", pilot.position[0], pilot.position[2]));
  assert.equal(toggleMech(pilot, 0, "cryo"), true);
  assert.deepEqual(pilot.position, [x, y, z]);
});
