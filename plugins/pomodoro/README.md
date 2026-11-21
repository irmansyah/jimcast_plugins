# jim-pomodoro

A pomodoro timer for jimcast, built only on `@jimcast/sdk`.

A boxed countdown beside a thin progress row, then a row of buttons. Green is
focus, aqua is break, yellow is paused, orange is the last minute (blinks),
blue is "phase finished" (blinks).

## Build and install

```bash
./scripts/install.sh jim-pomodoro
```

This builds `dist/index.mjs` (the SDK is bundled in) and copies `dist/` and
`package.json` to `~/.jimcast/plugins/<plugin id>/`. Fully quit and relaunch
jimcast-core afterwards: plugin processes outlive reloads.

The plugin id is the `name` in `package.json`. Add an alias for it in
`~/.jimcast/config.json`, then place the alias in `config_section.json`:

```json
"widgets": { "pomodoro": { "use": "com.jimcast.plugins.pomodoro" } }
```

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
