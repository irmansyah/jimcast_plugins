// [plugin] jimcast-external-calculator/src/index.ts
import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime"; // Node only
import { CLI_COMMANDS } from "./commands.js";
import { OWNS, SPEC_ID, render } from "./render.js";

export const widget = createWidget({
  id: "jimcast-external-calculator.calculator",
  section: { title: "Calculator", titleShow: false, querySearchActive: false },
  showIn: ["calc"], // TODO: confirm non-default mode names are accepted
  cli: { id: SPEC_ID, owns: OWNS, commands: CLI_COMMANDS },
  render: (ctx) => render(ctx),
});

export const plugin = definePlugin({
  name: "jimcast-external-calculator",
  description: "Calculator: safe arithmetic evaluator (CLI now, query-reactive result row pending).",
  commands: [],
  widgets: [widget],
});
export default plugin;
bootstrapPlugin(plugin);
