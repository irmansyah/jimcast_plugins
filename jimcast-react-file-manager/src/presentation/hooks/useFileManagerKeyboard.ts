// [plugins] jimcast-react-file-manager/src/presentation/hooks/useFileManagerKeyboard.ts
//
// The global keydown handler from the old component (window-level, not
// tied to any one row) — extracted verbatim, plus two additions:
//
// 1. Native ArrowUp/Down/Left/Right + Enter handling, calling the same
//    workspace.moveFocus/activateFocused that useFileManagerNav.ts's
//    useHostNav wiring calls. useHostNav only fires when an actual host
//    is connected and forwarding nav events over its wire protocol — it
//    does NOT listen to window keydown itself. Without this block,
//    arrow-key navigation only works when embedded in a host that's
//    actively wired up; this makes it work standalone too, with both
//    paths funneling into the exact same focus-movement logic.
//
// 2. Vim hjkl navigation, gated on config.json's keybindings.mode. Also
//    calls moveFocus/activateFocused, so all three input methods (host
//    nav protocol, native arrows, vim hjkl) drive identical behavior.
//
// Ignores keydowns while focus is in an <input>/<textarea> (the
// rename/shell footer inputs handle their own Escape separately via
// CommandFooter's onKeyDown), and the confirm-delete state intercepts
// everything except d/y/Escape while active.
import { useEffect } from 'react'
import type { FileManagerWorkspace } from './useFileManagerWorkspace'
import { basename, visibleEntries } from '../../domain/fileSystemLogic'
import { keybindingMode } from '../../config'

const VIM_DIRECTIONS: Record<string, 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'> = {
  h: 'ArrowLeft',
  j: 'ArrowDown',
  k: 'ArrowUp',
  l: 'ArrowRight',
}

const NATIVE_ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const
type NativeArrow = typeof NATIVE_ARROWS[number]

export function useFileManagerKeyboard(workspace: FileManagerWorkspace) {
  const {
    footerModeRef, multiSelectedRef, columnsRef, focusedIndexRef, showHiddenRef,
    setFooterMode, setRenameValue, setShellCommand, setShowHidden, setFocusedIndex,
    performDelete, toggleFocusedSelection, selectAllInColumn, copySelectedPaths,
    moveFocus, activateFocused,
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

      // Native arrow keys + Enter — see file header. Works regardless of
      // whether a host is connected/wired, unlike useHostNav.
      if (!e.shiftKey && (NATIVE_ARROWS as readonly string[]).includes(e.key)) {
        e.preventDefault()
        moveFocus(e.key as NativeArrow)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        activateFocused()
        return
      }

      // vim navigation — only active when config.json sets keybindings.mode
      // to "vim". Reuses the exact same moveFocus/activateFocused actions
      // as the native-arrow block above, so behavior stays identical, just
      // reachable from hjkl too.
      if (keybindingMode === 'vim' && !e.shiftKey) {
        const dir = VIM_DIRECTIONS[e.key.toLowerCase()]
        if (dir) {
          e.preventDefault()
          if (dir === 'ArrowRight') {
            // "l" on a file (not a directory) opens it, same as Enter/
            // activate — matches common vim-style file-manager behavior
            // (ranger, etc.) instead of doing nothing on a leaf node.
            const cols = columnsRef.current
            const lastCol = cols[cols.length - 1]
            if (lastCol && !lastCol.loading && !lastCol.error) {
              const visible = visibleEntries(lastCol, cols.length - 1, showHiddenRef.current)
              const entry = visible[focusedIndexRef.current]
              if (entry && !entry.isDir) {
                activateFocused()
                return
              }
            }
          }
          moveFocus(dir)
          return
        }
      }

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
  }, [
    toggleFocusedSelection, selectAllInColumn, copySelectedPaths, performDelete,
    moveFocus, activateFocused,
  ])
}
