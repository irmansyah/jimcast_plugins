// [plugin] jimcast-external-finder/src/index.ts
//
// A widget-based file browser that approximates macOS Finder's column
// view using only primitives the SDK already exposes: each directory
// depth is rendered as its own horizontal 'rows' section (WidgetRows lays
// its items out left-to-right, unlike WidgetList's vertical stack), and
// depths are stacked top-to-bottom inside a 'group' — so picking a folder
// reveals that folder's children as a new row underneath it, cascading
// downward as you drill in, similar in spirit to Finder's columns
// cascading rightward. No core or SDK changes needed: 'group' + per-item
// `style` are the two additions from earlier in this thread, and both are
// plain data that survive the RPC boundary unchanged.

import {
  createCommand,
  createCommandGroup,
  createWidget,
  definePlugin,
  type ExecutionContext,
  type WidgetContent,
  type WidgetItem,
  type WidgetGroupSection,
} from "@jimcast/sdk";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = homedir();
const MAX_ITEMS_PER_LEVEL = 30; // mirrors rpc.ts's SEARCH_RESULT_CAP-style cap
const SHOW_HIDDEN = false;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
//
// Module-scope, not per-render. This plugin process stays alive for the
// life of the command bar (see @jimcast/sdk/rpc.ts's bootstrapPlugin, which
// listens on stdin/stdout in a loop) — the same reason widgetActionRegistry
// there is a module-level Map. `pathChain` is the ordered list of
// directories currently "open": pathChain[0] is always ROOT, and each
// following entry is the child directory selected within the row above it.
// The widget's render() reads this on every call; item actions mutate it.

let pathChain: string[] = [ROOT];

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

interface DirEntry {
  name:  string;
  path:  string;
  isDir: boolean;
  size?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

async function listDirSafe(dirPath: string): Promise<DirEntry[] | null> {
  try {
    const dirents = await readdir(dirPath, { withFileTypes: true });
    const entries: DirEntry[] = [];

    for (const d of dirents) {
      if (!SHOW_HIDDEN && d.name.startsWith(".")) continue;
      const fullPath = join(dirPath, d.name);
      if (d.isDirectory()) {
        entries.push({ name: d.name, path: fullPath, isDir: true });
      } else if (d.isFile()) {
        const size = await stat(fullPath).then((s) => s.size).catch(() => undefined);
        entries.push({ name: d.name, path: fullPath, isDir: false, size });
      }
      // symlinks, sockets, etc. are silently skipped — keeping this a
      // simple demo rather than a fully general file browser
    }

    // Folders first, then files, both alphabetical — Finder's default
    // "list view" grouping, not a strict single alpha sort.
    entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return entries;
  } catch {
    return null; // permission denied, ENOENT, etc.
  }
}

// Cheap alpha-tint for a hex color, matching the `${hex}${alphaSuffix}`
// convention core's own designSystem.ts uses (see alpha() there) — kept
// local since plugins don't have access to core's internal design tokens,
// only the resolved theme colors handed to them via ctx.host.theme.
function tint(hexColor: string, suffix = "22"): string {
  return hexColor.startsWith("#") ? `${hexColor}${suffix}` : hexColor;
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

async function buildFileManagerContent(ctx: ExecutionContext): Promise<WidgetContent> {
  const colors = ctx.host.theme.colors as Record<string, string>;
  const accent = colors.brightBlue ?? colors.blue ?? "#5c9dfa";
  const muted  = colors.fg4 ?? "#888888";
  const fg     = colors.fg ?? "#dddddd";

  const sections: WidgetGroupSection[] = [
    {
      id: "path-bar",
      content: {
        type: "text",
        data: {
          id: "current-path",
          attribute: { label1: pathChain[pathChain.length - 1], color1: muted, textSize1: 11 },
        },
      },
    },
  ];

  for (let level = 0; level < pathChain.length; level++) {
    const dirPath  = pathChain[level];
    const openNext = pathChain[level + 1]; // undefined at the deepest level
    const entries  = await listDirSafe(dirPath);

    if (entries === null) {
      sections.push({
        id: `level-${level}`,
        content: { type: "error", message: `Can't read ${dirPath}` },
      });
      break; // no children to descend into past an unreadable directory
    }

    if (entries.length === 0) {
      sections.push({
        id: `level-${level}`,
        content: {
          type: "text",
          data: { id: "empty", attribute: { label1: "Empty", color1: muted } },
        },
      });
      break;
    }

    const visible = entries.slice(0, MAX_ITEMS_PER_LEVEL);
    const items: WidgetItem[] = visible.map((entry) => {
      const isOpen = entry.path === openNext;
      return {
        id: entry.path,
        attribute: {
          label1: `${entry.isDir ? "📁" : "📄"} ${entry.name}`,
          color1: isOpen ? accent : entry.isDir ? fg : muted,
          label2: entry.isDir ? undefined : entry.size !== undefined ? formatBytes(entry.size) : undefined,
          color2: muted,
        },
        style: isOpen
          ? { background: tint(accent), borderColor: accent, borderRadius: 6, padding: 4 }
          : undefined,
        action: async () => {
          if (entry.isDir) {
            if (pathChain[level + 1] === entry.path) {
              // Clicking the already-open folder again collapses it —
              // a lightweight stand-in for Finder's column-view toggle.
              pathChain = pathChain.slice(0, level + 1);
            } else {
              pathChain = [...pathChain.slice(0, level + 1), entry.path];
            }
          } else {
            // Best-effort "open" — relies on macOS's `open`; silently
            // no-ops on platforms where it doesn't exist on PATH.
            try {
              await ctx.exec(`open ${JSON.stringify(entry.path)}`);
            } catch {
              await ctx.showToast("Couldn't open file", { style: "failure" });
            }
          }
          // ASSUMPTION: core re-renders this widget after this function
          // resolves. If the UI doesn't visually update on click, this is
          // the first thing to check against actionRunner.ts's onRefresh.
        },
      };
    });

    if (entries.length > MAX_ITEMS_PER_LEVEL) {
      items.push({
        id: `${dirPath}::more`,
        attribute: { label1: `… ${entries.length - MAX_ITEMS_PER_LEVEL} more`, color1: muted },
      });
    }

    sections.push({ id: `level-${level}`, content: { type: "rows", datas: items } });

    // Stop after the deepest level that has no further selection —
    // there's nothing more to render past it.
    if (openNext === undefined) break;
  }

  return { type: "group", sections };
}

const fileManagerWidget = createWidget({
  id: "jimcast-external-finder.widget.explorer",
  showIn: ["default"],
  section: { titleShow: true },
  render: buildFileManagerContent,
});

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const resetToHomeCommand = createCommand({
  id:       "jimcast-external-finder.command.reset-to-home",
  title:    "Reset File Manager to Home",
  subtitle: "Collapse all open folders back to your home directory",
  keywords: ["files", "finder", "reset", "home"],

  async execute(context: ExecutionContext) {
    pathChain = [ROOT];
    await context.showToast("File manager reset to home");
    return [];
  },
});

const fileManagerGroup = createCommandGroup({
  title:    "File Manager",
  commands: [resetToHomeCommand],
});

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default definePlugin({
  name:        "File Manager",
  description: "A Finder-style column file browser rendered in the command bar",
  commands:    [fileManagerGroup],
  widgets:     [fileManagerWidget],
});
