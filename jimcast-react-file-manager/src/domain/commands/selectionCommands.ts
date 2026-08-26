// src/domain/commands/selectionCommands.ts
//
// "deselect <name>" is dropped: the real workspace has no single-item
// toggle-off by name, only toggleFocusedSelection (focused item only),
// selectAllInColumn, and clearSelection. Adding one would mean growing
// the workspace hook further — flagging it rather than inventing it.

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { FileExplorerWorkspace } from "../../presentation/hooks/useFileExplorerWorkspace";
import { resolveEntryTarget } from "./resolveEntryTarget";

export function buildSelectionCommands(
  workspace: FileExplorerWorkspace,
  notify: (f: Feedback) => void,
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
  ];
}
