# jim-calendar

A calendar widget for jimcast, built only on `@jimcast/sdk`.

A five-day strip with today in the middle, a full date line above it, and
today's tasks below (at most 3, open first, "+N" when there are more).

## Build and install

```bash
./scripts/install.sh jim-calendar
```

This builds `dist/index.mjs` (the SDK is bundled in) and copies `dist/` and
`package.json` to `~/.jimcast/plugins/<plugin id>/`. Fully quit and relaunch
jimcast-core afterwards.

Add an alias in `~/.jimcast/config.json` and place it in `config_section.json`:

```json
"widgets": { "calendar": { "use": "com.jimcast.plugins.calendar" } }
```

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
