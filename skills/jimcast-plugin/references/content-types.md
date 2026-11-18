# Content types

Top level is a `WidgetContent`. Compose with `group`.

| type | shape | good for |
|---|---|---|
| `list` | `{ type:"list", datas: WidgetItem[] }` | vertical rows, the default |
| `rows` | `{ type:"rows", datas }` | compact rows, tab bars |
| `grid-3` | `{ type:"grid-3", datas }` | buttons in 3 columns (Confirm/Cancel, Pause/Skip/Cancel) |
| `tiles` | `{ type:"tiles", columns, gap, datas }` | dense grids: color swatches, emoji |
| `text` | `{ type:"text", data: WidgetItem }` | one static line |
| `progress` | `{ type:"progress", datas }` | bar: `label1` left text, `labelRight`, `color1` = fill |
| `image` | `{ type:"image", data:{ src, alt, height } }` | thumbnails (`data:` URL) |
| `group` | `{ type:"group", direction:"row"\|"column", gap, sections }` | layout |

A group section: `{ id, flex?, height?, navigable?, scrollable?, style?, content }`.

- Give columns a fixed `height` and let them scroll so the window never changes size.
- `navigable: false` = display only; the keyboard cursor skips it.
- Footers: `height` + `scrollable: false`.

## Layout recipe: two rows

```ts
{ type: "group", direction: "column", gap: 6, sections: [
  { id: "bar",  content: { type: "rows", datas: bar } },
  { id: "body", content: { type: "tiles", columns: 12, gap: 2, datas: tiles } },
] }
```

See: `plugins/emoji` (tabs + tiles), `plugins/pomodoro` (row group + progress + grid-3).
