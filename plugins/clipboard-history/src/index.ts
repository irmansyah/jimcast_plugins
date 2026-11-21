// [plugin] jim-clipboard-history/src/index.ts
//
// Clipboard history manager. Same layout and colors as the REST API plugin:
//   left  = a pinned capture switcher, then the history as cards
//           (pinned first, then newest first)
//   right = status line + key hints, then the full content of the selected entry
//
// Left is only the header and the history list. Enter on the header toggles
// capture (like the config switcher in the REST API plugin). Enter on a
// history row selects it (preview on the right); Enter on the already
// selected row copies it back to the clipboard and dismisses the bar.
// Everything else is a key binding (no buttons):
//   ctrl+p pin/unpin the focused entry     ctrl+d delete the focused entry
//   ctrl+x clear the unpinned history      ctrl+t pause/resume capture
// The right status line shows the selected entry, the last action
// ("Cleared 5", "Pinned", ...) for a few seconds and whether it is pinned.
//
// Storage: ~/.jimcast/plugin-data/<plugin id>/
//   config.json   settings (created with defaults on first run, edit freely)
//   entries/<id>  one file per entry, id = content hash (duplicates just move to the top)
//   pins/<id>     marker file for pinned entries
//   selected      id of the entry shown on the right
//   status        last action message shown in the status line (epoch ms|text)
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
const F_STATUS = `${DIR}/status`;
// Hash of an entry that was just deleted/cleared while still on the clipboard,
// so the next capture does not bring it straight back.
const F_SKIP = `${DIR}/skip`;

const PRE = `mkdir -p "${ENTRIES_DIR}" "${PINS_DIR}"`;

// How long the last action message stays in the status line.
const MSG_SECONDS = 10;

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
//   sel<TAB>id | msg<TAB>epoch_ms|text | tool<TAB>0|1 | pin<TAB>id | e<TAB>id (newest first)
//   size<TAB>id<TAB>bytes | prev<TAB>id<TAB>first non-blank line
const READ_STATE = `
d="${DIR}"; mkdir -p "$d/entries" "$d/pins"
printf 'sel\\t%s\\n' "$(cat "$d/selected" 2>/dev/null)"
printf 'msg\\t%s\\n' "$(cat "$d/status" 2>/dev/null)"
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
  msg: string; // last action message, "" when none or older than MSG_SECONDS
}

// "<epoch ms>|<text>" -> text while it is younger than MSG_SECONDS.
function freshMessage(raw: string): string {
  const i = raw.indexOf("|");
  if (i < 0) return "";
  const at = Number(raw.slice(0, i));
  return Number.isFinite(at) && Date.now() - at < MSG_SECONDS * 1000 ? raw.slice(i + 1).trim() : "";
}

// Shown in the status line for a few seconds.
async function setStatus(ctx: Exec, text: string): Promise<void> {
  await ctx.exec(`${PRE}; printf %s ${shq(`${Date.now()}|${text}`)} > "${F_STATUS}"`);
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
  let msgRaw = "";
  let shellTool = false;
  for (const line of res.stdout.split("\n")) {
    const f = line.split("\t");
    const id = (f[1] ?? "").trim();
    switch (f[0]) {
      case "sel":
        wanted = id;
        break;
      case "msg":
        msgRaw = f.slice(1).join(" ");
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
    msg: freshMessage(msgRaw),
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

const act = (ctx: Exec, cmd: string, then: "refresh" | "dismiss" = "refresh"): Action => ({
  run: async () => {
    await ctx.exec(cmd);
  },
  then,
});

// Pause / resume capture (the pinned header item on the left).
const toggleCapture = (ctx: Exec, cfg: Config): Action => ({
  run: async () => {
    await setConfigKey(ctx, "capture", !cfg.capture);
    await setStatus(ctx, cfg.capture ? "Capture paused" : "Capture resumed");
  },
  then: "refresh",
});

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
    bg: g("bg", "#232326"),
    bg1: g("bg1", "#2e2e32"),
    yellow: g("yellow", "#d79921"),
    brightGreen: g("brightGreen", "#b8bb26"),
    brightYellow: g("brightYellow", "#fabd2f"),
    brightRed: g("brightRed", "#fb4934"),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

// Middle truncation: "test1test1test1" -> "test1te....st1" (keeps start and end).
const ELLIPSIS = "....";
function middle(s: string, max: number): string {
  if (s.length <= max) return s;
  const keep = Math.max(2, max - ELLIPSIS.length);
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return s.slice(0, head) + ELLIPSIS + (tail > 0 ? s.slice(-tail) : "");
}

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

// Default key bindings (remap per widget in ~/.jimcast/keybindings.json).
const KEYS = { pin: "ctrl+p", delete: "ctrl+d", clear: "ctrl+x", capture: "ctrl+t" };
const keyHint = (k: string) => k.replace(/^ctrl\+/, "^").toUpperCase();

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

  // LEFT: capture switcher (pinned) + the history entries (cards).
  const left: WidgetItem[] = [
    {
      id: `${OWNS}-capture`,
      pinned: true,
      attribute: {
        label1: "Clipboard history",
        color1: c.fg2,
        label2: `${st.entries.length} saved  ${pinnedCount} pinned`,
        color2: c.fg4,
        labelRight: cfg.capture ? "● Capturing" : "⏸ Paused",
        colorRight: cfg.capture ? c.brightGreen : c.brightYellow,
      },
      action: toggleCapture(ctx, cfg),
    },
  ];
  for (const e of st.entries) {
    const isSel = e.id === st.selId;
    left.push({
      id: `${OWNS}:${e.id}`,
      // NOTE: `style` on WidgetItem is a guess (sections accept it, see `panel`).
      // If the SDK names it differently, adjust here.
      style: { background: c.bg1, borderRadius: 6, padding: 4, marginBottom: 4 },
      attribute: {
        label1: middle(oneLine(e.preview) || "(blank)", cfg.label_max),
        color1: isSel ? c.yellow : c.fg,
        // always two lines so every item has the same height
        label2: fmtSize(e.size),
        color2: c.fg4,
        labelRight: e.pinned ? "📌" : undefined,
        colorRight: c.fg4,
        textSizeRight: FONT.xs,
      },
      // Enter selects; Enter on the selected row copies it back.
      action: isSel ? act(ctx, copyCmd(cfg, e.id), "dismiss") : act(ctx, selectCmd(e.id)),
    });
  }
  if (!st.entries.length) {
    left.push({
      id: `${OWNS}-empty`,
      pinned: true,
      attribute: {
        label1: cfg.capture ? "Nothing copied yet" : "Capture is paused",
        color1: c.fg4,
        textSize1: FONT.sm,
      },
    });
  }

  // RIGHT: status line + key hints + entry content.
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
        color1: c.brightGreen,
        textSize1: FONT.sm,
        label2: st.msg || undefined,
        color2: c.yellow,
        textSize2: FONT.xs,
        labelRight: sel.pinned ? "📌 pinned" : "not pinned",
        colorRight: sel.pinned ? c.brightGreen : c.fg4,
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
          : `Capture is paused. Press ${keyHint(KEYS.capture)} to resume.`,
        color1: c.fg4,
        textSize1: FONT.sm,
        label2: st.msg || undefined,
        color2: c.yellow,
        textSize2: FONT.xs,
      },
    };
  }

  const hintsItem: WidgetItem = {
    id: `${OWNS}-keys`,
    pinned: true,
    attribute: {
      label1: "Keys",
      color1: c.fg2,
      textSize1: FONT.sm,
      labelRight: [
        `${keyHint(KEYS.pin)} pin`,
        `${keyHint(KEYS.delete)} delete`,
        `${keyHint(KEYS.clear)} clear`,
        `${keyHint(KEYS.capture)} ${cfg.capture ? "pause" : "resume"}`,
      ].join(" · "),
      colorRight: c.fg4,
      textSizeRight: FONT.xs,
    },
  };

  const outItems: WidgetItem[] = outputLines(st.content, cfg.wrap_at, cfg.preview_lines).map(
    (line, i) => ({
      id: `${OWNS}-out:${i}`,
      pinned: true,
      attribute: { label1: line, color1: c.fg2, textSize1: FONT.xs },
    }),
  );

  const rightSections: WidgetGroupSection[] = [
    {
      id: "status",
      content: { type: "list", datas: [statusItem, hintsItem] },
    },
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

  const panel = { background: c.bg, borderRadius: 8, padding: 4 };
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
// Key actions
// ════════════════════════════════════════════════════════════════════════════

type KeyCtx = Exec & { focusedItemId?: string | null };

// The focused history row, or the selected entry when focus is elsewhere.
function focusedEntry(ctx: KeyCtx, st: State): Entry | undefined {
  const id = ctx.focusedItemId ?? "";
  const h = id.startsWith(`${OWNS}:`) ? id.slice(OWNS.length + 1) : "";
  return st.entries.find((e) => e.id === h) ?? st.entries.find((e) => e.id === st.selId);
}

export const KEY_ACTIONS = [
  {
    id: "pin",
    title: "Pin or unpin the focused entry",
    default: KEYS.pin,
    async run(ctx: KeyCtx) {
      const e = focusedEntry(ctx, await loadState(ctx));
      if (!e) return;
      await ctx.exec(pinCmd(e.id));
      await setStatus(ctx, e.pinned ? "Unpinned" : "Pinned");
    },
  },
  {
    id: "delete",
    title: "Delete the focused entry",
    default: KEYS.delete,
    async run(ctx: KeyCtx) {
      const e = focusedEntry(ctx, await loadState(ctx));
      if (!e) return;
      await ctx.exec(deleteCmd(e.id));
      await setStatus(ctx, "Deleted");
    },
  },
  {
    id: "clear",
    title: "Clear the unpinned history",
    default: KEYS.clear,
    async run(ctx: KeyCtx) {
      const st = await loadState(ctx);
      const n = st.entries.filter((e) => !e.pinned).length;
      await ctx.exec(clearCmd(st.cfg, false));
      await setStatus(ctx, n ? `Cleared ${n} ${n === 1 ? "entry" : "entries"}` : "Nothing to clear");
    },
  },
  {
    id: "capture",
    title: "Pause or resume capture",
    default: KEYS.capture,
    async run(ctx: KeyCtx) {
      const { cfg, error } = await loadConfig(ctx);
      if (error) return;
      await setConfigKey(ctx, "capture", !cfg.capture);
      await setStatus(ctx, cfg.capture ? "Capture paused" : "Capture resumed");
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
  keys: { owns: OWNS, actions: KEY_ACTIONS },
  render: (ctx) => render(ctx),
});

export const plugin = definePlugin({
  description: "Clipboard history manager: history on the left, full content on the right.",
  widgets: [widget],
});

export default plugin;
bootstrapPlugin(plugin);
