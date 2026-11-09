# jimcast-external-calendar

The calendar widget as an external jimcast plugin: a port of core's built-in
`calendar.ts` (same layout, same tasks file format) built only on `@jimcast/sdk`.

A five-day strip with today in the middle, a full date line above it, and
today's tasks below (at most 3, open first, "+N" when there are more).

## Build and install

```bash
pnpm install        # or npm install
pnpm build          # -> dist/index.mjs (the SDK is bundled in)
```

Copy `dist/` and `package.json` to `~/.jimcast/plugins/jimcast-external-calendar/`
(or use `jimcast-core/scripts/sync-plugin.sh jimcast-external-calendar`), then
reload jimcast-core. Show it with:

```json
{ "id": "jimcast-external-calendar.calendar", "label": "Calendar", "kind": "external-component" }
```

## Tasks file

`~/.jimcast/ext-calendar/tasks`, one task per line:

```
YYYY-MM-DD|<0 open | 1 done>|task text
```

Until the file exists, two dummy tasks are shown (an empty file means "no
tasks"). Past days are dropped whenever the file is saved from here.
`readTasks()` in `src/tasks.ts` is the seam for a real API.

## CLI

```bash
jimcast widget command xcalendar tasks
jimcast widget command xcalendar add "write the report"
jimcast widget command xcalendar done 1      # toggles open <-> done
jimcast widget command xcalendar rm 2
jimcast widget command xcalendar clear
```

## Differences from the built-in calendar

- Own tasks file (`~/.jimcast/ext-calendar/tasks`) and own item ids
  (`extcal-`), so both can coexist. Tasks are NOT shared (copy the file across
  if you want them).
- Spec id is `xcalendar` (the built-in one is `calendar`).
- Font sizes and the corner radius were `theme.font.*` / `radius.md` in core;
  here they are constants at the top of `render.ts`. Tune to your design system.
- The 60-second refresh is passed as `repeat` on `createWidget`; if the SDK
  names it differently, adjust `index.ts`.
