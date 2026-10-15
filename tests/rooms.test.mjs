import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { once } from "node:events";
import { createRoomServer } from "../server/rooms.mjs";

const origin = "http://127.0.0.1:5174";
async function setup(t, options) {
  const server = createRoomServer({ origins: [origin], ...options });
  server.http.listen(0, "127.0.0.1");
  await once(server.http, "listening");
  t.after(() => server.close());
  const url = `ws://127.0.0.1:${server.http.address().port}/multiplayer`;
  async function connect(type, name, room) {
    const ws = new WebSocket(url, { origin });
    const queue = [],
      listeners = new Set();
    ws.on("message", (raw) => {
      queue.push(JSON.parse(raw));
      for (const f of listeners) f();
    });
    const wait = (predicate) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          listeners.delete(check);
          reject(new Error("Message timed out"));
        }, 2500);
        function check() {
          const index = queue.findIndex(predicate);
          if (index >= 0) {
            clearTimeout(timer);
            listeners.delete(check);
            resolve(queue.splice(index, 1)[0]);
          }
        }
        listeners.add(check);
        check();
      });
    await once(ws, "open");
    ws.send(JSON.stringify({ type, name, room }));
    return { ws, wait, send: (data) => ws.send(JSON.stringify(data)) };
  }
  return { server, connect, url };
}

test("room isolates players, relays movement, enforces four slots and cleans departures", async (t) => {
  const { server, connect } = await setup(t);
  const a = await connect("create", "Pilot Alpha");
  const aw = await a.wait((m) => m.type === "welcome");
  assert.match(aw.room, /^[A-F0-9]{12}$/);
  const b = await connect("join", "Pilot Bravo", aw.room.toLowerCase());
  const bw = await b.wait((m) => m.type === "welcome");
  const joined = await a.wait(
    (m) => m.type === "snapshot" && m.players.length === 2,
  );
  assert.equal(new Set(joined.players.map((p) => p.color)).size, 2);
  b.send({ type: "move", position: [5, 1, 8], heading: 1.2 });
  const moved = await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.players.some((p) => p.id === bw.id && p.position[1] === 1),
  );
  assert.equal(moved.players.find((p) => p.id === bw.id).heading, 1.2);
  const other = await connect("create", "Other room");
  const ow = await other.wait((m) => m.type === "welcome");
  assert.notEqual(ow.room, aw.room);
  const alone = await other.wait((m) => m.type === "snapshot");
  assert.equal(alone.players.length, 1);
  const c = await connect("join", "Charlie", aw.room);
  await c.wait((m) => m.type === "welcome");
  const d = await connect("join", "Delta", aw.room);
  await d.wait((m) => m.type === "welcome");
  const e = await connect("join", "Echo", aw.room);
  assert.match(
    (await e.wait((m) => m.type === "error")).message,
    /four pilots/,
  );
  const closed = once(b.ws, "close");
  b.ws.close();
  await closed;
  await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.players.length === 3 &&
      !m.players.some((p) => p.id === bw.id),
  );
  const replacement = await connect("join", "Replacement", aw.room);
  const rw = await replacement.wait((m) => m.type === "welcome");
  assert.equal(rw.color, bw.color);
  for (const client of [a, c, d, replacement, other]) {
    const ended = once(client.ws, "close");
    client.ws.close();
    await ended;
  }
  // Closing handshake completes before the final server close callback on some platforms.
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(server.rooms.size, 0);
});

test("invalid names, missing rooms, and room capacity return useful errors", async (t) => {
  const { connect } = await setup(t, { maxRooms: 1 });
  const invalid = await connect("create", " ");
  assert.match(
    (await invalid.wait((m) => m.type === "error")).message,
    /pilot name/,
  );
  const missing = await connect("join", "Pilot", "000000000000");
  assert.match(
    (await missing.wait((m) => m.type === "error")).message,
    /not found/,
  );
  const first = await connect("create", "Pilot");
  await first.wait((m) => m.type === "welcome");
  const overflow = await connect("create", "Pilot");
  assert.match(
    (await overflow.wait((m) => m.type === "error")).message,
    /server is full/,
  );
});

test("malformed and out-of-bounds movement cannot poison room state", async (t) => {
  const { connect, server } = await setup(t);
  const a = await connect("create", "Pilot");
  const welcome = await a.wait((m) => m.type === "welcome");
  a.send({ type: "move", position: [null, 0, 8], heading: 0 });
  a.send({ type: "move", position: [999, 0, 8], heading: 0 });
  a.send({ type: "move", position: [60, 0, 8], heading: 0 });
  a.send({ type: "move", position: [0, 0, 8], heading: null });
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(
    server.rooms.get(welcome.room).players.get(welcome.id).position,
    [0, 0, 8],
  );
  const closed = once(a.ws, "close");
  a.ws.send("{broken");
  const [code] = await closed;
  assert.equal(code, 1008);
});

test("unapproved origins are refused", async (t) => {
  const { url } = await setup(t);
  const ws = new WebSocket(url, { origin: "https://unrelated.example" });
  ws.on("error", () => {});
  const [, response] = await once(ws, "unexpected-response");
  assert.equal(response.statusCode, 403);
  response.resume();
  ws.terminate();
});

test("server-owned shots damage shared targets, score the destroyer, and respect ammo", async (t) => {
  const { connect, server } = await setup(t);
  const a = await connect("create", "Gunner");
  const aw = await a.wait((m) => m.type === "welcome");
  const b = await connect("join", "Spotter", aw.room);
  await b.wait((m) => m.type === "welcome");
  const room = server.rooms.get(aw.room);
  const player = room.players.get(aw.id);
  // Stand in front of target 1 (x = -4.5, z = -15) and fire three shots.
  player.position = [-4.5, 0, -5];
  for (let i = 0; i < 3; i++) {
    a.send({ type: "fire", origin: [-4.5, 2.5, -6], dir: [0, 0, -1] });
    await new Promise((r) => setTimeout(r, 170));
  }
  const tracer = await b.wait((m) => m.type === "shot");
  assert.deepEqual(tracer.dir, [0, 0, -1]);
  const done = await b.wait(
    (m) => m.type === "snapshot" && m.targets[1] === 0,
  );
  assert.equal(done.players.find((p) => p.id === aw.id).score, 1);
  assert.equal(done.players.find((p) => p.id === aw.id).ammo, 57);
  // Rapid fire beyond the cooldown and shots from far away are ignored.
  a.send({ type: "fire", origin: [-4.5, 2.5, -6], dir: [0, 0, -1] });
  a.send({ type: "fire", origin: [-4.5, 2.5, -6], dir: [0, 0, -1] });
  a.send({ type: "fire", origin: [40, 2.5, -6], dir: [0, 0, -1] });
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(player.ammo, 56);
  player.ammo = 0;
  await new Promise((r) => setTimeout(r, 170));
  a.send({ type: "fire", origin: [-4.5, 2.5, -6], dir: [0, 0, -1] });
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(player.ammo, 0);
  a.send({ type: "reload" });
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(player.ammo, 60);
});

test("clearing every target starts the next wave", async (t) => {
  const { connect, server } = await setup(t);
  const a = await connect("create", "Gunner");
  const aw = await a.wait((m) => m.type === "welcome");
  const room = server.rooms.get(aw.room);
  for (const target of room.world.targets) target.hp = 0;
  room.world.targets[0].hp = 1;
  for (const enemy of room.world.enemies) enemy.hp = 0;
  room.players.get(aw.id).position = [-13.5, 0, -5];
  a.send({ type: "fire", origin: [-13.5, 2.5, -6], dir: [0, 0, -1] });
  await a.wait((m) => m.type === "snapshot" && m.cleared);
  room.world.waveAt = Date.now();
  const next = await a.wait((m) => m.type === "snapshot" && m.wave === 2);
  assert.equal(next.cleared, false);
  assert.ok(next.targets.every((hp) => hp === 3));
});

test("pilots choose classes, versus is set at creation, and support can repair", async (t) => {
  const { connect, server } = await setup(t);
  const a = await connect("create", "Medic");
  a.ws.close();
  const ws = new WebSocket(`ws://127.0.0.1:${server.http.address().port}/multiplayer`, { origin });
  const q = [];
  ws.on("message", (raw) => q.push(JSON.parse(raw)));
  await once(ws, "open");
  ws.send(JSON.stringify({ type: "create", name: "Medic", cls: "support", pvp: true }));
  await new Promise((r) => setTimeout(r, 100));
  const welcome = q.find((m) => m.type === "welcome");
  assert.equal(welcome.pvp, true);
  const room = server.rooms.get(welcome.room);
  const me = room.players.get(welcome.id);
  assert.equal(me.cls, "support");
  me.armor = 20;
  ws.send(JSON.stringify({ type: "repair" }));
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(me.armor, 50);
  assert.ok(q.some((m) => m.type === "snapshot" && m.events?.some((e) => e.kind === "repair")));
  ws.send(JSON.stringify({ type: "class", cls: "heavy" }));
  ws.send(JSON.stringify({ type: "class", cls: "wizard" }));
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(me.cls, "heavy");
  const snap = q.findLast((m) => m.type === "snapshot");
  assert.equal(snap.players[0].cls, "heavy");
  assert.equal(snap.pvp, true);
  ws.close();
});

test("rooms carry a planet, pilots carry paint jobs, and two pilots can fuse", async (t) => {
  const { server } = await setup(t);
  const url = `ws://127.0.0.1:${server.http.address().port}/multiplayer`;
  async function pilot(msg) {
    const ws = new WebSocket(url, { origin });
    const q = [];
    ws.on("message", (raw) => q.push(JSON.parse(raw)));
    await once(ws, "open");
    ws.send(JSON.stringify(msg));
    await new Promise((r) => setTimeout(r, 120));
    return { ws, q, send: (d) => ws.send(JSON.stringify(d)) };
  }
  const a = await pilot({
    type: "create",
    name: "Driver",
    planet: "ember",
    paint: { primary: "#112233", visor: "javascript:alert(1)" },
  });
  const wa = a.q.find((m) => m.type === "welcome");
  assert.equal(wa.planet, "ember");
  const b = await pilot({ type: "join", name: "Gunner", room: wa.room });
  const wb = b.q.find((m) => m.type === "welcome");
  const room = server.rooms.get(wa.room);
  const pa = room.players.get(wa.id);
  assert.equal(pa.paint.primary, "#112233");
  assert.equal(pa.paint.visor, "#00d9ff", "invalid colours fall back to defaults");
  b.send({ type: "paint", paint: { primary: "#abcdef" } });
  a.send({ type: "fuse" });
  // Messages from different sockets can arrive in either order; ask in sequence.
  await new Promise((r) => setTimeout(r, 40));
  b.send({ type: "fuse" });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(room.players.get(wb.id).paint.primary, "#abcdef");
  assert.ok(pa.fusion, "fused");
  const snap = b.q.findLast((m) => m.type === "snapshot");
  const me = snap.players.find((p) => p.id === wb.id);
  assert.equal(me.fusion.role, "gunner");
  assert.equal(me.fusion.partner, wa.id);
  assert.equal(snap.planet, "ember");
  // The gunner's own movement is ignored while fused.
  b.send({ type: "move", position: [30, 0, 8], heading: 1 });
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(room.players.get(wb.id).position, pa.position);
  a.ws.close();
  b.ws.close();
});
