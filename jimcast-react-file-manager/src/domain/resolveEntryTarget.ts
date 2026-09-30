// [plugins] jimcast-react-file-manager/src/domain/resolveEntryTarget.ts
//
// Shared helper the CLI commands use to turn "<name|#>" typed text into an
// actual entry in the focused (last) column. Not a workspace method — it
// only reads state (workspace.columns/showHidden/segments/homeDir), same
// as domain/selectionLogic.ts's existing functions, so it lives alongside
// them rather than growing the workspace hook's surface for something
// read-only.

import { entryFullPath, visibleEntries } from "./fileSystemLogic";
import type { FileManagerWorkspace } from "../presentation/hooks/useFileManagerWorkspace"
import type { FileEntry } from "../types"

export function resolveEntryTarget(
  workspace: FileManagerWorkspace,
  arg: string,
): { entry: FileEntry; index: number; path: string } | null {
  const cols = workspace.columns;
  const lastCol = cols[cols.length - 1];
  if (!lastCol || lastCol.loading || lastCol.error) return null;
  const trimmed = arg.trim();
  if (!trimmed) return null;
  const visible = visibleEntries(lastCol, cols.length - 1, workspace.showHidden);

  const idx = /^\d+$/.test(trimmed)
    ? parseInt(trimmed, 10) - 1
    : visible.findIndex((e) => e.name.toLowerCase() === trimmed.toLowerCase());

  const entry = visible[idx];
  if (!entry) return null;
  const path = entryFullPath(workspace.segments.slice(0, cols.length), entry.name, workspace.homeDir);
  return { entry, index: idx, path };
}
