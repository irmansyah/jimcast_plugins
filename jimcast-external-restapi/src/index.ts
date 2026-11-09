// [plugin] jimcast-external-restapi/src/index.ts
import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime"; // Node only
import { CLI_COMMANDS } from "./commands.js";
import { OWNS, SPEC_ID, render } from "./render.js";

export const widget = createWidget({
  id: "jimcast-external-restapi.restapi",
  section: {
    title: "REST API",
    titleShow: true,
    navigationActive: true,
    querySearchActive: true, // typing filters the request list
  },
  showIn: ["default"],
  cli: { id: SPEC_ID, owns: OWNS, commands: CLI_COMMANDS },
  render: (ctx) => render(ctx),
});

export const plugin = definePlugin({
  name: "jimcast-external-restapi",
  description: "Config-driven REST client: requests on the left, last response on the right.",
  commands: [],
  widgets: [widget],
});

export default plugin;
bootstrapPlugin(plugin);
