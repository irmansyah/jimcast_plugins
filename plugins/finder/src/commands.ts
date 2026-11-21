// [plugin] jim-finder/src/commands.ts
import type {
  WidgetCliCommand, WidgetCliContext, WidgetKeyAction, WidgetKeyContext,
} from "@jimcast/sdk";
import { readFinderStatus, currentFolder, type FinderStatus } from "./data.js";
import { cliItem, rowPathOf, ROW_PREFIX, OWNS } from "./render.js";
import {
  shq, parentOf, seq, guarded, loadState, loadInitDirs,
  selectCmd, leftCmd, rightCmd, markCmd, unmarkCmd, toggleMarkCmd, selectAllCmd,
  CLEAR_MARKS_CMD, ZIP_MARKED_CMD, TRASH_ASK_CMD, TRASH_CANCEL_CMD, TRASH_CONFIRMED_CMD,
  TOGGLE_HIDDEN_CMD, TOGGLE_SORT_CMD, TOGGLE_PICKER_CMD, yankCmd, pasteCmd, openCmd, revealCmd,
} from "./shell.js";

// ═══ CLI: `jimcast widget command <widget> <command> [args...]` ═════════════
// <widget> is the widget's catalog alias or its full id
// ("com.jimcast.plugins.finder"); core accepts nothing else.

// Relative paths resolve against the CALLER's cwd (ctx.cwd). Symlinks are not resolved.
function normalizePath(p: string): string {
  const out: string[] = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return "/" + out.join("/");
}

async function existingPaths(ctx: WidgetCliContext, raw: string[]): Promise<string[]> {
  const abs = raw.map((p) => normalizePath(p.startsWith("/") ? p : `${ctx.cwd ?? "/"}/${p}`));
  for (const p of abs) {
    const r = await ctx.exec(`if [ -e ${shq(p)} ]; then echo y; fi`);
    if (r.stdout.trim() !== "y") throw new Error(`no such file or directory: ${p}`);
  }
  return abs;
}

const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));
const hasFlag = (ctx: WidgetCliContext, f: string) => ctx.args.includes(f);

/** Given paths, else the current selection (never $HOME itself). */
async function targetsOrSelection(ctx: WidgetCliContext): Promise<string[]> {
  const given = positional(ctx);
  if (given.length) return existingPaths(ctx, given);
  const st = await readFinderStatus(ctx);
  if (st.selected === st.home) throw new Error("nothing is selected — pass a path");
  return [st.selected];
}

async function needMarks(ctx: WidgetCliContext): Promise<FinderStatus> {
  const st = await readFinderStatus(ctx);
  if (!st.marked.length) throw new Error("nothing is marked — run `mark <path>` first");
  return st;
}

const markedCount = async (ctx: WidgetCliContext) =>
  `${(await readFinderStatus(ctx)).marked.length} marked`;

const selectCommand: WidgetCliCommand = {
  id: "select", args: ["path"], title: "Select a file or folder (the columns follow, like a click)",
  async run(ctx) {
    if (!positional(ctx)[0]) throw new Error("select needs a path");
    const [p] = await existingPaths(ctx, [positional(ctx)[0]]);
    await ctx.dispatch(cliItem(ctx, "select", selectCmd(p)), { focus: { id: `${ROW_PREFIX}${p}` } });
    return `Selected ${p}`;
  },
};

export const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "status", title: "Selected path and marked paths",
    description: "--json for machine-readable output",
    async run(ctx) {
      const st = await readFinderStatus(ctx);
      if (hasFlag(ctx, "--json")) return st;
      return [
        `selected  ${st.selected}`,
        `hidden    ${st.showHidden ? "shown" : "hidden"}`,
        `sort      ${st.sort === "date" ? "date (newest first)" : "A-Z"}`,
        st.marked.length ? `marked    ${st.marked.length}` : "marked    (none)",
        ...st.marked.map((m) => `  ${m}`),
        ...(st.confirming ? ["trash     waiting — `trash --yes` or `--cancel`"] : []),
      ].join("\n");
    },
  },
  { id: "path", title: "Print the selected path", run: async (ctx) => (await readFinderStatus(ctx)).selected },
  { id: "marked", title: "Print the marked paths, one per line", run: async (ctx) => (await readFinderStatus(ctx)).marked.join("\n") },

  selectCommand,
  { ...selectCommand, id: "cd", title: "Alias of select" },
  {
    id: "up", args: ["[path]"], title: "Select the parent (the Left key)",
    async run(ctx) {
      const [given] = positional(ctx);
      const p = given ? (await existingPaths(ctx, [given]))[0] : (await readFinderStatus(ctx)).selected;
      await ctx.dispatch(cliItem(ctx, "up", leftCmd(p)), { focus: { id: `${ROW_PREFIX}${parentOf(p)}` } });
      return `Selected ${(await readFinderStatus(ctx)).selected}`;
    },
  },
  {
    id: "enter", args: ["[path]"], title: "Go into the folder: select its first entry (the Right key)",
    async run(ctx) {
      const [given] = positional(ctx);
      const p = given ? (await existingPaths(ctx, [given]))[0] : (await readFinderStatus(ctx)).selected;
      await ctx.dispatch(cliItem(ctx, "enter", rightCmd(p)), { focus: { id: `${ROW_PREFIX}${p}`, prefix: `${ROW_PREFIX}${p}/` } });
      return `Selected ${(await readFinderStatus(ctx)).selected}`;
    },
  },

  {
    id: "hidden", title: "Toggle showing hidden files",
    async run(ctx) {
      await ctx.dispatch(cliItem(ctx, "hidden", TOGGLE_HIDDEN_CMD));
      return (await readFinderStatus(ctx)).showHidden ? "Hidden files: shown" : "Hidden files: hidden";
    },
  },
  {
    id: "sort", title: "Toggle sort order: A-Z / date (newest first)",
    async run(ctx) {
      await ctx.dispatch(cliItem(ctx, "sort", TOGGLE_SORT_CMD));
      return (await readFinderStatus(ctx)).sort === "date" ? "Sort: date (newest first)" : "Sort: A-Z";
    },
  },

  {
    id: "mark", args: ["[paths...]"], title: "Mark paths (default: the selection). Safe to repeat.",
    async run(ctx) {
      for (const p of await targetsOrSelection(ctx)) await ctx.dispatch(cliItem(ctx, "mark", markCmd(p)));
      return markedCount(ctx);
    },
  },
  {
    id: "unmark", args: ["[paths...]"], title: "Unmark paths (default: the selection)",
    async run(ctx) {
      for (const p of await targetsOrSelection(ctx)) await ctx.dispatch(cliItem(ctx, "unmark", unmarkCmd(p)));
      return markedCount(ctx);
    },
  },
  {
    id: "toggle", args: ["[paths...]"], title: "Toggle marks, like Space (default: the selection)",
    async run(ctx) {
      for (const p of await targetsOrSelection(ctx)) await ctx.dispatch(cliItem(ctx, "toggle", toggleMarkCmd(p)));
      return markedCount(ctx);
    },
  },
  {
    id: "select-all", args: ["[folder]"], title: "Mark everything in a folder, or unmark it if already all marked (select_all key)",
    description: "Default folder: the one shown in the path bar.",
    async run(ctx) {
      const [given] = positional(ctx);
      const dir = given ? (await existingPaths(ctx, [given]))[0] : await currentFolder(ctx);
      await ctx.dispatch(cliItem(ctx, "select-all", selectAllCmd(dir)));
      return markedCount(ctx);
    },
  },
  {
    id: "clear", title: "Unmark everything",
    async run(ctx) {
      await ctx.dispatch(cliItem(ctx, "clear", CLEAR_MARKS_CMD));
      return "0 marked";
    },
  },

  {
    id: "zip", title: "Zip the marked items next to the first one",
    async run(ctx) {
      await needMarks(ctx);
      await ctx.dispatch(cliItem(ctx, "zip", ZIP_MARKED_CMD));
      // The script swallows its own errors; success always clears the marks.
      if ((await readFinderStatus(ctx)).marked.length) throw new Error("zip failed — the items are still marked");
      return "Zipped the marked items.";
    },
  },
  {
    id: "trash", args: ["[--yes|--cancel]"], title: "Move the marked items to the Trash",
    description: "Without a flag it only asks (the footer shows Confirm / Cancel). --yes asks and confirms.",
    async run(ctx) {
      if (hasFlag(ctx, "--cancel")) {
        await ctx.dispatch(cliItem(ctx, "trash-cancel", TRASH_CANCEL_CMD));
        return "Trash cancelled.";
      }
      const st = await needMarks(ctx);
      if (!hasFlag(ctx, "--yes")) {
        await ctx.dispatch(cliItem(ctx, "trash-ask", TRASH_ASK_CMD));
        return `Trash ${st.marked.length} item(s)? Re-run with --yes to confirm, or --cancel.`;
      }
      // Ask + confirm in one script: the confirm half still re-checks the timestamp and the marks.
      await ctx.dispatch(cliItem(ctx, "trash", seq(TRASH_ASK_CMD, TRASH_CONFIRMED_CMD)));
      if ((await readFinderStatus(ctx)).marked.length) throw new Error("trash failed — the items are still marked");
      return "Moved the marked items to the Trash.";
    },
  },

  {
    id: "open", args: ["[path]"], title: "Open in the jimcast Finder (shows the bar)",
    description: "A folder shows its contents, a file shows its preview. `launch` opens with the default app instead.",
    async run(ctx) {
      const [given] = positional(ctx);
      const p = given ? (await existingPaths(ctx, [given]))[0] : (await readFinderStatus(ctx)).selected;
      const d = await ctx.exec(`if [ -d ${shq(p)} ]; then echo y; fi`);
      const isDir = d.stdout.trim() === "y";

      // Select first (also covers an empty folder), then step into a folder.
      await ctx.dispatch(cliItem(ctx, "open-select", selectCmd(p)), { focus: { id: `${ROW_PREFIX}${p}` } });
      if (isDir) {
        await ctx.dispatch(cliItem(ctx, "open-enter", rightCmd(p)), { focus: { id: `${ROW_PREFIX}${p}`, prefix: `${ROW_PREFIX}${p}/` } });
      }
      ctx.showBar();
      return `Opened ${p}`;
    },
  },
  {
    id: "launch", args: ["[paths...]"], title: "Open with the default macOS app (default: the selection)",
    async run(ctx) {
      for (const p of await targetsOrSelection(ctx)) await ctx.exec(openCmd(p));
      return null;
    },
  },
  {
    id: "reveal", args: ["[paths...]"], title: "Reveal in macOS Finder (default: the selection)",
    async run(ctx) {
      for (const p of await targetsOrSelection(ctx)) await ctx.exec(revealCmd(p));
      return null;
    },
  },
];

// ═══ Keys ═══════════════════════════════════════════════════════════════════
// Every action goes through ctx.dispatch, so the Finder re-renders as for a click.
//
// The toggles (select, select_all, toggle_hidden, toggle_sort, jump_dir) are `guarded`:
// one key press that reaches this plugin twice (or reaches both this action and a row's
// click action) must toggle once, not twice. The CLI commands above are not
// guarded on purpose, so scripts can still toggle the same path back to back.

/** Keep the cursor on the same row after the re-render. */
const keepFocus = (ctx: WidgetKeyContext) =>
  ctx.focusedItemId ? { focus: { id: ctx.focusedItemId } } : undefined;

/** Cursor row, else the live selection (never $HOME itself). */
async function keyTarget(ctx: WidgetKeyContext): Promise<string | null> {
  const row = rowPathOf(ctx.focusedItemId);
  if (row) return row;
  const st = await readFinderStatus(ctx);
  return st.selected === st.home ? null : st.selected;
}

export const KEY_ACTIONS: WidgetKeyAction[] = [
  {
    id: "select", title: "Mark / unmark the row under the cursor", default: "space",
    async run(ctx) {
      const p = rowPathOf(ctx.focusedItemId);
      if (!p) return;
      // Same guard key as a file row's click action (see render.ts).
      await ctx.dispatch(cliItem(ctx, "select", guarded(`mark:${p}`, toggleMarkCmd(p))), keepFocus(ctx));
    },
  },
  {
    id: "select_all", title: "Select all / deselect all in the current folder", default: "shift+v",
    async run(ctx) {
      const dir = await currentFolder(ctx);
      await ctx.dispatch(
        cliItem(ctx, "select-all", guarded(`select-all:${dir}`, selectAllCmd(dir))),
        keepFocus(ctx),
      );
    },
  },
  {
    id: "copy", title: "Copy marked (or the row under the cursor)", default: "y",
    run: async (ctx) => ctx.dispatch(cliItem(ctx, "copy", yankCmd("copy", (await keyTarget(ctx)) ?? "")), keepFocus(ctx)),
  },
  {
    id: "move", title: "Cut marked (or the row); paste moves it", default: "x",
    run: async (ctx) => ctx.dispatch(cliItem(ctx, "cut", yankCmd("cut", (await keyTarget(ctx)) ?? "")), keepFocus(ctx)),
  },
  {
    id: "paste", title: "Paste into the current folder", default: "p",
    run: async (ctx) => ctx.dispatch(cliItem(ctx, "paste", pasteCmd(await currentFolder(ctx))), keepFocus(ctx)),
  },
  {
    id: "toggle_hidden", title: "Show / hide hidden files", default: "shift+h",
    run: (ctx) => ctx.dispatch(
      cliItem(ctx, "toggle-hidden", guarded("toggle-hidden", TOGGLE_HIDDEN_CMD)),
      keepFocus(ctx),
    ),
  },
  {
    id: "toggle_sort", title: "Toggle sort: A-Z / date", default: "s",
    run: (ctx) => ctx.dispatch(
      cliItem(ctx, "toggle-sort", guarded("toggle-sort", TOGGLE_SORT_CMD)),
      keepFocus(ctx),
    ),
  },
  {
    id: "jump_dir", title: "Show / hide defined directories (init_dirs.json)", default: "g",
    async run(ctx) {
      const opening = !(await loadState(ctx)).picker;
      const first = opening ? (await loadInitDirs(ctx))[0] : undefined;
      await ctx.dispatch(
        cliItem(ctx, "picker", guarded("picker", TOGGLE_PICKER_CMD)),
        first ? { focus: { id: `${OWNS}-dir:${first.path}` } } : undefined,
      );
    },
  },
  {
    id: "delete", title: "Move to Trash (asks first)", default: "d",
    async run(ctx) {
      const st = await readFinderStatus(ctx);
      if (st.marked.length) {
        await ctx.dispatch(cliItem(ctx, "trash-ask", TRASH_ASK_CMD), keepFocus(ctx));
        return;
      }
      const p = await keyTarget(ctx);
      if (!p) return;
      // Nothing marked: mark the row, then ask, in one script (one re-render).
      await ctx.dispatch(cliItem(ctx, "delete", seq(markCmd(p), TRASH_ASK_CMD)), keepFocus(ctx));
    },
  },
  {
    id: "zip", title: "Zip marked (or the row under the cursor)", default: "z",
    async run(ctx) {
      const st = await readFinderStatus(ctx);
      if (st.marked.length) {
        await ctx.dispatch(cliItem(ctx, "zip", ZIP_MARKED_CMD), keepFocus(ctx));
        return;
      }
      const p = await keyTarget(ctx);
      if (!p) return;
      await ctx.dispatch(cliItem(ctx, "zip-row", seq(markCmd(p), ZIP_MARKED_CMD)), keepFocus(ctx));
    },
  },
  {
    id: "clear_marks", title: "Unmark everything", default: "u",
    run: (ctx) => ctx.dispatch(cliItem(ctx, "clear", CLEAR_MARKS_CMD), keepFocus(ctx)),
  },
  {
    id: "confirm_delete", title: "Confirm the pending Trash", default: "shift+y",
    async run(ctx) {
      if (!(await readFinderStatus(ctx)).confirming) return;
      await ctx.dispatch(cliItem(ctx, "trash-confirm", TRASH_CONFIRMED_CMD));
    },
  },
  {
    id: "cancel_delete", title: "Cancel the pending Trash", default: "n",
    async run(ctx) {
      if (!(await readFinderStatus(ctx)).confirming) return;
      await ctx.dispatch(cliItem(ctx, "trash-cancel", TRASH_CANCEL_CMD));
    },
  },
];
