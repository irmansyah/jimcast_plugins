<!-- [plugin] jimcast-external-finder/README.md -->
# jimcast-external-finder

A macOS Finder-style column browser as an external jimcast plugin. It is a port
of core's built-in `finder.ts` (same shell scripts, same layout) built only on
`@jimcast/sdk`.

## Build and install

```bash
pnpm install        # or npm install
pnpm build          # -> dist/index.mjs (the SDK is bundled in)
```

Copy `dist/` and `package.json` to `~/.jimcast/plugins/jimcast-external-finder/`
(or use `jimcast-core/scripts/sync-plugin.sh jimcast-external-finder` if it
looks for plugins next to the core checkout), then reload jimcast-core.

Open it as a panel (it must be the OPEN panel for the keys to work):

```json
{ "id": "jimcast-external-finder.finder", "label": "Finder", "kind": "external-component" }
```

## Keys (`key_bindings.xfinder`)

| Action | Default | |
|---|---|---|
| `mark` | `space` | mark / unmark the row |
| `select` | `p` | select the row (shows its preview) |
| `up_dir` / `enter_dir` | `left` / `right` | parent / first entry |
| `toggle_hidden` | `shift+h` | dotfiles |
| `copy` / `move` / `paste` | `c` / `x` / `v` | marked set, else the row |
| `delete` / `confirm_delete` / `cancel_delete` | `d` / `y` / `n` | Trash, two steps |
| `zip` | `z` | zip marked (or the row) |
| `clear_marks` | `u` | |

Unbind with `""`: `{ "key_bindings": { "xfinder": { "zip": "" } } }`.

## CLI

```bash
jimcast widget commands xfinder
jimcast widget command xfinder open ~/Downloads --show
jimcast widget command xfinder mark a.png b.png
jimcast widget command xfinder trash --yes
```

## Differences from the built-in Finder

- Own state (`~/.jimcast/ext-finder-*`) and own item ids (`extfm:`), so both can coexist.
- Spec id is `xfinder` (the built-in one is `finder`).
- No cursor-follow live preview: core wires that only for its own `fm:` rows.
  The preview follows the selection (Enter on a folder, or `p`).
- Needs the core changes in the SDK's `CORE_CHANGES.md` (plugin specs, dispatch,
  `{ run, then }` actions).
