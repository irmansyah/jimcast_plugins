/**
 * {{PLUGIN_NAME}} — a Jimcast plugin
 *
 * Replace this file with your plugin's logic.
 * See https://jimcast.dev/docs/plugins for the full API reference.
 */

import { definePlugin, createCommand } from "@jimcast/sdk";

const exampleCommand = createCommand({
  id: "jimcast-external.command.starter",
  title: "Example Command",
  subtitle: "Replace this with your first real command",

  async execute(context) {
    // Your command logic goes here.
    // Return an array of CommandItems to show a list, or return nothing
    // if your command performs a direct action.
    await context.showToast(`Hello from Jimcast Plugin Starter!`, { style: "success" });
  },
});

export default definePlugin({
  name: "Jimcast Plugin Starter",
  description: "Jimcast Plugin Starter Description",
  commands: [exampleCommand],
});
