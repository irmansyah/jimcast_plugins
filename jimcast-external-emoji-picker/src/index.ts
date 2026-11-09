// [plugin] jimcast-external-emoji-picker/src/index.ts

import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";   // Node only
import { CLI_COMMANDS } from "./commands.js";
import { OWNS, SPEC_ID, renderEmoji } from "./render.js";

export const emojiWidget = createWidget({
  // The part before the first "." must be this plugin's folder name in
  // ~/.jimcast/plugins: core routes render_widget by it.
  id: "jimcast-external-emoji-picker.emoji",
  // Core's built-in descriptor had `searchable: true`; here it is the section's
  // querySearchActive flag (same as in the Finder plugin).
  section: { title: "Emoji", querySearchActive: true },
  showIn: ["default"],

  cli: { id: SPEC_ID, owns: OWNS, commands: CLI_COMMANDS },

  render: (ctx) => renderEmoji(ctx),
});

export const plugin = definePlugin({
  name: "jimcast-external-emoji",
  description: "Emoji picker: category tabs, Recent, click to copy, with CLI.",
  commands: [],
  widgets: [emojiWidget],
});

export default plugin;

bootstrapPlugin(plugin);
