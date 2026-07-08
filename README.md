# 🦞 OpenClaw UI — Agent Manager

A friendly, **educational** web UI for creating, configuring, and managing your
[OpenClaw](https://openclaw.ai) agents. It edits your live `~/.openclaw/openclaw.json`
with a review-diff and automatic backups, and teaches you how OpenClaw works while you
configure it.

## Features

- **Overview** — a live architecture diagram built from your actual config: channels →
  Gateway → agents, with status, ports, and models. Click any box to jump to its settings.
- **Agents** — create/edit/delete agents; set workspaces, primary models, fallbacks, and
  model aliases. Badges show which values are *inherited from defaults* vs *overridden*.
- **Channels & Routing** — connect external messaging (Telegram first-class: bot token,
  DM policy, allow list; other channels via generic editors), and bind each channel to
  the agent that should answer it. Includes a step-by-step Telegram + BotFather guide.
- **Gateway & Session** — network exposure (loopback / lan / tailnet / auto) as visual
  cards, auth token management, session DM scope, tools profile, and Tailscale settings —
  with safety warnings when a combination is risky (e.g. exposed bind with no auth).
- **Plugins, Skills & Auth** — toggle plugins, understand plugins vs skills vs auth
  profiles, and see your provider credentials at a glance (secrets are never shown).
- **Chat Console** — send a real turn to any agent through the Gateway
  (`openclaw agent`) and inspect the raw response.
- **Safe writes** — every save shows a unified diff first and snapshots the current
  config to `~/.openclaw/config-backups/` before writing. One-click restore from the
  Backups page. Concurrent edits are detected via file mtime.
- **Educational layer** — 📘 "Learn" notes, inline hints on every field, and diagrams
  explain Gateway/agent/session/plugin concepts as you go.

## Requirements

- Node.js ≥ 20
- [OpenClaw](https://openclaw.ai) installed with a config at `~/.openclaw/openclaw.json`
  (run `openclaw configure` once if you haven't)

## Quick start (development)

```bash
npm install
npm run dev
```

- Client: http://localhost:5173 (Vite, hot reload)
- API server: http://127.0.0.1:4177 (proxied under `/api`)

## Desktop shortcut (macOS)

```bash
scripts/create-desktop-shortcut.sh
```

Builds a double-clickable **OpenClaw UI.app** (with a 🦞 icon) into `~/Applications`
and links it from your Desktop. Double-clicking starts the production server if it
isn't already running, then opens the UI in your default browser. Server output goes
to `~/Library/Logs/openclaw-ui.log`; stop the server with
`lsof -ti :4177 | xargs kill`.

Notes:

- The app is intentionally **not** placed on the Desktop itself: with iCloud
  "Desktop & Documents" sync, app bundles on the Desktop can be evicted to the
  cloud, which breaks them. The Desktop gets a symlink to the real app instead.
- The app embeds the absolute path to this repo — if you move the repo, run the
  script again to regenerate it.

## Production

```bash
npm run build   # builds client into client/dist
npm start       # serves UI + API together on http://127.0.0.1:4177
```

## Configuration

| Env var            | Default        | Purpose                                        |
| ------------------ | -------------- | ---------------------------------------------- |
| `OPENCLAW_HOME`    | `~/.openclaw`  | OpenClaw state dir (useful for tests/profiles) |
| `OPENCLAW_UI_PORT` | `4177`         | API/production server port                     |

## How it's built

- `client/` — React 18 + Vite SPA. No UI framework; a small hand-rolled design system
  (dark, lobster-accented 🦞). Diagrams are plain SVG generated from your config.
- `server/` — a small Express server that reads/writes `openclaw.json` (atomic write +
  timestamped backup), computes diffs, probes the Gateway port, and shells out to the
  `openclaw` CLI for chat turns and version info.

The server binds to `127.0.0.1` only — it can read your config and run agent turns, so
don't expose it to the network.

## Safety model

1. All edits happen on a **draft** in the browser — nothing touches disk until you click
   **Review & Apply**.
2. The review modal shows the exact `openclaw.json` diff the server will write, and the
   proposed config is checked with `openclaw config validate` (in a throwaway state dir)
   — a config that OpenClaw itself rejects cannot be applied.
3. Before every write (and every restore), the current file is snapshotted to
   `~/.openclaw/config-backups/openclaw-<timestamp>.json`.
4. If the file changed on disk since you loaded it, the save is rejected with a conflict
   error instead of overwriting.
