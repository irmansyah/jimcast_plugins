<!-- README.md -->
# jim-finder

macOS Finder-style column view (up to 3 columns: parent, current folder, contents or file preview) with
multi-select marks, copy/cut/paste, zip, Trash (two-step confirm), hidden-file toggle and image thumbnails.
macOS only (`stat -f`, `sips`, `md5 -q`, `open`).

## Install

```bash
jimcast plugin install finder
# or by package id:
jimcast plugin install com.jimcast.plugins.finder
```

This downloads the plugin from the plugin registry, installs its dependencies,
builds it (the SDK is bundled in), copies the result to
`~/.jimcast/plugins/<plugin id>/`, adds a `finder` alias to the `widgets`
map in `~/.jimcast/config.json` (if it isn't there yet), and asks the running
jimcast-core to reload. It needs `git`, `node`, `pnpm` and `bash`.

The plugin id is the `name` in `package.json`. The alias that gets added is:

```json
"widgets": { "finder": { "use": "com.jimcast.plugins.finder" } }
```

The alias only declares the widget. To show it, place `finder` in a
section of your layout (`config_section.json`).

Plugin processes outlive reloads, so if you reinstall over a running copy,
fully quit and relaunch jimcast-core.

### Install from a local checkout (plugin development)

```bash
./scripts/install.sh finder
```

This does the same build and copy from your working tree, without cloning. It
does not touch `config.json` or reload the app, so add the alias above by hand
and relaunch jimcast-core.

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
