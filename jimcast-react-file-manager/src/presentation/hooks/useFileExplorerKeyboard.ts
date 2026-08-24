// jimcast-plugins/jimcast-external-file-manager/src/presentation/hooks/useFileExplorerKeyboard.ts
//
// The global keydown handler from the old component (window-level, not
// tied to any one row) — extracted verbatim. Ignores keydowns while
// focus is in an <input>/<textarea> (the rename/shell footer inputs
// handle their own Escape separately via CommandFooter's onKeyDown), and
// the confirm-delete state intercepts everything except d/y/Escape while
// active.

import { useEffect } from 'react'
import type { FileExplorerWorkspace } from './useFileExplorerWorkspace'
import { basename } from '../../domain/fileSystemLogic'

export function useFileExplorerKeyboard(workspace: FileExplorerWorkspace) {
  const {
    footerModeRef, multiSelectedRef,
    setFooterMode, setRenameValue, setShellCommand, setShowHidden, setFocusedIndex,
    performDelete, toggleFocusedSelection, selectAllInColumn, copySelectedPaths,
  } = workspace

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return

      if (footerModeRef.current === 'confirm-delete') {
        if (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'y') {
          e.preventDefault()
          void performDelete()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setFooterMode('hint')
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAllInColumn()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && multiSelectedRef.current.size > 0) {
        e.preventDefault()
        copySelectedPaths()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (multiSelectedRef.current.size > 0 && footerModeRef.current === 'hint') {
        if (e.key.toLowerCase() === 'd') {
          e.preventDefault()
          setFooterMode('confirm-delete')
          return
        }
        if (e.key.toLowerCase() === 'm' && multiSelectedRef.current.size === 1) {
          e.preventDefault()
          setRenameValue(basename(Array.from(multiSelectedRef.current)[0]))
          setFooterMode('rename')
          return
        }
        if (e.key === '!') {
          e.preventDefault()
          setShellCommand('')
          setFooterMode('shell')
          return
        }
      }

      if (e.shiftKey && e.key.toLowerCase() === 'h') {
        setShowHidden(h => !h)
        setFocusedIndex(0)
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        toggleFocusedSelection()
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleFocusedSelection, selectAllInColumn, copySelectedPaths, performDelete])
}
