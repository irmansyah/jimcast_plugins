// [plugins] jimcast-react-file-manager/src/domain/commands/fileCommands.ts
//
// delete/rename/run use the new performRenameWith/performShellCommandWith
// (paths passed explicitly) instead of the state-driven originals, to
// avoid the setState-then-immediate-call race. rename/run notify() on
// completion rather than blocking the CLI, same pattern as kanban's
// list-boards.

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { FileManagerWorkspace } from "../../presentation/hooks/useFileManagerWorkspace";
import { resolveEntryTarget } from "./resolveEntryTarget";

export function buildFileCommands(
  workspace: FileManagerWorkspace,
  notify: (f: Feedback) => void,
): CommandLineRegistry {
  return [
    {
      name: "delete",
      aliases: ["d"],
      usage: "delete [name|#]",
      run: ({ rest }) => {
        let count = workspace.multiSelected.size;
        if (rest.trim()) {
          const target = resolveEntryTarget(workspace, rest);
          if (!target) return { ok: false, message: `No entry found for "${rest}"` };
          workspace.selectEntry(target.index);
          count = 1;
        }
        if (count === 0) return { ok: false, message: "Nothing selected" };
        return {
          confirm: true,
          message: `Delete ${count} item(s)? y/n`,
          onConfirm: async () => {
            await workspace.performDelete();
            notify({ type: "ok", text: `Deleted ${count} item(s)` });
          },
          onCancel: () => notify({ type: "ok", text: "Delete cancelled" }),
        };
      },
    },
    {
      name: "rename",
      aliases: ["r"],
      usage: "rename <name|#> :: <new name>",
      run: ({ rest }) => {
        if (!rest.includes("::")) return { ok: false, message: "Usage: rename <name|#> :: <new name>" };
        const [targetArg, ...nameParts] = rest.split("::");
        const newName = nameParts.join("::").trim();
        const target = resolveEntryTarget(workspace, targetArg.trim());
        if (!target) return { ok: false, message: `No entry found for "${targetArg.trim()}"` };
        if (!newName) return { ok: false, message: "Usage: rename <name|#> :: <new name>" };
        workspace
          .performRenameWith(target.path, newName)
          .then(() => notify({ type: "ok", text: `Renamed to "${newName}"` }))
          .catch((e) => notify({ type: "ok", text: `Rename failed: ${e instanceof Error ? e.message : String(e)}` }));
        return { ok: true, message: `Renaming to "${newName}"…` };
      },
    },
    {
      name: "run",
      usage: "run <shell command>",
      run: ({ rest }) => {
        if (!rest.trim()) return { ok: false, message: "Usage: run <shell command>" };
        const paths = Array.from(workspace.multiSelected);
        const cmd = rest.trim();
        workspace
          .performShellCommandWith(cmd, paths)
          .then(() => notify({ type: "ok", text: `Ran "${cmd}"` }))
          .catch((e) => notify({ type: "ok", text: `Command failed: ${e instanceof Error ? e.message : String(e)}` }));
        return { ok: true, message: `Running "${cmd}"…` };
      },
    },
  ];
}
