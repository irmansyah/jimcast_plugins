// jimcast-react-file-manager/src/presentation/hooks/useFileExplorerWorkspace.ts
//
// The central state hook — mirrors kanban's useKanbanWorkspace.ts. Owns
// every piece of state the old monolithic FileExplorerPlugin.tsx had
// (homeDir, segments, columns, showHidden, focusedIndex, multiSelected,
// footerMode, renameValue, shellCommand, refreshTick) plus the ref-mirror
// pattern the original used so the keyboard/nav effects — which subscribe
// once via window.addEventListener / useHostNav and must not see stale
// closures — always read the latest values. Every action callback below
// is a straight port of the original's useCallback bodies, just now
// delegating the actual work to domain/ (pure) or application/
// (side-effecting orchestration) instead of inlining it.
//
// moveFocus/activateFocused were lifted in from useFileExplorerNav.ts so
// there's a single source of truth for "what does up/down/left/right/
// activate mean" — both the host's arrow-key protocol (useFileExplorerNav)
// and vim hjkl (useFileExplorerKeyboard, gated on config.json's
// keybindings.mode) now call the same two functions instead of each
// hook maintaining its own copy of the focus-movement logic.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { ColumnData, FileEntry, FooterMode, SelectionAnchor } from '../../types'
import { basename, buildPath, entryFullPath, visibleEntries } from '../../domain/fileSystemLogic'
import {
  toggleSelection,
  rangeSelect,
  selectAllFilesInColumn,
  toggleFocusedSelection as domainToggleFocusedSelection,
} from '../../domain/selectionLogic'
import { loadHomeDir, loadColumns } from '../../application/columnLoading'
import { deleteFiles, renameFile, runShellCommand } from '../../application/fileOperations'
import { openSelection } from '../../application/fileOpening'
import { reportFocusedItem, reportDragStarted, startDrag } from '../../infrastructure/backendClient'

export function useFileExplorerWorkspace() {
  const [homeDir, setHomeDir] = useState<string | null>(null)
  const [segments, setSegments] = useState<string[]>(['~'])
  const [columns, setColumns] = useState<ColumnData[]>([])
  const [showHidden, setShowHidden] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set())
  const [footerMode, setFooterMode] = useState<FooterMode>('hint')
  const [renameValue, setRenameValue] = useState('')
  const [shellCommand, setShellCommand] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    loadHomeDir().then(setHomeDir)
  }, [])

  // Re-fetches the entire column chain on every navigation/refresh —
  // same strategy as the original, not an incremental "just the changed
  // column" update.
  useEffect(() => {
    let cancelled = false
    // Placeholder rows with real paths (not just loading:true stubs) so
    // the render's `key={col.path}` stays unique per column during the
    // load flicker — losing this would collide every loading column onto
    // the same React key.
    const paths = segments.map((_, i) => buildPath(segments.slice(0, i + 1)))
    setColumns(paths.map(p => ({ path: p, entries: [], loading: true, error: null })))

    loadColumns(segments).then(results => {
      if (cancelled) return
      setColumns(results)
      setFocusedIndex(0)
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.join('\u0000'), refreshTick])

  // --- refs mirroring the latest state, for the keyboard/nav hooks ---
  const columnsRef = useRef(columns); columnsRef.current = columns
  const focusedIndexRef = useRef(focusedIndex); focusedIndexRef.current = focusedIndex
  const showHiddenRef = useRef(showHidden); showHiddenRef.current = showHidden
  const multiSelectedRef = useRef(multiSelected); multiSelectedRef.current = multiSelected
  const segmentsRef = useRef(segments); segmentsRef.current = segments
  const homeDirRef = useRef(homeDir); homeDirRef.current = homeDir
  const footerModeRef = useRef(footerMode); footerModeRef.current = footerMode

  useEffect(() => {
    if (multiSelected.size === 0) setFooterMode('hint')
  }, [multiSelected])

  const anchorRef = useRef<SelectionAnchor | null>(null)

  const reportRowFocus = useCallback((rect: DOMRect, entry: FileEntry, fullPath: string) => {
    reportFocusedItem({
      name: entry.name, path: fullPath,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    })
  }, [])

  // Directory: navigates. File: opens (used for double-click and
  // keyboard activate) — single click on a file only focuses/selects it.
  const openEntry = useCallback((colIndex: number, entry: FileEntry) => {
    if (entry.isDir) {
      setSegments(prev => [...prev.slice(0, colIndex + 1), entry.name])
      setFocusedIndex(0)
      return
    }
    const fullPath = entryFullPath(segmentsRef.current.slice(0, colIndex + 1), entry.name, homeDirRef.current)
    openSelection([fullPath])
  }, [])

  const goUp = useCallback(() => {
    setSegments(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  }, [])

  const jumpToCrumb = useCallback((colIndex: number) => {
    setSegments(prev => prev.slice(0, colIndex + 1))
  }, [])

  // Single click on a file: focus/select only. Directories navigate
  // immediately and are never added to multiSelected.
  const handleRowClick = useCallback((colIndex: number, entry: FileEntry, idx: number, e: MouseEvent) => {
    if (entry.isDir) {
      openEntry(colIndex, entry)
      return
    }

    const isLastColumn = colIndex === columnsRef.current.length - 1
    if (isLastColumn) setFocusedIndex(idx)

    const fullPath = entryFullPath(segmentsRef.current.slice(0, colIndex + 1), entry.name, homeDirRef.current)

    if (!isLastColumn) {
      reportRowFocus((e.currentTarget as HTMLElement).getBoundingClientRect(), entry, fullPath)
    }

    if (e.shiftKey && anchorRef.current && anchorRef.current.colIndex === colIndex) {
      const col = columnsRef.current[colIndex]
      if (!col || col.loading || col.error) return
      setMultiSelected(rangeSelect(
        col, colIndex, anchorRef.current, idx, showHiddenRef.current, segmentsRef.current, homeDirRef.current,
      ))
      return
    }

    if (e.metaKey || e.ctrlKey) {
      setMultiSelected(prev => toggleSelection(prev, fullPath))
      anchorRef.current = { colIndex, idx }
      return
    }

    setMultiSelected(new Set([fullPath]))
    anchorRef.current = { colIndex, idx }
  }, [openEntry, reportRowFocus])

  // Double click opens. If the file is part of a larger selection, opens
  // the whole selection; otherwise just that one file.
  const handleRowDoubleClick = useCallback((colIndex: number, entry: FileEntry) => {
    if (entry.isDir) return
    const fullPath = entryFullPath(segmentsRef.current.slice(0, colIndex + 1), entry.name, homeDirRef.current)
    const selected = multiSelectedRef.current
    if (selected.size > 1 && selected.has(fullPath)) {
      openSelection(Array.from(selected))
      return
    }
    openSelection([fullPath])
  }, [])

  // Only a row already in the selection can be dragged — no
  // select-on-drag.
  const handleRowDragStart = useCallback((colIndex: number, entry: FileEntry, rect: DOMRect) => {
    if (entry.isDir) return
    const fullPath = entryFullPath(segmentsRef.current.slice(0, colIndex + 1), entry.name, homeDirRef.current)
    const selected = multiSelectedRef.current
    if (!selected.has(fullPath)) return

    const paths = Array.from(selected)
    reportDragStarted(paths, { x: rect.x, y: rect.y, width: rect.width, height: rect.height })
    startDrag(paths, false)
  }, [])

  const toggleFocusedSelection = useCallback(() => {
    const cols = columnsRef.current
    const lastCol = cols[cols.length - 1]
    if (!lastCol) return
    const result = domainToggleFocusedSelection(
      lastCol, cols.length - 1, focusedIndexRef.current, showHiddenRef.current,
      segmentsRef.current, homeDirRef.current, multiSelectedRef.current,
    )
    if (!result) return
    setMultiSelected(result.next)
    anchorRef.current = result.anchor
  }, [])

  const selectAllInColumn = useCallback(() => {
    const cols = columnsRef.current
    const lastCol = cols[cols.length - 1]
    if (!lastCol || lastCol.loading || lastCol.error) return
    setMultiSelected(prev => selectAllFilesInColumn(
      lastCol, cols.length - 1, showHiddenRef.current, segmentsRef.current, homeDirRef.current, prev,
    ))
  }, [])

  const copySelectedPaths = useCallback(() => {
    const paths = Array.from(multiSelectedRef.current)
    if (paths.length === 0) return
    navigator.clipboard?.writeText(paths.join('\n')).catch(() => {})
  }, [])

  const clearSelection = useCallback(() => {
    setMultiSelected(new Set())
    anchorRef.current = null
  }, [])

  // "d" then "d"/"y" again (or Escape to cancel).
  const performDelete = useCallback(async () => {
    const paths = Array.from(multiSelectedRef.current)
    if (paths.length === 0) { setFooterMode('hint'); return }
    await deleteFiles(paths)
    setMultiSelected(new Set())
    anchorRef.current = null
    setFooterMode('hint')
    setRefreshTick(t => t + 1)
  }, [])

  // "m" — only ever armed when exactly one file is selected.
  const performRename = useCallback(async () => {
    const paths = Array.from(multiSelectedRef.current)
    if (paths.length !== 1) { setFooterMode('hint'); return }
    const oldPath = paths[0]
    const newName = renameValue.trim()
    if (!newName || newName === basename(oldPath)) { setFooterMode('hint'); return }
    const newPath = await renameFile(oldPath, newName)
    setMultiSelected(new Set([newPath]))
    setFooterMode('hint')
    setRefreshTick(t => t + 1)
  }, [renameValue])

  // "!" — {} expands to selected paths.
  const performShellCommand = useCallback(async () => {
    const cmd = shellCommand.trim()
    if (!cmd) { setFooterMode('hint'); return }
    await runShellCommand(cmd, Array.from(multiSelectedRef.current))
    setFooterMode('hint')
    setRefreshTick(t => t + 1)
  }, [shellCommand])

  // Single source of truth for arrow-style focus movement in the last
  // (deepest) column — shared by useFileExplorerNav (host arrow-key
  // protocol) and useFileExplorerKeyboard (vim hjkl, gated on config.json's
  // keybindings.mode). Extracted verbatim from what used to be
  // useFileExplorerNav's onArrow closure.
  const moveFocus = useCallback((dir: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight') => {
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
  }, [goUp, openEntry])

  // Single source of truth for "activate the focused/selected entr(y/ies)"
  // — Enter on the host side, and Enter/"l"-on-a-file in vim mode.
  // Extracted verbatim from what used to be useFileExplorerNav's
  // onActivate closure.
  const activateFocused = useCallback(() => {
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
  }, [openEntry])

  const selectEntry = useCallback((idx: number) => {
    const cols = columnsRef.current
    const lastCol = cols[cols.length - 1]
    if (!lastCol || lastCol.loading || lastCol.error) return false
    const visible = visibleEntries(lastCol, cols.length - 1, showHiddenRef.current)
    const entry = visible[idx]
    if (!entry) return false
    const fullPath = entryFullPath(segmentsRef.current.slice(0, cols.length), entry.name, homeDirRef.current)
    setFocusedIndex(idx)
    setMultiSelected(new Set([fullPath]))
    anchorRef.current = { colIndex: cols.length - 1, idx }
    return true
  }, [])

  const performRenameWith = useCallback(async (oldPath: string, newName: string) => {
    const newPath = await renameFile(oldPath, newName)
    setMultiSelected(new Set([newPath]))
    setRefreshTick(t => t + 1)
    return newPath
  }, [])

  const performShellCommandWith = useCallback(async (cmd: string, paths: string[]) => {
    await runShellCommand(cmd, paths)
    setRefreshTick(t => t + 1)
  }, [])

  return {
    // state
    homeDir, segments, columns, showHidden, focusedIndex, multiSelected,
    footerMode, renameValue, shellCommand,
    // refs — exposed for useFileExplorerKeyboard / useFileExplorerNav,
    // which subscribe once and need latest-value access outside React's
    // render cycle, same reason the original component kept them as refs.
    columnsRef, focusedIndexRef, showHiddenRef, multiSelectedRef,
    segmentsRef, homeDirRef, footerModeRef,
    // setters
    setShowHidden, setFocusedIndex, setFooterMode, setRenameValue, setShellCommand,
    // actions
    openEntry, goUp, jumpToCrumb, reportRowFocus,
    handleRowClick, handleRowDoubleClick, handleRowDragStart,
    toggleFocusedSelection, selectAllInColumn, copySelectedPaths, clearSelection,
    performDelete, performRename, performShellCommand,
    moveFocus, activateFocused,
    selectEntry, performRenameWith, performShellCommandWith
  }
}

export type FileExplorerWorkspace = ReturnType<typeof useFileExplorerWorkspace>
