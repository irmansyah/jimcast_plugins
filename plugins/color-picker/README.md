# com.jimcast.plugins.color-picker

The color picker as an external jimcast plugin: a port of core's built-in
`color-picker.ts` (same shell scripts, same layout) built only on `@jimcast/sdk`.

## Install

```bash
jimcast plugin install color-picker
# or by package id:
jimcast plugin install com.jimcast.plugins.color-picker
```

This downloads the plugin from the plugin registry, installs its dependencies,
builds it (the SDK is bundled in), copies the result to
`~/.jimcast/plugins/<plugin id>/`, adds a `color-picker` alias to the `widgets`
map in `~/.jimcast/config.json` (if it isn't there yet), and asks the running
jimcast-core to reload. It needs `git`, `node`, `pnpm` and `bash`.

The plugin id is the `name` in `package.json`. The alias that gets added is:

```json
"widgets": { "color-picker": { "use": "com.jimcast.plugins.color-picker" } }
```

The alias only declares the widget. To show it, place `color-picker` in a
section of your layout (`config_section.json`).

Plugin processes outlive reloads, so if you reinstall over a running copy,
fully quit and relaunch jimcast-core.

### Install from a local checkout (plugin development)

```bash
./scripts/install.sh color-picker
```

This does the same build and copy from your working tree, without cloning. It
does not touch `config.json` or reload the app, so add the alias above by hand
and relaunch jimcast-core.

## Usage

- Single click on a tile: save the color to the SAVE TO profile (copy mode).
- Enter / double click: the ENTER mode action (Copy / Save / Remove).
- The PALETTE row cycles Spectrum, the built-in schemes, then your profiles.

## CLI

```bash
jimcast widget commands com.jimcast.plugins.color-picker
jimcast widget command com.jimcast.plugins.color-picker list
jimcast widget command com.jimcast.plugins.color-picker use nord
jimcast widget command com.jimcast.plugins.color-picker new "My palette"
jimcast widget command com.jimcast.plugins.color-picker add '#ff8800' '#00aaff'
```

## Differences from the built-in picker

- Own state (`~/.jimcast/plugin-data/<plugin id>/`) and own item ids (`extcp:` / `extcp-`),
  so both can coexist. Profiles are NOT shared with the built-in one
  (copy the files across if you want them).
- Spec id is `com.jimcast.plugins.color-picker` (the built-in one is `colors`).
- The SAVE TO / PROFILE / ENTER action bar is hidden, as in the original
  (it was commented out there). Set `SHOW_ACTION_BAR = true` in `render.ts`
  to show it.
- No keys: the original had none.
