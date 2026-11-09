// [plugin] jimcast-external-calendar/src/commands.ts
//
// CLI: `jimcast widget command xcalendar <tasks|add|done|rm|clear>`
// Port of core's CALENDAR_COMMANDS. Each change goes through ctx.dispatch, so
// the calendar re-renders exactly as if a task had been edited in the UI.

import type { WidgetCliCommand, WidgetCliContext } from "@jimcast/sdk";
import { type Task, dateKey, readTasks, saveCmd, todayOrdered } from "./tasks.js";
import { cliItem } from "./render.js";

const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));

/** 1-based number from the args -> the task in today's display order. */
function pick(ctx: WidgetCliContext, tasks: Task[], today: string): Task {
  const n = Number(positional(ctx)[0]);
  const ordered = todayOrdered(tasks, today);
  if (!Number.isInteger(n) || n < 1 || n > ordered.length) {
    throw new Error(ordered.length ? `pick a number 1-${ordered.length} (see \`xcalendar tasks\`)` : "no tasks today");
  }
  return ordered[n - 1];
}

export const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "tasks", title: "Today's tasks, numbered", description: "--json for machine-readable output",
    async run(ctx) {
      const today = dateKey(new Date());
      const list = todayOrdered(await readTasks(ctx, today), today);
      if (ctx.args.includes("--json")) return list;
      return list.length
        ? list.map((t, i) => `${i + 1}. [${t.done ? "x" : " "}] ${t.text}`).join("\n")
        : "(no tasks today)";
    },
  },
  {
    id: "add", args: ["text..."], title: "Add a task for today (the widget shows the first 3)",
    async run(ctx) {
      const text = positional(ctx).join(" ").trim();
      if (!text) throw new Error("add needs the task text");
      const today = dateKey(new Date());
      const tasks = await readTasks(ctx, today);
      tasks.push({ date: today, done: false, text });
      await ctx.dispatch(cliItem(ctx, "add", saveCmd(tasks, today)));
      return `Added: ${text}`;
    },
  },
  {
    id: "done", args: ["number"], title: "Toggle a task done / open",
    async run(ctx) {
      const today = dateKey(new Date());
      const tasks = await readTasks(ctx, today);
      const t = pick(ctx, tasks, today);
      t.done = !t.done;
      await ctx.dispatch(cliItem(ctx, "done", saveCmd(tasks, today)));
      return `${t.done ? "Done" : "Reopened"}: ${t.text}`;
    },
  },
  {
    id: "rm", args: ["number"], title: "Remove a task",
    async run(ctx) {
      const today = dateKey(new Date());
      const tasks = await readTasks(ctx, today);
      const t = pick(ctx, tasks, today);
      await ctx.dispatch(cliItem(ctx, "rm", saveCmd(tasks.filter((x) => x !== t), today)));
      return `Removed: ${t.text}`;
    },
  },
  {
    id: "clear", title: "Remove all of today's tasks",
    async run(ctx) {
      const today = dateKey(new Date());
      const tasks = await readTasks(ctx, today);
      await ctx.dispatch(cliItem(ctx, "clear", saveCmd(tasks.filter((t) => t.date !== today), today)));
      return "Cleared today's tasks";
    },
  },
];
