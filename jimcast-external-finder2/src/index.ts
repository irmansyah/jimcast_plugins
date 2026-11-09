// [plugin] jimcast-external-finder/src/index.ts

import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";   // Node only
import { CLI_COMMANDS, KEY_ACTIONS } from "./commands.js";
import { OWNS, SPEC_ID, renderFinder } from "./render.js";

export const finderWidget = createWidget({
  // The part before the first "." must be this plugin's folder name in
  // ~/.jimcast/plugins: core routes render_widget by it.
  id: "jimcast-external-finder2.finder",
  section: { title: "Finder", titleShow: true, navigationActive: true, querySearchActive: false },
  cli:  { id: SPEC_ID, owns: OWNS, commands: CLI_COMMANDS },
  keys: { id: SPEC_ID, owns: OWNS, actions: KEY_ACTIONS },

  render: (ctx) => renderFinder(ctx),
});

export const plugin = definePlugin({
  name: "jimcast-external-finder2",
  description: "Finder-style column browser: marks, copy/cut/paste, zip, Trash, keys and CLI.",
  commands: [],
  widgets: [finderWidget],
});

export default plugin;

bootstrapPlugin(plugin);
