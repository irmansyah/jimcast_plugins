# jimcast-external-emoji-picker

The emoji picker as an external jimcast plugin: a port of core's built-in
`emojiPicker.ts` (same shell scripts, same layout) built only on `@jimcast/sdk`.

## Build and install

```bash
pnpm install        # or npm install
pnpm build          # -> dist/index.mjs (the SDK is bundled in)
```

Copy `dist/` and `package.json` to `~/.jimcast/plugins/jimcast-external-emoji/`
(or use `jimcast-core/scripts/sync-plugin.sh jimcast-external-emoji`), then
reload jimcast-core. Open it as a panel:

```json
{ "id": "jimcast-external-emoji-picker.emoji", "label": "Emoji", "kind": "external-component" }
```

## Usage

Click / Enter on a tile copies the emoji, moves it to the top of Recent and
dismisses the bar. The tab row switches category.

## CLI

```bash
jimcast widget commands xemoji
jimcast widget command xemoji list
jimcast widget command xemoji use food
jimcast widget command xemoji search heart
jimcast widget command xemoji copy rocket
```

## Differences from the built-in picker

- Own state (`~/.jimcast/ext-emoji/`) and own item ids (`extem:` / `extem-`),
  so both can coexist. Recent is NOT shared with the built-in one.
- Spec id is `xemoji` (the built-in one is `emoji`).
- Search: the original set `searchable: true` on the descriptor and never read
  a query itself. Here that is `section.querySearchActive: true`; if search
  does nothing, check how the SDK exposes it (see `index.ts`).
