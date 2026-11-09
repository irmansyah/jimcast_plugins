// [plugin] jimcast-external-calendar/src/index.ts

import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";   // Node only
import { CLI_COMMANDS } from "./commands.js";
import { OWNS, SPEC_ID, renderCalendar } from "./render.js";

export const calendarWidget = createWidget({
  // The part before the first "." must be this plugin's folder name in
  // ~/.jimcast/plugins: core routes render_widget by it.
  id: "jimcast-external-calendar.calendar",
  section: { title: "Calendar", titleShow: false, navigationActive: false },
  showIn: ["default"],
  // Re-render every minute so the date rolls over at midnight.
  repeat: { enable: true, seconds: 60 },

  cli: { id: SPEC_ID, owns: OWNS, commands: CLI_COMMANDS },

  render: (ctx) => renderCalendar(ctx),
});

export const plugin = definePlugin({
  name: "jimcast-external-calendar",
  description: "Five-day calendar strip with today's tasks, with CLI.",
  commands: [],
  widgets: [calendarWidget],
});

export default plugin;

bootstrapPlugin(plugin);
