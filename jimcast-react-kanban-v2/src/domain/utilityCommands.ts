// jimcast-react-kanban-v2/src/domain/commands/utilityCommands.ts
//
// New for Phase A: :search/:clear-search wire up the previously-dead
// searchActive/searchQuery state (set by focusSearch()/`/` but never read
// anywhere — see useKanbanWorkspace.ts's visibleColumns).
//
// :list/:commands/:? previously dumped the whole registry as one joined
// notify() toast, which doesn't read well past ~5 commands (Phase A #1).
// They now open the extended HelpModal (keymap + command reference)
// instead — see HelpModal.tsx and the kanbanCommands.ts composition below
// for how `openHelp` gets threaded in. If `openHelp` isn't wired up yet
// (see HANDOFF.md), these fall back to the old toast behavior so nothing
// breaks in the meantime.

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { KanbanWorkspace } from "../../hooks/useKanbanWorkspace";

export function buildUtilityCommands(
  workspace: KanbanWorkspace,
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
    {
      name: "list",
      aliases: ["commands", "?"],
      usage: "list",
      run: showHelp,
    },
    {
      name: "search",
      usage: "search <query>",
      run: ({ rest }) => {
        if (!workspace.currentBoard) return { ok: false, message: "No board open" };
        if (!rest.trim()) return { ok: false, message: "Usage: search <query>" };
        workspace.runSearch(rest.trim());
        return { ok: true, message: `Searching for "${rest.trim()}"` };
      },
    },
    {
      name: "clear-search",
      aliases: ["cs"],
      usage: "clear-search",
      run: () => {
        workspace.clearSearch();
        return { ok: true, message: "Search cleared" };
      },
    },
  ];
}
