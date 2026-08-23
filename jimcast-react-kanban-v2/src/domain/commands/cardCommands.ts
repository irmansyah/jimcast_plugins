// jimcast-react-kanban-v2/src/domain/commands/cardCommands.ts
//
// new/delete/move/rename carried over unchanged from the old monolithic
// kanbanCommands.ts (Phase A #3 split). archive/unarchive/archived are new
// for Phase A #2 — soft-delete as an alternative to :delete, per the
// carry-forward doc's open question ("archive/unarchive if delete should
// be soft"). Both now exist: :delete is still a hard, confirmed removal;
// :archive is the soft, unconfirmed alternative.

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { KanbanWorkspace } from "../../hooks/useKanbanWorkspace";

export function buildCardCommands(
  workspace: KanbanWorkspace,
  notify: (f: Feedback) => void,
): CommandLineRegistry {
  return [
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
    {
      name: "archive",
      usage: "archive",
      run: () => {
        if (!workspace.focusedCard) return { ok: false, message: "No card focused" };
        const title = workspace.focusedCard.title;
        workspace.archiveFocusedCard();
        return { ok: true, message: `Archived "${title}"` };
      },
    },
    {
      name: "unarchive",
      usage: "unarchive [title|#]",
      run: ({ rest }) => {
        const target = workspace.resolveArchivedCardTarget(rest);
        if (!target) return { ok: false, message: rest ? `No archived card found for "${rest}"` : "Nothing archived" };
        workspace.unarchiveCard(target.id);
        return { ok: true, message: `Unarchived "${target.title}"` };
      },
    },
    {
      name: "archived",
      usage: "archived",
      run: () => {
        const cards = workspace.archivedCards();
        notify({
          type: "ok",
          text: cards.length ? `Archived: ${cards.map((c) => c.title).join(", ")}` : "No archived cards",
        });
        return { ok: true, message: "Listing archived cards…" };
      },
    },
  ];
}
