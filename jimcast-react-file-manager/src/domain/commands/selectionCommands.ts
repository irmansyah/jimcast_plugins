// [plugins] jimcast-react-file-manager/src/domain/commands/selectionCommands.ts
//
// "deselect <name>" is dropped: the real workspace has no single-item
// toggle-off by name, only toggleFocusedSelection (focused item only),
// selectAllInColumn, and clearSelection. Adding one would mean growing
// the workspace hook further — flagging it rather than inventing it.

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { FileManagerWorkspace } from "../../presentation/hooks/useFileManagerWorkspace";
import { resolveEntryTarget } from "./resolveEntryTarget";

export function buildSelectionCommands(
  workspace: FileManagerWorkspace,
  _notify: (f: Feedback) => void,

): CommandLineRegistry {
  return [
    {
      name: "select",
      aliases: ["s"],
      usage: "select <name|#>",
      run: ({ rest }) => {
        const target = resolveEntryTarget(workspace, rest);
        if (!target) return { ok: false, message: `No entry found for "${rest}"` };
        workspace.selectEntry(target.index);
        return { ok: true, message: `Selected "${target.entry.name}"` };
      },
    },
    {
      name: "select-all",
      aliases: ["sa"],
      usage: "select-all",
      run: () => {
        workspace.selectAllInColumn();
        return { ok: true, message: "Selected all in column" };
      },
    },
    {
      name: "selected",
      aliases: ["ls-sel"],
      usage: "selected",
      run: () => {
        const paths = Array.from(workspace.multiSelected)
        if (paths.length === 0) return { ok: false, message: "Nothing selected" }
        return { ok: true, message: paths.join('\n') }
      },
    },
    {
      name: "clear-selection",
      aliases: ["cs"],
      usage: "clear-selection",
      run: () => {
        workspace.clearSelection();
        return { ok: true, message: "Selection cleared" };
      },
    },
    {
      name: "copy",
      aliases: ["cp"],
      usage: "copy",
      run: () => {
        if (workspace.multiSelected.size === 0) return { ok: false, message: "Nothing selected" };
        const n = workspace.multiSelected.size;
        workspace.copySelectedPaths();
        return { ok: true, message: `Copied ${n} path(s)` };
      },
    },
    {
      name: "select-match",
      aliases: ["sm"],
      usage: "select-match <glob>",
      run: ({ rest }) => {
        const pattern = rest.trim()
        if (!pattern) return { ok: false, message: "Usage: select-match <glob>" }
        const count = workspace.selectMatchingInColumn(pattern)
        if (count === 0) return { ok: false, message: `No files match "${pattern}"` }
        return { ok: true, message: `Selected ${count} file(s) matching "${pattern}"` };
      },
    },
    {
      name: "open",
      aliases: ["o"],
      usage: "open <path> [path...]",
      run: ({ rest }) => {
        const paths = rest.trim().split(/\s+/).filter(Boolean)
        if (paths.length === 0) return { ok: false, message: "Usage: open <path> [path...]" }
        workspace.selectAndOpenPaths(paths)
        return { ok: true, message: `Opened and selected ${paths.length} file(s)` }
      },
    },
  ];
}
