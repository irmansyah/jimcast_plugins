// // [plugins] jimcast-react-file-manager/src/presentation/hooks/useFileManagerCommandLine.ts
//
// import { useMemo, useRef } from "react";
// import { useCommandLine, type CommandLineRegistry, type Feedback } from "@jimcast/react-sdk/react";
// import type { FileManagerWorkspace } from "./useFileManagerWorkspace";
// import { buildFileManagerCommands } from "../../domain/fileManagerCommands";
//
// export function useFileManagerCommandLine(workspace: FileManagerWorkspace) {
//   const notifyRef = useRef<(f: Feedback) => void>(() => {});
//   const commands: CommandLineRegistry = useMemo(
//     () => buildFileManagerCommands(workspace, (f) => notifyRef.current(f)),
//     [workspace.segments.join('\u0000'), workspace.multiSelected, workspace.focusedIndex],
//   );
//   const cli = useCommandLine(commands);
//   notifyRef.current = cli.notify;
//   return cli;
// }
