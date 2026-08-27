// jimcast-react-file-manager/src/application/fileOpening.ts
//
// The "open these path(s)" decision the original component repeated at
// three call sites (openEntry's non-directory branch, handleRowDoubleClick,
// and the nav hook's onActivate): a single video file goes to the OS's
// system player, everything else (images, audio, text, binary, and any
// multi-file selection) goes through openPaths -> callHost('openFiles', ...),
// which the host intercepts in QuickToolExternalWebview.tsx and opens in
// the in-app popup viewer (WidgetFileViewer). Unified here instead of
// copy-pasted three times.
//
// Audio used to be routed to the system player alongside video (the old
// combined AV_EXT/isAvFile check) but now goes through the in-app viewer,
// since useOpenFiles.ts on the host side classifies an 'audio' kind it
// knows how to render. Video has no viewer support yet, so it's the only
// kind still special-cased here.
//
// Uses basename() rather than the raw entry name so it works uniformly
// whether the caller has a bare FileEntry.name (no separators, so
// basename is a no-op) or a full path (as onActivate did, working only
// from the selection Set<string> of full paths).
import { isVideoFile, basename } from '../domain/fileSystemLogic'
import { openPaths, openWithSystemPlayer } from '../infrastructure/backendClient'

export function openSelection(paths: string[]): void {
  if (paths.length === 0) return
  if (paths.length === 1 && isVideoFile(basename(paths[0]))) {
    void openWithSystemPlayer(paths[0])
    return
  }
  openPaths(paths)
}
