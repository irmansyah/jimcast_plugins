// [plugin] jimcast-external-restapi/src/render.ts
import type { ExecutionContext, WidgetContent, WidgetItem } from "@jimcast/sdk";
import { isBearer, loadState, methodOf, runCmd, type State } from "./data.js";
import { CONFIGS_HINT, MAX_LINES, setConfigCmd } from "./shell.js";

export const OWNS = "extra"; // item-id prefix, not a core prefix
export const SPEC_ID = "xrestapi"; // CLI spec id, not a core name

type Exec = Pick<ExecutionContext, "exec">;
type Action = NonNullable<WidgetItem["action"]>;
type GroupContent = Extract<WidgetContent, { type: "group" }>;
type WidgetGroupSection = GroupContent["sections"][number];

export const act = (ctx: Exec, cmd: string, then: "refresh" | "dismiss" = "refresh"): Action => ({
  run: async () => {
    await ctx.exec(cmd);
  },
  then,
});

export const cliItem = (ctx: Exec, id: string, cmd: string): WidgetItem => ({
  id: `${OWNS}-cli:${id}`,
  action: act(ctx, cmd),
});

// ── Design-system stand-ins ─────────────────────────────────────────────────
const FONT = { xs: 11, sm: 12 }; // assumed values, see README
const LIST_MAX_H = 380;
const OUT_MAX_H = 380;
const WRAP_AT = 110; // long lines are chunked so nothing overflows

function palette(ctx: ExecutionContext) {
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  return {
    fg: g("fg", "#ebdbb2"),
    fg2: g("fg2", "#d5c4a1"),
    fg4: g("fg4", "#a89984"),
    bg2: g("bg2", "#504945"),
    yellow: g("yellow", "#d79921"),
    brightGreen: g("brightGreen", "#b8bb26"),
    brightYellow: g("brightYellow", "#fabd2f"),
    brightBlue: g("brightBlue", "#83a598"),
    brightPurple: g("brightPurple", "#d3869b"),
    brightRed: g("brightRed", "#fb4934"),
  };
}
type Palette = ReturnType<typeof palette>;

// ── Helpers ─────────────────────────────────────────────────────────────────
const short = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

function methodColor(c: Palette, m: string): string {
  switch (m) {
    case "GET":
      return c.brightGreen;
    case "POST":
      return c.brightYellow;
    case "PUT":
      return c.brightBlue;
    case "PATCH":
      return c.brightPurple;
    case "DELETE":
      return c.brightRed;
    default:
      return c.fg4;
  }
}

// Wrap + keep indentation (HTML collapses leading spaces) -> one list row each.
function outputLines(out: string[]): string[] {
  const rows: string[] = [];
  for (const raw of out) {
    const line = raw.replace(/\r$/, "").replace(/\t/g, "  ");
    const indent = /^ */.exec(line)![0].length;
    const pad = "\u00A0".repeat(indent);
    const text = line.slice(indent);
    if (!text) {
      rows.push("\u00A0");
      continue;
    }
    for (let i = 0; i < text.length; i += WRAP_AT) {
      rows.push(pad + text.slice(i, i + WRAP_AT));
      if (rows.length >= MAX_LINES) return rows;
    }
  }
  return rows;
}

// ── Content ─────────────────────────────────────────────────────────────────
function messageContent(text: string, color: string): WidgetContent {
  return { type: "text", data: { id: `${OWNS}-msg`, attribute: { label1: text, color1: color } } };
}

function buildContent(ctx: ExecutionContext, st: State): WidgetContent {
  const c = palette(ctx);

  if (!st.config) {
    return messageContent(`No config found. Put a user_config.json into ${CONFIGS_HINT}`, c.fg4);
  }
  if (!st.cfg) {
    return messageContent(`${st.config}: ${st.cfgError || "empty config"}`, c.brightRed);
  }
  const cfg = st.cfg;

  // LEFT: config switcher (pinned) + the requests.
  const cIdx = Math.max(0, st.configs.indexOf(st.config));
  const nextConfig = st.configs[(cIdx + 1) % st.configs.length];
  const left: WidgetItem[] = [
    {
      id: `${OWNS}-config`,
      pinned: true,
      attribute: {
        label1: cfg.app_title ?? st.config,
        color1: c.fg2,
        label2: `${st.config}  ${cIdx + 1}/${st.configs.length}`,
        color2: c.fg4,
        labelRight: "⇄",
        colorRight: c.fg4,
      },
      action: act(ctx, setConfigCmd(nextConfig)),
    },
  ];
  for (const r of cfg.requests) {
    const m = methodOf(r);
    const flags = `${isBearer(r) ? " 🔑" : ""}${r.req_variable_is_save ? " 💾" : ""}`;
    left.push({
      id: `${OWNS}:${r.req_tag}`,
      attribute: {
        label1: r.req_title ?? r.req_tag,
        color1: r.req_tag === st.selected ? c.yellow : c.fg,
        label2: short(r.req_end_point, 34) + flags,
        color2: c.fg4,
        labelRight: m,
        colorRight: methodColor(c, m),
        textSizeRight: FONT.xs,
      },
      action: act(ctx, runCmd(cfg, r)),
    });
  }

  // RIGHT: status line + response body.
  const parts = st.status.split("|");
  const kind = parts[0] ?? "";
  const text = parts[1] ?? "";
  const saved = (parts[2] ?? "").trim();
  const sel = cfg.requests.find((r) => r.req_tag === st.selected);
  const tokenLabel = st.hasToken ? "🔑 token" : "no token";
  const tokenColor = st.hasToken ? c.brightGreen : c.fg4;

  let statusItem: WidgetItem;
  if (kind === "error") {
    statusItem = {
      id: `${OWNS}-status`,
      pinned: true,
      attribute: {
        label1: `✕ ${short(text, 90)}`,
        color1: c.brightRed,
        textSize1: FONT.sm,
        labelRight: tokenLabel,
        colorRight: tokenColor,
        textSizeRight: FONT.xs,
      },
    };
  } else if (kind === "ok") {
    const code = /\s(\d{3})\b/.exec(text)?.[1] ?? "";
    const good = code.startsWith("2") || code.startsWith("3");
    statusItem = {
      id: `${OWNS}-status`,
      pinned: true,
      attribute: {
        label1: `${sel ? methodOf(sel) + " " + sel.req_end_point + "  " : ""}${text}`,
        color1: good ? c.brightGreen : c.brightRed,
        textSize1: FONT.sm,
        label2: saved ? `💾 saved ${saved}` : undefined,
        color2: c.yellow,
        textSize2: FONT.xs,
        labelRight: tokenLabel,
        colorRight: tokenColor,
        textSizeRight: FONT.xs,
      },
    };
  } else {
    statusItem = {
      id: `${OWNS}-status`,
      pinned: true,
      attribute: {
        label1: "Select a request and press Enter to run it",
        color1: c.fg4,
        textSize1: FONT.sm,
        labelRight: tokenLabel,
        colorRight: tokenColor,
        textSizeRight: FONT.xs,
      },
    };
  }

  const outItems: WidgetItem[] = outputLines(st.out).map((line, i) => ({
    id: `${OWNS}-out:${i}`,
    pinned: true,
    attribute: { label1: line, color1: c.fg2, textSize1: FONT.xs },
  }));

  const rightSections: WidgetGroupSection[] = [
    { id: "status", content: { type: "list", datas: [statusItem] } },
    ...(outItems.length
      ? [
          {
            id: "output",
            maxHeight: OUT_MAX_H,
            content: { type: "list", datas: outItems },
          } as WidgetGroupSection,
        ]
      : []),
  ];

  const panel = { background: c.bg2, borderRadius: 8, padding: 4 };
  const sections: WidgetGroupSection[] = [
    {
      id: "apis",
      navigable: true,
      flex: 2,
      maxHeight: LIST_MAX_H,
      style: panel,
      content: { type: "list", datas: left },
    },
    {
      id: "response",
      flex: 3,
      style: panel,
      content: { type: "group", direction: "column", gap: 4, sections: rightSections },
    },
  ];
  return { type: "group", direction: "row", gap: 8, sections };
}

export async function render(ctx: ExecutionContext): Promise<WidgetContent> {
  return buildContent(ctx, await loadState(ctx));
}
