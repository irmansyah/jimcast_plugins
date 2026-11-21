# jim-jtop

A btop-style system monitor widget for jimcast (macOS). Same layout as btop: bordered, coloured
boxes for cpu, mem (+ disk), net and proc, with graphs. It re-renders every 2 seconds.

```
┌ cpu ──────────── up 3d 4h ┐  ┌ proc ───────────── sort: cpu ┐
│ ▁▂▃▅▇█▇▅▃▂  (2 rows)       │  │ PID    PROGRAM     ▼CPU%  MEM%  │
│ CPU user 5% sys 10%    15% │  │ 412    Chrome      12.3%   4.1%  │
│ Load avg 1.20 1.30 1.40    │  │ ...                              │
├ mem ──────────────── 16 GB ┤  └──────────────────────────────────┘
│ Used / Available / Cached / Free, disk │
├ net ─────────────────────── ┤
│ ▼ download + graph, ▲ upload + graph │
```

All code is in one file, `src/index.ts` (shell, data, render, commands, plugin, in that order).

## Install

```sh
pnpm install && pnpm build && pnpm typecheck
./scripts/install.sh jim-jtop
```

`install.sh` copies `app_config.json` next to `package.json` in `~/.jimcast/plugins/<plugin id>/`.
It adds the `jtop` alias to the platform config. If the alias is not applied automatically,
merge this into `~/.jimcast/config.json`:

```json
{ "widgets": { "jtop": { "use": "com.jimcast.plugins.jtop" } } }
```

## CLI

```sh
jimcast widget command jtop status   # CPU 23% · MEM 9.1 GB/16 GB (57%) · DISK 46% · ↓ 1.2 MB/s ↑ 0 B/s
jimcast widget command jtop top      # top processes as text
jimcast widget command jtop sort     # toggle cpu <-> mem
```

## Keys

| Key | Action |
|---|---|
| `s` | Toggle the process sort (cpu / mem) |

Remap in `~/.jimcast/keybinding.json`:
`"widgets": { "com.jimcast.plugins.jtop": { "sort": "x" } }`

## Layout

`SIDE_BY_SIDE` at the top of `src/render.ts`: `true` puts proc right of cpu/mem/net (btop);
`false` stacks the four boxes, for a narrow panel. `HIST_LEN` in `src/shell.ts` is the graph
width in samples (2 s each).

## State

`~/.jimcast/plugin-data/<plugin id>/`
- `net`: previous network counters, used to compute the rate
- `sort`: `cpu` or `mem`
- `hist`: the last 40 samples (cpu %, download B/s, upload B/s) for the graphs

## Differences from btop

- No per-core CPU meters or CPU temperature: macOS gives neither without sudo. CPU shows the
  total with the user / sys split.
- Graphs are block characters, not braille. The CPU graph is 2 rows tall, the net graphs 1 row.
- The process list is the top 10 by `ps`, with no tree view, filtering or signals.
- Boxes are not resizable and have no mouse or key navigation besides the sort key.

## Notes

- Each refresh runs one shell script. `top -l 2 -s 1` takes about 1 second, which is why CPU is
  accurate. The script finishes inside the 2-second period.
- The CPU graph and the colours use total CPU (0-100%). Process CPU is the raw `ps` value (can pass
  100% on several cores); its colour uses the share of the whole machine.
- Memory used = active + wired + compressor pages. Cached = file-backed + purgeable pages. It is
  close to Activity Monitor but not identical.
- Network sums the `en*` interfaces. The first sample shows `--` until a baseline exists.
