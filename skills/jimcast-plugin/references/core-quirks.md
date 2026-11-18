# Core quirks (things that surprised us)

1. **`repeat` has two sources, manifest first.** `package.json` `jimcast.widgets[].repeat` wins; otherwise core
   uses the `repeat` from `createWidget`, learned from the first render. Both need the patches in
   `docs/core-changes.md`; without them the widget renders once and updates on actions only.
2. **Manifest widget list** (`jimcast.widgets`) gives `show_in`, `searchable`, `repeat`. Undeclared widgets
   render only where `config_section.json` places them, in default mode.
3. **Id prefixes are global.** Core routes keys, CLI and live-select by item-id prefix. Collide with `fm`,
   `cp`, `em`, `cal-`, `pomodoro` and core handles your rows. Use `ext…`.
4. **CLI spec ids are global** too. Use `<plugin id>`.
5. **Core copies only `dist/` and `package.json`.** No `node_modules` at runtime, so bundle the SDK.
6. **Widget id routing**: `render_widget` takes the first dot-separated segment as the plugin name.
7. **Actions** from plugins are serialized as function ids; they work only for items core knows how to
   dispatch back. `then: "expand"` is for static `cmd` actions.
8. **Search**: `section.querySearchActive` controls whether the widget takes part; `searchable:false`
   in the manifest hides expensive widgets from search-only results.
9. **Stateless by design**: nothing persists in the plugin process between renders you can rely on.
10. **Fonts and radius**: core's `theme.font.*` and `radius.*` are not in the SDK. Use local constants.
