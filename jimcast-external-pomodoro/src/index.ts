// [plugin] jimcast-external-pomodoro/src/index.ts

import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";   // Node only
import { CLI_COMMANDS, KEY_ACTIONS } from "./commands.js";
import { OWNS, SPEC_ID, renderPomodoro } from "./render.js";

export const pomodoroWidget = createWidget({
  // The part before the first "." must be this plugin's folder name in
  // ~/.jimcast/plugins: core routes render_widget by it.
  id: "jimcast-external-pomodoro.pomodoro",
  section: { title: "Pomodoro" },
  showIn: ["default"],
  // Re-render every second: the countdown and the blink depend on it.
  repeat: { enable: true, seconds: 1 },

  cli:  { id: SPEC_ID, owns: OWNS, commands: CLI_COMMANDS },
  keys: { id: SPEC_ID, owns: OWNS, actions: KEY_ACTIONS },

  render: (ctx) => renderPomodoro(ctx),
});

export const plugin = definePlugin({
  name: "jimcast-external-pomodoro",
  description: "Pomodoro timer: focus / break countdown, progress bar, notifications, with CLI.",
  commands: [],
  widgets: [pomodoroWidget],
});

export default plugin;

bootstrapPlugin(plugin);
