# MECHVERSE — Prototype 0.1

A playable 3D mech game with solo missions and four-player private rooms, built with React, React Three Fiber, Three.js, and Vite. See [MULTIPLAYER.md](MULTIPLAYER.md) for the current controls, server setup and feature status.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Controls

- WASD / arrow keys: move
- Q / E: rotate mech
- Space: jump
- Hold F: fly upward
- Hold Ctrl: descend
- Shift: dodge / burst
- Hold mouse button: fire plasma cannon
- R: refill ammo (prototype debug reload)
- Camera button: cycle third-person, shoulder, first-person
- On-screen buttons: touch input for mobile testing

## Build

```bash
npm run build
npm run preview
```

## GitHub + online preview

1. Create a new GitHub repository.
2. In this folder, run `git init`, `git add .`, `git commit -m "Prototype 0.1"`.
3. Connect the GitHub repository to Vercel (or Netlify).
4. Build command: `npm run build`. Output directory: `dist`.

The browser client deploys to Vercel. Private rooms require the matching Node room server; see [MULTIPLAYER.md](MULTIPLAYER.md). The art is still procedural and subject to further polish.

## Mac setup

See [SETUP.md](SETUP.md) for verified setup status, fixes, hosting preparation, and the double-click Mac launcher. Use `npm ci` for reproducible installation from the included lockfile.
