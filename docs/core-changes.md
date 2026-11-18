# Core changes needed

External widgets can't auto-refresh in jimcast-core until `repeat` is read from the plugin manifest.
Five small patches:

## 1. Rust: `src-tauri/src/domain/plugin/manifest.rs`

Add `WidgetRepeat { enable: bool, seconds: u64 }` and `repeat: Option<WidgetRepeat>` on `WidgetDecl`
(`#[serde(default, skip_serializing_if = "Option::is_none")]`), so `PluginMeta.widgets` carries it to the frontend.

## 2. `frontend/src/domain/plugin/types.ts`

```ts
export interface PluginWidgetDecl {
  id: string; show_in?: string[]; searchable?: boolean
  repeat?: { enable: boolean; seconds: number }
}
```

## 3. `frontend/src/application/widget/externalWidgets.ts`

Keep a `repeatMeta` map filled in `loadExternalWidgets`, export `externalRepeatSeconds(id): number | null`.

## 4. `frontend/src/presentation/hooks/useWidgetSlot.ts`

Poll external widgets too: a `repeatSeconds(id, mode)` helper (internal: descriptor `repeat`; external:
`externalRepeatSeconds`, only when visible in the mode), and a `busy` flag per interval so slow renders don't pile up.

## 5. Also accept `repeat` from `createWidget` (manifest wins)

`externalWidgets.ts` keeps two maps: `manifestRepeat` (from `package.json`) and `renderRepeat` (from the
`section.repeat` of each `render_widget` response, recorded by `noteExternalRenderRepeat` in `makeExternalSource`).
`externalRepeatSeconds(id)` returns the manifest value if there is one (even `enable: false`), else the render-time one.
Intervals are created after every widget's first render, so no first tick is lost.

## Plugin side

Declare it in `package.json` (wins) and, optionally, in `createWidget({ repeat })`:

```json
"jimcast": { "widgets": [{ "id": "pomodoro", "repeat": { "enable": true, "seconds": 1 } }] }
```

Until these land in core, `pomodoro` and `calendar` render correctly but update on clicks only.
