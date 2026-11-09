// [plugin] jimcast-external-pomodoro/src/commands.ts
//
// CLI: `jimcast widget command xpomodoro <toggle|skip|break|reset|status>`
// Port of core's POMODORO_COMMANDS. The widget re-renders every second, so
// these just run the scripts; no dispatch is needed to see the change.

import type { WidgetCliCommand, WidgetCliContext, WidgetKeyAction } from "@jimcast/sdk";
import {
  BREAK_CMD,
  RESET_CMD,
  SKIP_CMD,
  TOGGLE_CMD,
  mmss,
  phaseName,
  readTimer,
} from "./shell.js";
import { cliItem } from "./render.js";

const run = (cmd: string) => async (ctx: WidgetCliContext) => {
  await ctx.exec(cmd);
  return null;
};

export const CLI_COMMANDS: WidgetCliCommand[] = [
  { id: "toggle", title: "Start / pause / resume (or start the next phase when finished)", run: run(TOGGLE_CMD) },
  { id: "skip", title: "Jump to the next phase (focus <-> break)", run: run(SKIP_CMD) },
  { id: "break", title: "Start a break right away", run: run(BREAK_CMD) },
  { id: "reset", title: "Stop and clear the timer", run: run(RESET_CMD) },
  {
    id: "status", title: "Print the current phase and time left",
    async run(ctx) {
      const t = await readTimer(ctx);
      if (!t) return "idle";
      const left = t.remaining <= 0 ? "done" : `${mmss(t.remaining)} left`;
      return `${phaseName(t.phase)} ${left}${t.state === "paused" ? " (paused)" : ""}`;
    },
  },
];

// ═══ Keys ═══════════════════════════════════════════════════════════════════
// Remap per widget in ~/.jimcast/keybinding.json:
//   "widgets": { "jimcast-external-pomodoro.pomodoro": { "toggle": "space", "skip": "s", ... } }
// Each action dispatches the same script a button runs, so the widget re-renders at once.

const key = (id: string, title: string, def: string, cmd: string): WidgetKeyAction => ({
  id, title, default: def,
  run: (ctx) => ctx.dispatch(cliItem(ctx, id, cmd)),
});

export const KEY_ACTIONS: WidgetKeyAction[] = [
  key("toggle", "Start / pause / resume (or start the next phase)", "space", TOGGLE_CMD),
  key("skip",   "Jump to the next phase",                           "s",     SKIP_CMD),
  key("break",  "Start a break right away",                         "b",     BREAK_CMD),
  key("reset",  "Stop and clear the timer",                         "r",     RESET_CMD),
];
