// [plugin] jim-calendar/src/render.ts
//
// Five-day strip with today in the middle (outlined), a full date line above
// it, and today's tasks below (max 3). A `group`: a `text` line over a `rows`
// strip over a `list`.

import type {
  ExecutionContext,
  WidgetContent,
  WidgetGroupSection,
  WidgetItem,
} from "@jimcast/sdk";
import { type Task, dateKey, readTasks, short, todayOrdered } from "./tasks.js";

// ── Ids ─────────────────────────────────────────────────────────────────────
// Every item id starts with OWNS: it is the `owns` of the widget's cli spec.
// It must NOT start with core's `cal-` prefix, or core's built-in calendar
// handlers would grab these items.
export const OWNS = "extcal";

// ── Layout ──────────────────────────────────────────────────────────────────
const SPAN = 2;   // days on each side of today → 5 cells (3 → 7 cells, 1 → 3 cells)
const MAX_TASKS = 3;
const TASK_MAX_CHARS = 60;
// Were theme.font.* / radius.md in core; tune to your design system.
const FONT = { xs: 11, sm: 12, md: 14, xxl: 28 };
const RADIUS_MD = 8;

// ── Actions ─────────────────────────────────────────────────────────────────
export const act = (ctx: ExecutionContext, cmd: string): NonNullable<WidgetItem["action"]> => ({
  run: async () => { await ctx.exec(cmd); },
  then: "refresh",
});

/** A synthetic item, for ctx.dispatch (CLI). */
export const cliItem = (ctx: ExecutionContext, id: string, cmd: string): WidgetItem => ({
  id: `${OWNS}-cli:${id}`,
  action: act(ctx, cmd),
});

function makePal(ctx: ExecutionContext) {
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  return {
    blue: g("blue", "#458588"), yellow: g("yellow", "#d79921"),
    fg: g("fg", "#ebdbb2"), fg2: g("fg2", "#d5c4a1"), fg4: g("fg4", "#a89984"),
  };
}

type Pal = ReturnType<typeof makePal>;

// ── Tasks ───────────────────────────────────────────────────────────────────
function taskSection(c: Pal, tasks: Task[], today: string): WidgetGroupSection | null {
  const all = todayOrdered(tasks, today);
  if (!all.length) return null;
  const shown = all.slice(0, MAX_TASKS);
  const more = all.length - shown.length;

  const datas: WidgetItem[] = shown.map((t, i) => ({
    id: `${OWNS}-task:${i}`,
    pinned: true,
    attribute: {
      label1: `${t.done ? "✓" : "○"} ${short(t.text, TASK_MAX_CHARS)}`,
      color1: t.done ? c.fg4 : c.fg,
      textSize1: FONT.sm,
      labelRight: i === shown.length - 1 && more > 0 ? `+${more}` : undefined,
      colorRight: c.fg4,
      textSizeRight: FONT.xs,
    },
  }));
  return { id: "tasks", content: { type: "list", datas } };
}

// ── Render ──────────────────────────────────────────────────────────────────
export async function renderCalendar(ctx: ExecutionContext): Promise<WidgetContent> {
  const now = new Date();
  const c = makePal(ctx);

  // ── Date line ──
  const weekdayLong = now.toLocaleDateString("en-US", { weekday: "long" });
  const dateRest = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // ── Day cells: today in the middle, neighbours fade with distance ──
  const datas: WidgetItem[] = [];
  for (let off = -SPAN; off <= SPAN; off++) {
    // new Date(y, m, d + off) handles month/year rollover on its own
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const num = String(d.getDate());
    const dist = Math.abs(off);

    if (dist === 0) {
      datas.push({
        id: `${OWNS}-${off}`,
        pinned: true,
        attribute: {
          label1: weekday, color1: c.fg2, textSize1: FONT.xs,
          label2: num,     color2: c.fg2, textSize2: FONT.xxl,
        },
        style: { borderRadius: RADIUS_MD, borderWidth: '3px', padding: "6px 0" },
      });
    } else {
      datas.push({
        id: `${OWNS}-${off}`,
        pinned: true,
        attribute: {
          label1: weekday, color1: c.fg4, textSize1: FONT.xs,
          label2: num,
          color2: dist === 1 ? c.fg : c.fg4,
          textSize2: dist === 1 ? FONT.md : FONT.sm,
        },
      });
    }
  }

  const sections: WidgetGroupSection[] = [
    {
      id: "date",
      content: {
        type: "text",
        data: {
          id: `${OWNS}-date`,
          attribute: {
            label1: `${weekdayLong}, ${dateRest}`.toUpperCase(),
            color1: c.yellow,
            textSize1: FONT.sm,
          },
        },
      },
    },
    { id: "days", content: { type: "rows", datas } },
  ];

  // ── Today's tasks (max 3) ──
  const today = dateKey(now);
  const tasks = taskSection(c, await readTasks(ctx, today), today);
  if (tasks) sections.push(tasks);

  return { type: "group", direction: "column", gap: 4, sections };
}
