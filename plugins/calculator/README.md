# jim-calculator

Inline calculator widget (`showIn: calc`). Type an expression such as `2*(3+4)`, `sqrt(2)`, `2^-3`,
`max(1,2,3)`; the result row shows `= value`, and enter copies the plain number.

## Install

```bash
jimcast plugin install calculator
# or by package id:
jimcast plugin install com.jimcast.plugins.calculator
```

This downloads the plugin from the plugin registry, installs its dependencies,
builds it (the SDK is bundled in), copies the result to
`~/.jimcast/plugins/<plugin id>/`, adds a `calculator` alias to the `widgets`
map in `~/.jimcast/config.json` (if it isn't there yet), and asks the running
jimcast-core to reload. It needs `git`, `node`, `pnpm` and `bash`.

The plugin id is the `name` in `package.json`. The alias that gets added is:

```json
"widgets": { "calculator": { "use": "com.jimcast.plugins.calculator" } }
```

The alias only declares the widget. To show it, place `calculator` in a
section of your layout (`config_section.json`).

Plugin processes outlive reloads, so if you reinstall over a running copy,
fully quit and relaunch jimcast-core.

### Install from a local checkout (plugin development)

```bash
./scripts/install.sh calculator
```

This does the same build and copy from your working tree, without cloning. It
does not touch `config.json` or reload the app, so add the alias above by hand
and relaunch jimcast-core.

## Differences from the built-in

- **Query-reactive rendering is not available yet.** The built-in used `renderQuery(context, q)`. The SDK has
  no equivalent, so `render` currently returns an empty list. The evaluator (`src/data.ts`) and the result
  row builder (`resultItem` in `src/render.ts`) are ported unchanged and ready to wire up.
- **Copy to clipboard and toast** (`port.copyToClipboard`, `port.showToast`) have no known SDK call; the
  action is a marked TODO. `port.dismissCommandBar()` is mapped to `then: "dismiss"`.
- `theme.color.yellow` comes from `ctx.host.theme.colors.yellow` with a fallback; `theme.font.hightlight1`
  is a local constant.
- No state files, shell scripts, CLI or key actions, so `shell.ts` and `commands.ts` are omitted and the
  manifest has no capabilities.
