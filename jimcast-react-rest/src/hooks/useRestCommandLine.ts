// [plugins] jimcast-react-rest/src/hooks/useRestCommandLine.ts

import { useMemo, useRef } from "react";
import { useCommandLine, type CommandLineRegistry, type Feedback } from "@jimcast/react-sdk/react";
import type { RestWorkspace } from "./useRestWorkspace";
import { buildRestCommands } from "../domain/restCommands";

/**
 * notifyRef indirection avoids a declaration-order problem: buildRestCommands
 * needs a notify function for its onConfirm/onCancel callbacks, but those
 * callbacks only run later (on user confirm), so the ref is populated with
 * cli.notify right after cli exists, and the closures read through it.
 */
export function useRestCommandLine(workspace: RestWorkspace) {
  const notifyRef = useRef<(f: Feedback) => void>(() => {});
  const commands: CommandLineRegistry = useMemo(
    () => buildRestCommands(workspace, (f) => notifyRef.current(f)),
    [workspace.requests, workspace.selectedRequest],
  );
  const cli = useCommandLine(commands);
  notifyRef.current = cli.notify;
  return cli;
}
