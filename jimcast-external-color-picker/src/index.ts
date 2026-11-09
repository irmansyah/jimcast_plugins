// [plugin] jimcast-external-color-picker/src/index.ts

import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";   // Node only
import { CLI_COMMANDS } from "./commands.js";
import { OWNS, SPEC_ID, renderColors } from "./render.js";

export const colorsWidget = createWidget({
  // The part before the first "." must be this plugin's folder name in
  // ~/.jimcast/plugins: core routes render_widget by it.
  id: "jimcast-external-color-picker.color-picker",
  section: { title: "Colors" },
  showIn: ["default"],

  cli: { id: SPEC_ID, owns: OWNS, commands: CLI_COMMANDS },

  render: (ctx) => renderColors(ctx),
});

export const plugin = definePlugin({
  name: "jimcast-external-color-picker",
  description: "Color picker: spectrum, built-in schemes and saved profiles, with CLI.",
  commands: [],
  widgets: [colorsWidget],
});

export default plugin;

bootstrapPlugin(plugin);
