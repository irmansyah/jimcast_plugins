// src/domain/fileExplorerCommands.ts
//
// Composer, ported directly from kanbanCommands.ts. Same shape: compose the
// domain-split modules, thread openHelp through to buildUtilityCommands,
// fall back to the joined-usage toast if openHelp isn't wired.

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { FileExplorerWorkspace } from "../presentation/hooks/useFileExplorerWorkspace";
import { buildNavigationCommands } from "./commands/navigationCommands";
import { buildSelectionCommands } from "./commands/selectionCommands";
import { buildFileCommands } from "./commands/fileCommands";
import { buildUtilityCommands } from "./commands/utilityCommands";

export function buildFileExplorerCommands(
  workspace: FileExplorerWorkspace,
  notify: (f: Feedback) => void,
  openHelp?: () => void,
): CommandLineRegistry {
  const registry: CommandLineRegistry = [
    ...buildNavigationCommands(workspace, notify),
    ...buildSelectionCommands(workspace, notify),
    ...buildFileCommands(workspace, notify),
    ...buildUtilityCommands(workspace, notify, openHelp, () => summarize(registry)),
  ];
  return registry;
}

function summarize(registry: CommandLineRegistry): string {
  return registry.map((c) => c.usage).join("  ·  ");
}
