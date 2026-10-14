# MECHVERSE setup status

Prepared on October 14, 2026.

## Play on this Mac

Open http://127.0.0.1:5173 while the local server is running.
To restart later, double-click `Start MECHVERSE.command` in this folder. Keep its Terminal window open while playing. Press Control+C in that window to stop its server.

Node.js v26.7.0, npm 11.19.0, Visual Studio Code, and Chrome were already installed. The original Downloads ZIP was preserved. This working copy contains installed packages and a reproducible package-lock.json.

## Fixes applied

- Connected primary mouse firing to the game canvas; UI clicks do not fire.
- Added ammo count and connected reload updates to the HUD.
- Made turning continuous and aligned movement, cannon direction, and muzzle position with the mech's rotation.
- Hid the mech in first-person view so the camera is not obstructed by its head.
- Made dodge last 0.22 seconds instead of one frame, with a 1.5-second cooldown.
- Cleared controls on lost focus, visibility change, and pointer cancellation.
- Added pointer capture to on-screen controls and cleared held inputs when capture is lost.
- Removed default page margins/scrolling, centered the reticle, and declared UTF-8 for the page title.
- Bound local preview servers to this Mac's loopback address.

## Verification

- Dependency installation completed; npm reported zero vulnerabilities at installation time.
- Production build passed with Vite 6.4.4. The built app was also browser-tested on port 4173: rendering, target destruction, camera switching, and reload passed with no observed console errors.
- Browser checks verified 3D rendering, three camera modes, movement, rotation, flight/descent, mouse firing, target destruction, and reloading to 60 rounds.
- Browser console showed no warnings or errors during the observed checks.
- Jump and dodge inputs were exercised; their timing has not been quantitatively benchmarked.
- Build warning: the main JavaScript bundle is about 1.10 MB (307 KB compressed). This does not prevent the build, but optimization remains useful before broader release.

This remains a single-player prototype. Mouse movement does not aim; Q/E rotates the mech. The reticle is a screen-center marker, not a precise cannon-impact indicator. Multiplayer, gamepad support, saved progress, and production mobile testing remain future work.

## GitHub and Vercel

Live game: https://mech-five.vercel.app/
Repository: https://github.com/juliusross/Mech
Vercel dashboard: https://vercel.com/juliuus-projects/mech

Verified October 14, 2026:

- Vercel reports the production deployment Ready, from main commit 7946ccfa4e13255feeb08363ba16984839f1f5d9.
- The live page is publicly accessible without Vercel login.
- Live browser checks passed for rendering, movement, firing, target destruction, all camera modes, and reloading. No browser console warnings or errors were observed.
- The dashboard identifies main as the production branch; pushing to main updates this deployment.
- The local repository tracks origin/main. The multiplayer-movement branch now contains the local multiplayer milestone described in MULTIPLAYER.md. Production still serves the solo source on main. Local setup notes and the original launcher's executable permission also differ from the uploaded version.

The local launcher remains usable on this Mac. A fresh GitHub clone may require `chmod +x "Start MECHVERSE.command"` before double-clicking the launcher, because browser upload did not preserve its executable permission.

This deployment is still the single-player prototype. Sharing the link lets each person play separately; multiplayer is not implemented.
