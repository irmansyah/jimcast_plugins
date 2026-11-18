# Getting started

## Prerequisites

- macOS, jimcast-core installed and running
- Node 20+, pnpm 9+
- `jimcast-sdk` checked out next to this repo: `../jimcast-sdk` (the one place to change when the SDK is published: `pnpm.overrides` in the root `package.json`)

## 1. Run a plugin

```bash
pnpm install
./scripts/install.sh plugins/pomodoro
```

`install.sh` builds the plugin and copies `dist/` + `package.json` (plus `dist-backend/`, `manifest.json`, `config.json` when present) to `~/.jimcast/plugins/com.jimcast.plugins.pomodoro/`.
It auto-detects native (`tsdown.config.ts`) vs react (`vite.config.ts`) plugins; see [architecture](architecture.md#plugin-flavors).
`./scripts/install.sh --all` installs everything; `--no-build` copies the last build.
Reload jimcast-core, then add the panel to `config_section.json`:

```json
{ "id": "com.jimcast.plugins.pomodoro.pomodoro", "label": "Pomodoro", "kind": "external-component" }
```

## 2. Make your own

```bash
./scripts/new-plugin.sh my-timer
$EDITOR plugins/my-timer/src/render.ts
pnpm --filter com.jimcast.plugins.my-timer typecheck
./scripts/install.sh plugins/my-timer
```

Edit loop: `pnpm --filter com.jimcast.plugins.my-timer dev` (rebuilds on save), then `./scripts/install.sh` again to copy.

## 3. Drive it from the terminal

```bash
jimcast widget commands com.jimcast.plugins.my-timer
jimcast widget command com.jimcast.plugins.my-timer inc
```

## Debugging

| Symptom | Check |
|---|---|
| Widget missing | `package.json` `jimcast.widgets[].id` matches the widget id suffix; plugin folder name equals package `name` |
| Rows behave oddly | item id prefix collides with a core prefix (`fm`, `cp`, `em`, `cal-`, `pomodoro`) |
| Never refreshes | `repeat` must be in `package.json` and core needs the patch in `docs/core-changes.md` |
| Click does nothing | action must be `{ run, then }`; check `ctx.exec` output with `exitCode` |
| Works in dev, not installed | SDK not bundled: `noExternal: [/^@jimcast\//]` in `tsdown.config.ts` |
