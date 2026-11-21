// [plugin] jim-finder/src/index.ts
import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";
import { CLI_COMMANDS, KEY_ACTIONS } from "./commands.js";
import { OWNS, ROW_PREFIX, rowPathOf, render } from "./render.js";
import { runCmd, leftCmd, rightCmd } from "./shell.js";

export const widget = createWidget({
  section: { title: "Finder", titleShow: true, navigationActive: true },
  cli: { owns: OWNS, commands: CLI_COMMANDS },
  keys: { owns: OWNS, actions: KEY_ACTIONS },
  nav: {
    owns: OWNS,
    stickyFocus: true,
    tree: { prefix: ROW_PREFIX },
    async left(ctx, itemId) {
      const p = rowPathOf(itemId);
      if (p) await runCmd(ctx, leftCmd(p));
    },
    async right(ctx, itemId) {
      const p = rowPathOf(itemId);
      if (p) await runCmd(ctx, rightCmd(p));
    },
  },
  render: (ctx) => render(ctx),
});

export const plugin = definePlugin({
  description: "macOS Finder-style column browser with marks, copy/cut/paste, zip and Trash.",
  widgets: [widget],
});
export default plugin;
bootstrapPlugin(plugin);
