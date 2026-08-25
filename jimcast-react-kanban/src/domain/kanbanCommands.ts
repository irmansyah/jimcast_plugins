// jimcast-react-kanban/src/domain/kanbanCommands.ts
//
// Phase A #3: this used to be one flat ~250-line function. Now it just
// composes the four split-out modules in domain/commands/. Behavior for
// every pre-existing command (list-boards, new-board/nb, delete-board/db,
// board/b, focus, new/n, delete/d, move/m, rename) is unchanged — this is
// a pure relocation for those. New commands (:new-column and friends,
// :archive/:unarchive/:archived, :search/:clear-search, and :list/:commands/
// :? now opening the help modal) live in their respective new modules.
//
// `openHelp` is optional and threaded straight through to
// buildUtilityCommands — see that file's header comment and HANDOFF.md for
// what still needs wiring in App.tsx to actually open the modal instead of
// falling back to a toast.

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { KanbanWorkspace } from "../hooks/useKanbanWorkspace";
import { buildBoardCommands } from "./commands/boardCommands";
import { buildCardCommands } from "./commands/cardCommands";
import { buildColumnCommands } from "./commands/columnCommands";
import { buildUtilityCommands } from "./commands/utilityCommands";

export function buildKanbanCommands(
  workspace: KanbanWorkspace,
  notify: (f: Feedback) => void,
  openHelp?: () => void,
): CommandLineRegistry {
  const registry: CommandLineRegistry = [
    ...buildBoardCommands(workspace, notify),
    ...buildColumnCommands(workspace, notify),
    ...buildCardCommands(workspace, notify),
    ...buildUtilityCommands(workspace, notify, openHelp, () => summarize(registry)),
  ];
  return registry;
}

// Fallback toast text for :list/:commands/:? when openHelp isn't wired up
// yet — same "joined line" shape the original had, just factored out so
// utilityCommands.ts doesn't need to know the full registry itself.
function summarize(registry: CommandLineRegistry): string {
  return registry.map((c) => c.usage).join("  ·  ");
}
