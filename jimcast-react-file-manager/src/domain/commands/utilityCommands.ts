// src/domain/commands/utilityCommands.ts
//
// :search/:clear-search dropped — no searchActive/searchQuery state exists
// in this workspace (unlike kanban's, which had dead-but-present state to
// wire up). Adding search here means adding the state + a
// visibleEntries-side filter first, same lift kanban's got. toggle-hidden
// now calls the real setShowHidden setter directly (no
// workspace.toggleHidden — that never existed).

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { FileExplorerWorkspace } from "../../presentation/hooks/useFileExplorerWorkspace";

export function buildUtilityCommands(
  workspace: FileExplorerWorkspace,
  notify: (f: Feedback) => void,
  openHelp?: () => void,
  registrySummary?: () => string,
): CommandLineRegistry {
  const showHelp = () => {
    if (openHelp) {
      openHelp();
      return { ok: true, message: "Opened command reference" };
    }
    notify({ type: "ok", text: registrySummary ? registrySummary() : "Commands: (registry not wired up)" });
    return { ok: true, message: "Listing commands…" };
  };
  return [
    { name: "list", aliases: ["commands", "?"], usage: "list", run: showHelp },
    {
      name: "toggle-hidden",
      aliases: ["th"],
      usage: "toggle-hidden",
      run: () => {
        workspace.setShowHidden((h) => !h);
        return { ok: true, message: "Toggled hidden files" };
      },
    },
  ];
}
