# Porting a built-in core widget to a plugin

Do the same mechanical steps every time (this is how every plugin in this repo was made):

| Core (`descriptors/x.ts`) | Plugin |
|---|---|
| `port.shellExec(cmd, opts)` | `ctx.exec(cmd)` |
| `{ cmd, params:{p}, then }` with `{p}` interpolation | `{ run: () => ctx.exec(cmdWithShq), then }` |
| `theme.color.*` | `ctx.host.theme.colors` + fallbacks |
| `theme.font.*`, `radius.*`, `alpha()` | local constants / helpers |
| `registerWidgetCli({ id, owns, commands })` | `createWidget({ cli: { owns, commands } })` (no id: core uses the plugin id) |
| `registerWidgetKeys({...})` | `createWidget({ keys: {...} })` |
| `port.shellExec` inside CLI | `ctx.exec` |
| `repeat` on the descriptor | `repeat` in `package.json` `jimcast.widgets[]` |
| state in `~/.jimcast/<x>` | `pluginDataDir()` / `pluginDataFile(name)` from `@jimcast/sdk` |
| widget / CLI / keys id (`finder`) | none: the plugin id (`package.json` `name`, reverse-DNS) is the id of the main widget; extra widgets are `<plugin id>.<local id>` |
| CLI name `finder` | a catalog alias in `config.json` (`"finder": { "use": "<plugin id>" }`) |

## Rules

- **Never write ids in code.** No ids in `createWidget`, specs or `definePlugin`; core derives them from the plugin id. Use `pluginId()` only when you really need the string.
- **Plugin data lives only in `pluginDataDir()`.** No `~/.jimcast/...`, `$HOME`, `homedir()`, `/tmp` or `ext-` paths in plugin code. No plugin builds the path itself; the SDK creates the directory.
- **User-chosen paths** (files the user browses or opens) are not plugin data and are out of scope for this rule.
- **State migration:** copy old state once, e.g. `cp -R ~/.jimcast/<old dir>/. ~/.jimcast/plugin-data/<plugin id>/`.
- **Stale ids:** after conversion `jimcast widget list` must show only full ids.

## Files

Split: `shell.ts` (scripts + state read), `render.ts` (view), `commands.ts` (CLI + keys), `index.ts`.

Document the differences in the plugin README under "Differences from the built-in".
