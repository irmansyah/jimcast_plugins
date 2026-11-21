<!-- README.md -->
# jim-aiagents

Compact AI agent monitor for a small window: icon tabs, one progress row and a short live log
(newest first). Runs on deterministic dummy data unless a feed file exists.

## Install

```bash
jimcast plugin install aiagents
# or by package id:
jimcast plugin install com.jimcast.plugins.aiagents
```

This downloads the plugin from the plugin registry, installs its dependencies,
builds it (the SDK is bundled in), copies the result to
`~/.jimcast/plugins/<plugin id>/`, adds a `aiagents` alias to the `widgets`
map in `~/.jimcast/config.json` (if it isn't there yet), and asks the running
jimcast-core to reload. It needs `git`, `node`, `pnpm` and `bash`.

The plugin id is the `name` in `package.json`. The alias that gets added is:

```json
"widgets": { "aiagents": { "use": "com.jimcast.plugins.aiagents" } }
```

The alias only declares the widget. To show it, place `aiagents` in a
section of your layout (`config_section.json`).

Plugin processes outlive reloads, so if you reinstall over a running copy,
fully quit and relaunch jimcast-core.

### Install from a local checkout (plugin development)

```bash
./scripts/install.sh aiagents
```

This does the same build and copy from your working tree, without cloning. It
does not touch `config.json` or reload the app, so add the alias above by hand
and relaunch jimcast-core.

## Panel entry

```json
{ "widget": "com.jimcast.plugins.aiagents" }
```

## Real data

Write `~/.jimcast/plugin-data/<plugin id>/feed.json`; it replaces the dummy data:

```json
{ "agents": [ { "id": "coder", "name": "Coder", "icon": "🛠",
  "status": "running", "task": "Implement PaymentGateway adapter", "progress": 0.54,
  "logs": [ { "level": "info", "text": "..." } ] } ] }
```

`status`: running | idle | done | error. `level`: info | tool | ok | warn | error (oldest first).
The seam for other sources is `loadAgents()` in `src/data.ts`.

## CLI

```sh
jimcast widget command com.jimcast.plugins.aiagents status
jimcast widget command com.jimcast.plugins.aiagents use all
jimcast widget command com.jimcast.plugins.aiagents use coder
```

## Differences from the built-in

- Widget id `com.jimcast.plugins.aiagents`; CLI spec `xagents` (was `agents`); item ids use the `extag` prefix (was `ag-`).
- State and feed live in `~/.jimcast/plugin-data/<plugin id>/` (`tab`, `feed.json`) so both versions can coexist. The built-in's `~/.jimcast/aiagents/feed.json` is not read.
- Actions are closures (`{ run, then }`), not `{cmd, params}`.
- Colors come from `ctx.host.theme.colors` with Gruvbox fallbacks; `theme.font.xs` is a local constant (11).
- The per-call shell timeout (5s) and `ignore_exit_code` options are not passed (`ctx.exec` takes only the command).
