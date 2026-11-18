# jim-clipboard-history

Clipboard history manager with the same layout as `jim-restapi`: the history on the left (pinned first, then
newest first), the full content of the selected entry on the right.

## Use

- **Enter** on a row selects it and shows it on the right. **Enter** on the already selected row copies it back
  to the clipboard and dismisses the bar.
- Pinned rows at the top: pause/resume capture, pin/unpin the selected entry, delete the selected entry, clear
  the unpinned history.
- Typing in the bar filters the list by each entry's first line.

## Install

```sh
./scripts/install.sh jim-clipboard-history
```

Add the alias to `~/.jimcast/config.json`:

```json
"widgets": { "clip": { "use": "com.jimcast.plugins.clipboard-history" } }
```

## Config

`~/.jimcast/plugin-data/<plugin id>/config.json` is created with defaults on first run. Edit it by hand, or use
`jimcast widget command clip config set <key> <value>`.

| Key | Default | Meaning |
|---|---|---|
| `capture` | `true` | `false` pauses capture (also toggled by the first row) |
| `max_items` | `50` | unpinned entries kept (1 to 1000) |
| `max_entry_bytes` | `20000` | larger clipboard contents are ignored |
| `preview_lines` | `300` | rows shown in the right pane |
| `label_max` | `60` | characters of a row label |
| `wrap_at` | `110` | width at which long preview lines are chunked |
| `ignore_patterns` | `[]` | `grep -E` patterns, matched per line; matching contents are never stored |
| `read_command` | `""` | shell command that prints the clipboard; empty = auto (`pbpaste`, `wl-paste`, `xclip`, `xsel`) |
| `write_command` | `""` | shell command that reads stdin into the clipboard; empty = auto (`pbcopy`, `wl-copy`, `xclip`, `xsel`) |

Example: `config set ignore_patterns '["^[A-Za-z0-9+/=_-]{32,}$", "password"]'`

## CLI

```sh
jimcast widget command clip list
jimcast widget command clip show 2          # entry number or id prefix
jimcast widget command clip copy 2
jimcast widget command clip pin 2           # toggles
jimcast widget command clip delete 2
jimcast widget command clip clear [--all]   # --all also removes pinned entries
jimcast widget command clip capture
jimcast widget command clip config [get <key> | set <key> <value> | reset]
```

## Storage

`~/.jimcast/plugin-data/<plugin id>/`: `config.json`, `entries/<id>` (one file per entry, id = content hash,
so a repeated copy just moves to the top), `pins/<id>`, `selected`, `skip`.

## Limits

- No background daemon: the clipboard is read on every widget refresh (every 2 s, `REFRESH_SECONDS` in
  `src/index.ts`; changing it needs a rebuild). Copies are only recorded while the widget is being refreshed.
- Text only.
- Ignore patterns match per line, not across lines.
