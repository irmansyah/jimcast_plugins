<!-- README.md -->
# jim-finder

macOS Finder-style column view (up to 3 columns: parent, current folder, contents or file preview) with
multi-select marks, copy/cut/paste, zip, Trash (two-step confirm), hidden-file toggle and image thumbnails.
macOS only (`stat -f`, `sips`, `md5 -q`, `open`).

## Install
```
pnpm install && pnpm build && pnpm typecheck
```
Copy `dist/` and `package.json` into `~/.jimcast/plugins/<plugin id>/`.

## Panel entry
```json
{ "widget": "com.jimcast.plugins.finder" }
```

## CLI
```
jimcast widget command com.jimcast.plugins.finder status [--json]
jimcast widget command com.jimcast.plugins.finder select ~/Documents
jimcast widget command com.jimcast.plugins.finder enter | up
jimcast widget command com.jimcast.plugins.finder mark a.txt b.txt
jimcast widget command com.jimcast.plugins.finder select-all
jimcast widget command com.jimcast.plugins.finder zip
jimcast widget command com.jimcast.plugins.finder trash --yes
jimcast widget command com.jimcast.plugins.finder open ~/Pictures
```
Other commands: `path`, `marked`, `cd`, `unmark`, `toggle`, `clear`, `hidden`, `launch`, `reveal`.

## Keys
`space` mark · `shift+v` mark all · `shift+h` hidden · `y` copy · `x` cut · `p` paste · `d` trash ·
`shift+y` confirm · `n` cancel · `z` zip · `u` unmark · `h` / `l` parent / into (new, see below).

## Differences from the built-in
- Ids: widget `com.jimcast.plugins.finder`, CLI/keys spec `com.jimcast.plugins.finder`, item prefix `extfm`.
- State lives in `~/.jimcast/plugin-data/<plugin id>/` (`path`, `hidden`, `clipboard`, `marked`, `confirm`, `thumbs/`),
  so it coexists with the built-in. Marks and clipboard are not shared with it.
- `ctx.exec` takes no options: `ignore_exit_code`, `trim_output` and `timeout_secs` (8 s thumbnails,
  60/120 s zip/trash/paste) are dropped. Read scripts end in `exit 0` and output is trimmed by hand.
- Select/left/right scripts now `mkdir -p` the state dir first (it may not exist on first run).
- **No live preview, no Left/Right.** The core nav spec (cursor-follow preview, arrow-key column
  navigation) can't be registered by plugins. Enter on a folder row selects it (this was already the
  row action). `h`/`l` (`go_up`/`go_in`) replace Left/Right.
- Fonts (`xs/sm/lg` = 11/12/15) and fallback colors are local constants.
