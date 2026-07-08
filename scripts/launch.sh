#!/bin/bash
# OpenClaw UI launcher — used by the desktop shortcut app.
# Starts the production server (UI + API on one port) if it isn't already
# running, then opens the UI in the default browser.
set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${OPENCLAW_UI_PORT:-4177}"
URL="http://127.0.0.1:$PORT"
LOG="$HOME/Library/Logs/openclaw-ui.log"

# .app bundles launch without a login shell, so nvm's node (and the openclaw
# CLI next to it) are not on PATH yet.
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
fi
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "OpenClaw UI" message "Could not find Node.js. Install Node (or nvm), or start the app from a terminal with: npm start"'
  exit 1
fi

up() { curl -s -o /dev/null --max-time 1 "$URL/api/status"; }

if ! up; then
  # first run after a fresh clone: build the client bundle
  if [ ! -d "$REPO/client/dist" ]; then
    (cd "$REPO" && npm install >>"$LOG" 2>&1 && npm run build >>"$LOG" 2>&1)
  fi
  nohup node "$REPO/server/src/index.js" >>"$LOG" 2>&1 &
  for _ in $(seq 1 40); do
    up && break
    sleep 0.25
  done
fi

if up; then
  open "$URL"
else
  osascript -e 'display alert "OpenClaw UI" message "The server failed to start. See ~/Library/Logs/openclaw-ui.log for details."'
  exit 1
fi
