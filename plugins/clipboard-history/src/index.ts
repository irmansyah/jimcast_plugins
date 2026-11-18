// [plugin] jim-clipboard-history/src/index.ts
//
// Clipboard history manager. Same layout as the REST API plugin:
//   left  = clipboard history (pinned first, then newest first)
//   right = full content of the selected entry
//
// Enter on a row selects it (preview on the right); Enter on the already
// selected row copies it back to the clipboard and dismisses the bar.
// The pinned rows at the top pause/resume capture, pin/unpin, delete the
// selected entry, or clear the unpinned history.
//
// Storage: ~/.jimcast/plugin-data/<plugin id>/
//   config.json   settings (created with defaults on first run, edit freely)
//   entries/<id>  one file per entry, id = content hash (duplicates just move to the top)
//   pins/<id>     marker file for pinned entries
//   selected      id of the entry shown on the right
//
// Capture: every refresh (REFRESH_SECONDS) the clipboard is read once and
// stored. There is no background daemon, so copies are only recorded while
// the widget is being refreshed.

import {
  createWidget,
  definePlugin,
  pluginDataDir,
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

const DIR = pluginDataDir();
const ENTRIES_DIR = `${DIR}/entries`;
const PINS_DIR = `${DIR}/pins`;
const CONFIG_FILE = `${DIR}/config.json`;
const F_SELECTED = `${DIR}/selected`;
// Hash of an entry that was just deleted/cleared while still on the clipboard,
// so the next capture does not bring it straight back.
const F_SKIP = `${DIR}/skip`;

const PRE = `mkdir -p "${ENTRIES_DIR}" "${PINS_DIR}"`;

// Local poll interval (seconds). Fixed at build time, see README.
const REFRESH_SECONDS = 2;

// Shell function: content hash of a file (sha1sum / shasum / cksum fallback).
const HASH_FN = `hashf() {
  if command -v sha1sum >/dev/null 2>&1; then sha1sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum "$1" | cut -d' ' -f1
  else cksum < "$1" | tr ' ' '-'; fi
}`;

const READ_DEFAULT = `if command -v pbpaste >/dev/null 2>&1; then pbpaste
elif command -v wl-paste >/dev/null 2>&1; then wl-paste --no-newline
elif command -v xclip >/dev/null 2>&1; then xclip -selection clipboard -o
elif command -v xsel >/dev/null 2>&1; then xsel --clipboard --output
fi`;

const WRITE_DEFAULT = `if command -v pbcopy >/dev/null 2>&1; then pbcopy
elif command -v wl-copy >/dev/null 2>&1; then wl-copy
elif command -v xclip >/dev/null 2>&1; then xclip -selection clipboard -i
elif command -v xsel >/dev/null 2>&1; then xsel --clipboard --input
fi`;

// Raw, untrimmed stdout is parsed in loadState. Tab-separated records:
//   sel<TAB>id | tool<TAB>0|1 | pin<TAB>id | e<TAB>id (newest first)
//   size<TAB>id<TAB>bytes | prev<TAB>id<TAB>first non-blank line
const READ_STATE = `
d="${DIR}"; mkdir -p "$d/entries" "$d/pins"
printf 'sel\\t%s\\n' "$(cat "$d/selected" 2>/dev/null)"
t=0; for x in pbpaste wl-paste xclip xsel; do command -v "$x" >/dev/null 2>&1 && t=1; done
printf 'tool\\t%s\\n' "$t"
for p in $(ls -1 "$d/pins"); do printf 'pin\\t%s\\n' "$p"; done
cd "$d/entries" || exit 0
list=$(ls -t)
if [ -n "$list" ]; then
  for h in $list; do printf 'e\\t%s\\n' "$h"; done
  wc -c $list | awk '$2 != "total" { print "size\\t" $2 "\\t" $1 }'
  awk '/[^[:space:]]/ && !(FILENAME in s) { s[FILENAME]=1; line=$0; sub(/^[ \\t]+/, "", line); print "prev\\t" FILENAME "\\t" substr(line, 1, 200) }' $list
fi
`;

// ════════════════════════════════════════════════════════════════════════════
// Config (config.json)
// ════════════════════════════════════════════════════════════════════════════

interface Config {
  capture: boolean; // false = paused
  max_items: number; // unpinned entries kept
  max_entry_bytes: number; // larger clipboard contents are ignored
  preview_lines: number; // rows shown in the right pane
  label_max: number; // characters of a row label
  wrap_at: number; // long preview lines are chunked at this width
  ignore_patterns: string[]; // grep -E patterns; matching contents are never stored
  read_command: string; // "" = auto (pbpaste / wl-paste / xclip / xsel)
  write_command: string; // "" = auto (pbcopy / wl-copy / xclip / xsel); reads stdin
}

type NumKey = "max_items" | "max_entry_bytes" | "preview_lines" | "label_max" | "wrap_at";

const DEFAULT_CONFIG: Config = {
  capture: true,
  max_items: 50,
  max_entry_bytes: 20000,
  preview_lines: 300,
  label_max: 60,
  wrap_at: 110,
  ignore_patterns: [],
  read_command: "",
  write_command: "",
};

const LIMITS: Record<NumKey, [number, number]> = {
  max_items: [1, 1000],
  max_entry_bytes: [1, 1_000_000],
  preview_lines: [1, 2000],
  label_max: [10, 200],
  wrap_at: [20, 300],
};

function normalizeConfig(raw: unknown): Config {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const num = (k: NumKey): number => {
    const v = o[k];
    const [lo, hi] = LIMITS[k];
    return typeof v === "number" && Number.isFinite(v)
      ? Math.min(hi, Math.max(lo, Math.round(v)))
      : DEFAULT_CONFIG[k];
  };
  const str = (k: "read_command" | "write_command"): string =>
    typeof o[k] === "string" ? (o[k] as string) : DEFAULT_CONFIG[k];
  return {
    capture: typeof o.capture === "boolean" ? o.capture : DEFAULT_CONFIG.capture,
    max_items: num("max_items"),
    max_entry_bytes: num("max_entry_bytes"),
    preview_lines: num("preview_lines"),
    label_max: num("label_max"),
    wrap_at: num("wrap_at"),
    ignore_patterns: Array.isArray(o.ignore_patterns)
      ? o.ignore_patterns.filter((p): p is string => typeof p === "string" && p.length > 0)
      : [],
    read_command: str("read_command"),
    write_command: str("write_command"),
  };
}

async function readConfigFile(
  ctx: Exec,
): Promise<{ raw: Record<string, unknown> | null; error: string }> {
  const res = await ctx.exec(`cat "${CONFIG_FILE}" 2>/dev/null`);
  const text = res.stdout.trim();
  if (!text) return { raw: null, error: "" };
  try {
    const j: unknown = JSON.parse(text);
    if (!j || typeof j !== "object" || Array.isArray(j)) {
      return { raw: null, error: "expected a JSON object" };
    }
    return { raw: j as Record<string, unknown>, error: "" };
  } catch (e) {
    return { raw: null, error: `invalid JSON: ${(e as Error).message}` };
  }
}

async function writeConfigFile(ctx: Exec, obj: Record<string, unknown>): Promise<void> {
  const text = JSON.stringify(obj, null, 2) + "\n";
  await ctx.exec(`mkdir -p "${DIR}"; printf %s ${shq(text)} > "${CONFIG_FILE}"`);
}

// Creates config.json with the defaults on first run.
async function loadConfig(ctx: Exec): Promise<{ cfg: Config; error: string }> {
  const { raw, error } = await readConfigFile(ctx);
  if (error) return { cfg: DEFAULT_CONFIG, error };
  if (!raw) {
    await writeConfigFile(ctx, { ...DEFAULT_CONFIG });
    return { cfg: DEFAULT_CONFIG, error: "" };
  }
  return { cfg: normalizeConfig(raw), error: "" };
}

async function setConfigKey(ctx: Exec, key: string, value: unknown): Promise<void> {
  const { raw, error } = await readConfigFile(ctx);
  if (error) throw new Error(`config.json: ${error}`);
  await writeConfigFile(ctx, { ...(raw ?? DEFAULT_CONFIG), [key]: value });
}

// ════════════════════════════════════════════════════════════════════════════
// Scripts (capture and actions)
// ════════════════════════════════════════════════════════════════════════════

const readCmd = (cfg: Config) => cfg.read_command.trim() || READ_DEFAULT;
const writeCmd = (cfg: Config) => cfg.write_command.trim() || WRITE_DEFAULT;

// Read the clipboard once, store it unless empty / too big / ignored / just
// deleted, then prune the unpinned entries above max_items.
function captureCmd(cfg: Config): string {
  const patterns = cfg.ignore_patterns
    .map((p) => `  grep -Eq -e ${shq(p)} "$tmp" && skip=1`)
    .join("\n");
  return `${PRE}
${HASH_FN}
d="${DIR}"
tmp="$d/.capture.$$"
(
${readCmd(cfg)}
) > "$tmp" 2>/dev/null
sz=$(wc -c < "$tmp" | tr -d ' ')
if [ "$sz" -gt 0 ] && [ "$sz" -le ${cfg.max_entry_bytes} ] && grep -q '[^[:space:]]' "$tmp"; then
  skip=0
${patterns}
  h=$(hashf "$tmp")
  if [ "$h" = "$(cat "$d/skip" 2>/dev/null)" ]; then skip=1; else rm -f "$d/skip"; fi
  if [ "$skip" = 0 ]; then
    if [ -f "$d/entries/$h" ]; then touch "$d/entries/$h"; else cp "$tmp" "$d/entries/$h"; fi
  fi
fi
rm -f "$tmp"
n=0
for h in $(ls -t "$d/entries"); do
  [ -f "$d/pins/$h" ] && continue
  n=$((n+1))
  [ "$n" -gt ${cfg.max_items} ] && rm -f "$d/entries/$h"
done
for p in $(ls "$d/pins"); do [ -f "$d/entries/$p" ] || rm -f "$d/pins/$p"; done
`;
}

const selectCmd = (id: string) => `${PRE}; printf %s ${shq(id)} > "${F_SELECTED}"`;

const copyCmd = (cfg: Config, id: string) =>
  `${PRE}; f="${ENTRIES_DIR}/"${shq(id)}; [ -f "$f" ] || exit 0
( ${writeCmd(cfg)}
) < "$f" > /dev/null 2>&1
touch "$f"; printf %s ${shq(id)} > "${F_SELECTED}"`;

const pinCmd = (id: string) =>
  `${PRE}; f="${PINS_DIR}/"${shq(id)}; if [ -f "$f" ]; then rm -f "$f"; else : > "$f"; fi`;

const deleteCmd = (id: string) =>
  `${PRE}; f=${shq(id)}; rm -f "${ENTRIES_DIR}/$f" "${PINS_DIR}/$f"; printf %s "$f" > "${F_SKIP}"
[ "$(cat "${F_SELECTED}" 2>/dev/null)" = "$f" ] && rm -f "${F_SELECTED}"`;

// Removes unpinned entries (and pinned ones with all = true). Whatever is on
// the clipboard right now is not captured again.
function clearCmd(cfg: Config, all: boolean): string {
  return `${PRE}
${HASH_FN}
d="${DIR}"
tmp="$d/.clear.$$"
(
${readCmd(cfg)}
) > "$tmp" 2>/dev/null
[ -s "$tmp" ] && hashf "$tmp" > "$d/skip"
rm -f "$tmp"
${
  all
    ? `rm -f "$d"/entries/* "$d"/pins/*`
    : `for h in $(ls "$d/entries"); do [ -f "$d/pins/$h" ] || rm -f "$d/entries/$h"; done`
}
rm -f "$d/selected"
`;
}

// ════════════════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════════════════

interface Entry {
  id: string;
  size: number; // bytes
  pinned: boolean;
  preview: string; // first non-blank line
}

interface State {
  cfg: Config;
  cfgError: string;
  tool: boolean; // a clipboard tool is available
  entries: Entry[]; // pinned first, then newest first
  selId: string; // resolved selection ("" when no entries)
  content: string[]; // lines of the selected entry (at most preview_lines)
  truncated: boolean;
}

async function loadState(
  ctx: Exec,
  loaded?: { cfg: Config; error: string },
): Promise<State> {
  const { cfg, error } = loaded ?? (await loadConfig(ctx));
  const res = await ctx.exec(READ_STATE);

  const order: string[] = [];
  const pins = new Set<string>();
  const sizes = new Map<string, number>();
  const prev = new Map<string, string>();
  let wanted = "";
  let shellTool = false;
  for (const line of res.stdout.split("\n")) {
    const f = line.split("\t");
    const id = (f[1] ?? "").trim();
    switch (f[0]) {
      case "sel":
        wanted = id;
        break;
      case "tool":
        shellTool = id === "1";
        break;
      case "pin":
        if (id) pins.add(id);
        break;
      case "e":
        if (id) order.push(id);
        break;
      case "size":
        sizes.set(id, Number(f[2]) || 0);
        break;
      case "prev":
        prev.set(id, f.slice(2).join(" ").replace(/\r/g, ""));
        break;
    }
  }

  const all: Entry[] = order.map((id) => ({
    id,
    size: sizes.get(id) ?? 0,
    pinned: pins.has(id),
    preview: prev.get(id) ?? "",
  }));
  const entries = [...all.filter((e) => e.pinned), ...all.filter((e) => !e.pinned)];
  const sel = entries.find((e) => e.id === wanted) ?? entries[0];

  const st: State = {
    cfg,
    cfgError: error,
    tool: cfg.read_command.trim() !== "" || shellTool,
    entries,
    selId: sel?.id ?? "",
    content: [],
    truncated: false,
  };
  if (sel) {
    const body = await ctx.exec(
      `head -n ${cfg.preview_lines + 1} "${ENTRIES_DIR}/"${shq(sel.id)} 2>/dev/null`,
    );
    const lines = body.stdout.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    st.truncated = lines.length > cfg.preview_lines;
    st.content = lines.slice(0, cfg.preview_lines);
  }
  return st;
}

// ════════════════════════════════════════════════════════════════════════════
// Rendering
// ════════════════════════════════════════════════════════════════════════════

const OWNS = "extclip"; // item-id prefix and `owns` of the cli spec, not a core prefix

type Action = NonNullable<WidgetItem["action"]>;
type GroupContent = Extract<WidgetContent, { type: "group" }>;
type WidgetGroupSection = GroupContent["sections"][number];

const fn = (run: () => Promise<void>, then: "refresh" | "dismiss" = "refresh"): Action => ({
  run,
  then,
});

const act = (ctx: Exec, cmd: string, then: "refresh" | "dismiss" = "refresh"): Action =>
  fn(async () => {
    await ctx.exec(cmd);
  }, then);

const cliItem = (ctx: Exec, id: string, cmd: string): WidgetItem => ({
  id: `${OWNS}-cli:${id}`,
  action: act(ctx, cmd),
});

// ── Design-system stand-ins ─────────────────────────────────────────────────
const FONT = { xs: 11, sm: 12 }; // assumed values, see README
const LIST_MAX_H = 380;
const OUT_MAX_H = 380;

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
    brightRed: g("brightRed", "#fb4934"),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const short = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Wrap + keep indentation (HTML collapses leading spaces) -> one list row each.
function outputLines(out: string[], wrapAt: number, maxRows: number): string[] {
  const rows: string[] = [];
  for (const raw of out) {
    const line = raw.replace(/\r$/, "").replace(/\t/g, "  ");
    const indent = /^ */.exec(line)![0].length;
    const pad = "\u00A0".repeat(indent);
    const text = line.slice(indent);
    if (!text) {
      rows.push("\u00A0");
      if (rows.length >= maxRows) return rows;
      continue;
    }
    for (let i = 0; i < text.length; i += wrapAt) {
      rows.push(pad + text.slice(i, i + wrapAt));
      if (rows.length >= maxRows) return rows;
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
  const cfg = st.cfg;

  if (st.cfgError) {
    return messageContent(`config.json: ${st.cfgError} (${CONFIG_FILE})`, c.brightRed);
  }
  if (!st.tool) {
    return messageContent(
      `No clipboard tool found (pbpaste, wl-paste, xclip, xsel). Set read_command and write_command in ${CONFIG_FILE}`,
      c.fg4,
    );
  }

  const sel = st.entries.find((e) => e.id === st.selId);
  const pinnedCount = st.entries.filter((e) => e.pinned).length;
  const unpinnedCount = st.entries.length - pinnedCount;

  // LEFT: control rows (pinned) + the history.
  const left: WidgetItem[] = [
    {
      id: `${OWNS}-capture`,
      pinned: true,
      attribute: {
        label1: cfg.capture ? "● Capturing" : "⏸ Paused",
        color1: cfg.capture ? c.brightGreen : c.brightYellow,
        label2: `${st.entries.length} saved · ${pinnedCount} pinned`,
        color2: c.fg4,
        labelRight: cfg.capture ? "pause" : "resume",
        colorRight: c.fg4,
        textSizeRight: FONT.xs,
      },
      action: fn(async () => {
        await setConfigKey(ctx, "capture", !cfg.capture);
      }),
    },
  ];
  if (sel) {
    left.push(
      {
        id: `${OWNS}-pin`,
        pinned: true,
        attribute: {
          label1: sel.pinned ? "Unpin selected" : "Pin selected",
          color1: c.fg2,
          label2: short(oneLine(sel.preview), 34),
          color2: c.fg4,
          labelRight: "📌",
          colorRight: c.fg4,
        },
        action: act(ctx, pinCmd(sel.id)),
      },
      {
        id: `${OWNS}-delete`,
        pinned: true,
        attribute: {
          label1: "Delete selected",
          color1: c.fg2,
          label2: short(oneLine(sel.preview), 34),
          color2: c.fg4,
          labelRight: "🗑",
          colorRight: c.fg4,
        },
        action: act(ctx, deleteCmd(sel.id)),
      },
    );
  }
  if (unpinnedCount > 0) {
    left.push({
      id: `${OWNS}-clear`,
      pinned: true,
      attribute: {
        label1: "Clear unpinned",
        color1: c.fg2,
        label2: `${unpinnedCount} ${unpinnedCount === 1 ? "entry" : "entries"}`,
        color2: c.fg4,
        labelRight: "✕",
        colorRight: c.fg4,
      },
      action: act(ctx, clearCmd(cfg, false)),
    });
  }
  for (const e of st.entries) {
    const isSel = e.id === st.selId;
    left.push({
      id: `${OWNS}:${e.id}`,
      attribute: {
        label1: short(oneLine(e.preview) || "(blank)", cfg.label_max),
        color1: isSel ? c.yellow : c.fg,
        label2: fmtSize(e.size),
        color2: c.fg4,
        labelRight: e.pinned ? "📌" : undefined,
        colorRight: c.fg4,
      },
      // Enter selects; Enter on the selected row copies it back.
      action: isSel ? act(ctx, copyCmd(cfg, e.id), "dismiss") : act(ctx, selectCmd(e.id)),
    });
  }

  // RIGHT: entry info + content.
  const modeLabel = cfg.capture ? "capturing" : "paused";
  const modeColor = cfg.capture ? c.brightGreen : c.brightYellow;
  let statusItem: WidgetItem;
  if (sel) {
    const idx = st.entries.indexOf(sel) + 1;
    statusItem = {
      id: `${OWNS}-status`,
      pinned: true,
      attribute: {
        label1: `Entry ${idx}/${st.entries.length} · ${fmtSize(sel.size)} · ${st.content.length}${
          st.truncated ? "+" : ""
        } ${st.content.length === 1 && !st.truncated ? "line" : "lines"}`,
        color1: c.fg2,
        textSize1: FONT.sm,
        label2: sel.pinned ? "📌 pinned · Enter on the highlighted row copies it" : "Enter on the highlighted row copies it",
        color2: c.fg4,
        textSize2: FONT.xs,
        labelRight: modeLabel,
        colorRight: modeColor,
        textSizeRight: FONT.xs,
      },
    };
  } else {
    statusItem = {
      id: `${OWNS}-status`,
      pinned: true,
      attribute: {
        label1: cfg.capture
          ? "Clipboard history is empty. Copy something."
          : "Capture is paused. Select the first row to resume.",
        color1: c.fg4,
        textSize1: FONT.sm,
        labelRight: modeLabel,
        colorRight: modeColor,
        textSizeRight: FONT.xs,
      },
    };
  }

  const outItems: WidgetItem[] = outputLines(st.content, cfg.wrap_at, cfg.preview_lines).map(
    (line, i) => ({
      id: `${OWNS}-out:${i}`,
      pinned: true,
      attribute: { label1: line, color1: c.fg2, textSize1: FONT.xs },
    }),
  );

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
      id: "history",
      navigable: true,
      flex: 2,
      maxHeight: LIST_MAX_H,
      style: panel,
      content: { type: "list", datas: left },
    },
    {
      id: "content",
      flex: 3,
      style: panel,
      content: { type: "group", direction: "column", gap: 4, sections: rightSections },
    },
  ];
  return { type: "group", direction: "row", gap: 8, sections };
}

async function render(ctx: ExecutionContext): Promise<WidgetContent> {
  const loaded = await loadConfig(ctx);
  if (!loaded.error && loaded.cfg.capture) await ctx.exec(captureCmd(loaded.cfg));
  return buildContent(ctx, await loadState(ctx, loaded));
}

// ════════════════════════════════════════════════════════════════════════════
// CLI commands
// ════════════════════════════════════════════════════════════════════════════

const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));

function resolveEntry(st: State, q: string | undefined, verb: string): Entry {
  if (!q) throw new Error(`${verb} needs an entry number or id (see \`list\`)`);
  if (!st.entries.length) throw new Error("clipboard history is empty");
  if (/^\d+$/.test(q)) {
    const e = st.entries[Number(q) - 1];
    if (!e) throw new Error(`no entry ${q} (history has ${st.entries.length})`);
    return e;
  }
  const m = st.entries.filter((e) => e.id.startsWith(q));
  if (m.length === 1) return m[0];
  throw new Error(m.length ? `ambiguous id: ${q}` : `unknown entry: ${q} (see \`list\`)`);
}

async function stateOrThrow(ctx: WidgetCliContext): Promise<State> {
  const st = await loadState(ctx);
  if (st.cfgError) throw new Error(`config.json: ${st.cfgError}`);
  return st;
}

const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "list",
    title: "List the clipboard history (pinned first, then newest)",
    async run(ctx) {
      const st = await stateOrThrow(ctx);
      if (!st.entries.length) return "(empty)";
      return st.entries
        .map(
          (e, i) =>
            `${i + 1}\t${e.id.slice(0, 8)}\t${e.pinned ? "pin" : "-"}\t${e.size}\t${oneLine(e.preview)}`,
        )
        .join("\n");
    },
  },
  {
    id: "show",
    args: ["n|id"],
    title: "Print the full content of an entry",
    async run(ctx) {
      const st = await stateOrThrow(ctx);
      const e = resolveEntry(st, positional(ctx)[0], "show");
      const res = await ctx.exec(`cat "${ENTRIES_DIR}/"${shq(e.id)}`);
      return res.stdout;
    },
  },
  {
    id: "copy",
    args: ["n|id"],
    title: "Copy an entry back to the clipboard",
    async run(ctx) {
      const st = await stateOrThrow(ctx);
      const e = resolveEntry(st, positional(ctx)[0], "copy");
      await ctx.dispatch(cliItem(ctx, e.id, copyCmd(st.cfg, e.id)));
      return `copied ${e.id.slice(0, 8)} (${fmtSize(e.size)})`;
    },
  },
  {
    id: "pin",
    args: ["n|id"],
    title: "Pin or unpin an entry",
    async run(ctx) {
      const st = await stateOrThrow(ctx);
      const e = resolveEntry(st, positional(ctx)[0], "pin");
      await ctx.dispatch(cliItem(ctx, e.id, pinCmd(e.id)));
      return `${e.pinned ? "unpinned" : "pinned"} ${e.id.slice(0, 8)}`;
    },
  },
  {
    id: "delete",
    args: ["n|id"],
    title: "Delete an entry",
    async run(ctx) {
      const st = await stateOrThrow(ctx);
      const e = resolveEntry(st, positional(ctx)[0], "delete");
      await ctx.dispatch(cliItem(ctx, e.id, deleteCmd(e.id)));
      return `deleted ${e.id.slice(0, 8)}`;
    },
  },
  {
    id: "clear",
    title: "Clear the unpinned history",
    description: "--all also removes pinned entries",
    async run(ctx) {
      const st = await stateOrThrow(ctx);
      const all = ctx.args.includes("--all");
      await ctx.dispatch(cliItem(ctx, "clear", clearCmd(st.cfg, all)));
      return all ? "cleared everything" : "cleared unpinned entries";
    },
  },
  {
    id: "capture",
    title: "Read the clipboard now and store it",
    async run(ctx) {
      const loaded = await loadConfig(ctx);
      if (loaded.error) throw new Error(`config.json: ${loaded.error}`);
      await ctx.dispatch(cliItem(ctx, "capture", captureCmd(loaded.cfg)));
      const st = await loadState(ctx, loaded);
      return `${st.entries.length} entries`;
    },
  },
  {
    id: "config",
    args: ["get|set|reset", "key", "value"],
    title: "Show or change config.json",
    description:
      "`config` prints it, `config get <key>`, `config set <key> <value>` (JSON values, e.g. ignore_patterns '[\"secret\"]'), `config reset`",
    async run(ctx) {
      const [sub = "get", key, ...rest] = positional(ctx);
      const keys = Object.keys(DEFAULT_CONFIG);

      if (sub === "reset") {
        await writeConfigFile(ctx, { ...DEFAULT_CONFIG });
        return "config reset to defaults";
      }

      if (sub === "get") {
        const { raw, error } = await readConfigFile(ctx);
        if (error) throw new Error(`config.json: ${error}`);
        const cfg = normalizeConfig(raw);
        if (!key) return cfg;
        if (!keys.includes(key)) throw new Error(`unknown key: ${key} (keys: ${keys.join(", ")})`);
        return (cfg as unknown as Record<string, unknown>)[key];
      }

      if (sub === "set") {
        if (!key || !rest.length) throw new Error("usage: config set <key> <value>");
        if (!keys.includes(key)) throw new Error(`unknown key: ${key} (keys: ${keys.join(", ")})`);
        const text = rest.join(" ");
        const def = (DEFAULT_CONFIG as unknown as Record<string, unknown>)[key];
        let val: unknown;
        try {
          val = JSON.parse(text);
        } catch {
          val = text;
        }
        if (typeof def === "string") val = text; // string keys take the raw text
        const ok =
          typeof def === "boolean"
            ? typeof val === "boolean"
            : typeof def === "number"
              ? typeof val === "number" && Number.isFinite(val)
              : typeof def === "string"
                ? typeof val === "string"
                : Array.isArray(val) && val.every((x) => typeof x === "string");
        if (!ok) {
          throw new Error(
            `${key} expects ${Array.isArray(def) ? "a JSON array of strings" : typeof def}`,
          );
        }
        // Clamp numbers the same way the widget will.
        const clamped = (normalizeConfig({ [key]: val }) as unknown as Record<string, unknown>)[key];
        await setConfigKey(ctx, key, clamped);
        return `${key} = ${JSON.stringify(clamped)}`;
      }

      throw new Error("usage: config [get [key] | set <key> <value> | reset]");
    },
  },
];

// ════════════════════════════════════════════════════════════════════════════
// Plugin
// ════════════════════════════════════════════════════════════════════════════

// Main widget: no id (its full id is the plugin id from package.json).
export const widget = createWidget({
  section: {
    title: "Clipboard",
    titleShow: true,
    navigationActive: true,
    querySearchActive: true, // typing filters the history by first line
  },
  repeat: { enable: true, seconds: REFRESH_SECONDS },
  cli: { owns: OWNS, commands: CLI_COMMANDS },
  render: (ctx) => render(ctx),
});

export const plugin = definePlugin({
  description: "Clipboard history manager: history on the left, full content on the right.",
  widgets: [widget],
});

export default plugin;
bootstrapPlugin(plugin);
