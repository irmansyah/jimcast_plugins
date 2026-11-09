// [plugin] jimcast-external-finder/src/render.ts
//
// The column view. Port of core's finder.ts rendering:
//   left   = parent of the center folder (center folder outlined)
//   center = folder containing the selection (selection highlighted, blue)
//   right  = contents of the selection if it is a folder, else a file preview
// Every column has the SAME FIXED HEIGHT and scrolls inside it, so the window
// never changes height while navigating.

import type {
  ExecutionContext,
  WidgetActionWithFn,
  WidgetContent,
  WidgetGroupSection,
  WidgetItem,
} from "@jimcast/sdk";
import {
  type FinderStatus,
  SELECT_CMD,
  TOGGLE_MARK_CMD,
  TRASH_CANCEL_CMD,
  TRASH_CONFIRMED_CMD,
  THUMB_PX,
  extOf,
  join,
  lines,
  parentOf,
  readStatus,
  sh,
  shq,
  thumbScript,
} from "./shell.js";

// ── Ids ─────────────────────────────────────────────────────────────────────
// Every item id starts with OWNS: it is the `owns` of the widget's cli/keys
// specs. It must NOT be core's `fm` prefix, or core's built-in Finder
// handlers (live select, Space, Left/Right) would grab these rows.

export const OWNS = "extfm";
/** Spec id: `jimcast widget command xfinder ...` and `key_bindings.xfinder`. Not "finder": core's built-in Finder owns that. */
export const SPEC_ID = "xfinder";
export const ROW = `${OWNS}:`;
export const rowPathOf = (id?: string | null) => (id && id.startsWith(ROW) ? id.slice(ROW.length) : null);

// ── Layout ──────────────────────────────────────────────────────────────────

const WINDOW_ROWS = 14;                 // side columns show at most this many rows
const ROW_PX = 26;
const COLUMN_HEIGHT = ROW_PX * WINDOW_ROWS + 8;
const FOOTER_H = ROW_PX + 24;
const IMAGE_H = 200;
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff", "heic", "heif", "ico"]);
const SVG_MAX_BYTES = 1_000_000;
const LABEL_MAX: Record<number, number> = { 1: 56, 2: 36, 3: 24 };
const ELLIPSIS = "…";
const DIR_ICON = "📁";
const DIR_PREFIX_LEN = 3;
const MARK_ICON = "✓";
const MARK_PREFIX_LEN = 2;
const FONT = { xs: 11, sm: 12, lg: 16 };

// ── View: ctx + palette ─────────────────────────────────────────────────────

export interface Pal {
  blue: string; bg: string; bg1: string; bg2: string;
  fg: string; fg4: string; yellow: string; red: string;
}

export interface View { ctx: ExecutionContext; c: Pal }

export function makeView(ctx: ExecutionContext): View {
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  return {
    ctx,
    c: {
      blue: g("blue", "#458588"), bg: g("bg", "#282828"), bg1: g("bg1", "#3c3836"), bg2: g("bg2", "#504945"),
      fg: g("fg", "#ebdbb2"), fg4: g("fg4", "#a89984"), yellow: g("yellow", "#d79921"),
      red: g("brightRed", g("red", "#fb4934")),
    },
  };
}

// ── Actions ─────────────────────────────────────────────────────────────────

/** Runs a script (with `{p}` = path) in the plugin, then asks core to `then`. */
export const act = (
  ctx: ExecutionContext, cmd: string, path?: string, then: "refresh" | "dismiss" = "refresh",
): WidgetActionWithFn => ({
  run: async () => { await sh(ctx, cmd, path); },
  then,
});

/** A synthetic item, for ctx.dispatch (keys and CLI). */
export const cliItem = (
  ctx: ExecutionContext, id: string, cmd: string, path?: string,
): WidgetItem => ({ id: `${OWNS}-cli:${id}`, action: act(ctx, cmd, path) });

// ── Small helpers ───────────────────────────────────────────────────────────

/** "very-long-video-name.mp4" -> "very-long-vi…ame.mp4" (keeps the extension). */
function middleTruncate(name: string, max: number): string {
  const limit = Math.max(5, max);
  if (name.length <= limit) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 8 ? name.slice(dot) : "";
  const tail = Math.min(ext.length + 2, Math.floor((limit - 1) / 2));
  const head = limit - ELLIPSIS.length - tail;
  return name.slice(0, head) + ELLIPSIS + name.slice(name.length - tail);
}

function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${i === 0 ? n : n.toFixed(1)} ${u[i]}`;
}

async function loadImageSrc(ctx: ExecutionContext, path: string, size: number): Promise<string | null> {
  const ext = extOf(path);
  let cmd: string, mime: string;
  if (ext === "svg") {
    if (!(size < SVG_MAX_BYTES)) return null;
    cmd = `base64 -i ${shq(path)} | tr -d '\\n'`;
    mime = "image/svg+xml";
  } else if (IMAGE_EXTS.has(ext)) {
    cmd = thumbScript(path);
    mime = "image/jpeg";
  } else {
    return null;
  }
  try {
    const b64 = (await ctx.exec(cmd)).stdout.trim();
    return b64 ? `data:${mime};base64,${b64}` : null;
  } catch {
    return null;
  }
}

// ── Rows ────────────────────────────────────────────────────────────────────

// Folders: select (writes the state file, then refresh).
// Files:   open directly, then dismiss. Click on a file toggles its mark.
function selectItem(
  v: View, id: string, label: string, path: string, isDir: boolean,
  opts: { color?: string; style?: WidgetItem["style"]; maxChars?: number; open?: boolean; marked?: boolean } = {},
): WidgetItem {
  const { ctx, c } = v;
  const color = opts.color ?? (opts.marked ? c.yellow : isDir ? c.blue : c.fg);
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
    action: openOnEnter ? act(ctx, "open {p}", path, "dismiss") : act(ctx, SELECT_CMD, path),
    clickAction: openOnEnter ? act(ctx, TOGGLE_MARK_CMD, path) : undefined,
    style: opts.style,
  };
}

async function listColumn(
  v: View, dir: string, selectedPath: string | null,
  active: boolean, navigable: boolean, maxChars: number, marks: ReadonlySet<string>, showHidden: boolean,
): Promise<WidgetGroupSection> {
  const { c } = v;
  const res = await v.ctx.exec(`ls -1p${showHidden ? "A" : ""} ${shq(dir)} 2>/dev/null`);
  const names = lines(res.stdout.trim()).filter((n) => showHidden || !n.startsWith("."));
  names.sort((a, b) => {
    const da = a.endsWith("/"), db = b.endsWith("/");
    return da !== db ? (da ? -1 : 1) : a.localeCompare(b, undefined, { sensitivity: "base" });
  });

  // Navigable column: every entry, scrolled by the keyboard cursor.
  // Side columns: a window that keeps the highlighted entry visible.
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
    // Finder look: blue highlight in the active column, grey in earlier ones.
    const style = sel ? { background: active ? c.blue : c.bg2, borderRadius: 6 } : undefined;
    // Text on the blue highlight must be white; otherwise dirs stay blue.
    const color = sel && active ? "#ffffff" : undefined;
    return selectItem(v, `${ROW}${path}`, name, path, isDir, { color, style, maxChars, marked: marks.has(path) });
  });

  if (!navigable && names.length > start + WINDOW_ROWS) {
    datas.push({ id: `${OWNS}-more:${dir}`, pinned: true,
      attribute: { label1: `… ${names.length - start - WINDOW_ROWS} more`, color1: c.fg4, textSize1: FONT.xs } });
  }
  if (!datas.length) {
    datas.push({ id: `${OWNS}-empty:${dir}`, pinned: true,
      attribute: { label1: "(empty)", color1: c.fg4, textSize1: FONT.sm } });
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

function previewColumn(
  v: View, path: string, size: number, kind: string, maxChars: number, imageSrc: string | null,
): WidgetGroupSection {
  const { ctx, c } = v;
  const name = middleTruncate(path.slice(path.lastIndexOf("/") + 1), maxChars);
  const datas: WidgetItem[] = [
    { id: `${OWNS}-pv-name`, pinned: true,
      attribute: { label1: name, label2: `${kind} · ${humanSize(size)}`, color1: c.fg, color2: c.fg4, textSize1: FONT.lg } },
    { id: `${OWNS}-pv-open`, pinned: true,
      attribute: { label1: "Open", labelRight: "↵", color1: c.blue, colorRight: c.fg4 },
      action: act(ctx, "open {p}", path, "dismiss") },
    { id: `${OWNS}-pv-reveal`, pinned: true,
      attribute: { label1: "Reveal in Finder", color1: c.fg },
      action: act(ctx, "open -R {p}", path, "dismiss") },
  ];

  const info: WidgetGroupSection = { id: "pv-info", navigable: true, content: { type: "list", datas } };
  const sections: WidgetGroupSection[] = imageSrc
    ? [{ id: "pv-image", navigable: false, content: { type: "image", data: { src: imageSrc, alt: name, height: IMAGE_H } } }, info]
    : [info];

  return {
    id: "preview",
    flex: 1.2,
    height: COLUMN_HEIGHT,
    style: { background: c.bg1, borderRadius: 8, padding: 4 },
    content: { type: "group", direction: "column", gap: 6, sections },
  };
}

function currentDirBar(v: View, cwd: string, home: string): WidgetGroupSection {
  const { c } = v;
  const shown = cwd === home ? "~" : cwd.startsWith(home + "/") ? "~" + cwd.slice(home.length) : cwd;
  const parent = parentOf(cwd);

  // `open: false` — this row means "go up", never "open".
  const base = selectItem(v, `${OWNS}-cwd`, shown, parent, false, { open: false });
  const item: WidgetItem = {
    ...base,
    attribute: {
      label1: `${DIR_ICON} ${shown}`, color1: c.blue, textSize1: FONT.sm,
      labelRight: cwd === "/" ? undefined : "↑ up", colorRight: c.fg4,
    },
    action: cwd === "/" ? undefined : base.action,   // nothing above root
  };

  return {
    id: "cwd",
    navigable: true,
    style: { background: c.bg2, borderRadius: 8, padding: 4 },
    content: { type: "list", datas: [item] },
  };
}

/** "c copy · x cut" from [actionId, text] pairs; unbound actions are skipped. */
const keyHints = (labels: Record<string, string>, items: [string, string][]) =>
  items.filter(([id]) => labels[id]).map(([id, text]) => `${labels[id]} ${text}`).join(" · ");

/// Always one fixed-height row, so the window never changes size: a status
/// line (never navigable) with key hints, or Confirm / Cancel while a Trash
/// is pending.
function marksFooter(
  v: View, count: number, confirming: boolean,
  labels: Record<string, string>, clip: FinderStatus["clip"],
): WidgetGroupSection {
  const { ctx, c } = v;
  const style = { background: c.bg2, borderRadius: 8, padding: 4 };
  const withKey = (text: string, id: string) => (labels[id] ? `${text} (${labels[id]})` : text);

  if (count > 0 && confirming) {
    // Order matters: if the cursor index is clamped into this shorter list it
    // must land on "Cancel", never on "Confirm".
    const confirmDatas: WidgetItem[] = [
      { id: `${OWNS}-act:trash-confirm`, pinned: true,
        attribute: { label1: withKey(`Confirm Trash ${count}`, "confirm_delete"), color1: c.red },
        action: act(ctx, TRASH_CONFIRMED_CMD) },
      { id: `${OWNS}-act:trash-cancel`, pinned: true,
        attribute: { label1: withKey("Cancel", "cancel_delete"), color1: c.blue },
        action: act(ctx, TRASH_CANCEL_CMD) },
    ];
    return { id: "marks", height: FOOTER_H, scrollable: false, navigable: true, style,
      content: { type: "grid-3", datas: confirmDatas } };
  }

  const status = count > 0
    ? `${MARK_ICON} ${count} selected`
    : clip ? `${clip.count} ${clip.mode === "cut" ? "cut" : "copied"}` : "Space: select";

  const paste: [string, string][] = clip ? [["paste", "paste"]] : [];
  const hint = count > 0
    ? keyHints(labels, [["copy", "copy"], ["move", "cut"], ...paste, ["delete", "delete"], ["zip", "zip"], ["clear_marks", "clear"]])
    : keyHints(labels, [...paste, ["copy", "copy"], ["move", "cut"], ["delete", "delete"], ["toggle_hidden", "hidden"]]);

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

// ── The widget's render ─────────────────────────────────────────────────────

export async function renderFinder(ctx: ExecutionContext): Promise<WidgetContent> {
  const v = makeView(ctx);
  const [st, labels] = await Promise.all([readStatus(ctx), ctx.keyLabels(SPEC_ID)]);

  const marks = new Set<string>(st.marked);
  const { home, selected: sel, isDir } = st;
  const base = sel === home || sel.startsWith(home + "/") ? home : "/";

  const sections: WidgetGroupSection[] = [];
  let cwd: string;

  if (sel === base) {
    // Nothing selected yet: a single column showing the base folder.
    cwd = base;
    sections.push(await listColumn(v, base, null, true, true, LABEL_MAX[1], marks, st.showHidden));
  } else {
    const center = parentOf(sel);
    cwd = center;

    // How many columns will be visible decides how wide each label may be.
    const colCount = (center !== base ? 1 : 0) + 2;
    const maxChars = LABEL_MAX[colCount] ?? LABEL_MAX[3];

    const jobs: Promise<WidgetGroupSection>[] = [];
    // left: parent of the center folder, with the center folder highlighted
    if (center !== base) jobs.push(listColumn(v, parentOf(center), center, false, false, maxChars, marks, st.showHidden));
    // center: folder holding the selection, selection highlighted blue
    jobs.push(listColumn(v, center, sel, true, true, maxChars, marks, st.showHidden));
    // right: contents of the selection (folder) or a preview (file)
    if (isDir) jobs.push(listColumn(v, sel, null, false, false, maxChars, marks, st.showHidden));

    // The thumbnail is fetched in parallel with the columns.
    const imageJob = isDir ? Promise.resolve(null) : loadImageSrc(ctx, sel, st.size);
    const [cols, imageSrc] = await Promise.all([Promise.all(jobs), imageJob]);

    sections.push(...cols);
    if (!isDir) sections.push(previewColumn(v, sel, st.size, st.kind, maxChars, imageSrc));
  }

  return {
    type: "group",
    direction: "column",
    gap: 6,
    sections: [
      currentDirBar(v, cwd, home),
      { id: "columns", content: { type: "group", direction: "row", gap: 6, sections } },
      marksFooter(v, marks.size, st.confirming, labels, st.clip),
    ],
  };
}
