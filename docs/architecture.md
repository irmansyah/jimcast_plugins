# Architecture

```
jimcast-core (Tauri + React)                       your plugin (Node process, started on demand)
────────────────────────────                       ─────────────────────────────────────────────
reads ~/.jimcast/plugins/*/package.json            dist/index.mjs  ← bundled with @jimcast/sdk
  → widgets, capabilities, show_in, repeat         bootstrapPlugin(plugin)  (JSON-RPC over stdio)

render_widget("<name>.<id>")  ───────────────────▶ widget.render(ctx) → WidgetContent
                              ◀─────────────────── serialized tree; actions become function ids
click / Enter on a row        ── invokeWidgetAction(fnId) ─▶ runs your closure (ctx.exec(script))
  then: refresh               ── render_widget again ──────▶ new tree from the new state
```

## Concepts

- **Widget**: `createWidget({ id, section, render, cli?, keys? })`. Pure view over state.
- **Item**: a row/tile/button. `id`, `attribute` (labels, colors), `style`, `action`.
- **Action**: `{ run, then }`. `run` is a closure in your process; `then` tells core what to do next.
- **State**: files in `~/.jimcast/ext-<name>/`. Re-read each render, so the CLI, keys, clicks and
  hand-edits all see the same truth.
- **CLI / keys**: specs attached to the widget; both go through `ctx.dispatch` so they behave like a click.

## Why this shape

- No UI framework for plugin authors: a tree of data is easy for humans and LLMs to generate and review.
- Plain-file state: debuggable with `cat`, scriptable from anywhere.
- Shell as the effect layer: macOS already has `pbcopy`, `osascript`, `open`, `sips`.

## Repo layout

See [`AGENTS.md`](../AGENTS.md). Plugins are self-contained and share only `tsconfig.base.json`.
The SDK path is set once in the root `package.json` (`pnpm.overrides`).

## Plugin flavors

`scripts/install.sh` detects the flavor from the files in the plugin folder:

| Flavor | Detected by | Output copied to `~/.jimcast/plugins/<package name>/` | Use for |
|---|---|---|---|
| native | `tsdown.config.ts` | `dist/` + `package.json` | widgets (everything in `plugins/` today) |
| react | `vite.config.ts` | `dist/` (+ `dist-backend/`) + `package.json` | webview UIs; `dist-backend/` is the optional host-communication process |
| unknown | neither | whatever `dist/` appears | builds anyway, with a warning |

`manifest.json` and `config.json` are copied too when the plugin has them.
The destination folder is always the **package name** (core routes on it), not the repo folder name.

React plugins use `@jimcast/react-sdk` (`jimcast-sdk/packages/react-sdk`). If you add one here, add a
`link:` override for it next to the other two in the root `package.json` (`pnpm.overrides`).
