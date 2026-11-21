// [plugin] jim-aiagents/src/index.ts

import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime"; // Node only
import { CLI_COMMANDS } from "./commands.js";
import { OWNS, render } from "./render.js";

export const widget = createWidget({
  section: { title: "AI Agents", titleShow: true, navigationActive: true },
  repeat: { enable: true, seconds: 3 },
  cli: { owns: OWNS, commands: CLI_COMMANDS },
  render: (ctx) => render(ctx),
});

export const plugin = definePlugin({
  description: "Compact AI agent monitor: icon tabs, progress rows and a short live log.",
  widgets: [widget],
});
export default plugin;
bootstrapPlugin(plugin);
