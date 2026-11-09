// [plugin] jimcast-external-finder/src/commands.ts
//
// CLI (`jimcast widget command xfinder <command> ...`) and key actions.
// Port of core's FINDER_COMMANDS / FINDER_KEY_ACTIONS. Everything goes through
// ctx.dispatch, so the Finder re-renders exactly as if the row or button had
// been selected.

import type {
  ExecutionContext,
  WidgetCliCommand,
  WidgetCliContext,
  WidgetKeyAction,
  WidgetKeyContext,
} from "@jimcast/sdk";
import {
  CLEAR_MARKS_CMD,
  LEFT_CMD,
  MARK_CMD,
  PASTE_CMD,
  RIGHT_CMD,
  SELECT_CMD,
  TOGGLE_HIDDEN_CMD,
  TOGGLE_MARK_CMD,
  TRASH_ASK_CMD,
  TRASH_CANCEL_CMD,
  TRASH_CONFIRMED_CMD,
  UNMARK_CMD,
  ZIP_MARKED_CMD,
  parentOf,
  readStatus,
  shq,
  yankCmd,
} from "./shell.js";
import { ROW, cliItem, rowPathOf } from "./render.js";

// ═══ CLI ════════════════════════════════════════════════════════════════════

// Relative paths resolve against the CALLER's cwd (ctx.cwd). `~` and globs are
// expanded by the user's shell before they get here. Symlinks are not resolved:
// the Finder tracks paths exactly as `ls` shows them, and marks match as strings.
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
    const r = await ctx.exec(`test -e ${shq(p)}`);
    if (r.exitCode !== 0) throw new Error(`no such file or directory: ${p}`);
  }
  return abs;
}

const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));
const hasFlag = (ctx: WidgetCliContext, f: string) => ctx.args.includes(f);

/** Given paths, else the current selection (never $HOME itself). */
async function targetsOrSelection(ctx: WidgetCliContext): Promise<string[]> {
  const given = positional(ctx);
  if (given.length) return existingPaths(ctx, given);
  const st = await readStatus(ctx);
  if (st.selected === st.home) throw new Error("nothing is selected — pass a path");
  return [st.selected];
}

async function needMarks(ctx: WidgetCliContext) {
  const st = await readStatus(ctx);
  if (!st.marked.length) throw new Error("nothing is marked — run `xfinder mark <path>` first");
  return st;
}

const markedCount = async (ctx: ExecutionContext) => `${(await readStatus(ctx)).marked.length} marked`;

const selectCommand: WidgetCliCommand = {
  id: "select", args: ["path"], title: "Select a file or folder (the columns follow, like a click)",
  async run(ctx) {
    if (!positional(ctx)[0]) throw new Error("select needs a path");
    const [p] = await existingPaths(ctx, [positional(ctx)[0]]);
    await ctx.dispatch(cliItem(ctx, "select", SELECT_CMD, p), { focus: { id: `${ROW}${p}` } });
    return `Selected ${p}`;
  },
};

export const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "status", title: "Selected path and marked paths", description: "--json for machine-readable output",
    async run(ctx) {
      const st = await readStatus(ctx);
      if (hasFlag(ctx, "--json")) {
        return {
          home: st.home, selected: st.selected, isDir: st.isDir, marked: st.marked,
          confirming: st.confirming, showHidden: st.showHidden,
        };
      }
      return [
        `selected  ${st.selected}`,
        `hidden    ${st.showHidden ? "shown" : "hidden"}`,
        st.marked.length ? `marked    ${st.marked.length}` : "marked    (none)",
        ...st.marked.map((m) => `  ${m}`),
        ...(st.confirming ? ["trash     waiting — `xfinder trash --yes` or `--cancel`"] : []),
      ].join("\n");
    },
  },
  { id: "path",   title: "Print the selected path",              run: async (ctx) => (await readStatus(ctx)).selected },
  { id: "marked", title: "Print the marked paths, one per line", run: async (ctx) => (await readStatus(ctx)).marked.join("\n") },

  selectCommand,
  { ...selectCommand, id: "cd", title: "Alias of select" },
  {
    id: "up", args: ["[path]"], title: "Select the parent (the Left key)",
    async run(ctx) {
      const [given] = positional(ctx);
      const p = given ? (await existingPaths(ctx, [given]))[0] : (await readStatus(ctx)).selected;
      await ctx.dispatch(cliItem(ctx, "up", LEFT_CMD, p), { focus: { id: `${ROW}${parentOf(p)}` } });
      return `Selected ${(await readStatus(ctx)).selected}`;
    },
  },
  {
    id: "enter", args: ["[path]"], title: "Go into the folder: select its first entry (the Right key)",
    async run(ctx) {
      const [given] = positional(ctx);
      const p = given ? (await existingPaths(ctx, [given]))[0] : (await readStatus(ctx)).selected;
      await ctx.dispatch(cliItem(ctx, "enter", RIGHT_CMD, p), { focus: { id: `${ROW}${p}`, prefix: `${ROW}${p}/` } });
      return `Selected ${(await readStatus(ctx)).selected}`;
    },
  },

  {
    id: "hidden", title: "Toggle showing hidden files",
    async run(ctx) {
      await ctx.dispatch(cliItem(ctx, "hidden", TOGGLE_HIDDEN_CMD));
      return (await readStatus(ctx)).showHidden ? "Hidden files: shown" : "Hidden files: hidden";
    },
  },

  {
    id: "mark", args: ["[paths...]"], title: "Mark paths (default: the selection). Safe to repeat.",
    async run(ctx) {
      for (const p of await targetsOrSelection(ctx)) await ctx.dispatch(cliItem(ctx, "mark", MARK_CMD, p));
      return markedCount(ctx);
    },
  },
  {
    id: "unmark", args: ["[paths...]"], title: "Unmark paths (default: the selection)",
    async run(ctx) {
      for (const p of await targetsOrSelection(ctx)) await ctx.dispatch(cliItem(ctx, "unmark", UNMARK_CMD, p));
      return markedCount(ctx);
    },
  },
  {
    id: "toggle", args: ["[paths...]"], title: "Toggle marks, like Space (default: the selection)",
    async run(ctx) {
      for (const p of await targetsOrSelection(ctx)) await ctx.dispatch(cliItem(ctx, "toggle", TOGGLE_MARK_CMD, p));
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
      if ((await readStatus(ctx)).marked.length) throw new Error("zip failed — the items are still marked");
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
      // Ask + confirm in one script: the confirm half still re-checks the
      // timestamp and the marks, exactly like the two-click UI flow.
      await ctx.dispatch(cliItem(ctx, "trash", `${TRASH_ASK_CMD}\n${TRASH_CONFIRMED_CMD}`));
      if ((await readStatus(ctx)).marked.length) throw new Error("trash failed — the items are still marked");
      return "Moved the marked items to the Trash.";
    },
  },

  {
    id: "open", args: ["[path]"], title: "Open in this Finder (shows the bar)",
    description: "A folder shows its contents, a file shows its preview. `launch` opens with the default app instead.",
    async run(ctx) {
      const [given] = positional(ctx);
      const p = given ? (await existingPaths(ctx, [given]))[0] : (await readStatus(ctx)).selected;
      const isDir = (await ctx.exec(`test -d ${shq(p)}`)).exitCode === 0;

      // Select first (also covers an empty folder, where "enter" has nothing to pick),
      // then step into a folder so its contents become the centre column.
      await ctx.dispatch(cliItem(ctx, "open-select", SELECT_CMD, p), { focus: { id: `${ROW}${p}` } });
      if (isDir) {
        await ctx.dispatch(cliItem(ctx, "open-enter", RIGHT_CMD, p), { focus: { id: `${ROW}${p}`, prefix: `${ROW}${p}/` } });
      }
      ctx.showBar();
      return `Opened ${p}`;
    },
  },
  {
    id: "launch", args: ["[paths...]"], title: "Open with the default macOS app (default: the selection)",
    async run(ctx) {
      for (const p of await targetsOrSelection(ctx)) await ctx.exec(`open ${shq(p)}`);
      return null;
    },
  },
  {
    id: "reveal", args: ["[paths...]"], title: "Reveal in macOS Finder (default: the selection)",
    async run(ctx) {
      for (const p of await targetsOrSelection(ctx)) await ctx.exec(`open -R ${shq(p)}`);
      return null;
    },
  },
];

// ═══ Keys ═══════════════════════════════════════════════════════════════════
// Active only while this Finder is the open panel. Remap per action in
// "key_bindings.xfinder" of config_section.json (per profile) or config.json.
//
// Core's built-in Finder also has Space / Left / Right and a cursor-follow live
// preview, but those are hard-wired to its own `fm:` ids. Here they are plain
// key actions (mark, up_dir, enter_dir, select), and the preview follows the
// SELECTION, not the cursor: press Enter on a folder, or `p` on any row.

/** Keep the cursor on the same row after the re-render. */
const keepFocus = (ctx: WidgetKeyContext) =>
  ctx.focusedItemId ? { focus: { id: ctx.focusedItemId } } : undefined;

/** Cursor row, else the live selection (never $HOME itself). */
async function keyTarget(ctx: WidgetKeyContext): Promise<string | null> {
  const row = rowPathOf(ctx.focusedItemId);
  if (row) return row;
  const st = await readStatus(ctx);
  return st.selected === st.home ? null : st.selected;
}

/** The folder shown in the path bar: parent of the selection (same rule as render). */
async function pasteDir(ctx: WidgetKeyContext): Promise<string> {
  const st = await readStatus(ctx);
  const base = st.selected === st.home || st.selected.startsWith(st.home + "/") ? st.home : "/";
  return st.selected === base ? base : parentOf(st.selected);
}

export const KEY_ACTIONS: WidgetKeyAction[] = [
  {
    id: "mark", title: "Mark / unmark the row under the cursor", default: "space",
    async run(ctx) {
      const p = rowPathOf(ctx.focusedItemId);
      if (!p) return;
      await ctx.dispatch(cliItem(ctx, "mark-row", TOGGLE_MARK_CMD, p), keepFocus(ctx));
    },
  },
  {
    id: "select", title: "Select the row under the cursor (shows its preview)", default: "p",
    async run(ctx) {
      const p = rowPathOf(ctx.focusedItemId);
      if (!p) return;
      await ctx.dispatch(cliItem(ctx, "select-row", SELECT_CMD, p), keepFocus(ctx));
    },
  },
  {
    id: "up_dir", title: "Select the parent folder", default: "left",
    async run(ctx) {
      const p = await keyTarget(ctx);
      if (!p) return;
      await ctx.dispatch(cliItem(ctx, "up", LEFT_CMD, p), { focus: { id: `${ROW}${parentOf(p)}` } });
    },
  },
  {
    id: "enter_dir", title: "Folder: select its first entry. File: select it", default: "right",
    async run(ctx) {
      const p = await keyTarget(ctx);
      if (!p) return;
      await ctx.dispatch(cliItem(ctx, "enter", RIGHT_CMD, p), { focus: { id: `${ROW}${p}`, prefix: `${ROW}${p}/` } });
    },
  },
  {
    id: "toggle_hidden", title: "Show / hide hidden files", default: "shift+h",
    run: (ctx) => ctx.dispatch(cliItem(ctx, "toggle-hidden", TOGGLE_HIDDEN_CMD), keepFocus(ctx)),
  },
  {
    id: "copy", title: "Copy marked (or the row under the cursor)", default: "c",
    async run(ctx) {
      await ctx.dispatch(cliItem(ctx, "copy", yankCmd("copy"), (await keyTarget(ctx)) ?? ""), keepFocus(ctx));
    },
  },
  {
    id: "move", title: "Cut marked (or the row); paste moves it", default: "x",
    async run(ctx) {
      await ctx.dispatch(cliItem(ctx, "cut", yankCmd("cut"), (await keyTarget(ctx)) ?? ""), keepFocus(ctx));
    },
  },
  {
    id: "paste", title: "Paste into the current folder", default: "v",
    async run(ctx) {
      await ctx.dispatch(cliItem(ctx, "paste", PASTE_CMD, await pasteDir(ctx)), keepFocus(ctx));
    },
  },
  {
    id: "delete", title: "Move to Trash (asks first)", default: "d",
    async run(ctx) {
      const st = await readStatus(ctx);
      if (st.marked.length) {
        await ctx.dispatch(cliItem(ctx, "trash-ask", TRASH_ASK_CMD), keepFocus(ctx));
        return;
      }
      const p = await keyTarget(ctx);
      if (!p) return;
      // Nothing marked: mark the row, then ask, in one script (one re-render).
      await ctx.dispatch(cliItem(ctx, "delete", `${MARK_CMD}\n${TRASH_ASK_CMD}`, p), keepFocus(ctx));
    },
  },
  {
    id: "zip", title: "Zip marked (or the row under the cursor)", default: "z",
    async run(ctx) {
      const st = await readStatus(ctx);
      if (st.marked.length) {
        await ctx.dispatch(cliItem(ctx, "zip", ZIP_MARKED_CMD), keepFocus(ctx));
        return;
      }
      const p = await keyTarget(ctx);
      if (!p) return;
      // Nothing marked: mark the row, then zip it, in one script.
      await ctx.dispatch(cliItem(ctx, "zip-row", `${MARK_CMD}\n${ZIP_MARKED_CMD}`, p), keepFocus(ctx));
    },
  },
  {
    id: "clear_marks", title: "Unmark everything", default: "u",
    run: (ctx) => ctx.dispatch(cliItem(ctx, "clear", CLEAR_MARKS_CMD), keepFocus(ctx)),
  },
  {
    id: "confirm_delete", title: "Confirm the pending Trash", default: "y",
    async run(ctx) {
      if (!(await readStatus(ctx)).confirming) return;
      await ctx.dispatch(cliItem(ctx, "trash-confirm", TRASH_CONFIRMED_CMD));
    },
  },
  {
    id: "cancel_delete", title: "Cancel the pending Trash", default: "n",
    async run(ctx) {
      if (!(await readStatus(ctx)).confirming) return;
      await ctx.dispatch(cliItem(ctx, "trash-cancel", TRASH_CANCEL_CMD));
    },
  },
];
