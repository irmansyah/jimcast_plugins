// [plugin] jimcast-external-aiagents/src/render.ts
import type { ExecutionContext, WidgetContent, WidgetItem } from "@jimcast/sdk";
import { LOG_ROWS, loadAgents, type Agent, type Level, type LogLine, type Status } from "./data.js";
import { ALL_ID, readTab, setTabCmd } from "./shell.js";

export const OWNS = "extag";   // item-id prefix, not a core prefix
export const SPEC_ID = "xagents"; // CLI spec id, not a core name

type Exec = Pick<ExecutionContext, "exec">;
type Action = NonNullable<WidgetItem["action"]>;
type WidgetGroupSection = Extract<WidgetContent, { type: "group" }>["sections"][number];

export const act = (ctx: Exec, cmd: string, then: "refresh" | "dismiss" = "refresh"): Action =>
  ({ run: async () => { await ctx.exec(cmd); }, then });

export const cliItem = (ctx: Exec, id: string, cmd: string): WidgetItem =>
  ({ id: `${OWNS}-cli:${id}`, action: act(ctx, cmd) });

// ── Look ────────────────────────────────────────────────────────────────────
const ALL_ROWS = 4; // lines under the All tab
const LINE_MAX = 60;
const FONT_XS = 11; // local stand-in for theme.font.xs

function palette(ctx: ExecutionContext) {
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  return {
    bg1: g("bg1", "#3c3836"),
    bg3: g("bg3", "#665c54"),
    fg: g("fg", "#ebdbb2"),
    fg2: g("fg2", "#d5c4a1"),
    fg4: g("fg4", "#a89984"),
    brightGreen: g("brightGreen", "#b8bb26"),
    brightAqua: g("brightAqua", "#8ec07c"),
    brightRed: g("brightRed", "#fb4934"),
    brightBlue: g("brightBlue", "#83a598"),
    brightYellow: g("brightYellow", "#fabd2f"),
  };
}
type Palette = ReturnType<typeof palette>;

const short = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

const STATUS_SYMBOL: Record<Status, string> = { running: "●", idle: "○", done: "✓", error: "✕" };
const LEVEL_GLYPH: Record<Level, string> = { info: "·", tool: "$", ok: "✓", warn: "!", error: "✕" };

function statusColor(c: Palette, s: Status): string {
  return s === "running" ? c.brightGreen : s === "done" ? c.brightAqua : s === "error" ? c.brightRed : c.fg4;
}

function levelColor(c: Palette, l: Level): string {
  return l === "tool" ? c.brightBlue : l === "ok" ? c.brightGreen : l === "warn" ? c.brightYellow : l === "error" ? c.brightRed : c.fg2;
}

/** Newest first. */
function logItems(c: Palette, lines: { agent?: string; line: LogLine }[], max: number): WidgetItem[] {
  const shown = lines.slice(-max).reverse();
  if (!shown.length) {
    return [{ id: `${OWNS}-log-empty`, pinned: true, attribute: { label1: "No log lines yet", color1: c.fg4, textSize1: FONT_XS } }];
  }
  return shown.map(({ agent, line }, i) => ({
    id: `${OWNS}-log:${i}`,
    pinned: true,
    attribute: {
      label1: `${LEVEL_GLYPH[line.level]} ${agent ? `${agent}: ` : ""}${short(line.text, LINE_MAX)}`,
      color1: levelColor(c, line.level), textSize1: FONT_XS,
    },
  }));
}

// ── Content ─────────────────────────────────────────────────────────────────
function buildContent(ctx: ExecutionContext, tab: string, agents: Agent[]): WidgetContent {
  const c = palette(ctx);
  const panel = { background: c.bg1, borderRadius: 8, padding: 4 };

  // Tabs: icon only, the active one also shows its name.
  const tabs = [
    { id: ALL_ID, name: "All", icon: "◎", color: agents.some((a) => a.status === "error") ? c.brightRed : c.fg },
    ...agents.map((a) => ({ id: a.id, name: a.name, icon: a.icon, color: statusColor(c, a.status) })),
  ];
  const activeId = tabs.find((t) => t.id === tab)?.id ?? ALL_ID;

  const tabBar: WidgetItem[] = tabs.map((t) => ({
    id: `${OWNS}-tab:${t.id}`,
    pinned: true,
    attribute: { label1: t.icon, label2: t.id === activeId ? t.name : undefined, color1: t.color, color2: c.fg, textSize1: 15 },
    style: t.id === activeId ? { background: c.bg3, borderRadius: 6 } : undefined,
    action: act(ctx, setTabCmd(t.id), "refresh"),
  }));

  const sections: WidgetGroupSection[] = [
    { id: "tabs", navigable: true, style: panel, content: { type: "rows", datas: tabBar } },
  ];

  const agent = agents.find((a) => a.id === activeId);
  if (!agent) {
    // All: a progress row per agent (Enter opens its tab) + the last few lines.
    sections.push({
      id: "agents", navigable: true,
      content: {
        type: "progress",
        datas: agents.map((a) => ({
          id: `${OWNS}-open:${a.id}`,
          attribute: {
            label1: `${STATUS_SYMBOL[a.status]} ${a.name}`, color1: statusColor(c, a.status),
            labelRight: `${Math.round(a.progress * 100)}%`, colorRight: statusColor(c, a.status),
          },
          action: act(ctx, setTabCmd(a.id), "refresh"),
        })),
      },
    });
    sections.push({
      id: "logs", style: panel,
      content: {
        type: "list",
        datas: logItems(c, agents.flatMap((a) => a.logs.slice(-ALL_ROWS).map((line) => ({ agent: a.name, line }))), ALL_ROWS),
      },
    });
  } else {
    // One agent: task + progress in a single row, then the log.
    const col = statusColor(c, agent.status);
    sections.push({
      id: "progress",
      content: {
        type: "progress",
        datas: [{
          id: `${OWNS}-progress`,
          attribute: {
            label1: `${STATUS_SYMBOL[agent.status]} ${short(agent.task, 34)}`, color1: col,
            labelRight: `${Math.round(agent.progress * 100)}%`, colorRight: col,
          },
        }],
      },
    });
    sections.push({
      id: "logs", style: panel,
      content: { type: "list", datas: logItems(c, agent.logs.map((line) => ({ line })), LOG_ROWS) },
    });
  }

  return { type: "group", direction: "column", gap: 4, sections };
}

export async function render(ctx: ExecutionContext): Promise<WidgetContent> {
  const [tab, agents] = await Promise.all([readTab(ctx), loadAgents(ctx)]);
  return buildContent(ctx, tab, agents);
}
