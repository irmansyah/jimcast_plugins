// jimcast-plugins/jimcast-external-file-manager/src/application/fileOpening.ts
//
// The "open these path(s)" decision the original component repeated at
// three call sites (openEntry's non-directory branch, handleRowDoubleClick,
// and the nav hook's onActivate): a single AV file goes to the system
// player, everything else goes through the host's default-app opener.
// Unified here instead of copy-pasted three times.
//
// Uses basename() rather than the raw entry name so it works uniformly
// whether the caller has a bare FileEntry.name (no separators, so
// basename is a no-op) or a full path (as onActivate did, working only
// from the selection Set<string> of full paths).

import { isAvFile, basename } from '../domain/fileSystemLogic'
import { openPaths, openWithSystemPlayer } from '../infrastructure/backendClient'

export function openSelection(paths: string[]): void {
  if (paths.length === 0) return
  if (paths.length === 1 && isAvFile(basename(paths[0]))) {
    void openWithSystemPlayer(paths[0])
    return
  }
  openPaths(paths)
}
