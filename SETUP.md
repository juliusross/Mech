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

Local Git is initialized on `main`. Source files are staged. No commit was created because no Git author identity is configured. No GitHub remote or Vercel deployment has been created.

Next steps after signing in:

1. Create a private GitHub repository named `mechverse-prototype-0.1` (or choose another name). Do not initialize it with additional files.
2. Configure this repository's Git author name and verified or GitHub-provided noreply email, commit the staged source, add the repository remote, and push `main`.
3. Import that repository into Vercel and grant access to this repository when prompted.
4. Use the Vite framework preset, project root `.`, install command `npm ci`, build command `npm run build`, and output directory `dist`. These build settings are included in `vercel.json`. No environment variables are required.
5. Open the resulting deployment URL and repeat rendering, camera, firing, and reload checks before sharing it.

Account sign-in is required on both services. GitHub repository access authorization for Vercel must be approved by the account owner when requested. Choose a supported Node version in Vercel and verify its build; the local build was tested on Node 26.7.0.

Official references:
- https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
- https://vercel.com/docs/frameworks/frontend/vite
