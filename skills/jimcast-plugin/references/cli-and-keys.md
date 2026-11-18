# CLI commands and keys

## CLI: `jimcast widget command <specId> <command> [args]`

```ts
cli: { id: "xname", owns: "extx", commands: CLI_COMMANDS }

const CLI_COMMANDS: WidgetCliCommand[] = [{
  id: "add", args: ["text..."], title: "Add a task",
  description: "optional longer help",
  async run(ctx) {
    const text = ctx.args.filter(a => !a.startsWith("--")).join(" ");
    await ctx.dispatch(cliItem(ctx, "add", ADD_CMD(text)));   // re-renders like a click
    return `Added: ${text}`;                                   // printed to the terminal
  },
}];
```

- `run` returns a string, an object (printed as JSON) or `null`.
- Throw `new Error("...")` for user errors; it is shown as the CLI error.
- Relative paths resolve against `ctx.cwd` (the caller's directory).
- List them: `jimcast widget commands <specId>`.
- Convention: `status` (with `--json`), plus verbs. Make destructive ones ask first (`--yes`).

## Keys

```ts
keys: { id: "xname", owns: "extx", actions: KEY_ACTIONS }

const KEY_ACTIONS: WidgetKeyAction[] = [{
  id: "mark", title: "Mark the row", default: "space",
  async run(ctx) {
    const id = ctx.focusedItemId;               // cursor row, or null
    if (!id) return;
    await ctx.dispatch(cliItem(ctx, "mark", MARK_CMD), id ? { focus: { id } } : undefined);
  },
}];
```

- Add `"widget-keys"` to `capabilities` in `package.json`.
- Only active while this widget is the open panel.
- Users remap in `key_bindings.<specId>` of `config_section.json` / `config.json`; `""` unbinds.
- `default` strings: `"space"`, `"shift+h"`, `"left"`, `"y"`. Modifiers are matched exactly.
- Show hints from `ctx.keyLabels(specId)` instead of hard-coding keys.
- The built-in finder also has a cursor-follow live preview that is wired to its own ids only.
  An external plugin gets plain key actions instead.
