import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { MAX_AMMO, CLASSES, classOf, WEAPONS, weaponOf } from "../shared/arena.js";
import { PLANETS, cleanPaint } from "../shared/planets.js";
import { POWERUPS } from "../shared/powerups.js";
import { terrainHeight, WORLD_EDGE } from "../shared/terrain.js";
import {
  createWorld,
  createPilot,
  toggleMech,
  setClass,
  setWeapon,
  fire,
  repair,
  requestFuse,
  step,
  view,
  drainEvents,
} from "../shared/sim.js";

const COLORS = ["#e17b35", "#45c7b8", "#c68af0", "#f0c653"];
const CODE = /^[A-F0-9]{12}$/;
const finite = Number.isFinite;

export function createRoomServer({
  origins = ["http://127.0.0.1:5174", "http://localhost:5174"],
  maxRooms = 100,
} = {}) {
  const rooms = new Map();
  const http = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 2048,
    perMessageDeflate: false,
  });
  http.on("upgrade", (req, socket, head) => {
    if (
      req.url !== "/multiplayer" ||
      !origins.includes(req.headers.origin) ||
      wss.clients.size >= 200
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });
  const send = (ws, data) => {
    if (ws.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > 65536) {
        ws.terminate();
        return;
      }
      ws.send(JSON.stringify(data));
    }
  };
  const snapshot = (room) => ({
    type: "snapshot",
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      position: p.position,
      heading: p.heading,
      onFoot: p.onFoot,
      mechPosition: p.mechPosition,
      mechHeading: p.mechHeading,
      ammo: p.ammo,
      score: p.score,
      armor: p.armor,
      shield: p.shield,
      speedUntil: Math.max(0, p.speedUntil - Date.now()),
      special: p.special ? { ...p.special, until: Math.max(0, p.special.until - Date.now()) } : null,
      down: Boolean(p.downUntil),
      cls: p.cls,
      weapon: p.weapon,
      paint: p.paint,
      fusion: p.fusion
        ? {
            role: p.fusion.driver === p ? "driver" : "gunner",
            partner: (p.fusion.driver === p ? p.fusion.gunner : p.fusion.driver).id,
            armor: p.fusion.armor,
            max: p.fusion.max,
            left: Math.max(0, p.fusion.until - Date.now()),
          }
        : null,
      fuseReady: Math.max(0, p.fuseReadyAt - Date.now()),
    })),
    ...view(room.world),
    events: drainEvents(room.world),
  });
  const broadcast = (room) => {
    const state = snapshot(room);
    for (const p of room.players.values()) send(p.ws, state);
    room.dirty = false;
  };
  wss.on("connection", (ws) => {
    let room, player;
    let count = 0,
      windowStart = Date.now();
    ws.alive = true;
    ws.on("pong", () => {
      ws.alive = true;
    });
    ws.on("error", () => {});
    const joinTimer = setTimeout(() => ws.close(1008, "Join timeout"), 10000);
    ws.on("message", (raw) => {
      const now = Date.now();
      if (now - windowStart >= 1000) {
        count = 0;
        windowStart = now;
      }
      if (++count > 60) {
        ws.close(1008, "Too many messages");
        return;
      }
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        ws.close(1008, "Invalid message");
        return;
      }
      if (!data || typeof data !== "object") {
        ws.close(1008, "Invalid message");
        return;
      }
      if (!player) {
        const fail = (message) => {
          send(ws, { type: "error", message });
          ws.close(1008, "Unable to join");
        };
        if (!["create", "join"].includes(data.type)) {
          fail("Create or join a room first.");
          return;
        }
        if (
          typeof data.name !== "string" ||
          !data.name.trim() ||
          data.name.trim().length > 20 ||
          /[\x00-\x1f\x7f]/.test(data.name)
        ) {
          fail("Enter a pilot name of 1–20 characters.");
          return;
        }
        if (data.type === "create") {
          if (rooms.size >= maxRooms) {
            fail("The server is full. Try again later.");
            return;
          }
          let code;
          do {
            code = randomBytes(6).toString("hex").toUpperCase();
          } while (rooms.has(code));
          room = {
            code,
            players: new Map(),
            world: createWorld(Math.random, {
              pvp: data.pvp === true,
              planet: PLANETS[data.planet] ? data.planet : "proving",
            }),
            dirty: true,
          };
          rooms.set(code, room);
        } else {
          const code =
            typeof data.room === "string" ? data.room.toUpperCase() : "";
          room = CODE.test(code) ? rooms.get(code) : undefined;
          if (!room) {
            fail("Room not found. Ask your friend for a new invite.");
            return;
          }
          if (room.players.size >= 4) {
            fail("This room already has four pilots.");
            room = undefined;
            return;
          }
        }
        const occupied = new Set([...room.players.values()].map((p) => p.slot));
        const slot = [0, 1, 2, 3].find((n) => !occupied.has(n));
        player = {
          ...createPilot([slot * 4, 0, 8], CLASSES[data.cls] ? data.cls : "assault"),
          id: randomUUID(),
          ws,
          slot,
          name: data.name.trim(),
          color: COLORS[slot],
          heading: 0,
          updatedAt: now,
          ammo: MAX_AMMO,
          firedAt: 0,
          paint: cleanPaint(data.paint),
          weapon: WEAPONS[data.weapon] ? data.weapon : "plasma",
        };
        room.players.set(player.id, player);
        clearTimeout(joinTimer);
        send(ws, {
          type: "welcome",
          id: player.id,
          room: room.code,
          color: player.color,
          position: player.position,
          pvp: room.world.pvp,
          planet: room.world.planet,
        });
        broadcast(room);
      } else if (player.downUntil) {
        // A downed Titan cannot move or fire until it reboots at its spawn.
        return;
      } else if (data.type === "interact") {
        if (toggleMech(player, player.heading, room.world.planet)) {
          player.updatedAt = now;
          room.dirty = true;
        }
      } else if (data.type === "move" && player.fusion?.gunner === player) {
        // The gunner rides inside the driver's Titan; only its aim matters.
        if (Number.isFinite(data.heading)) player.heading = data.heading;
        room.dirty = true;
      } else if (data.type === "move") {
        const p = data.position;
        if (
          !Array.isArray(p) ||
          p.length !== 3 ||
          !p.every(finite) ||
          !finite(data.heading)
        )
          return;
        if (
          p[0] < -WORLD_EDGE ||
          p[0] > WORLD_EDGE ||
          p[2] < -WORLD_EDGE ||
          p[2] > WORLD_EDGE ||
          p[1] < terrainHeight(room.world.planet, p[0], p[2]) - 0.5 ||
          p[1] > terrainHeight(room.world.planet, p[0], p[2]) + (player.onFoot ? 3.5 : 45) + 0.5
        )
          return;
        // Movement is client-predicted in this milestone; reject extreme jumps.
        const distance = Math.hypot(...p.map((v, i) => v - player.position[i]));
        if (distance > (player.onFoot ? 14 : 60) * Math.min(2, (now - player.updatedAt) / 1000) + 2)
          return;
        player.position = p;
        player.heading = Math.atan2(
          Math.sin(data.heading),
          Math.cos(data.heading),
        );
        if (!player.onFoot) {
          player.mechPosition = [...p];
          player.mechHeading = player.heading;
        }
        player.updatedAt = now;
        room.dirty = true;
      } else if (data.type === "fire") {
        if (player.onFoot) return;
        // Shots are simulated here; clients only draw tracers.
        const o = data.origin,
          d = data.dir;
        if (
          !Array.isArray(o) ||
          o.length !== 3 ||
          !o.every(finite) ||
          !Array.isArray(d) ||
          d.length !== 3 ||
          !d.every(finite)
        )
          return;
        const length = Math.hypot(...d);
        if (length < 0.5 || length > 1.5) return;
        if (Math.hypot(...o.map((v, i) => v - player.position[i])) > 8) return;
        if (player.special?.type === "sword" && now >= player.special.until) player.special = null;
        const special = player.special?.type;
        const interval = special
          ? POWERUPS[special]?.interval
          : classOf(player.cls).fireInterval * weaponOf(player.weapon).rate;
        if ((!special && player.ammo <= 0) || now - player.firedAt < (interval || 0.16) * 900)
          return;
        if (!special) player.ammo--;
        player.firedAt = now;
        const dir = d.map((v) => v / length);
        const weapon = fire(room.world, player, o, dir, [...room.players.values()]);
        const shot = { type: "shot", by: player.id, origin: o, dir, weapon };
        for (const p of room.players.values()) if (p !== player) send(p.ws, shot);
        room.dirty = true;
      } else if (data.type === "paint") {
        player.paint = cleanPaint(data.paint);
        room.dirty = true;
      } else if (data.type === "fuse") {
        if (requestFuse(room.world, player, now)) room.dirty = true;
      } else if (data.type === "weapon") {
        setWeapon(player, data.weapon);
        room.dirty = true;
      } else if (data.type === "class") {
        if (player.fusion) return;
        if (!CLASSES[data.cls]) return;
        setClass(player, data.cls);
        room.dirty = true;
      } else if (data.type === "repair") {
        if (repair(room.world, player, [...room.players.values()], now))
          room.dirty = true;
      } else if (data.type === "reload") {
        if (player.onFoot) return;
        player.ammo = MAX_AMMO;
        room.dirty = true;
      }
    });
    ws.on("close", () => {
      clearTimeout(joinTimer);
      if (!player || !room) return;
      room.players.delete(player.id);
      if (!room.players.size) rooms.delete(room.code);
      else broadcast(room);
    });
  });
  let last = Date.now();
  const tick = setInterval(() => {
    const now = Date.now(),
      dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const room of rooms.values()) {
      const players = [...room.players.values()];
      if (step(room.world, players, dt, now)) room.dirty = true;
      if (room.dirty) broadcast(room);
    }
  }, 50);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }, 15000);
  return {
    http,
    rooms,
    async close() {
      clearInterval(tick);
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => http.close(resolve));
    },
  };
}
