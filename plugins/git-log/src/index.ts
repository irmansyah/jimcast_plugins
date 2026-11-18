// [plugin] jim-git-log/src/index.ts
//
// Inline, read-only "terminal print" of a repo: `git status -sb` and
// `git log --graph --oneline --decorate`, drawn directly in the slot (no click
// to open a panel). Which repo:
//   1. the Finder's selection (FINDER_PATH_FILE): the folder itself, or the
//      folder holding the selected file, resolved to its git root;
//   2. if that is not inside a repo, the git-branches widget's repo
//      (<git-branches data dir>/repo, else the first one in .../repos).
// The header shows which one was used ("from Finder" / "from Git widget").
//
//   status -> branch line + changed files (staged green, modified yellow,
//             deleted red, untracked purple)
//   log    -> the commit graph; Enter / click on a commit copies its hash
//
// Stateless: nothing is stored, it just re-reads on render.

import {
  createWidget,
  definePlugin,
  type ExecutionContext,
  type WidgetContent,
  type WidgetGroupSection,
  type WidgetItem,
} from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime"; // Node only

// ── Shared basics ───────────────────────────────────────────────────────────
type Exec = Pick<ExecutionContext, "exec">;
type Action = NonNullable<WidgetItem["action"]>;

// Item-id prefix (not a core prefix while the built-in widget still exists: core uses "gl-").
const OWNS = "extgl";

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const short = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

const act = (ctx: Exec, cmd: string, then: "refresh" | "dismiss" = "refresh"): Action => ({
  run: async () => {
    await ctx.exec(cmd);
  },
  then,
});

// Local stand-ins for theme.font.* from the core design system.
const FONT = { xs: 11, sm: 12 };

// ── Layout ──────────────────────────────────────────────────────────────────
const LOG_LINES = 20;
const STATUS_MAX = 12; // changed files shown before "… n more"
const STATUS_HEIGHT = 150; // status box scrolls past this
const ROW_PX = 22;
const LOG_HEIGHT = ROW_PX * 12 + 8;
const LINE_MAX = 90;

// ── Other widgets' state (read-only) ────────────────────────────────────────
// This widget reads state written by two OTHER widgets. These are the only
// places those locations are written; adjust them if the other plugins move.
//   Finder selection: the built-in Finder's file (path of the selected item).
//   Git branches:     data dir of the git-branches plugin (files `repo`, `repos`).
const FINDER_PATH_FILE = `$HOME/.jimcast/finder-path`;
const GIT_BRANCHES_DIR = `$HOME/.jimcast/plugin-data/com.jimcast.plugins.git-branches`;

const READ = `export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
d="${GIT_BRANCHES_DIR}"
src=finder
r=""
p=$(cat "${FINDER_PATH_FILE}" 2>/dev/null)
if [ -n "$p" ] && [ -e "$p" ]; then
  if [ -d "$p" ]; then dir="$p"; else dir=$(dirname "$p"); fi
  r=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)
fi
if [ -z "$r" ]; then
  src=git
  r=$(cat "$d/repo" 2>/dev/null)
  if [ -z "$r" ] || [ ! -d "$r" ]; then r=$(head -1 "$d/repos" 2>/dev/null); fi
fi
[ -d "$r" ] || exit 0
cd "$r" || exit 0
echo "src=$src"
echo "repo=$r"
echo "@@status"
git status -sb 2>&1
echo "@@log"
git log --graph --oneline --decorate --color=never -n ${LOG_LINES} 2>&1
`;

interface View {
  repo: string;
  source: "finder" | "git";
  status: string[];
  log: string[];
}

async function readView(ctx: Exec): Promise<View | null> {
  const res = await ctx.exec(READ);
  let repo = "";
  let source: View["source"] = "git";
  const status: string[] = [],
    log: string[] = [];
  let into: string[] | null = null;
  for (const line of res.stdout.trim().split("\n")) {
    if (line.startsWith("src=")) source = line.slice(4).trim() === "finder" ? "finder" : "git";
    else if (line.startsWith("repo=")) repo = line.slice(5).trim();
    else if (line === "@@status") into = status;
    else if (line === "@@log") into = log;
    else if (into && line.trim()) into.push(line);
  }
  return repo ? { repo, source, status, log } : null;
}

// ── Palette ─────────────────────────────────────────────────────────────────
function palette(ctx: ExecutionContext) {
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  return {
    bg: g("bg", "#1e2127"),
    bg2: g("bg2", "#282c34"),
    fg: g("fg", "#abb2bf"),
    fg2: g("fg2", "#9da5b4"),
    fg4: g("fg4", "#7f848e"),
    yellow: g("yellow", "#e5c07b"),
    brightGreen: g("brightGreen", "#98c379"),
    brightRed: g("brightRed", "#ff6b6b"),
    purple: g("purple", "#c678dd"),
  };
}
type Palette = ReturnType<typeof palette>;

// ── Items ───────────────────────────────────────────────────────────────────
function statusItems(c: Palette, lines: string[]): WidgetItem[] {
  const [head, ...files] = lines;
  const items: WidgetItem[] = [];

  if (head?.startsWith("##")) {
    items.push({
      id: `${OWNS}-branch`,
      pinned: true,
      attribute: {
        label1: `⎇ ${short(head.slice(3), LINE_MAX)}`,
        color1: c.yellow,
        textSize1: FONT.sm,
      },
    });
  }
  if (!files.length) {
    items.push({
      id: `${OWNS}-clean`,
      pinned: true,
      attribute: { label1: "✓ working tree clean", color1: c.brightGreen, textSize1: FONT.sm },
    });
    return items;
  }
  files.slice(0, STATUS_MAX).forEach((l, i) => {
    const x = l[0],
      y = l[1];
    const color = l.startsWith("??")
      ? c.purple
      : y === "D" || x === "D"
        ? c.brightRed
        : y === "M"
          ? c.yellow
          : x !== " "
            ? c.brightGreen
            : c.fg2;
    items.push({
      id: `${OWNS}-file:${i}`,
      pinned: true,
      attribute: { label1: short(l, LINE_MAX), color1: color, textSize1: FONT.sm },
    });
  });
  if (files.length > STATUS_MAX) {
    items.push({
      id: `${OWNS}-more`,
      pinned: true,
      attribute: {
        label1: `… ${files.length - STATUS_MAX} more`,
        color1: c.fg4,
        textSize1: FONT.xs,
      },
    });
  }
  return items;
}

function logItems(ctx: Exec, c: Palette, lines: string[]): WidgetItem[] {
  return lines.map((l, i) => {
    const hash = /\b([0-9a-f]{7,12})\b/.exec(l)?.[1];
    return {
      id: `${OWNS}-log:${i}`,
      pinned: true,
      attribute: {
        label1: short(l, LINE_MAX),
        color1: l.includes("HEAD ->") ? c.yellow : c.fg2,
        textSize1: FONT.xs,
      },
      action: hash ? act(ctx, `printf %s ${shq(hash)} | pbcopy`) : undefined,
    };
  });
}

// ── Render ──────────────────────────────────────────────────────────────────
async function render(ctx: ExecutionContext): Promise<WidgetContent> {
  const c = palette(ctx);
  const view = await readView(ctx);
  if (!view) {
    return {
      type: "text",
      data: {
        id: `${OWNS}-empty`,
        attribute: {
          label1: "No repo tracked. Add one with the git-branches widget (Scan, or `git add`).",
          color1: c.fg4,
        },
      },
    };
  }

  const name = view.repo.slice(view.repo.lastIndexOf("/") + 1);
  const box = { background: c.bg, borderRadius: 8, padding: 4 };
  const sections: WidgetGroupSection[] = [
    {
      id: "gl-head",
      navigable: true,
      style: { background: c.bg2, borderRadius: 8, padding: 4 },
      content: {
        type: "rows",
        datas: [
          {
            id: `${OWNS}-refresh`,
            pinned: true,
            attribute: {
              label1: name,
              color1: c.fg,
              label2: "⟳ Refresh",
              color2: c.fg,
              label3: view.source === "finder" ? "from Finder" : "from Git widget",
              color3: c.fg4,
            },
            action: act(ctx, ":"),
          },
        ],
      },
    },
    {
      id: "gl-status",
      navigable: false,
      maxHeight: STATUS_HEIGHT,
      style: box,
      content: { type: "list", datas: statusItems(c, view.status) },
    },
    {
      id: "gl-log",
      navigable: true,
      height: LOG_HEIGHT,
      style: box,
      content: { type: "list", datas: logItems(ctx, c, view.log) },
    },
  ];
  return { type: "group", direction: "column", gap: 6, sections };
}

// ── Plugin ──────────────────────────────────────────────────────────────────
// Main widget: no id (its full id is the plugin id from package.json).
export const widget = createWidget({
  section: {
    title: "Git log",
    titleShow: true,
    navigationActive: true,
    querySearchActive: false,
  },
  showIn: ["default"],
  render: (ctx) => render(ctx),
});

export const plugin = definePlugin({
  description: "Read-only git status and commit graph of the Finder's repo or the git-branches repo",
  widgets: [widget],
});
export default plugin;
bootstrapPlugin(plugin);
