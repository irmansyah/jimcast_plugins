// [plugin] notes/src/index.ts
//
// Simple notes widget for a folder of markdown files. The folders (tabs), the
// file naming and the template all come from config.json in the plugin data
// dir, so the same plugin can be a plain notes folder or a full Zettelkasten
// (inbox / notes / hubs / zettelkasten ...). See README.md for both setups.
//
//   [ 📥 11 ] [ 📝 ] [ 📁 3 ]                                        tabs
//   Capture fast, no polish.                                          hint
//   ⚠ 3 Inbox notes older than 7 days
//   Neovim find and replace                          inbox · 2026-01-09
//   ...                                                             latest 6
//   NEW  ＋ Notes    NEW IN  cheat-sheet    CLIP  📋 To inbox    VAULT  Open
//
// Config: ~/.jimcast/plugin-data/<plugin id>/config.json, written with a simple
// default the first time the widget runs; after that the file is yours.
//
//   root          notes folder (absolute, or starting with ~/)
//   stale_days    notes older than this are flagged by check "stale" (default 7)
//   template      note template, relative to root (copied as-is into new notes)
//   file_name     "date_title"  -> 2026-01-09_My-Title.md   (default)
//                 "title"       -> My-Title.md
//   extra_dirs    more folders `setup` should create (assets, images, ...)
//   tabs[]        one tab per folder:
//     key, name, icon, dir (relative to root)
//     recursive   list notes of sub-folders too
//     sub         sub-folders a new note can go in (NEW IN cycles through them)
//     hint        one line under the tabs
//     file_name   overrides the global naming for this tab
//     new         false hides the NEW button (default true)
//     check       "stale"   flag notes older than stale_days (by modified time)
//                 "orphans" flag notes without a [[link]]
//
// macOS: uses `open` and `pbpaste`.
//
// CLI: `jimcast widget command <alias> <setup|status|check|new|capture|move>`
//
// Design: every note row is its own card (bg1 background, rounded, padded) with
// a gap between cards, titles stay on one line (middle truncation) and every
// row has the same size.

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
// "~/x/y" -> "$HOME"'/x/y' (adjacent quoted strings = one word)
const shPath = (p: string) =>
  p === "~" ? '"$HOME"' : p.startsWith("~/") ? `"$HOME"${shq(p.slice(1))}` : shq(p);

// ~/.jimcast/plugin-data/<plugin id>/ (pluginDataDir() reads the env core sets at spawn)
const DIR = pluginDataDir();
const CONFIG_FILE = `"${DIR}/config.json"`;
const TAB_FILE = `"${DIR}/tab"`;
const SUB_FILE = `"${DIR}/sub"`;

const setStateCmd = (file: string, value: string) =>
  `mkdir -p "${DIR}"; printf %s ${shq(value)} > ${file}`;

const OPEN_CONFIG_CMD = `open ${CONFIG_FILE}`;

// ════════════════════════════════════════════════════════════════════════════
// Config
// ════════════════════════════════════════════════════════════════════════════

type Check = "stale" | "orphans";
type FileName = "date_title" | "title";

interface TabCfg {
  key: string;
  name: string;
  icon: string;
  dir: string;
  recursive: boolean;
  sub: string[];
  hint: string;
  fileName: FileName | null;
  canCreate: boolean;
  check: Check[];
}

interface Config {
  root: string;
  staleDays: number;
  template: string;
  fileName: FileName;
  extraDirs: string[];
  tabs: TabCfg[];
}

// Written to config.json when it does not exist yet. A plain notes folder; the
// README shows how to turn it into a Zettelkasten.
const DEFAULT_CONFIG_JSON =
  JSON.stringify(
    {
      root: "~/Notes",
      stale_days: 7,
      template: "templates/note.md",
      file_name: "date_title",
      extra_dirs: ["assets", "templates"],
      tabs: [
        {
          key: "inbox",
          name: "Inbox",
          icon: "📥",
          dir: "inbox",
          hint: "Capture fast, no polish. Process within 7 days.",
          check: ["stale"],
        },
        {
          key: "notes",
          name: "Notes",
          icon: "📝",
          dir: "notes",
          recursive: true,
          hint: "One subject per note.",
        },
        {
          key: "projects",
          name: "Projects",
          icon: "📁",
          dir: "projects",
          recursive: true,
          file_name: "title",
          hint: "One note or folder per project.",
        },
      ],
    },
    null,
    2,
  ) + "\n";

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function parseConfig(raw: string): { cfg: Config | null; error: string } {
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j.root !== "string" || !j.root.trim()) {
      return { cfg: null, error: 'config needs "root"' };
    }
    const tabs: TabCfg[] = (Array.isArray(j.tabs) ? j.tabs : [])
      .filter(
        (t: Record<string, unknown>) =>
          t &&
          typeof t.key === "string" &&
          /^[A-Za-z0-9_-]+$/.test(t.key) &&
          typeof t.name === "string" &&
          typeof t.dir === "string" &&
          t.dir.trim() &&
          !t.dir.includes(".."),
      )
      .map(
        (t: Record<string, unknown>): TabCfg => ({
          key: t.key as string,
          name: t.name as string,
          icon: typeof t.icon === "string" && t.icon ? t.icon : "📄",
          dir: (t.dir as string).replace(/^\/+|\/+$/g, ""),
          recursive: t.recursive === true,
          sub: strings(t.sub),
          hint: typeof t.hint === "string" ? t.hint : "",
          fileName:
            t.file_name === "title" || t.file_name === "date_title"
              ? (t.file_name as FileName)
              : null,
          canCreate: t.new !== false,
          check: strings(t.check).filter((c): c is Check => c === "stale" || c === "orphans"),
        }),
      );
    if (!tabs.length) return { cfg: null, error: "config needs at least one valid tab" };
    return {
      cfg: {
        root: j.root.trim(),
        staleDays: Number(j.stale_days) > 0 ? Number(j.stale_days) : 7,
        template: typeof j.template === "string" ? j.template.replace(/^\/+/, "") : "",
        fileName: j.file_name === "title" ? "title" : "date_title",
        extraDirs: strings(j.extra_dirs),
        tabs,
      },
      error: "",
    };
  } catch (e) {
    return { cfg: null, error: `invalid JSON: ${(e as Error).message}` };
  }
}

async function loadConfig(ctx: Exec): Promise<{ cfg: Config | null; error: string }> {
  const res = await ctx.exec(`cat ${CONFIG_FILE} 2>/dev/null`);
  if (!res.stdout.trim()) {
    await ctx.exec(`mkdir -p "${DIR}"; printf %s ${shq(DEFAULT_CONFIG_JSON)} > ${CONFIG_FILE}`);
    return parseConfig(DEFAULT_CONFIG_JSON);
  }
  return parseConfig(res.stdout);
}

// ════════════════════════════════════════════════════════════════════════════
// Scripts
// ════════════════════════════════════════════════════════════════════════════

const rootVar = (cfg: Config) => `r=${shPath(cfg.root)}`;
/** "$r"'/relative/path' */
const rp = (rel: string) => `"$r"${shq("/" + rel)}`;

/** The .md files of a tab (README and dot-files excluded). */
const findFiles = (t: TabCfg) =>
  `find ${rp(t.dir)} ${t.recursive ? "" : "-maxdepth 1"} -type f -name '*.md' ! -name '.*' ! -name README.md`;

function readStateCmd(cfg: Config): string {
  const lines = [
    rootVar(cfg),
    'echo "root=$r"',
    '[ -d "$r" ] && echo "ready=1"',
    `echo "tab=$(cat ${TAB_FILE} 2>/dev/null)"`,
    `echo "sub=$(cat ${SUB_FILE} 2>/dev/null)"`,
  ];
  for (const t of cfg.tabs) {
    lines.push(`echo "count:${t.key}=$(${findFiles(t)} 2>/dev/null | wc -l | tr -d ' ')"`);
    if (t.check.includes("stale")) {
      lines.push(
        `echo "stale:${t.key}=$(${findFiles(t)} -mtime +${cfg.staleDays} 2>/dev/null | wc -l | tr -d ' ')"`,
      );
    }
    if (t.check.includes("orphans")) {
      lines.push(
        `echo "orphans:${t.key}=$(${findFiles(t)} -print0 2>/dev/null | xargs -0 grep -L '\\[\\[' 2>/dev/null | wc -l | tr -d ' ')"`,
      );
    }
  }
  return lines.join("\n");
}

/** "<full path>|<title>" for the newest notes of a tab. */
const listCmd = (cfg: Config, t: TabCfg, rows: number) => `${rootVar(cfg)}
${findFiles(t)} -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -${rows} | while IFS= read -r f; do
  t=$(grep -m1 '^# ' "$f" | cut -c3-)
  [ -n "$t" ] || t=$(sed -n '/^---$/,/^---$/!p' "$f" | grep -m1 . | cut -c1-80)
  printf '%s|%s\\n' "$f" "$t"
done
`;

/** Problems of one tab: "stale:<path>" / "orphan:<path>" per file. */
const checkCmd = (cfg: Config, t: TabCfg) => `${rootVar(cfg)}
(
${t.check.includes("stale") ? `${findFiles(t)} -mtime +${cfg.staleDays} 2>/dev/null | sed 's|^|stale:|'` : ""}
${t.check.includes("orphans") ? `${findFiles(t)} -print0 2>/dev/null | xargs -0 grep -L '\\[\\[' 2>/dev/null | sed 's|^|orphan:|'` : ""}
) | sed "s|^\\([a-z]*:\\)$r/|\\1|"
`;

const dirOf = (t: TabCfg, sub?: string) => (sub ? `${t.dir}/${sub}` : t.dir);
const nameFormat = (cfg: Config, t: TabCfg): FileName => t.fileName ?? cfg.fileName;

/** New note in tab/sub. `title` is the already cleaned file-name title. Template is copied as-is. */
function newCmd(cfg: Config, t: TabCfg, sub: string | undefined, open: boolean, title: string): string {
  const prefix = nameFormat(cfg, t) === "date_title" ? "$(date +%Y-%m-%d)_" : "";
  return `${rootVar(cfg)}
d=${rp(dirOf(t, sub))}; mkdir -p "$d"
t=${shq(title)}
f="$d/${prefix}$t.md"
[ -e "$f" ] && f="$d/${prefix}$t-$(date +%H%M%S).md"
${cfg.template ? `if [ -f ${rp(cfg.template)} ]; then cp ${rp(cfg.template)} "$f"; else : > "$f"; fi` : ': > "$f"'}
${open ? 'open "$f"' : ""}
`;
}

/** Clipboard (or the given text) as a new inbox note; the first line names it. */
function captureCmd(cfg: Config, t: TabCfg, text: string | null): string {
  const prefix = nameFormat(cfg, t) === "date_title" ? "$(date +%Y-%m-%d)_" : "";
  const body = text === null ? "pbpaste" : `printf '%s\\n' ${shq(text)}`;
  return `${rootVar(cfg)}
${text === null ? '[ -n "$(pbpaste)" ] || exit 0' : ""}
d=${rp(dirOf(t))}; mkdir -p "$d"
n=$(${body} | head -1 | cut -c1-60 | tr -cs 'A-Za-z0-9' '-' | sed 's/^-//;s/-$//')
[ -n "$n" ] || n=clip
f="$d/${prefix}$n.md"
[ -e "$f" ] && f="$d/${prefix}$n-$(date +%H%M%S).md"
${body} > "$f"
`;
}

const openVaultCmd = (cfg: Config) => `${rootVar(cfg)}; open "$r"`;

// ════════════════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════════════════

interface State {
  root: string;
  ready: boolean;
  tab: string;
  sub: string;
  counts: Record<string, number>;
  stale: Record<string, number>;
  orphans: Record<string, number>;
}

async function readState(ctx: Exec, cfg: Config): Promise<State> {
  const res = await ctx.exec(readStateCmd(cfg));
  const st: State = { root: "", ready: false, tab: "", sub: "", counts: {}, stale: {}, orphans: {} };
  for (const line of res.stdout.trim().split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i);
    const v = line.slice(i + 1).trim();
    if (k === "root") st.root = v;
    else if (k === "ready") st.ready = true;
    else if (k === "tab") st.tab = v;
    else if (k === "sub") st.sub = v;
    else if (k.startsWith("count:")) st.counts[k.slice(6)] = Number(v) || 0;
    else if (k.startsWith("stale:")) st.stale[k.slice(6)] = Number(v) || 0;
    else if (k.startsWith("orphans:")) st.orphans[k.slice(8)] = Number(v) || 0;
  }
  return st;
}

interface NoteRow {
  path: string;
  title: string;
}

async function readNotes(ctx: Exec, cfg: Config, t: TabCfg, rows: number): Promise<NoteRow[]> {
  const res = await ctx.exec(listCmd(cfg, t, rows));
  return res.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("|");
      return { path: i < 0 ? l : l.slice(0, i), title: i < 0 ? "" : l.slice(i + 1).trim() };
    });
}

/** The sub-folder a new note goes in (the stored one if it is valid). */
const subOf = (t: TabCfg, stored: string) => (t.sub.includes(stored) ? stored : t.sub[0]);

// ════════════════════════════════════════════════════════════════════════════
// Rendering
// ════════════════════════════════════════════════════════════════════════════

const OWNS = "extnote"; // item-id prefix and `owns` of the cli spec, not a core prefix

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

function palette(ctx: ExecutionContext) {
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  return {
    fg: g("fg", "#ebdbb2"),
    fg4: g("fg4", "#a89984"),
    bg1: g("bg1", "#2e2e32"),
    bg2: g("bg2", "#2a2a2e"),
    bg3: g("bg3", "#38383d"),
    yellow: g("yellow", "#d79921"),
    blue: g("blue", "#458588"),
    brightGreen: g("brightGreen", "#b8bb26"),
    brightYellow: g("brightYellow", "#fabd2f"),
    brightRed: g("brightRed", "#fb4934"),
  };
}

const LIST_ROWS = 6;
const short = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

// Middle truncation: "test1test1test1" -> "test1te....st1" (keeps start and end).
const ELLIPSIS = "....";
const NBSP = "\u00A0"; // keeps an empty line occupying its full row height
function middle(s: string, max: number): string {
  if (s.length <= max) return s;
  const keep = Math.max(2, max - ELLIPSIS.length);
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return s.slice(0, head) + ELLIPSIS + (tail > 0 ? s.slice(-tail) : "");
}

const TITLE_MAX = 36; // note title, one line (the right label needs room too)
const ITEM_GAP = 8; // space between two note cards

const dateOf = (file: string) => /^(\d{4}-\d{2}-\d{2})_/.exec(file)?.[1] ?? "";

/** 2026-01-09_My-Title.md -> My Title */
const prettyName = (file: string) =>
  file
    .replace(/\.md$/, "")
    .replace(/^\d{4}-\d{2}-\d{2}_/, "")
    .replace(/-/g, " ");

function messageContent(ctx: ExecutionContext, text: string, color: string): WidgetContent {
  const c = palette(ctx);
  const sections: WidgetGroupSection[] = [
    {
      id: "msg",
      content: {
        type: "text",
        data: { id: `${OWNS}-msg`, attribute: { label1: text, color1: color, textSize1: FONT.sm } },
      },
    },
    {
      id: "bar",
      navigable: true,
      style: { background: c.bg2, borderRadius: 8, padding: 4 },
      content: {
        type: "rows",
        datas: [
          {
            id: `${OWNS}-config`,
            pinned: true,
            attribute: { label1: "CONFIG", label2: "Open config.json", color1: c.fg4, color2: c.blue },
            action: act(ctx, OPEN_CONFIG_CMD, "dismiss"),
          },
        ],
      },
    },
  ];
  return { type: "group", direction: "column", gap: 6, sections };
}

function buildContent(
  ctx: ExecutionContext,
  cfg: Config,
  st: State,
  active: TabCfg,
  notes: NoteRow[],
): WidgetContent {
  const c = palette(ctx);
  const panel = { background: c.bg2, borderRadius: 8, padding: 4 };
  // One card per note row: own background, rounded, padded, gap below.
  const card = { background: c.bg1, borderRadius: 6, padding: 4, marginBottom: ITEM_GAP };

  if (!st.ready) {
    return messageContent(
      ctx,
      `Folder not found: ${short(st.root || cfg.root, 60)}. Fix "root" in the config.`,
      c.brightYellow,
    );
  }

  // Tabs: icon + count, the active one also shows its name.
  const tabBar: WidgetItem[] = cfg.tabs.map(
    (t) =>
      ({
        id: `${OWNS}-tab:${t.key}`,
        pinned: true,
        attribute: {
          label1: t.icon,
          textSize1: 15,
          label2: t.key === active.key ? t.name : undefined,
          color2: c.fg,
          label3: String(st.counts[t.key] ?? 0),
          color3: (st.stale[t.key] ?? 0) > 0 ? c.brightYellow : c.fg4,
        },
        style: t.key === active.key ? { background: c.bg3, borderRadius: 6 } : undefined,
        action: act(ctx, setStateCmd(TAB_FILE, t.key)),
      }) as WidgetItem,
  );

  const sections: WidgetGroupSection[] = [
    { id: "tabs", navigable: true, style: panel, content: { type: "rows", datas: tabBar } },
  ];

  // Rule violations, only when there are some.
  const warn: string[] = [];
  for (const t of cfg.tabs) {
    const s = st.stale[t.key] ?? 0;
    const o = st.orphans[t.key] ?? 0;
    if (s > 0) warn.push(`${s} ${t.name} note${s > 1 ? "s" : ""} older than ${cfg.staleDays} days`);
    if (o > 0) warn.push(`${o} ${t.name} note${o > 1 ? "s" : ""} without links`);
  }
  if (warn.length) {
    sections.push({
      id: "warn",
      content: {
        type: "text",
        data: {
          id: `${OWNS}-warn`,
          attribute: { label1: `⚠ ${short(warn.join(" · "), 90)}`, color1: c.brightYellow, textSize1: FONT.xs },
        },
      },
    });
  }

  if (active.hint) {
    sections.push({
      id: "hint",
      content: {
        type: "text",
        data: {
          id: `${OWNS}-hint`,
          attribute: { label1: active.hint, color1: c.fg4, textSize1: FONT.xs },
        },
      },
    });
  }

  const base = `${st.root}/${active.dir}/`;
  const datas: WidgetItem[] = notes.length
    ? notes.map(
        (n, i) =>
          ({
            id: `${OWNS}-note:${i}`,
            pinned: true,
            style: card,
            attribute: {
              // one line, middle-truncated so start and end stay readable
              label1: middle(n.title || prettyName(n.path.slice(n.path.lastIndexOf("/") + 1)), TITLE_MAX),
              color1: c.fg,
              // never empty, so every card keeps the same size
              labelRight:
                (() => {
                  const rel = n.path.startsWith(base) ? n.path.slice(base.length) : n.path;
                  const file = rel.slice(rel.lastIndexOf("/") + 1);
                  const sub = rel.includes("/") ? rel.slice(0, rel.indexOf("/")) : "";
                  return [sub, dateOf(file)].filter(Boolean).join(" · ");
                })() || NBSP,
              colorRight: c.fg4,
              textSizeRight: FONT.xs,
            },
            action: act(ctx, `open ${shq(n.path)}`, "dismiss"),
          }) as WidgetItem,
      )
    : [
        {
          id: `${OWNS}-empty`,
          pinned: true,
          style: card,
          attribute: { label1: "No notes yet", color1: c.fg4, textSize1: FONT.sm },
        } as WidgetItem,
      ];
  sections.push({ id: "notes", navigable: notes.length > 0, content: { type: "list", datas } });

  // Action bar.
  const inbox = cfg.tabs.find((t) => t.key === "inbox") ?? cfg.tabs[0];
  const bar: WidgetItem[] = [];
  if (active.canCreate) {
    const sub = subOf(active, st.sub);
    bar.push({
      id: `${OWNS}-new`,
      pinned: true,
      attribute: { label1: "NEW", label2: `＋ ${active.name}`, color1: c.fg4, color2: c.brightGreen },
      action: act(ctx, newCmd(cfg, active, sub, true, "new")),
    });
    if (active.sub.length) {
      const next = active.sub[(active.sub.indexOf(sub) + 1) % active.sub.length];
      bar.push({
        id: `${OWNS}-sub`,
        pinned: true,
        attribute: { label1: "NEW IN", label2: sub, color1: c.fg4, color2: c.yellow },
        action: act(ctx, setStateCmd(SUB_FILE, next)),
      });
    }
  }
  bar.push({
    id: `${OWNS}-clip`,
    pinned: true,
    attribute: { label1: "CLIP", label2: `📋 To ${inbox.name.toLowerCase()}`, color1: c.fg4, color2: c.blue },
    action: act(ctx, captureCmd(cfg, inbox, null)),
  });
  bar.push({
    id: `${OWNS}-config`,
    pinned: true,
    attribute: { label1: "CONFIG", label2: "Open", color1: c.fg4, color2: c.fg },
    action: act(ctx, OPEN_CONFIG_CMD, "dismiss"),
  });
  bar.push({
    id: `${OWNS}-vault`,
    pinned: true,
    attribute: { label1: "VAULT", label2: "Open", color1: c.fg4, color2: c.fg },
    action: act(ctx, openVaultCmd(cfg), "dismiss"),
  });
  sections.push({ id: "bar", navigable: true, style: panel, content: { type: "rows", datas: bar } });

  return { type: "group", direction: "column", gap: 4, sections };
}

async function render(ctx: ExecutionContext): Promise<WidgetContent> {
  const { cfg, error } = await loadConfig(ctx);
  if (!cfg) {
    return messageContent(ctx, `config.json: ${error} (${DIR}/config.json)`, palette(ctx).brightRed);
  }
  const st = await readState(ctx, cfg);
  const active = cfg.tabs.find((t) => t.key === st.tab) ?? cfg.tabs[0];
  const notes = st.ready ? await readNotes(ctx, cfg, active, LIST_ROWS) : [];
  return buildContent(ctx, cfg, st, active, notes);
}

// ════════════════════════════════════════════════════════════════════════════
// CLI commands
// ════════════════════════════════════════════════════════════════════════════

const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));

async function needConfig(ctx: WidgetCliContext): Promise<Config> {
  const { cfg, error } = await loadConfig(ctx);
  if (!cfg) throw new Error(`config.json: ${error} (${DIR}/config.json)`);
  return cfg;
}

function tabArg(cfg: Config, name: string | undefined): TabCfg {
  const q = (name ?? "").toLowerCase();
  const t = cfg.tabs.find((x) => x.key.toLowerCase() === q || x.name.toLowerCase() === q);
  if (!t) throw new Error(`tab must be one of: ${cfg.tabs.map((x) => x.key).join(", ")}`);
  return t;
}

/** A file name from a title: dashes for spaces, no characters Obsidian / macOS dislike. */
const cleanTitle = (s: string) =>
  s
    .replace(/[/\\:*?"<>|{}$`]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);

const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "setup",
    title: "Create the folders from the config that are missing (never touches notes)",
    async run(ctx) {
      const cfg = await needConfig(ctx);
      const dirs = new Set<string>(cfg.extraDirs);
      for (const t of cfg.tabs) {
        dirs.add(t.dir);
        t.sub.forEach((s) => dirs.add(`${t.dir}/${s}`));
      }
      await ctx.dispatch(cliItem(ctx, "setup", `${rootVar(cfg)}\nmkdir -p ${[...dirs].map(rp).join(" ")}`));
      return `Folders ready in ${cfg.root}`;
    },
  },
  {
    id: "status",
    title: "Folder path, note counts and rule warnings",
    description: "--json for machine-readable output",
    async run(ctx) {
      const cfg = await needConfig(ctx);
      const st = await readState(ctx, cfg);
      if (ctx.args.includes("--json")) return st;
      return [
        `folder  ${st.root}${st.ready ? "" : "  (not found)"}`,
        ...cfg.tabs.map((t) => {
          const flags = [
            st.stale[t.key] ? `${st.stale[t.key]} stale` : "",
            st.orphans[t.key] ? `${st.orphans[t.key]} without links` : "",
          ]
            .filter(Boolean)
            .join(", ");
          return `${t.key.padEnd(8)} ${String(st.counts[t.key] ?? 0).padStart(4)}${flags ? `   (${flags})` : ""}`;
        }),
      ].join("\n");
    },
  },
  {
    id: "check",
    title: "List the notes that break the rules (from each tab's \"check\")",
    async run(ctx) {
      const cfg = await needConfig(ctx);
      const out: string[] = [];
      for (const t of cfg.tabs.filter((x) => x.check.length)) {
        const res = await ctx.exec(checkCmd(cfg, t));
        const stale: string[] = [];
        const orphan: string[] = [];
        for (const l of res.stdout.trim().split("\n").filter(Boolean)) {
          const i = l.indexOf(":");
          const path = l.slice(i + 1);
          if (l.startsWith("stale:")) stale.push(path);
          else if (l.startsWith("orphan:")) orphan.push(path);
        }
        if (t.check.includes("stale")) {
          out.push(`${t.name}: older than ${cfg.staleDays} days: ${stale.length || "ok"}`, ...stale.map((p) => `  ${p}`));
        }
        if (t.check.includes("orphans")) {
          out.push(`${t.name}: without links: ${orphan.length || "ok"}`, ...orphan.map((p) => `  ${p}`));
        }
      }
      return out.join("\n") || "(no checks configured)";
    },
  },
  {
    id: "new",
    args: ["tab", "[sub]", "[title...]"],
    title: "Create a note from the template (add --open to open it)",
    async run(ctx) {
      const cfg = await needConfig(ctx);
      const [tabName, ...rest] = positional(ctx);
      const t = tabArg(cfg, tabName);
      if (!t.canCreate) throw new Error(`${t.key}: notes are not created here (new: false)`);
      let sub: string | undefined;
      if (t.sub.length) {
        if (rest[0] && t.sub.includes(rest[0])) sub = rest.shift();
        else sub = t.sub[0];
      }
      const title = cleanTitle(rest.join(" ")) || "new";
      await ctx.dispatch(cliItem(ctx, "new", newCmd(cfg, t, sub, ctx.args.includes("--open"), title)));
      const res = await ctx.exec(`${rootVar(cfg)}; ls -1t ${rp(dirOf(t, sub))} | head -1`);
      return `Created ${dirOf(t, sub)}/${res.stdout.trim()}`;
    },
  },
  {
    id: "capture",
    args: ["text..."],
    title: "Add the text as a new inbox note (the first line names it)",
    async run(ctx) {
      const cfg = await needConfig(ctx);
      const text = positional(ctx).join(" ").trim();
      if (!text) throw new Error("capture needs the note text");
      const inbox = cfg.tabs.find((t) => t.key === "inbox") ?? cfg.tabs[0];
      await ctx.dispatch(cliItem(ctx, "capture", captureCmd(cfg, inbox, text)));
      return `Captured to ${inbox.dir}/`;
    },
  },
  {
    id: "move",
    args: ["name-part", "tab", "[sub]"],
    title: "Move a note (found by part of its file name) to another folder",
    async run(ctx) {
      const cfg = await needConfig(ctx);
      const [part, tabName, subName] = positional(ctx);
      if (!part || !tabName) throw new Error("move needs a part of the file name and a tab");
      const to = tabArg(cfg, tabName);
      const sub = to.sub.length ? (subName && to.sub.includes(subName) ? subName : to.sub[0]) : undefined;

      const q = part.replace(/['"\\*?[\]{}$`]/g, "");
      const finds = cfg.tabs
        .map((t) => `find ${rp(t.dir)} -type f -iname ${shq(`*${q}*.md`)} ! -name README.md 2>/dev/null`)
        .join("; ");
      const res = await ctx.exec(`${rootVar(cfg)}; ${finds}`);
      const hits = res.stdout.trim().split("\n").filter(Boolean);
      if (hits.length !== 1) {
        throw new Error(
          hits.length
            ? `${hits.length} notes match, be more specific:\n${hits.map((h) => `  ${h}`).join("\n")}`
            : `no note matches "${part}"`,
        );
      }
      await ctx.dispatch(
        cliItem(
          ctx,
          "move",
          `${rootVar(cfg)}; mkdir -p ${rp(dirOf(to, sub))}; mv ${shq(hits[0])} ${rp(dirOf(to, sub))}/`,
        ),
      );
      return `Moved to ${dirOf(to, sub)}/`;
    },
  },
];

// ════════════════════════════════════════════════════════════════════════════
// Plugin
// ════════════════════════════════════════════════════════════════════════════

// Main widget: no id (its full id is the plugin id from package.json).
export const widget = createWidget({
  section: {
    title: "Notes",
    titleShow: true,
    navigationActive: true,
    querySearchActive: false,
  },
  showIn: ["default"],
  repeat: { enable: true, seconds: 30 }, // picks up edits made in an editor
  cli: { owns: OWNS, commands: CLI_COMMANDS },
  render: (ctx) => render(ctx),
});

export const plugin = definePlugin({
  description: "Simple markdown notes: configurable folders as tabs, new note, clipboard capture.",
  widgets: [widget],
});

export default plugin;
bootstrapPlugin(plugin);
