// [plugin] jim-emojipicker/src/index.ts

import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";   // Node only
import { CLI_COMMANDS } from "./commands.js";
import { OWNS, renderEmoji } from "./render.js";

export const emojiWidget = createWidget({
  section: { title: "Emoji", querySearchActive: true },
  cli: { owns: OWNS, commands: CLI_COMMANDS },
  render: (ctx) => renderEmoji(ctx),
});

export const plugin = definePlugin({
  description: "Emoji picker: category tabs, Recent, click to copy, with CLI.",
  widgets: [emojiWidget],
});

export default plugin;

bootstrapPlugin(plugin);
