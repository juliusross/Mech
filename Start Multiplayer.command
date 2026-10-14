#!/bin/zsh
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null; then
  echo "Install Node.js from https://nodejs.org, then try again."
  read -k 1
  exit 1
fi
if [[ ! -d node_modules ]]; then npm ci; fi
(sleep 2; open http://127.0.0.1:5174/) &
exec npm run dev:multiplayer
