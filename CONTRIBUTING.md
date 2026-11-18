# Contributing

1. `./scripts/new-plugin.sh <name>` (or `./scripts/import-plugin.sh <path>` for an existing plugin).
2. Build it. Read `skills/jimcast-plugin/SKILL.md` first; it lists the rules that avoid most bugs.
3. Set the `package.json` `name` to a reverse-DNS plugin id (`com.jimcast.plugins.<name>`).
4. `pnpm install && pnpm typecheck && pnpm build && ./scripts/check-data-paths.sh`
5. Test it for real: `./scripts/install.sh <folder name>`, fully quit and relaunch jimcast-core, click through every button and CLI command. `jimcast widget list` must show only full ids.
6. In your PR:
   - README of the plugin: install, catalog alias entry for `config.json`, panel entry JSON, CLI examples using the alias (+ a GIF if you can)
   - a row in the root `README.md` and `docs/plugin-catalog.md`
   - note anything you could not verify

## Style

- Four files per plugin: `index.ts`, `render.ts`, `shell.ts`, `commands.ts`.
- No cross-plugin imports. Copy small helpers; plugins stay independently installable.
- **Ids:** the plugin id (`package.json` `name`, reverse-DNS, at least three lowercase segments of `[a-z0-9-]`) is the only id. Never write ids in `createWidget`, specs or `definePlugin`. Extra widgets are `<plugin id>.<local id>`.
- **Plugin data:** your own files (state, config, cache, logs, feeds) live only in `~/.jimcast/plugin-data/<plugin id>/`, and you get paths only from `pluginDataDir()` / `pluginDataFile(name)` in `@jimcast/sdk`. No `~/.jimcast/...`, `$HOME`, `homedir()`, `/tmp` or `ext-` paths in plugin code. User-chosen paths (files the user browses or opens) are not plugin data; mark such a line with a `data-path-ok` comment so `scripts/check-data-paths.sh` skips it.
- **CLI:** examples use the catalog alias from `config.json`, never an `<plugin id>` id.

## Using AI to write your plugin

Encouraged. Point your agent at `AGENTS.md`, review the diff, run it, and tell us which model/tool you used if
the skill missed something: that is how the skill gets better. Improvements to `skills/` are welcome PRs.
