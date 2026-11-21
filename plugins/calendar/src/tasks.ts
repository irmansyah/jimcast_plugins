// [plugin] jim-calendar/src/tasks.ts
//
// Task model + storage. The tasks file (plugin data dir, "tasks") has one task per line:
//     YYYY-MM-DD|<0 open | 1 done>|task text

import { pluginDataFile, type ExecutionContext } from "@jimcast/sdk";

export interface Task { date: string; done: boolean; text: string }

const TASKS_FILE = `"${pluginDataFile("tasks")}"`;

export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const pad2 = (n: number) => String(n).padStart(2, "0");
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const short = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

function parseTasks(text: string): Task[] {
  const out: Task[] = [];
  for (const line of text.split("\n")) {
    const m = /^(\d{4}-\d{2}-\d{2})\|([01])\|(.*)$/.exec(line.trim());
    if (m && m[3].trim()) out.push({ date: m[1], done: m[2] === "1", text: m[3].trim() });
  }
  return out;
}

// Dummy data, shown until the tasks file exists.
const dummyTasks = (today: string): Task[] => [
  { date: today, done: false, text: "Review PR #482" },
  { date: today, done: true, text: "Write the weekly report" },
];

// The seam: file wins when it exists, else dummy data. Replace the body to
// fetch from an API instead (return today's + future tasks).
export async function readTasks(ctx: ExecutionContext, today: string): Promise<Task[]> {
  const res = await ctx.exec(`if [ -f ${TASKS_FILE} ]; then echo "#file"; cat ${TASKS_FILE}; fi`);
  const out = res.stdout.trim();
  return out.startsWith("#file") ? parseTasks(out) : dummyTasks(today);
}

/** Today's tasks in display order: open first, done last (stable). */
export function todayOrdered(tasks: Task[], today: string): Task[] {
  const mine = tasks.filter((t) => t.date === today);
  return [...mine.filter((t) => !t.done), ...mine.filter((t) => t.done)];
}

/** Script that rewrites the tasks file (drops past days). */
export function saveCmd(tasks: Task[], today: string): string {
  const body = tasks
    .filter((t) => t.date >= today)
    .map((t) => `${t.date}|${t.done ? 1 : 0}|${t.text.replace(/[\r\n]+/g, " ")}`)
    .join("\n");
  return `printf %s ${shq(body ? body + "\n" : "")} > ${TASKS_FILE}`;
}
