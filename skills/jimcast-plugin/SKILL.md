---
name: jimcast-plugin
description: Write, review, debug or port jimcast plugins (external widgets built with TypeScript and @jimcast/sdk). Use when the user wants a new jimcast widget or plugin, wants to add CLI commands or keyboard actions to one, asks why a plugin widget does not render, update or refresh, or wants to move a built-in core widget into an external plugin.
---

# jimcast-plugin

A jimcast plugin is a small Node program that renders **widgets** (data, not HTML)
into the jimcast command bar. This repo has 4 real plugins and 2 examples; copy
them instead of inventing structure.

## Fast path (do this first)

1. `./scripts/new-plugin.sh <name>` scaffolds `plugins/<name>` from `templates/plugin`.
2. Edit `src/render.ts` (the look), `src/shell.ts` (state + scripts), `src/commands.ts` (CLI).
3. `pnpm install && pnpm typecheck`
4. `./scripts/install.sh <name>` builds and copies to `~/.jimcast/plugins/<package name>/`.
   It detects the flavor itself: `tsdown.config.ts` = native widget plugin (what you want), `vite.config.ts` = react webview plugin.
5. Add the panel entry to `config_section.json` and reload jimcast-core.

Smallest working code: `examples/hello/src/index.ts` (1 file). Full shape:
`examples/counter/` (state file + buttons + CLI). Rich UI: `plugins/pomodoro`, `plugins/colors`.

## Mental model

- **Stateless render.** `render(ctx)` runs every time core asks; it rebuilds the whole
  `WidgetContent` tree from state it reads (files under `~/.jimcast/ext-<name>/`). Never keep state in memory.
- **Actions are closures.** `action: { run: async () => { await ctx.exec(script) }, then: "refresh" }`.
  `then` is `"refresh"` (re-render), `"dismiss"` (close the bar) or `"refresh|dismiss"`.
- **Shell is the engine.** macOS shell scripts do the work (`pbcopy`, `osascript`, `open`, `sips`, `stat -f%z`).
  Quote EVERY interpolated value with `shq()`.
- **CLI and keys reuse actions** via `ctx.dispatch(cliItem(...))`, so a CLI call re-renders like a click.

## Hard rules (each one is a bug someone hit)

1. Widget id is `"<package.json name>.<suffix>"` and the suffix must be listed in
   `package.json` → `jimcast.widgets[].id`. Core routes on the text before the first `.`.
2. Package folder name in `~/.jimcast/plugins/` must equal the package `name`.
3. Item ids: unique per widget, stable across renders, and start with the plugin's own prefix
   (`ext…`). Core's built-ins own `fm`, `cp`, `em`, `cal-`, `pomodoro`; reusing them makes core grab your rows.
4. CLI spec id must not be a core name (`finder`, `colors`, `emoji`, `calendar`, `pomodoro`). Use `<plugin id>`.
5. Bundle the SDK: `tsdown.config.ts` has `noExternal: [/^@jimcast\//]` (core ships only `dist/` + `package.json`).
6. State files go in `~/.jimcast/ext-<name>/`, never in a directory core or another plugin uses.
7. Colors: read `ctx.host.theme.colors` with a fallback for every key. No hard-coded palette.
8. Timers: set `repeat` in BOTH `package.json` `jimcast.widgets[]` and `createWidget({ repeat })`.
   Core uses the manifest value first, then the render-time one (needs `docs/core-changes.md`).
   If they differ, the manifest wins, and `enable: false` there turns polling off.
9. Never `rm` user files. Move to Trash (see `plugins/finder` if present, or `references/shell-patterns.md`).

## Where to look

| Need | Read |
|---|---|
| Every field of `createWidget`, `ctx`, items, sections | `references/widget-api.md` |
| Which `content.type` to use for what | `references/content-types.md` |
| State files, quoting, background jobs, macOS commands | `references/shell-patterns.md` |
| CLI commands and keyboard actions | `references/cli-and-keys.md` |
| Things core does that surprise you | `references/core-quirks.md` |
| Moving a built-in descriptor out of core | `references/porting-from-core.md` |
| Pre-flight checklist | `references/checklist.md` |

## Output format when asked to build a plugin

Produce the whole folder (`package.json`, `tsconfig.json`, `tsdown.config.ts`, `README.md`,
`src/{index,render,shell,commands}.ts`), then give the user: the install command, the
`config_section.json` panel entry, and the CLI usage. State anything unverified.

## Verify against the SDK

Types are the source of truth: `jimcast-sdk/packages/sdk/src/{widget,ui,context,specs}.ts`.
If a field in these docs is rejected by the typechecker, trust the typechecker and fix the doc.
