// src/domain/commands/navigationCommands.ts
//
// Only what the real workspace supports: goUp() and jumpToCrumb(colIndex).
// There's no arbitrary-path navigateTo — jumpToCrumb(0) doubles as "home"
// since segments always starts with '~'.

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { FileExplorerWorkspace } from "../../presentation/hooks/useFileExplorerWorkspace";
import { resolveEntryTarget } from "./resolveEntryTarget";

export function buildNavigationCommands(
  workspace: FileExplorerWorkspace,
  notify: (f: Feedback) => void,
): CommandLineRegistry {
  return [
    {
      name: "up",
      usage: "up",
      run: () => {
        if (workspace.segments.length <= 1) return { ok: false, message: "Already at root" };
        workspace.goUp();
        return { ok: true, message: "Moved up one level" };
      },
    },
    {
      name: "home",
      usage: "home",
      run: () => {
        workspace.jumpToCrumb(0);
        return { ok: true, message: "Jumped to home" };
      },
    },
    {
      name: "open",
      aliases: ["o"],
      usage: "open <name|#>",
      run: ({ rest }) => {
        const target = resolveEntryTarget(workspace, rest);
        if (!target) return { ok: false, message: `No entry found for "${rest}"` };
        workspace.openEntry(workspace.columns.length - 1, target.entry);
        return { ok: true, message: `Opening "${target.entry.name}"` };
      },
    },
  ];
}
