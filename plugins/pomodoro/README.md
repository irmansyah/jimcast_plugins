# pomodoro

A pomodoro timer for jimcast, built only on `@jimcast/sdk`.

A boxed countdown beside a thin progress row, then a row of buttons. Green is
focus, aqua is break, yellow is paused, orange is the last minute (blinks),
blue is "phase finished" (blinks).

## Install

```bash
jimcast plugin install pomodoro
# or by package id:
jimcast plugin install com.jimcast.plugins.pomodoro
```

This downloads the plugin from the plugin registry, installs its dependencies,
builds `dist/index.mjs` (the SDK is bundled in), copies `dist/` and
`package.json` to `~/.jimcast/plugins/<plugin id>/`, adds a `pomodoro` alias to
the `widgets` map in `~/.jimcast/config.json` (if it isn't there yet), and asks
the running jimcast-core to reload. It needs `git`, `node`, `pnpm` and `bash`.

The plugin id is the `name` in `package.json`. The alias that gets added is:

```json
"widgets": { "pomodoro": { "use": "com.jimcast.plugins.pomodoro" } }
```

The alias only declares the widget. To show it, place `pomodoro` in a section
of your layout (`config_section.json`).

Plugin processes outlive reloads, so if you reinstall over a running copy,
fully quit and relaunch jimcast-core.

### Install from a local checkout (plugin development)

```bash
./scripts/install.sh pomodoro
```

This does the same build and copy from your working tree, without cloning. It
does not touch `config.json` or reload the app, so add the alias above by hand
and relaunch jimcast-core.

## How it works

State is a timestamp, never a tick counter, so it is right even when the bar
was hidden for minutes. `~/.jimcast/plugin-data/<plugin id>/state` holds one line:

```
<running|paused> <focus|break> <end-epoch> <total-secs> <remaining-secs>
```

No file = idle. The desktop notification comes from a background `sleep`
started with the phase (its pid is in `state.pid`), because nothing renders
while the bar is hidden. Pause / skip / cancel kill it.

The 1-second refresh is `repeat` on `createWidget`.

## Keys

Default keys are defined in `src/commands.ts`. Remap them per widget in
`~/.jimcast/keybinding.json`:

```json
"widgets": { "com.jimcast.plugins.pomodoro": { "toggle": "space", "skip": "s" } }
```

## CLI

```bash
jimcast widget commands com.jimcast.plugins.pomodoro
jimcast widget command com.jimcast.plugins.pomodoro toggle     # start / pause / resume / next phase
jimcast widget command com.jimcast.plugins.pomodoro skip
jimcast widget command com.jimcast.plugins.pomodoro break
jimcast widget command com.jimcast.plugins.pomodoro reset
jimcast widget command com.jimcast.plugins.pomodoro status
```

## Notes

- `alpha()` and the corner radius are small local helpers in `render.ts` (the
  alpha levels are guesses, tune them).
- The notification process is started from the plugin's `ctx.exec`. It is fully
  detached (`&`, output and stdin redirected). If the notification never fires,
  check that the host's exec doesn't wait for or kill it.
- While developing, `pnpm dev` (`tsdown --watch`) rebuilds `dist/` on every
  change. Run `./scripts/install.sh pomodoro --no-build` to copy it over.
