// jimcast-plugins/jimcast-external-file-manager/src/presentation/hooks/useFileExplorerNav.ts
//
// Wires the workspace into the host's arrow-key/activate nav protocol via
// @jimcast/react-sdk/react's useHostNav — confirmed this session to
// already match the {onArrow, onActivate} shape this plugin used against
// the old in-core plugin-sdk's useHostBridge, so this is a straight
// import-path port, not a rewrite. The old onActivate's inline
// single-AV-file-vs-openPaths branching is now just a call to
// application/fileOpening.ts's openSelection(), which already contains
// that same decision (see that file's header for why it's unified there).

import { useMemo } from 'react'
import { useHostNav, type HostNavHandlers } from '@jimcast/react-sdk/react'
import type { FileExplorerWorkspace } from './useFileExplorerWorkspace'
import { visibleEntries } from '../../domain/fileSystemLogic'
import { openSelection } from '../../application/fileOpening'

export function useFileExplorerNav(workspace: FileExplorerWorkspace) {
  const {
    columnsRef, focusedIndexRef, showHiddenRef, multiSelectedRef,
    setFocusedIndex, goUp, openEntry,
  } = workspace

  const navHandlers: HostNavHandlers = useMemo(() => ({
    onArrow: (dir) => {
      const cols = columnsRef.current
      const lastCol = cols[cols.length - 1]
      if (!lastCol || lastCol.loading || lastCol.error) return
      const visible = visibleEntries(lastCol, cols.length - 1, showHiddenRef.current)
      const total = visible.length

      if (dir === 'ArrowDown') { if (total) setFocusedIndex(i => Math.min(i + 1, total - 1)); return }
      if (dir === 'ArrowUp') { if (total) setFocusedIndex(i => Math.max(i - 1, 0)); return }
      if (dir === 'ArrowLeft') { goUp(); return }
      if (dir === 'ArrowRight') {
        const entry = visible[focusedIndexRef.current]
        if (entry?.isDir) openEntry(cols.length - 1, entry)
        return
      }
    },
    onActivate: () => {
      const selected = multiSelectedRef.current
      if (selected.size > 0) {
        openSelection(Array.from(selected))
        return
      }
      const cols = columnsRef.current
      const lastCol = cols[cols.length - 1]
      const visible = lastCol ? visibleEntries(lastCol, cols.length - 1, showHiddenRef.current) : []
      const entry = visible[focusedIndexRef.current]
      if (entry) openEntry(cols.length - 1, entry)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [goUp, openEntry])

  useHostNav(navHandlers)
}
