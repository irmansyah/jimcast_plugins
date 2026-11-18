# Widget API cheat sheet

Source of truth: `jimcast-sdk/packages/sdk/src/{widget,ui,context}.ts`. Verify there when unsure.

## createWidget

```ts
createWidget({
  id: "<package name>.<suffix>",                 // required
  section: {                                     // header + behaviour
    title: "Pomodoro", titleShow: true,
    navigationActive: true,                      // arrow-key navigation in this section
    querySearchActive: true,                     // participates in search
  },
  showIn: ["default"],                           // modes it appears in
  repeat: { enable: true, seconds: 1 },          // also put it in package.json jimcast.widgets[]; the manifest wins
  cli:  { id: "xname", owns: "extx", commands },  // optional, see cli-and-keys.md
  keys: { id: "xname", owns: "extx", actions },   // optional
  render: async (ctx) => WidgetContent,
})
definePlugin({ name, description, widgets: [widget] })
bootstrapPlugin(plugin)                           // last line of index.ts, from "@jimcast/sdk/runtime"
```

## ctx (ExecutionContext)

| Member | Use |
|---|---|
| `ctx.exec(cmd)` | run a shell command → `{ stdout, exitCode }` |
| `ctx.dispatch(item, { focus? })` | run an item's action as if clicked, then re-render |
| `ctx.host.theme.colors` | theme palette (`fg`, `fg2`, `fg4`, `bg`, `bg1`, `bg2`, `bg3`, `blue`, `yellow`, `brightGreen`, `brightRed`, …) |
| `ctx.keyLabels(specId)` | configured key labels per action id (for footer hints) |
| CLI ctx adds `ctx.args`, `ctx.cwd`, `ctx.showBar()` | |
| Key ctx adds `ctx.focusedItemId` | |

## WidgetItem

```ts
{
  id: "extx-row:3",                  // unique + stable
  pinned: true,                      // keep visible while searching
  attribute: {
    label1, label2, label3, labelRight,
    color1, color2, colorRight,
    textSize1, textSizeRight,
    image,                           // emoji or data: URL
  },
  style: { background, borderRadius, borderColor, borderWidth, padding },
  action:      { run, then },        // Enter / activate
  clickAction: { run, then },        // single click, when different from Enter
}
```

Action type without importing a name: `NonNullable<WidgetItem["action"]>`.
`then`: `"refresh" | "dismiss" | "refresh|dismiss"`.

## Focus after re-render

`ctx.dispatch(item, { focus: { id } })` keeps the cursor on a row; `{ focus: { id, prefix } }`
falls back to the first row starting with `prefix`.
