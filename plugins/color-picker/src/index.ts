// [plugin] jim-colorpicker/src/index.ts

import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";   // Node only
import { CLI_COMMANDS } from "./commands.js";
import { OWNS, renderColors } from "./render.js";

export const colorsWidget = createWidget({
  section: { title: "Colors", titleShow: true },
  cli: { owns: OWNS, commands: CLI_COMMANDS },
  render: (ctx) => renderColors(ctx),
});

export const plugin = definePlugin({
  description: "Color picker: spectrum, built-in schemes and saved profiles, with CLI.",
  widgets: [colorsWidget],
});

export default plugin;

bootstrapPlugin(plugin);
