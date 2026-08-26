// src/presentation/hooks/useFileExplorerCommandLine.ts

import { useMemo, useRef } from "react";
import { useCommandLine, type CommandLineRegistry, type Feedback } from "@jimcast/react-sdk/react";
import type { FileExplorerWorkspace } from "./useFileExplorerWorkspace";
import { buildFileExplorerCommands } from "../../domain/fileExplorerCommands";

export function useFileExplorerCommandLine(workspace: FileExplorerWorkspace) {
  const notifyRef = useRef<(f: Feedback) => void>(() => {});
  const commands: CommandLineRegistry = useMemo(
    () => buildFileExplorerCommands(workspace, (f) => notifyRef.current(f)),
    [workspace.segments.join('\u0000'), workspace.multiSelected, workspace.focusedIndex],
  );
  const cli = useCommandLine(commands);
  notifyRef.current = cli.notify;
  return cli;
}
