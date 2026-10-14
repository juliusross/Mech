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
