// [plugin] jimcast-external-finder/src/index.ts
import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";
import { CLI_COMMANDS, KEY_ACTIONS } from "./commands.js";
import { OWNS, SPEC_ID, ROW_PREFIX, rowPathOf, render } from "./render.js";
import { runCmd, leftCmd, rightCmd } from "./shell.js";

export const widget = createWidget({
  id: "jimcast-external-finder.finder",
  section: { title: "Finder", titleShow: true, navigationActive: true, querySearchActive: false },
  cli: { id: SPEC_ID, owns: OWNS, commands: CLI_COMMANDS },
  keys: { id: SPEC_ID, owns: OWNS, actions: KEY_ACTIONS },
  nav: {
    id: SPEC_ID,
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
  name: "jimcast-external-finder",
  description: "macOS Finder-style column browser with marks, copy/cut/paste, zip and Trash.",
  commands: [],
  widgets: [widget],
});
export default plugin;
bootstrapPlugin(plugin);
