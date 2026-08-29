// [plugins] jimcast-react-file-manager/src/domain/fileManagerCommands.ts
//
// Composer, ported directly from kanbanCommands.ts. Same shape: compose the
// domain-split modules, thread openHelp through to buildUtilityCommands,
// fall back to the joined-usage toast if openHelp isn't wired.

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { FileManagerWorkspace } from "../presentation/hooks/useFileManagerWorkspace";
import { buildNavigationCommands } from "./commands/navigationCommands";
import { buildSelectionCommands } from "./commands/selectionCommands";
import { buildFileCommands } from "./commands/fileCommands";
import { buildUtilityCommands } from "./commands/utilityCommands";

export function buildFileManagerCommands(
  workspace: FileManagerWorkspace,
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
