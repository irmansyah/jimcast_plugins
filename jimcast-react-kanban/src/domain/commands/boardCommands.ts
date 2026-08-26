// [plugins] jimcast-react-kanban/src/domain/commands/boardCommands.ts
//
// Split out of the old monolithic kanbanCommands.ts (Phase A #3). Board-level
// :list-boards/:new-board/:delete-board/:board only — unchanged behavior
// from before the split, just relocated.

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import { callHost } from "@jimcast/react-sdk/client";
import type { KanbanWorkspace } from "../../hooks/useKanbanWorkspace";

export function buildBoardCommands(
  workspace: KanbanWorkspace,
  notify: (f: Feedback) => void,
): CommandLineRegistry {
  return [
    {
      name: "list-boards",
      usage: "list-boards",
      run: () => {
        callHost<{ boards: string[] }>("list-boards", {})
          .then((result) => {
            notify({ type: "ok", text: result.boards.join(", ") || "No boards" });
          })
          .catch((e) => {
            notify({ type: "ok", text: `list-boards failed: ${e instanceof Error ? e.message : String(e)}` });
          });
        return { ok: true, message: "Loading boards…" };
      },
    },
    {
      name: "new-board",
      aliases: ["nb"],
      usage: "new-board <name>",
      run: ({ rest }) => {
        if (!rest.trim()) return { ok: false, message: "Usage: new-board <name>" };
        const board = workspace.createBoard(rest.trim());
        return { ok: true, message: `Created board "${board.name}"` };
      },
    },
    {
      name: "delete-board",
      aliases: ["db"],
      usage: "delete-board [name|#]",
      run: ({ rest }) => {
        const target = workspace.resolveBoardTarget(rest);
        if (!target) return { ok: false, message: `No board found for "${rest}"` };
        return {
          confirm: true,
          message: `Delete board "${target.name}"? y/n`,
          onConfirm: () => {
            workspace.deleteBoard(target.id);
            notify({ type: "ok", text: `Deleted board "${target.name}"` });
          },
          onCancel: () => notify({ type: "ok", text: "Delete cancelled" }),
        };
      },
    },
    {
      name: "board",
      aliases: ["b"],
      usage: "board <name|#>",
      run: ({ rest }) => {
        const target = workspace.resolveBoardTarget(rest);
        if (!target) return { ok: false, message: `No board found for "${rest}"` };
        workspace.selectBoard(target.id);
        return { ok: true, message: `Switched to "${target.name}"` };
      },
    },
  ];
}
