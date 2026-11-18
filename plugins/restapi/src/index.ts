// [plugin] jim-restapi/src/index.ts
//
// Config-driven REST client: requests on the left, last response on the right.
// (Merged from shell.ts, data.ts, render.ts, commands.ts and index.ts.)

import {
  createWidget,
  definePlugin,
  pluginDataDir,
  pluginDataFile,
  type ExecutionContext,
  type WidgetCliCommand,
  type WidgetCliContext,
  type WidgetContent,
  type WidgetItem,
} from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime"; // Node only

// ════════════════════════════════════════════════════════════════════════════
// Shell helpers and storage
// ════════════════════════════════════════════════════════════════════════════

type Exec = Pick<ExecutionContext, "exec">;

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

// "~/x/y" -> "$HOME"'/x/y' (adjacent quoted strings = one word)
const shPath = (p: string) =>
  p === "~" ? '"$HOME"' : p.startsWith("~/") ? `"$HOME"${shq(p.slice(1))}` : shq(p);

// ── Storage (plugin data dir, created by the SDK) ───────────────────────────
const DIR = pluginDataDir();
const F_CONFIG = pluginDataFile("config");
const F_SELECTED = pluginDataFile("selected");
const F_STATUS = pluginDataFile("status");
const F_OUT = pluginDataFile("out");

const CONFIGS_DIR = `${DIR}/configs`;
// `configs/` is a user-facing subfolder (users drop *.json files there).
const PRE = `mkdir -p "${CONFIGS_DIR}"`;
const CONFIGS_HINT = `${CONFIGS_DIR}/`;
const DEFAULT_VARIABLE_DIR = `${DIR}/_variables`;

// Output lines kept in the right pane (used by READ_STATE and by the renderer).
const MAX_LINES = 300;

const setConfigCmd = (name: string) =>
  `${PRE}; printf %s ${shq(name)} > "${F_CONFIG}"; rm -f "${F_SELECTED}" "${F_STATUS}" "${F_OUT}"`;

// jq filter from a dotted path: data.access_token -> .data.access_token, items.0.id -> .items[0].id
const jqFilter = (path: string) =>
  path
    .split(".")
    .filter(Boolean)
    .map((s) => (/^\d+$/.test(s) ? `[${s}]` : `.${s}`))
    .join("");

const READ_STATE = `
c="${CONFIGS_DIR}"; mkdir -p "$c"
n=$(cat "${F_CONFIG}" 2>/dev/null)
[ -f "$c/$n" ] || n=$(ls -1 "$c" | grep '\\.json$' | head -1)
echo "config=$n"
ls -1 "$c" | grep '\\.json$' | sed 's/^/configs=/'
echo "selected=$(cat "${F_SELECTED}" 2>/dev/null)"
echo "status=$(cat "${F_STATUS}" 2>/dev/null)"
[ -n "$n" ] && echo "cfg=$(tr -d '\\n' < "$c/$n")"
echo "---"
head -${MAX_LINES} "${F_OUT}" 2>/dev/null
`;

// Raw, untrimmed stdout of READ_STATE (parsed in loadState).
async function readRawState(ctx: Exec): Promise<string> {
  const res = await ctx.exec(READ_STATE);
  return res.stdout;
}

// `pathWord` is an already-quoted shell word (see varPath).
async function isNonEmptyFile(ctx: Exec, pathWord: string): Promise<boolean> {
  const res = await ctx.exec(`[ -s ${pathWord} ] && echo yes`);
  return res.stdout.trim() === "yes";
}

// ════════════════════════════════════════════════════════════════════════════
// Data model, request building, state
// ════════════════════════════════════════════════════════════════════════════

// ── Config format ───────────────────────────────────────────────────────────
interface ReqBody {
  body_type?: string;
  body_file?: string;
}

interface ApiRequest {
  req_tag: string;
  req_title: string;
  req_type: string;
  req_end_point: string;
  req_variable_type?: string;
  req_variable_is_save?: boolean;
  req_variable_response_value?: Record<string, string>;
  req_body?: ReqBody | null;
}

interface ApiConfig {
  app_title?: string;
  base_url: string;
  variable_dir?: string;
  variable_access_token_file?: string;
  headers?: Record<string, string>;
  requests: ApiRequest[];
}

const DEFAULT_TOKEN_FILE = "ACCESS_TOKEN.txt";

const METHOD_RE = /^[A-Z]{3,7}$/;
const NAME_RE = /^[A-Za-z0-9_.-]+$/; // variable file names
const PATH_RE = /^[A-Za-z0-9_.[\]-]+$/; // response field paths

// ── Request building ────────────────────────────────────────────────────────
const methodOf = (r: ApiRequest) => String(r.req_type ?? "GET").toUpperCase();

const urlOf = (cfg: ApiConfig, r: ApiRequest) =>
  cfg.base_url.replace(/\/+$/, "") +
  (r.req_end_point.startsWith("/") ? r.req_end_point : `/${r.req_end_point}`);

const variableDir = (cfg: ApiConfig) => cfg.variable_dir ?? DEFAULT_VARIABLE_DIR;
const tokenFile = (cfg: ApiConfig) => cfg.variable_access_token_file ?? DEFAULT_TOKEN_FILE;
const varPath = (cfg: ApiConfig, name: string) => `${shPath(variableDir(cfg))}"/${name}"`;

const isBearer = (r: ApiRequest) => (r.req_variable_type ?? "").toLowerCase() === "bearer";

function saveBlock(cfg: ApiConfig, r: ApiRequest): string {
  if (!r.req_variable_is_save || !r.req_variable_response_value) return "";
  const entries = Object.entries(r.req_variable_response_value).filter(
    ([file, path]) => NAME_RE.test(file) && PATH_RE.test(path),
  );
  if (!entries.length) return "";
  const lines = entries.map(
    ([file, path]) => `    v=$(jq -r '${jqFilter(path)} // empty' "$d/body" 2>/dev/null)
    if [ -n "$v" ]; then printf %s "$v" > ${varPath(cfg, file)}; saved="$saved ${file}"; fi`,
  );
  return `case "$code" in
  2*)
    if command -v jq >/dev/null 2>&1; then
      mkdir -p ${shPath(variableDir(cfg))}
${lines.join("\n")}
    else saved=" (jq missing: nothing saved)"; fi;;
esac`;
}

// h = ready-made " -H 'k: v'" args, b = body arg (or empty), u = quoted URL.
// In the built-in these travelled as {h} {b} {u} params; here they are
// interpolated straight into the script (actions are closures now).
function runParts(cfg: ApiConfig, r: ApiRequest): { u: string; h: string; b: string } {
  const h = Object.entries(cfg.headers ?? {})
    .map(([k, v]) => ` -H ${shq(`${k}: ${v}`)}`)
    .join("");
  const file = r.req_body?.body_file;
  const b =
    file && (r.req_body?.body_type ?? "RAW").toUpperCase() === "RAW"
      ? `--data-binary @${shPath(file)}`
      : "";
  return { u: shq(urlOf(cfg, r)), h, b };
}

function runCmd(cfg: ApiConfig, r: ApiRequest): string {
  const bearer = isBearer(r);
  const { u, h, b } = runParts(cfg, r);
  return `${PRE}
d="${DIR}"
rm -f "$d/body" "$d/headers" "$d/err" "$d/out"
printf %s ${shq(r.req_tag)} > "$d/selected"
${bearer ? `tok=$(cat ${varPath(cfg, tokenFile(cfg))} 2>/dev/null)` : ""}
curl -sS -m 15 -X ${methodOf(r)} -D "$d/headers" -o "$d/body" ${h} ${bearer ? '-H "Authorization: Bearer $tok"' : ""} ${b} ${u} 2> "$d/err"
rc=$?
if [ $rc -ne 0 ]; then
  echo "error|$(tr '\\n' ' ' < "$d/err" | cut -c1-200)" > "$d/status"
  : > "$d/out"
  exit 0
fi
line=$(grep -i '^HTTP/' "$d/headers" | tail -1 | tr -d '\\r')
code=$(echo "$line" | cut -d' ' -f2)
saved=""
${saveBlock(cfg, r)}
echo "ok|$line|$saved" > "$d/status"
if command -v jq >/dev/null 2>&1 && jq . "$d/body" > "$d/out" 2>/dev/null; then :; else head -c 20000 "$d/body" > "$d/out"; fi
`;
}

// ── State ───────────────────────────────────────────────────────────────────
interface State {
  config: string; // active config file name
  configs: string[]; // all config file names
  cfg: ApiConfig | null;
  cfgError: string;
  selected: string; // req_tag of the last run
  status: string; // raw "kind|text|saved"
  out: string[];
  hasToken: boolean;
}

function parseConfig(raw: string): { cfg: ApiConfig | null; error: string } {
  if (!raw) return { cfg: null, error: "" };
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j.base_url !== "string" || !Array.isArray(j.requests)) {
      return { cfg: null, error: "config needs base_url and requests[]" };
    }
    const requests = (j.requests as ApiRequest[]).filter(
      (r) =>
        r &&
        typeof r.req_tag === "string" &&
        typeof r.req_end_point === "string" &&
        METHOD_RE.test(String(r.req_type ?? "GET").toUpperCase()),
    );
    return { cfg: { ...j, requests }, error: "" };
  } catch (e) {
    return { cfg: null, error: `invalid JSON: ${(e as Error).message}` };
  }
}

async function loadState(ctx: Exec): Promise<State> {
  const raw = await readRawState(ctx);
  const st: State = {
    config: "",
    configs: [],
    cfg: null,
    cfgError: "",
    selected: "",
    status: "",
    out: [],
    hasToken: false,
  };
  const lines = raw.split("\n");
  const sep = lines.indexOf("---");
  const head = sep < 0 ? lines : lines.slice(0, sep);
  st.out = sep < 0 ? [] : lines.slice(sep + 1);
  for (const line of head) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i);
    const v = line.slice(i + 1).trim();
    if (k === "config") st.config = v;
    else if (k === "configs" && v) st.configs.push(v);
    else if (k === "selected") st.selected = v;
    else if (k === "status") st.status = v;
    else if (k === "cfg") {
      const p = parseConfig(v);
      st.cfg = p.cfg;
      st.cfgError = p.error;
    }
  }
  if (st.cfg) {
    st.hasToken = await isNonEmptyFile(ctx, varPath(st.cfg, tokenFile(st.cfg)));
  }
  return st;
}

// ════════════════════════════════════════════════════════════════════════════
// Rendering
// ════════════════════════════════════════════════════════════════════════════

const OWNS = "extra"; // item-id prefix and `owns` of the cli spec, not a core prefix

type Action = NonNullable<WidgetItem["action"]>;
type GroupContent = Extract<WidgetContent, { type: "group" }>;
type WidgetGroupSection = GroupContent["sections"][number];

const act = (ctx: Exec, cmd: string, then: "refresh" | "dismiss" = "refresh"): Action => ({
  run: async () => {
    await ctx.exec(cmd);
  },
  then,
});

const cliItem = (ctx: Exec, id: string, cmd: string): WidgetItem => ({
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
    bg1: g("bg1", "#232326"),
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

  const panel = { background: c.bg1, borderRadius: 8, padding: 4 };
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

async function render(ctx: ExecutionContext): Promise<WidgetContent> {
  return buildContent(ctx, await loadState(ctx));
}

// ════════════════════════════════════════════════════════════════════════════
// CLI commands
// ════════════════════════════════════════════════════════════════════════════

const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));

const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "list",
    title: "List the requests of the active config",
    async run(ctx) {
      const st = await loadState(ctx);
      if (!st.cfg) throw new Error(st.cfgError || `no config (see ${CONFIGS_HINT})`);
      return st.cfg.requests
        .map((r) => `${r.req_tag}\t${methodOf(r)}\t${urlOf(st.cfg!, r)}`)
        .join("\n");
    },
  },
  {
    id: "run",
    args: ["tag|title"],
    title: "Run a request and print the response",
    async run(ctx) {
      const q = positional(ctx).join(" ").toLowerCase();
      if (!q) throw new Error("run needs a req_tag or title (see `xrestapi list`)");
      const st = await loadState(ctx);
      if (!st.cfg) throw new Error(st.cfgError || `no config (see ${CONFIGS_HINT})`);
      const r = st.cfg.requests.find(
        (x) => x.req_tag.toLowerCase() === q || (x.req_title ?? "").toLowerCase() === q,
      );
      if (!r) throw new Error(`unknown request: ${q} (see \`xrestapi list\`)`);
      await ctx.dispatch(cliItem(ctx, r.req_tag, runCmd(st.cfg, r)));
      const after = await loadState(ctx);
      if (after.status.startsWith("error|")) throw new Error(after.status.slice(6));
      const [, line, saved] = after.status.split("|");
      return [line + (saved?.trim() ? `  (saved${saved})` : ""), "", ...after.out].join("\n");
    },
  },
  {
    id: "status",
    title: "Status and output of the last request",
    description: "--json for machine-readable output",
    async run(ctx) {
      const st = await loadState(ctx);
      if (ctx.args.includes("--json")) {
        return {
          config: st.config,
          selected: st.selected,
          status: st.status,
          hasToken: st.hasToken,
          out: st.out,
        };
      }
      return [
        `config  ${st.config || "(none)"}`,
        `request ${st.selected || "(none)"}`,
        `status  ${st.status || "(none)"}`,
        `token   ${st.hasToken ? "yes" : "no"}`,
        "",
        ...st.out,
      ].join("\n");
    },
  },
];

// ════════════════════════════════════════════════════════════════════════════
// Plugin
// ════════════════════════════════════════════════════════════════════════════

export const widget = createWidget({
  section: {
    title: "REST API",
    titleShow: true,
    navigationActive: true,
    querySearchActive: true, // typing filters the request list
  },
  cli: { owns: OWNS, commands: CLI_COMMANDS },
  render: (ctx) => render(ctx),
});

export const plugin = definePlugin({
  description: "Config-driven REST client: requests on the left, last response on the right.",
  widgets: [widget],
});

export default plugin;
bootstrapPlugin(plugin);
