// jimcast-react-kanban-v2/src/domain/kanbanCommands.ts

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { KanbanWorkspace } from "../hooks/useKanbanWorkspace";
import { callHost } from "@jimcast/react-sdk/client";

export function buildKanbanCommands(
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
    {
      name: "focus",
      usage: "focus <column>",
      run: ({ rest }) => {
        if (!workspace.currentBoard) return { ok: false, message: "No board open" };
        const idx = workspace.columns.findIndex((c) => c.title.toLowerCase() === rest.trim().toLowerCase());
        if (idx === -1) return { ok: false, message: `No such column "${rest}"` };
        const delta = idx - workspace.focusedColumnIndex;
        const dir = delta < 0 ? "left" : "right";
        for (let i = 0; i < Math.abs(delta); i++) workspace.moveFocus(dir);
        return { ok: true, message: `Focused "${rest}"` };
      },
    },
    {
      name: "new",
      aliases: ["n"],
      usage: "new <title>",
      run: ({ rest }) => {
        if (!workspace.currentBoard) return { ok: false, message: "No board open" };
        if (!rest.trim()) return { ok: false, message: "Usage: new <title>" };
        workspace.newCardInFocusedColumn();
        const card = workspace.submitNewCard(rest.trim());
        return { ok: true, message: card ? `Added "${card.title}"` : "Added card" };
      },
    },
    {
      name: "delete",
      aliases: ["d"],
      usage: "delete [title|#]",
      run: ({ rest }) => {
        const target = workspace.resolveCardTarget(rest);
        if (!target) return { ok: false, message: `No card found for "${rest}"` };
        return {
          confirm: true,
          message: `Delete "${target.title}"? y/n`,
          onConfirm: () => {
            workspace.confirmDeleteCard(target.id);
            notify({ type: "ok", text: `Deleted "${target.title}"` });
          },
          onCancel: () => notify({ type: "ok", text: "Delete cancelled" }),
        };
      },
    },
    {
      name: "move",
      aliases: ["m"],
      usage: "move left|right",
      run: ({ rest }) => {
        const dir = rest.trim().toLowerCase();
        if (dir !== "left" && dir !== "right") return { ok: false, message: "Usage: move left|right" };
        if (!workspace.focusedCard) return { ok: false, message: "No card focused" };
        workspace.moveFocusedCard(dir);
        return { ok: true, message: `Moved "${workspace.focusedCard.title}" ${dir}` };
      },
    },
    {
      name: "rename",
      usage: "rename <title>",
      run: ({ rest }) => {
        if (!workspace.focusedCard) return { ok: false, message: "No card focused" };
        if (!rest.trim()) return { ok: false, message: "Usage: rename <title>" };
        workspace.renameFocusedCard(rest.trim());
        return { ok: true, message: "Renamed" };
      },
    },
  ];
}
