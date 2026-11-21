# com.jimcast.plugins.colorpicker

The color picker as an external jimcast plugin: a port of core's built-in
`colorPicker.ts` (same shell scripts, same layout) built only on `@jimcast/sdk`.

## Build and install

```bash
pnpm install        # or npm install
pnpm build          # -> dist/index.mjs (the SDK is bundled in)
```

Copy `dist/` and `package.json` to `~/.jimcast/plugins/com.jimcast.plugins.colorpicker/`
(or use `jimcast-core/scripts/sync-plugin.sh jim-colorpicker`), then
reload jimcast-core. Open it as a panel:

```json
{ "id": "com.jimcast.plugins.colorpicker", "label": "Colors", "kind": "external-component" }
```

## Usage

- Single click on a tile: save the color to the SAVE TO profile (copy mode).
- Enter / double click: the ENTER mode action (Copy / Save / Remove).
- The PALETTE row cycles Spectrum, the built-in schemes, then your profiles.

## CLI

```bash
jimcast widget commands com.jimcast.plugins.colorpicker
jimcast widget command com.jimcast.plugins.colorpicker list
jimcast widget command com.jimcast.plugins.colorpicker use nord
jimcast widget command com.jimcast.plugins.colorpicker new "My palette"
jimcast widget command com.jimcast.plugins.colorpicker add '#ff8800' '#00aaff'
```

## Differences from the built-in picker

- Own state (`~/.jimcast/plugin-data/<plugin id>/`) and own item ids (`extcp:` / `extcp-`),
  so both can coexist. Profiles are NOT shared with the built-in one
  (copy the files across if you want them).
- Spec id is `com.jimcast.plugins.colorpicker` (the built-in one is `colors`).
- The SAVE TO / PROFILE / ENTER action bar is hidden, as in the original
  (it was commented out there). Set `SHOW_ACTION_BAR = true` in `render.ts`
  to show it.
- No keys: the original had none.
