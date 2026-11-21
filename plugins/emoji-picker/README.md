# jim-emojipicker

The emoji picker as an external jimcast plugin: a port of core's built-in
`emojiPicker.ts` (same shell scripts, same layout) built only on `@jimcast/sdk`.

## Build and install

```bash
pnpm install        # or npm install
pnpm build          # -> dist/index.mjs (the SDK is bundled in)
```

Copy `dist/` and `package.json` to `~/.jimcast/plugins/com.jimcast.plugins.emojipicker/`
(or use `jimcast-core/scripts/sync-plugin.sh jim-emojipicker`), then
reload jimcast-core. Open it as a panel:

```json
{ "id": "com.jimcast.plugins.emojipicker", "label": "Emoji", "kind": "external-component" }
```

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
