# jim-emojipicker

The emoji picker as an external jimcast plugin: a port of core's built-in
`emojiPicker.ts` (same shell scripts, same layout) built only on `@jimcast/sdk`.

## Install

```bash
jimcast plugin install emoji-picker
# or by package id:
jimcast plugin install com.jimcast.plugins.emoji-picker
```

This downloads the plugin from the plugin registry, installs its dependencies,
builds it (the SDK is bundled in), copies the result to
`~/.jimcast/plugins/<plugin id>/`, adds a `emoji-picker` alias to the `widgets`
map in `~/.jimcast/config.json` (if it isn't there yet), and asks the running
jimcast-core to reload. It needs `git`, `node`, `pnpm` and `bash`.

The plugin id is the `name` in `package.json`. The alias that gets added is:

```json
"widgets": { "emoji-picker": { "use": "com.jimcast.plugins.emoji-picker" } }
```

The alias only declares the widget. To show it, place `emoji-picker` in a
section of your layout (`config_section.json`).

Plugin processes outlive reloads, so if you reinstall over a running copy,
fully quit and relaunch jimcast-core.

### Install from a local checkout (plugin development)

```bash
./scripts/install.sh emoji-picker
```

This does the same build and copy from your working tree, without cloning. It
does not touch `config.json` or reload the app, so add the alias above by hand
and relaunch jimcast-core.

## Usage

Click / Enter on a tile copies the emoji, moves it to the top of Recent and
dismisses the bar. The tab row switches category.

## CLI

```bash
jimcast widget commands com.jimcast.plugins.emoji
jimcast widget command com.jimcast.plugins.emojipicker list
jimcast widget command com.jimcast.plugins.emojipicker use food
jimcast widget command com.jimcast.plugins.emojipicker search heart
jimcast widget command com.jimcast.plugins.emojipicker copy rocket
```

## Differences from the built-in picker

- Own state (`~/.jimcast/plugin-data/<plugin id>/`) and own item ids (`extem:` / `extem-`),
  so both can coexist. Recent is NOT shared with the built-in one.
- Spec id is `com.jimcast.plugins.emojipicker` (the built-in one is `emoji`).
- Search: the original set `searchable: true` on the descriptor and never read
  a query itself. Here that is `section.querySearchActive: true`; if search
  does nothing, check how the SDK exposes it (see `index.ts`).
