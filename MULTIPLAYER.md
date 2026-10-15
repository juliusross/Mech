# Private-room multiplayer

## Classes, versus, effects and phone layout (October 14, 2026)

- Four mech classes, chosen in the HUD (remembered per browser, switchable any time except while down; switching keeps your armor percentage):
  - Assault: 100 armor, balanced.
  - Scout: 70 armor, fast, rapid fire, quick dodge, smaller.
  - Heavy: 160 armor, slow, double-damage shots, larger.
  - Support: 90 armor. G (or REPAIR on touch) repairs 30 armor for itself and pilots within 14 m, with a 10 s cooldown.
- Versus rooms: tick "Versus" when creating a room. Pilot shots then damage other pilots (5 armor per damage point), and knocking a pilot down scores 5. Drones and targets are still in play. Co-op rooms are unchanged.
- Effects: explosions when targets or drones are destroyed, sparks on hits, a green ring for repairs, and a red burst when a Titan goes down. The simulation emits these as events, which the server forwards in snapshots.
- Touch controls gained turn left/right, jump, and repair. On phones the friends panel starts collapsed above the controls, and the controls help starts hidden.
- Verified: 15 tests pass. In the browser: class switching and sizes, Support repair (+30, cooldown shown), a target explosion, a versus room where a Heavy knocked down an Assault (+5 score, roster shows down), and the phone layout at 375×812 (collapsed and expanded). No console errors.

## Co-op drone milestone (October 14, 2026)

- Hostile drones hunt the nearest active pilot, circle at range, and fire dodgeable red bolts (6 armor each). Wave N brings min(2 + N, 8) drones, each taking 4 hits; destroying one scores 2.
- Armor is real now. At 0 a Titan goes down for 3 seconds (no moving or firing, drones ignore it), then reboots at full armor at its spawn point.
- A wave clears only when all 12 targets and all drones are destroyed.
- `shared/sim.js` holds the whole combat simulation. The room server runs one world per room, and solo practice runs the same code in the browser.
- HUD: wave, targets, drones left, score, live armor (red at 30% or below), hit flash, and a TITAN DOWN overlay. The roster marks downed pilots.
- Verified: 10 tests pass (4 new simulation tests). In the browser, drones attacked solo and in a two-pilot local room; down and reboot worked in both, and there were no console or server errors.
- Not yet verified in the browser: destroying a drone by aiming manually (covered by tests).

## Shared combat milestone (October 14, 2026)

- Everyone in a room fights the same 12 targets. The room server owns target health, simulates every shot, and credits the pilot who destroys each target.
- The server tracks each pilot's ammo (60, R reloads), enforces the fire rate, and ignores shots fired from away from the pilot's mech.
- Every pilot sees every shot as a tracer. Local tracers stop at targets but never deal damage themselves.
- Clearing all 12 targets starts the next wave after 4 seconds. The roster shows each pilot's score.
- Verified: six server tests pass (two new: shared damage/scoring/ammo/fire-rate, and wave reset). In two browser sessions, one pilot destroyed a target and the other saw the squad count and score update. No console errors. Solo practice still works after leaving.
- Not yet: pilot-vs-pilot damage, hit effects, online hosting.

## Movement milestone

Implemented locally, October 14, 2026. The public Vercel game remains the previously deployed solo version.

## Try it on this Mac

```sh
npm ci
npm run dev:multiplayer
```

Open http://127.0.0.1:5174 in two browser tabs. Enter a pilot name and create a room in the first tab. Use its invite link in the second tab, enter another name, and join. Move, rotate, jump, dodge, and fly to see the other pilot move. Leaving removes the pilot and restores solo practice. Rooms disappear when empty; a server restart ends all rooms.

The current preview is loopback-only. Its invite links work on this Mac, not on a friend's computer. Online invites require the server hosting step below.

## Included

- Private rooms with random 12-character invite codes and up to four pilots.
- Server-assigned pilot identities, colors, and separate starting positions.
- Twenty-per-second position broadcasts with remote interpolation.
- Pilot names and roster, copyable invite link, room-full and missing-room errors.
- Connection timeout, cancel, explicit leave, and disconnect fallback to solo.
- Server-side origin checks, message-size and rate limits, bounded movement, heartbeat cleanup, and room limits.

## Verified

- Two local browser sessions joined the same room; one visibly saw the other move and fly.
- Leaving returned that session to solo and removed the remote pilot.
- No browser warnings or errors were observed during those checks.
- Four movement server integration tests pass: movement/room isolation/four-player cap/departure cleanup; invalid names/missing rooms/server capacity; malformed and out-of-bounds movement; origin rejection.
- Production client build passes. The existing large JavaScript bundle warning remains.

Four simultaneous browser sessions, different physical computers, high-latency connections, mobile devices, and automatic reconnection have not been validated in this milestone.

## Online hosting

Room server: https://mechverse-rooms.onrender.com (Render free plan). The repository's Render blueprint now selects `main`, which contains the merged co-op and versus features. The existing Render service must also be switched to `main` and deployed in its dashboard; changing this file alone does not update a running service. Free instances sleep after ~15 idle minutes, so the first connection may take up to a minute. Deployed web builds connect to this server by default; `VITE_MULTIPLAYER_URL` overrides that. To allow another site, add its exact origin to `ALLOWED_ORIGINS` in Render.

### Original preparation notes

This feature needs a persistent Node WebSocket server in addition to the Vercel frontend. Render web services support WebSockets: https://render.com/docs/websocket . No new hosting account, paid service, or online multiplayer deployment has been created.

Server settings:

- Working directory: project root
- Install/build: `npm ci`
- Start: `npm run server`
- Health endpoint: `/health`
- `NODE_ENV=production`
- `ALLOWED_ORIGINS=https://mech-five.vercel.app` (append exact preview origins when testing another frontend)
- `PORT` supplied by host; the production server binds to all interfaces.

Frontend build setting:

- Set `VITE_MULTIPLAYER_URL=wss://YOUR-SERVER-HOST/multiplayer` before building on Vercel.
- Use a separate preview first, then test two computers before updating production.
- No server credential is required in the frontend. The room code is the invitation secret; anyone with it can join until the room is full.

Movement is client-predicted and relayed with sanity bounds. Shots, damage, ammo, and score are server-owned. This is still not a robust anti-cheat system.

## Development

```sh
npm test
npm run build
```

The movement, shared combat, co-op drones, mech classes, and versus features have been merged into `main`. The Vercel production deployment follows `main`. Confirm the Render service's branch and successful deployment in its dashboard before treating the latest online multiplayer server as verified.
