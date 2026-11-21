# jim-notes

Simple markdown notes for a folder you choose. The folders (tabs), file naming and template come from
`config.json`, so the same plugin works as a plain notes folder or as a full Zettelkasten.

```
[ 📥 11 ] [ 📝 ] [ 📁 3 ]
Capture fast, no polish. Process within 7 days.
⚠ 3 Inbox notes older than 7 days
Neovim find and replace                        inbox · 2026-01-09
NEW  ＋ Notes    NEW IN  book    CLIP  📋 To inbox    CONFIG  Open    VAULT  Open
```

macOS only (`open`, `pbpaste`).

## Install

```sh
./scripts/install.sh jim-notes
```

The alias lives in `app_config.json` (declared in `package.json` as `jimcast.app_config`); the installer copies
it to the installed folder. If core does not apply it automatically, merge it into `~/.jimcast/config.json`:

```json
"widgets": { "note": { "use": "com.jimcast.plugins.notes" } }
```

Then `jimcast widget command note setup` creates the folders from the config.

## Config

`~/.jimcast/plugin-data/<plugin id>/config.json` is written with a simple default (inbox / notes / projects
under `~/Notes`) the first time the widget runs. After that it is yours: use the CONFIG button to open it.

| Key | Meaning |
|---|---|
| `root` | notes folder (absolute, or starting with `~/`) |
| `stale_days` | notes older than this are flagged by `check: ["stale"]` (default 7) |
| `template` | template file relative to `root`, copied as-is into new notes |
| `file_name` | `"date_title"` gives `2026-01-09_My-Title.md`, `"title"` gives `My-Title.md` |
| `extra_dirs` | more folders for `setup` to create |
| `tabs[]` | one per folder, see below |

Tab keys: `key`, `name`, `icon`, `dir` (relative to `root`), `recursive` (list sub-folders too), `sub`
(sub-folders a new note can go in; NEW IN cycles through them), `hint` (line under the tabs), `file_name`
(overrides the global naming), `new` (`false` hides NEW), `check` (`"stale"` flags old notes by modified time,
`"orphans"` flags notes without a `[[link]]`).

### Zettelkasten setup

Replace `tabs` (and optionally `extra_dirs`) with:

```json
"extra_dirs": ["assets", "images", "templates", "projects"],
"tabs": [
  { "key": "inbox", "name": "Inbox", "icon": "📥", "dir": "inbox",
    "hint": "Capture fast, no polish. Process within 7 days.", "check": ["stale"] },
  { "key": "notes", "name": "Notes", "icon": "📝", "dir": "notes", "recursive": true,
    "sub": ["book", "cheat-sheet", "code-snip", "doc", "fact", "task", "video"],
    "hint": "One subject per note. The folder is the type." },
  { "key": "hubs", "name": "Hubs", "icon": "🗂", "dir": "hubs", "file_name": "title",
    "hint": "Entry points into a topic: links with one line of context.", "check": ["orphans"] },
  { "key": "zettel", "name": "Zettelkasten", "icon": "💎", "dir": "zettelkasten",
    "hint": "One idea. Own words. Link to at least one other note.", "check": ["orphans"] },
  { "key": "projects", "name": "Projects", "icon": "📁", "dir": "projects",
    "recursive": true, "file_name": "title" }
]
```

The inbox tab is the target of CLIP and `capture`: the tab with key `inbox`, or the first tab if there is none.

## CLI

```sh
jimcast widget command note setup
jimcast widget command note status [--json]
jimcast widget command note check
jimcast widget command note new notes book "My title" [--open]
jimcast widget command note capture "text, the first line names the note"
jimcast widget command note move milk notes book     # part of file name, tab, [sub]
```

## Differences from the built-in

- `config.json`, `tab` and `sub` moved from `~/.jimcast/note/` to `~/.jimcast/plugin-data/<plugin id>/`.
  Copy your existing `config.json` there (set `root` as before).
- Simplified: the 📜 rules tab and the `rules` keys (global and per tab) are gone; `hint` stays. Old configs
  that still have `rules` load fine, the key is ignored.
- The default config is a plain notes folder under `~/Notes` instead of the ManeVault structure (the
  Zettelkasten setup above gives you that back), and it is written as JSON, not base64.
- Actions are closures; titles and paths are quoted into the scripts, so the `{`/`}` restriction is gone.
- Shell options (`timeout_secs`, `trim_output`, `ignore_exit_code`) are dropped.
- Item ids use the `extnote` prefix; the CLI id is the full widget id (alias from `config.json`).
- A CONFIG button is on every tab (it was only on the rules tab).
