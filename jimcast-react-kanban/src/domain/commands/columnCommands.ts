// [plugins] jimcast-react-kanban/src/domain/commands/columnCommands.ts
//
// New for Phase A #2: columns were previously fixed to DEFAULT_COLUMNS with
// no way to add/rename/reorder/delete one, webview OR CLI. `:focus` moved
// here from the old kanbanCommands.ts unchanged (it's column-shaped, just
// wasn't previously grouped with the other column ops).
//
// rename-column uses a `<target> :: <new title>` separator rather than
// space-splitting, since both the target (a column title) and the new
// title are free text that may contain spaces — same ambiguity problem
// rename-card doesn't have (it always targets the *focused* card, no
// separate lookup argument).

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { KanbanWorkspace } from "../../hooks/useKanbanWorkspace";

export function buildColumnCommands(
  workspace: KanbanWorkspace,
  notify: (f: Feedback) => void,
): CommandLineRegistry {
  return [
    {
      name: "new-column",
      aliases: ["nc"],
      usage: "new-column <title>",
      run: ({ rest }) => {
        if (!workspace.currentBoard) return { ok: false, message: "No board open" };
        if (!rest.trim()) return { ok: false, message: "Usage: new-column <title>" };
        const column = workspace.createColumn(rest.trim());
        return { ok: true, message: column ? `Added column "${column.title}"` : "Added column" };
      },
    },
    {
      name: "rename-column",
      aliases: ["rc"],
      usage: "rename-column <name|#> :: <new title>",
      run: ({ rest }) => {
        if (!workspace.currentBoard) return { ok: false, message: "No board open" };
        if (!rest.includes("::")) return { ok: false, message: "Usage: rename-column <name|#> :: <new title>" };
        const [targetArg, ...titleParts] = rest.split("::");
        const title = titleParts.join("::").trim();
        const target = workspace.resolveColumnTarget(targetArg.trim());
        if (!target) return { ok: false, message: `No column found for "${targetArg.trim()}"` };
        if (!title) return { ok: false, message: "Usage: rename-column <name|#> :: <new title>" };
        workspace.renameColumn(target.id, title);
        return { ok: true, message: `Renamed column to "${title}"` };
      },
    },
    {
      name: "delete-column",
      aliases: ["dc"],
      usage: "delete-column [name|#]",
      run: ({ rest }) => {
        if (!workspace.currentBoard) return { ok: false, message: "No board open" };
        const target = workspace.resolveColumnTarget(rest);
        if (!target) return { ok: false, message: `No column found for "${rest}"` };
        return {
          confirm: true,
          message: `Delete column "${target.title}" and all ${target.cards.length} card(s) in it? y/n`,
          onConfirm: () => {
            workspace.deleteColumn(target.id);
            notify({ type: "ok", text: `Deleted column "${target.title}"` });
          },
          onCancel: () => notify({ type: "ok", text: "Delete cancelled" }),
        };
      },
    },
    {
      name: "move-column",
      aliases: ["mc"],
      usage: "move-column left|right [name|#]",
      run: ({ rest }) => {
        if (!workspace.currentBoard) return { ok: false, message: "No board open" };
        const [dirArg, ...targetParts] = rest.trim().split(/\s+/);
        const dir = dirArg?.toLowerCase();
        if (dir !== "left" && dir !== "right") {
          return { ok: false, message: "Usage: move-column left|right [name|#]" };
        }
        const target = workspace.resolveColumnTarget(targetParts.join(" "));
        if (!target) return { ok: false, message: "No column focused or matched" };
        workspace.moveColumn(target.id, dir);
        return { ok: true, message: `Moved column "${target.title}" ${dir}` };
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
  ];
}
