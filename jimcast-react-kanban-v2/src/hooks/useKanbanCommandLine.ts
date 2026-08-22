import { useMemo, useRef } from "react";
import { useCommandLine, type CommandLineRegistry, type Feedback } from "@jimcast/react-sdk/react";
import type { KanbanWorkspace } from "./useKanbanWorkspace";
import { buildKanbanCommands } from "../domain/kanbanCommands";

/**
 * notifyRef indirection avoids a declaration-order problem: buildKanbanCommands
 * needs a notify function for its onConfirm/onCancel callbacks, but those
 * callbacks only run later (on user confirm), so the ref is populated with
 * cli.notify right after cli exists, and the closures read through it.
 */
export function useKanbanCommandLine(workspace: KanbanWorkspace) {
  const notifyRef = useRef<(f: Feedback) => void>(() => {});
  const commands: CommandLineRegistry = useMemo(
    () => buildKanbanCommands(workspace, (f) => notifyRef.current(f)),
    [workspace.state, workspace.currentBoardId, workspace.focusedColumnIndex, workspace.focusedCardIndex],
  );
  const cli = useCommandLine(commands);
  notifyRef.current = cli.notify;
  return cli;
}
