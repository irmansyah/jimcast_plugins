# jimcast-external-pomodoro

The pomodoro timer as an external jimcast plugin: a port of core's built-in
`pomodoro.ts` (same shell scripts, same layout) built only on `@jimcast/sdk`.

A boxed countdown beside a thin progress row, then a row of buttons. Green is
focus, aqua is break, yellow is paused, orange is the last minute (blinks),
blue is "phase finished" (blinks).

## Build and install

```bash
pnpm install        # or npm install
pnpm build          # -> dist/index.mjs (the SDK is bundled in)
```

Copy `dist/` and `package.json` to `~/.jimcast/plugins/jimcast-external-pomodoro/`
(or use `jimcast-core/scripts/sync-plugin.sh jimcast-external-pomodoro`), then
reload jimcast-core. Show it with:

```json
{ "id": "jimcast-external-pomodoro.pomodoro", "label": "Pomodoro", "kind": "external-component" }
```

## How it works

State is a timestamp, never a tick counter, so it is right even when the bar
was hidden for minutes. `~/.jimcast/ext-pomodoro-state` holds one line:

```
<running|paused> <focus|break> <end-epoch> <total-secs> <remaining-secs>
```

No file = idle. The desktop notification comes from a background `sleep`
started with the phase (its pid is in `ext-pomodoro-state.pid`), because
nothing renders while the bar is hidden. Pause / skip / cancel kill it.

## CLI

```bash
jimcast widget commands xpomodoro
jimcast widget command xpomodoro toggle     # start / pause / resume / next phase
jimcast widget command xpomodoro skip
jimcast widget command xpomodoro break
jimcast widget command xpomodoro reset
jimcast widget command xpomodoro status
```

## Differences from the built-in pomodoro

- Own state (`~/.jimcast/ext-pomodoro-state`) and own item ids (`extpomo-`),
  so both can coexist. Running both at once means two timers and two
  notifications; they do not share state.
- Spec id is `xpomodoro` (the built-in one is `pomodoro`).
- `alpha()` and `radius.md` came from core's design system; here they are small
  local helpers in `render.ts` (the alpha levels are guesses, tune them).
- The background notification process is started from the plugin's `ctx.exec`.
  It is fully detached (`&`, output and stdin redirected) as in core, but check
  that the host's exec does not wait for or kill it; if the notification never
  fires, that is the first place to look.
- The 1-second refresh is passed as `repeat` on `createWidget`.
