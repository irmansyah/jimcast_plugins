// [plugin] jim-pomodoro/src/index.ts

import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";   // Node only
import { CLI_COMMANDS, KEY_ACTIONS } from "./commands.js";
import { OWNS, renderPomodoro } from "./render.js";

export const pomodoroWidget = createWidget({
  section: { title: "Pomodoro" },
  // Re-render every second: the countdown and the blink depend on it.
  repeat: { enable: true, seconds: 1 },

  cli:  { owns: OWNS, commands: CLI_COMMANDS },
  keys: { owns: OWNS, actions: KEY_ACTIONS },

  render: (ctx) => renderPomodoro(ctx),
});

export const plugin = definePlugin({
  description: "Pomodoro timer: focus / break countdown, progress bar, notifications, with CLI.",
  widgets: [pomodoroWidget],
});

export default plugin;

bootstrapPlugin(plugin);
