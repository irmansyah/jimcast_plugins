# jim-calendar

A calendar widget for jimcast, built only on `@jimcast/sdk`.

A five-day strip with today in the middle, a full date line above it, and
today's tasks below (at most 3, open first, "+N" when there are more).

## Install

```bash
jimcast plugin install calendar
# or by package id:
jimcast plugin install com.jimcast.plugins.calendar
```

This downloads the plugin from the plugin registry, installs its dependencies,
builds it (the SDK is bundled in), copies the result to
`~/.jimcast/plugins/<plugin id>/`, adds a `calendar` alias to the `widgets`
map in `~/.jimcast/config.json` (if it isn't there yet), and asks the running
jimcast-core to reload. It needs `git`, `node`, `pnpm` and `bash`.

The plugin id is the `name` in `package.json`. The alias that gets added is:

```json
"widgets": { "calendar": { "use": "com.jimcast.plugins.calendar" } }
```

The alias only declares the widget. To show it, place `calendar` in a
section of your layout (`config_section.json`).

Plugin processes outlive reloads, so if you reinstall over a running copy,
fully quit and relaunch jimcast-core.

### Install from a local checkout (plugin development)

```bash
./scripts/install.sh calendar
```

This does the same build and copy from your working tree, without cloning. It
does not touch `config.json` or reload the app, so add the alias above by hand
and relaunch jimcast-core.

## Tasks file

`~/.jimcast/plugin-data/<plugin id>/tasks`, one task per line:

```
YYYY-MM-DD|<0 open | 1 done>|task text
```

Until the file exists, two dummy tasks are shown (an empty file means "no
tasks"). Past days are dropped whenever the file is saved from here.
`readTasks()` in `src/tasks.ts` is the seam for a real API.

## CLI

```bash
jimcast widget command com.jimcast.plugins.calendar tasks
jimcast widget command com.jimcast.plugins.calendar add "write the report"
jimcast widget command com.jimcast.plugins.calendar done 1      # toggles open <-> done
jimcast widget command com.jimcast.plugins.calendar rm 2
jimcast widget command com.jimcast.plugins.calendar clear
```

## Notes

- Font sizes and the corner radius are constants at the top of `render.ts`.
  Tune them to your design system.
- The 60-second refresh is `repeat` on `createWidget`, so the date rolls over at midnight.
