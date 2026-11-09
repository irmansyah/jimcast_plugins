// [plugin] jimcast-external-aiagents/src/index.ts

import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime"; // Node only
import { CLI_COMMANDS } from "./commands.js";
import { OWNS, SPEC_ID, render } from "./render.js";

export const widget = createWidget({
  id: "jimcast-external-aiagents.aiagents",
  section: { title: "AI Agents", titleShow: true, navigationActive: true },
  showIn: ["default"],
  repeat: { enable: true, seconds: 3 }, // the log moves on its own (also in package.json)
  cli: { id: SPEC_ID, owns: OWNS, commands: CLI_COMMANDS },
  render: (ctx) => render(ctx),
});

export const plugin = definePlugin({
  name: "jimcast-external-aiagents",
  description: "Compact AI agent monitor: icon tabs, progress rows and a short live log.",
  commands: [],
  widgets: [widget],
});
export default plugin;
bootstrapPlugin(plugin);
