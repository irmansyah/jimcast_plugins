// [plugin] jim-finder/src/render.ts
import { pluginId, type ExecutionContext, WidgetContent, WidgetItem } from "@jimcast/sdk";
import { loadFinderState, loadImageSrc } from "./data.js";
import { fileCategory, type FileCategory } from "./colors.js";
import {
  type Exec, type Cmd, type SortMode, type InitDir,
  runCmd, listNames, join, parentOf, guarded,
  selectCmd, toggleMarkCmd, openCmd, revealCmd, jumpCmd, loadInitDirs, INIT_DIRS_FILE,
  TRASH_CONFIRMED_CMD, TRASH_CANCEL_CMD,
} from "./shell.js";

export const OWNS = "extfm";      // item-id prefix (core used `fm:` / `fm-`)
// CLI / keys / nav spec id. Internal only: the host registers the spec under
// "<plugin>.<spec id>", which must equal the widget id ("com.jimcast.plugins.finder").
// It is NOT a name the CLI accepts; commands address the widget by alias or full id.
export const ROW_PREFIX = `${OWNS}:`;

type Action = NonNullable<WidgetItem["action"]>;
type GroupSection = Extract<WidgetContent, { type: "group" }>["sections"][number];

/** A function action: runs the command (shell string or state mutation), then asks core to refresh. */
export const act = (ctx: Exec, cmd: Cmd, then: "refresh" | "dismiss" = "refresh"): Action =>
  ({ run: async () => { await runCmd(ctx, cmd); }, then });

/** A synthetic item for ctx.dispatch (CLI and keys). The id must start with the spec's `owns`. */
export const cliItem = (ctx: Exec, id: string, cmd: Cmd): WidgetItem =>
  ({ id: `${OWNS}-cli:${id}`, action: act(ctx, cmd) });

/** Path behind a Finder row id, else null. */
export const rowPathOf = (id?: string | null) =>
  id && id.startsWith(ROW_PREFIX) ? id.slice(ROW_PREFIX.length) : null;

/** keyLabels exists at runtime but may be missing from the type, or return nothing: never throw. */
type WithKeyLabels = { keyLabels?: (specId: string) => Promise<Record<string, string> | undefined> };
const keyLabelsOf = async (ctx: ExecutionContext, specId: string): Promise<Record<string, string>> => {
  try {
    return (await (ctx as ExecutionContext & WithKeyLabels).keyLabels?.(specId)) ?? {};
  } catch {
    return {};
  }
};

// ── layout constants ────────────────────────────────────────────────────────
const WINDOW_ROWS = 14;                       // side columns show at most this many rows
const ROW_PX = 26;
const COLUMN_HEIGHT = ROW_PX * WINDOW_ROWS + 8;
const IMAGE_H = 200;
const LABEL_MAX: Record<number, number> = { 1: 56, 2: 36, 3: 24 };
const ELLIPSIS = "…";
const DIR_PREFIX_LEN = 3;                     // "📁 "
const MARK_ICON = "✓";
const MARK_PREFIX_LEN = 2;                    // "✓ "
const FOOTER_H = ROW_PX + 24;
const DIR_ICON = "📁";

// Design-system stand-ins (core: theme.font.*).
const FONT = { xs: 11, sm: 12, lg: 15 };

function palette(ctx: ExecutionContext) {
  const raw = (ctx.host?.theme?.colors ?? {}) as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  return {
    fg: g("fg", "#e6e6e6"),
    fg4: g("fg4", "#8a8a8e"),
    bg: g("bg", "#1c1c1e"),
    bg1: g("bg1", "#232326"),
    blue: g("blue", "#0a84ff"),
    yellow: g("yellow", "#ffd60a"),
    brightRed: g("brightRed", "#ff453a"),
  };
}

// File-type colors: [theme key, fallback hex]. A theme can override by key name.
const CATEGORY_COLOR: Record<FileCategory, [string, string]> = {
  image:      ["magenta", "#ff6bd6"],
  video:      ["purple",  "#bf5af2"],
  audio:      ["cyan",    "#5ac8fa"],
  document:   ["orange",  "#ff9f0a"],
  text:       ["green",   "#30d158"],
  code:       ["teal",    "#66d4cf"],
  data:       ["brown",   "#ac8e68"],
  archive:    ["red",     "#ff453a"],
  executable: ["pink",    "#ff6482"],
  other:      ["fg",      "#e6e6e6"],
};

function fileColor(ctx: ExecutionContext, name: string): string {
  const raw = (ctx.host?.theme?.colors ?? {}) as unknown as Record<string, string | undefined>;
  const [key, fb] = CATEGORY_COLOR[fileCategory(name)];
  return raw[key] ?? fb;
}

function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${i === 0 ? n : n.toFixed(1)} ${u[i]}`;
}

/** Shortens `name` to at most `max` chars by eliding the middle, keeping the extension visible. */
function middleTruncate(name: string, max: number): string {
  const limit = Math.max(5, max);
  if (name.length <= limit) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 8 ? name.slice(dot) : "";
  const tail = Math.min(ext.length + 2, Math.floor((limit - 1) / 2));
  const head = limit - ELLIPSIS.length - tail;
  return name.slice(0, head) + ELLIPSIS + name.slice(name.length - tail);
}

// Folders: select (write state), then refresh.
// Files:   open directly, then dismiss (opts.open = false forces "select").
//
// A file's click toggles its mark. The command is `guarded` with the same key
// the Space key action uses (see commands.ts), so one gesture that reaches both
// paths toggles the mark once, not twice.
const selectItem = (
  ctx: ExecutionContext,
  id: string, label: string, path: string, isDir: boolean,
  opts: {
    color?: string;
    style?: WidgetItem["style"];
    maxChars?: number;
    open?: boolean;
    marked?: boolean;
  } = {},
): WidgetItem => {
  const c = palette(ctx);
  const color = opts.color ?? (opts.marked ? c.yellow : isDir ? c.blue : fileColor(ctx, label));
  const prefixLen = (isDir ? DIR_PREFIX_LEN : 0) + (opts.marked ? MARK_PREFIX_LEN : 0);
  const limit = (opts.maxChars ?? Infinity) - prefixLen;
  const mark = opts.marked ? `${MARK_ICON} ` : "";
  const shown = middleTruncate(label, limit);
  const openOnEnter = !isDir && (opts.open ?? true);
  return {
    id,
    pinned: true,
    attribute: {
      label1: isDir ? `${mark}${DIR_ICON} ${shown}` : `${mark}${shown}`,
      labelRight: isDir ? "›" : undefined,
      color1: color,
      colorRight: isDir ? color : c.fg4,
    },
    action: openOnEnter ? act(ctx, openCmd(path), "dismiss") : act(ctx, selectCmd(path), "refresh"),
    clickAction: openOnEnter
      ? act(ctx, guarded(`mark:${path}`, toggleMarkCmd(path)), "refresh")
      : undefined,
    style: opts.style,
  };
};

// `active`    = the column that holds the selection (blue highlight).
// `navigable` = whether the keyboard cursor may enter this column.
async function listColumn(
  ctx: ExecutionContext, dir: string, selectedPath: string | null,
  active: boolean, navigable: boolean, maxChars: number, marks: ReadonlySet<string>,
  showHidden: boolean, sort: SortMode,
): Promise<GroupSection> {
  const c = palette(ctx);
  const names = await listNames(ctx, dir, showHidden, sort);

  // Navigable column: every entry. Side columns: a window keeping the highlighted entry visible.
  let start = 0;
  let shown = names;
  if (!navigable) {
    const selName = selectedPath ? selectedPath.slice(selectedPath.lastIndexOf("/") + 1) : null;
    const selIdx = names.findIndex((n) => n.replace(/\/$/, "") === selName);
    start = selIdx >= WINDOW_ROWS ? selIdx - WINDOW_ROWS + 1 : 0;
    shown = names.slice(start, start + WINDOW_ROWS);
  }

  const datas: WidgetItem[] = shown.map((n) => {
    const isDir = n.endsWith("/");
    const name = isDir ? n.slice(0, -1) : n;
    const path = join(dir, name);
    const sel = path === selectedPath;
    const style = sel ? { background: active ? c.blue : c.bg1, borderRadius: 6 } : undefined;
    const color = sel && active ? "#ffffff" : undefined;
    return selectItem(ctx, `${ROW_PREFIX}${path}`, name, path, isDir, {
      color, style, maxChars, marked: marks.has(path),
    });
  });

  if (!navigable && names.length > start + WINDOW_ROWS) {
    datas.push({
      id: `${OWNS}-more:${dir}`, pinned: true,
      attribute: { label1: `… ${names.length - start - WINDOW_ROWS} more`, color1: c.fg4, textSize1: FONT.xs },
    });
  }
  if (!datas.length) {
    datas.push({
      id: `${OWNS}-empty:${dir}`, pinned: true,
      attribute: { label1: "(empty)", color1: c.fg4, textSize1: FONT.sm },
    });
  }

  return {
    id: `col:${dir}`,
    flex: 1,
    navigable,
    height: COLUMN_HEIGHT,
    style: { background: c.bg, borderRadius: 8, padding: 4 },
    content: { type: "list", datas },
  };
}

/** The defined-directories picker (from init_dirs.json). Enter / click jumps and closes it. */
function dirsColumn(ctx: ExecutionContext, dirs: InitDir[]): GroupSection {
  const c = palette(ctx);
  const datas: WidgetItem[] = dirs.map((d) => ({
    id: `${OWNS}-dir:${d.path}`, pinned: true,
    attribute: {
      label1: `${DIR_ICON} ${d.name}`, label2: d.path,
      color1: c.blue, color2: c.fg4, labelRight: "↵", colorRight: c.fg4,
    },
    action: act(ctx, jumpCmd(d.path), "refresh"),
  }));
  if (!datas.length) {
    datas.push({
      id: `${OWNS}-dirs-empty`, pinned: true,
      attribute: {
        label1: "No directories defined", label2: INIT_DIRS_FILE,
        color1: c.fg4, color2: c.fg4, textSize1: FONT.sm,
      },
    });
  }
  return {
    id: "init-dirs",
    flex: 1,
    navigable: true,
    height: COLUMN_HEIGHT,
    style: { background: c.bg, borderRadius: 8, padding: 4 },
    content: { type: "list", datas },
  };
}

function previewColumn(
  ctx: ExecutionContext, path: string, size: number, kind: string, maxChars: number, imageSrc: string | null,
): GroupSection {
  const c = palette(ctx);
  const name = middleTruncate(path.slice(path.lastIndexOf("/") + 1), maxChars);
  const datas: WidgetItem[] = [
    {
      id: `${OWNS}-pv-name`, pinned: true,
      attribute: { label1: name, label2: `${kind} · ${humanSize(size)}`, color1: c.fg, color2: c.fg4, textSize1: FONT.lg },
    },
    {
      id: `${OWNS}-pv-open`, pinned: true,
      attribute: { label1: "Open", labelRight: "↵", color1: c.blue, colorRight: c.fg4 },
      action: act(ctx, openCmd(path), "dismiss"),
    },
    {
      id: `${OWNS}-pv-reveal`, pinned: true,
      attribute: { label1: "Reveal in Finder", color1: c.fg },
      action: act(ctx, revealCmd(path), "dismiss"),
    },
  ];

  const info: GroupSection = {
    id: "pv-info",
    navigable: true,   // reachable by Down from the center column: Open / Reveal
    content: { type: "list", datas },
  };
  const sections: GroupSection[] = imageSrc
    ? [
        { id: "pv-image", navigable: false,
          content: { type: "image", data: { src: imageSrc, alt: name, height: IMAGE_H } } },
        info,
      ]
    : [info];

  return {
    id: "preview",
    flex: 1.2,
    height: COLUMN_HEIGHT,
    style: { background: c.bg1, borderRadius: 8, padding: 4 },
    content: { type: "group", direction: "column", gap: 6, sections },
  };
}

function currentDirBar(ctx: ExecutionContext, cwd: string, home: string): GroupSection {
  const c = palette(ctx);
  const shown = cwd === home ? "~" : cwd.startsWith(home + "/") ? "~" + cwd.slice(home.length) : cwd;
  const parent = parentOf(cwd);

  // `open: false`: this row means "go up", never "open".
  const item = selectItem(ctx, `${OWNS}-cwd`, shown, parent, false, { open: false });
  item.attribute = {
    label1: `${DIR_ICON} ${shown}`, color1: c.blue, textSize1: FONT.sm,
    labelRight: cwd === "/" ? undefined : "↑ up", colorRight: c.fg4,
  };
  if (cwd === "/") item.action = undefined;   // nothing above root

  return {
    id: "cwd",
    navigable: true,
    style: { background: c.bg1, borderRadius: 8, padding: 4 },
    content: { type: "list", datas: [item] },
  };
}

interface FooterHints {
  /** Action id -> first configured key label ('' when unbound). May be missing. */
  labels?: Record<string, string>;
  clip?: { mode: string; count: number } | null;
  sort?: SortMode;
}

const keyHints = (labels: Record<string, string>, items: [string, string][]) =>
  items.filter(([id]) => labels[id]).map(([id, text]) => `${labels[id]} ${text}`).join(" · ");

/** Always one fixed-height row. Status line, or Confirm / Cancel while a Trash is pending. */
function marksFooter(ctx: ExecutionContext, count: number, confirming: boolean, hints: FooterHints): GroupSection {
  const c = palette(ctx);
  const style = { background: c.bg1, borderRadius: 8, padding: 4 };
  const labels: Record<string, string> = hints.labels ?? {};
  const clip = hints.clip ?? null;
  const withKey = (text: string, id: string) => (labels[id] ? `${text} (${labels[id]})` : text);

  if (count > 0 && confirming) {
    // Order matters: a clamped cursor must land on "Cancel", never on "Confirm".
    const confirmDatas: WidgetItem[] = [
      {
        id: `${OWNS}-act:trash-confirm`, pinned: true,
        attribute: { label1: withKey(`Confirm Trash ${count}`, "confirm_delete"), color1: c.brightRed },
        action: act(ctx, TRASH_CONFIRMED_CMD, "refresh"),
      },
      {
        id: `${OWNS}-act:trash-cancel`, pinned: true,
        attribute: { label1: withKey("Cancel", "cancel_delete"), color1: c.blue },
        action: act(ctx, TRASH_CANCEL_CMD, "refresh"),
      },
    ];
    return {
      id: "marks", height: FOOTER_H, scrollable: false, navigable: true, style,
      content: { type: "grid-3", datas: confirmDatas },
    };
  }

  const sortLabel = hints.sort === "date" ? "date" : "A–Z";
  const status = count > 0
    ? `${MARK_ICON} ${count} selected`
    : clip
      ? `${clip.count} ${clip.mode === "cut" ? "cut" : "copied"}`
      : `${labels["select"] || "Space"}: select · sort ${sortLabel}`;

  const pasteHint: [string, string][] = clip ? [["paste", "paste"]] : [];
  const hint = count > 0
    ? keyHints(labels, [
        ["copy", "copy"], ["move", "cut"], ...pasteHint,
        ["delete", "delete"], ["zip", "zip"], ["clear_marks", "clear"],
      ])
    : keyHints(labels, [
        ...pasteHint,
        ["copy", "copy"], ["move", "cut"], ["delete", "delete"],
        ["toggle_hidden", "hidden"], ["toggle_sort", "sort"], ["jump_dir", "dirs"],
      ]);

  return {
    id: "marks", height: FOOTER_H, scrollable: false, navigable: false, style,
    content: { type: "list", datas: [{
      id: `${OWNS}-marks-hint`, pinned: true,
      attribute: {
        label1: status, color1: count > 0 ? c.yellow : c.fg4, textSize1: FONT.sm,
        labelRight: hint || undefined, colorRight: c.fg4, textSizeRight: FONT.xs,
      },
    }] },
  };
}

export async function render(ctx: ExecutionContext): Promise<WidgetContent> {
  const [st, labels] = await Promise.all([
    loadFinderState(ctx),
    keyLabelsOf(ctx, pluginId()),
  ]);
  const { home, sel, isDir, size, kind, marks, confirming, showHidden, clip, sort, picker } = st;

  const base = sel === home || sel.startsWith(home + "/") ? home : "/";

  const sections: GroupSection[] = [];
  let cwd: string;

  if (picker) {
    // Defined-directories list replaces the columns until a dir is picked or the key is pressed again.
    cwd = sel === base ? base : parentOf(sel);
    sections.push(dirsColumn(ctx, await loadInitDirs(ctx)));
  } else if (sel === base) {
    // Nothing selected yet: a single column showing the base folder.
    cwd = base;
    sections.push(await listColumn(ctx, base, null, true, true, LABEL_MAX[1], marks, showHidden, sort));
  } else {
    const center = parentOf(sel);
    cwd = center;

    // Two columns max: center + (contents | preview), so labels get the 2-column width.
    const maxChars = LABEL_MAX[2];

    const jobs: Promise<GroupSection>[] = [];

    // center: folder holding the selection, selection highlighted blue
    jobs.push(listColumn(ctx, center, sel, true, true, maxChars, marks, showHidden, sort));
    // right: contents of the selection (folder) or a preview (file)
    if (isDir) jobs.push(listColumn(ctx, sel, null, false, false, maxChars, marks, showHidden, sort));

    const imageJob = isDir ? Promise.resolve(null) : loadImageSrc(ctx, sel, size);
    const [cols, imageSrc] = await Promise.all([Promise.all(jobs), imageJob]);

    sections.push(...cols);
    if (!isDir) sections.push(previewColumn(ctx, sel, size, kind, maxChars, imageSrc));
  }

  return {
    type: "group",
    direction: "column",
    gap: 6,
    sections: [
      currentDirBar(ctx, cwd, home),
      { id: "columns", content: { type: "group", direction: "row", gap: 6, sections } },
      marksFooter(ctx, marks.size, confirming, { labels, clip, sort }),
    ],
  };
}
