# jim-calculator

Inline calculator widget (`showIn: calc`). Type an expression such as `2*(3+4)`, `sqrt(2)`, `2^-3`,
`max(1,2,3)`; the result row shows `= value`, and enter copies the plain number.

## Install

```
./scripts/install.sh jim-calculator
```

Alias in `~/.jimcast/config.json`:

```json
"widgets": { "calc": { "use": "com.jimcast.plugins.calculator" } }
```

## Differences from the built-in

- **Query-reactive rendering is not available yet.** The built-in used `renderQuery(context, q)`. The SDK has
  no equivalent, so `render` currently returns an empty list. The evaluator (`src/data.ts`) and the result
  row builder (`resultItem` in `src/render.ts`) are ported unchanged and ready to wire up.
- **Copy to clipboard and toast** (`port.copyToClipboard`, `port.showToast`) have no known SDK call; the
  action is a marked TODO. `port.dismissCommandBar()` is mapped to `then: "dismiss"`.
- `theme.color.yellow` comes from `ctx.host.theme.colors.yellow` with a fallback; `theme.font.hightlight1`
  is a local constant.
- No state files, shell scripts, CLI or key actions, so `shell.ts` and `commands.ts` are omitted and the
  manifest has no capabilities.
