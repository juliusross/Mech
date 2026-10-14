#!/bin/zsh
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if curl --silent --fail http://127.0.0.1:5173/ | /usr/bin/grep -q 'MECHVERSE'; then
  open http://127.0.0.1:5173/
  exit 0
fi
if ! command -v npm >/dev/null; then
  echo "Node.js is required. Install it from https://nodejs.org, then try again."
  read -k 1
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci
fi
(sleep 2; open http://127.0.0.1:5173/) &
exec npm run dev -- --port 5173 --strictPort
