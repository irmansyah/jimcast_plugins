// [plugin] jim-calendar/src/index.ts

import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";   // Node only
import { CLI_COMMANDS } from "./commands.js";
import { OWNS, renderCalendar } from "./render.js";

export const calendarWidget = createWidget({
  section: { title: "Calendar", titleShow: false, navigationActive: false },
  // Re-render every minute so the date rolls over at midnight.
  repeat: { enable: true, seconds: 60 },
  cli: { owns: OWNS, commands: CLI_COMMANDS },
  render: (ctx) => renderCalendar(ctx),
});

export const plugin = definePlugin({
  description: "Five-day calendar strip with today's tasks, with CLI.",
  widgets: [calendarWidget],
});

export default plugin;

bootstrapPlugin(plugin);
