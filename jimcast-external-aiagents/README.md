<!-- README.md -->
# jimcast-external-aiagents

Compact AI agent monitor for a small window: icon tabs, one progress row and a short live log
(newest first). Runs on deterministic dummy data unless a feed file exists.

## Install

```sh
cd plugins/aiagents
npm install
npm run build
```

Then register the plugin with jimcast the way you do for other external plugins.

## Panel entry

```json
{ "widget": "jimcast-external-aiagents.aiagents" }
```

## Real data

Write `~/.jimcast/ext-aiagents/feed.json`; it replaces the dummy data:

```json
{ "agents": [ { "id": "coder", "name": "Coder", "icon": "🛠",
  "status": "running", "task": "Implement PaymentGateway adapter", "progress": 0.54,
  "logs": [ { "level": "info", "text": "..." } ] } ] }
```

`status`: running | idle | done | error. `level`: info | tool | ok | warn | error (oldest first).
The seam for other sources is `loadAgents()` in `src/data.ts`.

## CLI

```sh
jimcast widget command xagents status
jimcast widget command xagents use all
jimcast widget command xagents use coder
```

## Differences from the built-in

- Widget id `jimcast-external-aiagents.aiagents`; CLI spec `xagents` (was `agents`); item ids use the `extag` prefix (was `ag-`).
- State and feed live in `~/.jimcast/ext-aiagents/` (`tab`, `feed.json`) so both versions can coexist. The built-in's `~/.jimcast/aiagents/feed.json` is not read.
- Actions are closures (`{ run, then }`), not `{cmd, params}`.
- Colors come from `ctx.host.theme.colors` with Gruvbox fallbacks; `theme.font.xs` is a local constant (11).
- The per-call shell timeout (5s) and `ignore_exit_code` options are not passed (`ctx.exec` takes only the command).
