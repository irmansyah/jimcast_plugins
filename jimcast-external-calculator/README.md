<!-- README.md -->
# jimcast-external-calculator

Arithmetic calculator (no `eval`): `+ - * / % ^ **`, `× ÷`, parentheses, constants `pi e tau π`,
functions `sqrt abs sin cos tan asin acos atan ln log log2 exp floor ceil round min max`.
A query counts as a calculation only if it has a digit and at least one operator or function call.

**Status: partial port.** The live "type and see the result" row is not available (see below).

## Install

```sh
pnpm install && pnpm build
```

Then register the plugin with jimcast the way you do for other external plugins.

## Panel entry

```json
{ "widget": "jimcast-external-calculator.calculator" }
```

## CLI

```sh
jimcast widget command xcalc eval "2+2*3"
jimcast widget command xcalc copy "sqrt(16)*pi"
```

## Differences from the built-in

- **No query-reactive result row.** Core's `renderQuery` has no external equivalent, so the widget shows a hint. `resultItem()` in `src/render.ts` is the ported row, ready to wire once the SDK passes the query.
- **Clipboard** goes through the shell (`pbcopy`, `wl-copy`, `xclip` or `xsel`, whichever exists) instead of `port.copyToClipboard`.
- **No toast.** `port.showToast` has no known SDK call; the CLI `copy` command returns `Copied <value>` instead.
- **Dismiss** maps to `then: "dismiss"`.
- Widget id, CLI spec (`xcalc`, was none) and item prefix (`extcalc`) are renamed; `showIn: ["calc"]` is kept as in the original.
- Theme colors come from `ctx.host.theme.colors` with fallbacks; font sizes are local constants.
