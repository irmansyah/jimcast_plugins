# file-manager

Column-based file browser plugin for jimcast-core.

## Two independent entry points

- **`backend.ts`** → built to `dist/backend.cjs`, referenced by
  `package.json`'s `"main"`. This is what
  `plugin_runtime.rs::spawn_plugin` execs when jimcast-core calls
  `invoke_command("file-manager", ...)`. Talks NDJSON over stdin/stdout.
- **`main.tsx`** → webview UI (`FileExplorerPlugin.tsx`), loaded in an
  iframe via `jimcast-plugin://file-manager/`. Talks to `backend.ts`
  through `callHost`/postMessage (see `plugin-sdk/client.ts`) — never
  talks to the Node process directly.

`helpers.ts` is imported by both — kept free of DOM and Node-only APIs
(the one exception, `openWithSystemPlayer`, uses `callHost` and is
webview-only; `backend.ts` re-implements the same shell one-liner locally
since it runs as the Node process itself and doesn't need to round-trip
through a host it effectively *is*).

## Commands (invoke_command / executeCommand contract)

| command         | args                                                   | returns                        |
|-----------------|----------------------------------------------------------|-----------------------------------|
| `listDir`       | `{ path, showHidden?, colIndex? }`                       | `{ entries: FileEntry[] }`         |
| `resolveHome`   | `{ path }`                                                | `{ path: string }`                  |
| `buildPath`     | `{ segments: string[] }`                                  | `{ path: string }`                   |
| `entryFullPath` | `{ segments, name, homeDir }`                              | `{ path: string }`                    |
| `openFile`      | `{ path }`                                                  | `{}`                                    |
| `isAvFile`      | `{ name }`                                                   | `{ isAv: boolean }`                      |
| `listRoots`     | `{}`                                                          | `{ roots: string[] }`                     |
| `renderWidget`  | (host-supplied `envContext`/`hostContext`)                     | `{ content: {...} }`                       |
| `executeCommand`| `{ commandId, query, ... }`                                      | `{ items: [...] }`                          |

## Capabilities

Declared in `package.json`'s `jimcast.capabilities`:
- `shell` — `listDir` shells out to `ls`, `openFile` shells out to the
  OS-default opener (`open`/`xdg-open`/`start`).
- `fs:read` — reflects that this plugin's entire purpose is reading the
  filesystem, even though the actual reads currently go through `ls`
  rather than direct `fs` calls.

`build_sandbox_env` (`plugin_runtime.rs`) turns these into
`JIMCAST_CAP_SHELL=1` / `JIMCAST_CAP_FS_READ=1` (+ `JIMCAST_FS_ROOT`) env
vars — this is an *advisory* boundary today (nothing in `backend.ts`
currently reads or enforces those vars itself), not an OS-level sandbox.

## `renderWidget` response shape

Unverified against the real widget content schema
(`domain/widget/types.ts` on the host side) — only checked against
`PluginService::render_widget`'s call site, not the frontend consumer.
Confirm before relying on it rendering correctly in `WidgetSlot`.

## Known coupling (not yet resolved)

`styles.ts` still imports theme tokens (`alpha`, `hairline`, `radius`,
`space`, `fv`, `theme`) from the host's `designSystem`/`globalSetup`
modules rather than being fully standalone. Once this plugin ships as a
truly separate build, replace that with a `themeSync` postMessage event
(same envelope as `nav`) feeding a small in-plugin theme store, the way
`plugin-sdk/client.ts`'s `onHostNav` pattern already works for keyboard
nav. Left as-is for now — the immediate goal was decoupling *behavior*
(shell/drag/nav/openFiles into `backend.ts`), not the theme system.

## Build & install (dev workflow)

```bash
npm install
npm run build            # → dist/{index.html,assets,backend.cjs}

# sync into the runtime location jimcast-core actually reads from
mkdir -p ~/.jimcast/plugins/file-manager
rsync -a --delete dist/ ~/.jimcast/plugins/file-manager/
cp package.json ~/.jimcast/plugins/file-manager/package.json
```

Note the sync flattens `dist/` into the plugin root (rather than nesting
it) so `package.json`'s `"main": "backend.cjs"` resolves directly against
`~/.jimcast/plugins/file-manager/backend.cjs` — matching how
`plugin_runtime.rs::spawn_plugin` resolves
`plugin_dir.join(manifest.entry_file())`. If you'd rather keep `dist/`
nested, change `"main"` to `"dist/backend.cjs"` in the copied
`package.json` instead — just keep the sync script and the manifest
consistent with each other.
