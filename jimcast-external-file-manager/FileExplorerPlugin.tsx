// [core] frontend/src/external-plugins/file-manager/FileExplorerPlugin.tsx
//
// v2 — rebuilt against the real QuickToolFileManager.tsx (pasted and
// diffed this session) after the first port (see git history / prior
// carry-forward) was found to diverge in nine real behaviors, not just
// style. This version restores, translated through the plugin-sdk instead
// of host imports:
//   - single click selects/focuses a file; double click opens it
//     (directories still navigate on single click)
//   - delete requires a two-step confirm ("d"/"y" again, or Escape to
//     cancel) before running
//   - delete tries `trash` first, only falls back to unrecoverable
//     `rm -rf` if that's not installed
//   - full keyboard-action layer: d (delete), m (rename, single-select
//     only), ! (shell, {} expands to selected paths), Space (toggle
//     selection), Cmd/Ctrl+A (select all files in focused column),
//     Cmd/Ctrl+C (copy selected paths), Shift+H (toggle hidden)
//   - directory listing re-fetches the whole column chain (not just the
//     changed column) on navigation, with `-A` so hidden files are
//     actually returned by the shell and the showHidden toggle has
//     something to reveal
//   - drag only starts from a row that's already part of the selection
//   - directories are never added to the selection set
//   - the selection checkbox only renders for files, not directories
//
// Host-coupling removed vs. the original QuickToolFileManager.tsx:
//   widgetPort.shellExec(...)        -> callHost('shellExec', ...)
//   requestOpenFiles(paths)          -> callHost('openFiles', { paths })
//   startNativeFileDrag(paths, ...)  -> callHost('startDrag', ...) + reportDragStarted(...)
//   registerNav prop (from host)     -> useHostNav(...) (from plugin-sdk)
//   onFocusedItemChange/onDragStarted props -> reportFocusedItem/reportDragStarted
//   ui/Primitives' IconButton        -> tiny local IconButton
//   useScrollIntoViewWhenSelected    -> tiny local reimplementation
//   toMonitorCenteredPercent/toCenteredScreenPercent (host-only,
//     monitor-aware coordinate math) -> not needed here; the plugin
//     reports the iframe-local DOMRect as-is (see reportRowFocus /
//     handleRowDragStart below) and the host does the screen-space
//     translation itself, per QuickToolExternalWebview's host-side
//     translation step.
// Still host-coupled (tracked debt, see styles.ts header):
//   theme/designSystem tokens via styles.ts
//
// NOT yet re-verified against the real file in this pass (flagged, not
// silently assumed correct):
//   - exact confirm-delete UX wording/kbd hints
//   - whether `initScreenPositionTracking()`-equivalent setup is needed
//     plugin-side at all, given the host now owns coordinate translation

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { callHost, reportFocusedItem, reportDragStarted } from '../../plugin-sdk/client'
import { useHostNav, type HostNavHandlers } from '../../plugin-sdk/useHostBridge'
import {
  basename, buildPath, entryFullPath, isAvFile,
  openWithSystemPlayer, parseLsEntries, resolveHome, truncateMiddle, visibleEntries,
  type ColumnData, type FileEntry,
} from './helpers'
import { styles } from './styles'

type FooterMode = 'hint' | 'confirm-delete' | 'rename' | 'shell'

const DRAG_THRESHOLD_PX = 4

// --- tiny local replacement for the host's ui/Primitives IconButton ---
function IconButton({
  onClick, title, disabled, children,
}: { onClick: () => void; title?: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1, fontSize: 14, padding: '2px 6px', color: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

// --- tiny local replacement for the host's useScrollIntoViewWhenSelected ---
function useScrollIntoViewWhenSelected<T extends HTMLElement>(selected: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])
  return ref
}

async function shellExec(cmd: string, opts: { ignore_exit_code?: boolean; trim_output?: boolean } = {}) {
  return callHost<{ stdout: string; exitCode: number }>('shellExec', { cmd, opts })
}

function ColRow({
  entry, isFocused, isMultiSelected, onClick, onDoubleClick, onDragStart, onFocusReport,
}: {
  entry:           FileEntry
  isFocused:       boolean
  isMultiSelected: boolean
  onClick:         (e: React.MouseEvent) => void
  onDoubleClick:   (e: React.MouseEvent) => void
  onDragStart:     (rect: DOMRect) => void
  onFocusReport?:  (rect: DOMRect) => void
}) {
  const ref = useScrollIntoViewWhenSelected<HTMLDivElement>(isFocused)

  useEffect(() => {
    if (isFocused && ref.current && onFocusReport) {
      onFocusReport(ref.current.getBoundingClientRect())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused])

  // Same mousedown-then-move-past-threshold arming as the real component:
  // firing native drag unconditionally on mousedown would swallow the
  // mouseup and break click/double-click.
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    const target = e.currentTarget

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    const onMove = (ev: MouseEvent) => {
      const dx = Math.abs(ev.clientX - startX)
      const dy = Math.abs(ev.clientY - startY)
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
        cleanup()
        onDragStart(target.getBoundingClientRect())
      }
    }
    const onUp = () => cleanup()

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [onDragStart])

  return (
    <div
      ref={ref}
      style={{
        ...styles.colRow,
        ...(isMultiSelected ? styles.colRowMultiSelected : {}),
        ...(isFocused ? styles.colRowFocused : {}),
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={handleMouseDown}
    >
      {!entry.isDir && (
        <span style={styles.checkbox}>{isMultiSelected ? '☑' : ''}</span>
      )}
      <span style={styles.icon}>{entry.isDir ? '📁' : '📄'}</span>
      <span style={styles.name}>{truncateMiddle(entry.name)}</span>
      {entry.isDir && <span style={styles.chevron}>›</span>}
    </div>
  )
}

export function FileExplorerPlugin() {
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
    shellExec('echo $HOME', { trim_output: true })
      .then(({ stdout }) => setHomeDir(stdout.trim()))
      .catch(() => setHomeDir(null))
  }, [])

  // Re-fetches the *entire* column chain on every navigation/refresh, with
  // -A so hidden entries actually come back from the shell — filtering
  // them client-side (visibleEntries) only works if ls returned them in
  // the first place.
  useEffect(() => {
    let cancelled = false
    const paths = segments.map((_, i) => buildPath(segments.slice(0, i + 1)))
    setColumns(paths.map(p => ({ path: p, entries: [], loading: true, error: null })))

    Promise.all(paths.map(async (p): Promise<ColumnData> => {
      try {
        const escaped = resolveHome(p).replace(/"/g, '\\"')
        const { stdout, exitCode } = await shellExec(
          `cd "${escaped}" 2>/dev/null && ls -1pA`,
          { ignore_exit_code: true, trim_output: true },
        )
        if (exitCode !== 0) return { path: p, entries: [], loading: false, error: "Can't open" }
        return { path: p, entries: parseLsEntries(stdout), loading: false, error: null }
      } catch {
        return { path: p, entries: [], loading: false, error: 'Failed to read directory' }
      }
    })).then(results => {
      if (cancelled) return
      setColumns(results)
      setFocusedIndex(0)
    })

    return () => { cancelled = true }
  }, [segments.join('\u0000'), refreshTick])

  const openPaths = useCallback((paths: string[]) => {
    void callHost('openFiles', { paths }).catch(() => {})
  }, [])

  // Directory: navigates. File: opens (used for double-click and
  // keyboard activate) — single click on a file only focuses/selects it,
  // matching the real component.
  const openEntry = useCallback((colIndex: number, entry: FileEntry) => {
    if (entry.isDir) {
      setSegments(prev => [...prev.slice(0, colIndex + 1), entry.name])
      setFocusedIndex(0)
      return
    }
    const fullPath = entryFullPath(segments.slice(0, colIndex + 1), entry.name, homeDir)
    if (isAvFile(entry.name)) {
      void openWithSystemPlayer(fullPath)
    } else {
      openPaths([fullPath])
    }
  }, [segments, homeDir, openPaths])

  const goUp = useCallback(() => {
    setSegments(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  }, [])

  const jumpToCrumb = useCallback((colIndex: number) => {
    setSegments(prev => prev.slice(0, colIndex + 1))
  }, [])

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

  const reportRowFocus = useCallback((rect: DOMRect, entry: FileEntry, fullPath: string) => {
    reportFocusedItem({
      name: entry.name, path: fullPath,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    })
  }, [])

  const anchorRef = useRef<{ colIndex: number; idx: number } | null>(null)

  // Single click on a file: focus/select only (mirrors real behavior —
  // opening needs a double click). Directories still navigate immediately.
  // Directories are never added to multiSelected.
  const handleRowClick = useCallback((colIndex: number, entry: FileEntry, idx: number, e: React.MouseEvent) => {
    if (entry.isDir) {
      openEntry(colIndex, entry)
      return
    }

    const isLastColumn = colIndex === columnsRef.current.length - 1
    if (isLastColumn) setFocusedIndex(idx)

    const fullPath = entryFullPath(segmentsRef.current.slice(0, colIndex + 1), entry.name, homeDirRef.current)

    if (!isLastColumn) {
      reportRowFocus(e.currentTarget.getBoundingClientRect(), entry, fullPath)
    }

    if (e.shiftKey && anchorRef.current && anchorRef.current.colIndex === colIndex) {
      const col = columnsRef.current[colIndex]
      if (!col || col.loading || col.error) return
      const visible = visibleEntries(col, colIndex, showHiddenRef.current)
      const lo = Math.min(anchorRef.current.idx, idx)
      const hi = Math.max(anchorRef.current.idx, idx)
      const rangePaths = visible
        .slice(lo, hi + 1)
        .filter(e2 => !e2.isDir)
        .map(e2 => entryFullPath(segmentsRef.current.slice(0, colIndex + 1), e2.name, homeDirRef.current))
      setMultiSelected(new Set(rangePaths))
      return
    }

    if (e.metaKey || e.ctrlKey) {
      setMultiSelected(prev => {
        const next = new Set(prev)
        if (next.has(fullPath)) next.delete(fullPath)
        else next.add(fullPath)
        return next
      })
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
      openPaths(Array.from(selected))
      return
    }
    if (isAvFile(entry.name)) {
      void openWithSystemPlayer(fullPath)
    } else {
      openPaths([fullPath])
    }
  }, [openPaths])

  // Only a row already in the selection can be dragged — no
  // select-on-drag.
  const handleRowDragStart = useCallback((colIndex: number, entry: FileEntry, rect: DOMRect) => {
    if (entry.isDir) return
    const fullPath = entryFullPath(segmentsRef.current.slice(0, colIndex + 1), entry.name, homeDirRef.current)
    const selected = multiSelectedRef.current
    if (!selected.has(fullPath)) return

    const paths = Array.from(selected)
    reportDragStarted(paths, { x: rect.x, y: rect.y, width: rect.width, height: rect.height })
    void callHost('startDrag', { paths, allDirs: false }).catch(() => {})
  }, [])

  const toggleFocusedSelection = useCallback(() => {
    const cols = columnsRef.current
    const lastCol = cols[cols.length - 1]
    if (!lastCol || lastCol.loading || lastCol.error) return
    const visible = visibleEntries(lastCol, cols.length - 1, showHiddenRef.current)
    const entry = visible[focusedIndexRef.current]
    if (!entry || entry.isDir) return

    const fullPath = entryFullPath(segmentsRef.current, entry.name, homeDirRef.current)
    setMultiSelected(prev => {
      const next = new Set(prev)
      if (next.has(fullPath)) next.delete(fullPath)
      else next.add(fullPath)
      return next
    })
    anchorRef.current = { colIndex: cols.length - 1, idx: focusedIndexRef.current }
  }, [])

  const selectAllInColumn = useCallback(() => {
    const cols = columnsRef.current
    const lastCol = cols[cols.length - 1]
    if (!lastCol || lastCol.loading || lastCol.error) return
    const visible = visibleEntries(lastCol, cols.length - 1, showHiddenRef.current)
    const paths = visible
      .filter(e => !e.isDir)
      .map(e => entryFullPath(segmentsRef.current, e.name, homeDirRef.current))
    setMultiSelected(prev => new Set([...prev, ...paths]))
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

  // "d" then "d"/"y" again (or Escape to cancel) — trash-first, rm -rf
  // fallback only if trash isn't installed.
  const performDelete = useCallback(async () => {
    const paths = Array.from(multiSelectedRef.current)
    if (paths.length === 0) { setFooterMode('hint'); return }
    const quoted = paths.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ')
    await shellExec(`trash ${quoted} 2>/dev/null || rm -rf ${quoted}`, { ignore_exit_code: true })
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
    const dir = oldPath.slice(0, oldPath.length - basename(oldPath).length)
    const newPath = `${dir}${newName}`
    await shellExec(
      `mv "${oldPath.replace(/"/g, '\\"')}" "${newPath.replace(/"/g, '\\"')}"`,
      { ignore_exit_code: true },
    )
    setMultiSelected(new Set([newPath]))
    setFooterMode('hint')
    setRefreshTick(t => t + 1)
  }, [renameValue])

  // "!" — {} expands to selected paths; appended at the end if absent.
  const performShellCommand = useCallback(async () => {
    const cmd = shellCommand.trim()
    if (!cmd) { setFooterMode('hint'); return }
    const paths = Array.from(multiSelectedRef.current)
    const filesArg = paths.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ')
    const finalCmd = cmd.includes('{}') ? cmd.replace(/\{\}/g, filesArg) : `${cmd} ${filesArg}`
    await shellExec(finalCmd, { ignore_exit_code: true })
    setFooterMode('hint')
    setRefreshTick(t => t + 1)
  }, [shellCommand])

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
        const paths = Array.from(selected)
        if (paths.length === 1 && isAvFile(basename(paths[0]))) {
          void openWithSystemPlayer(paths[0])
        } else {
          openPaths(paths)
        }
        return
      }
      const cols = columnsRef.current
      const lastCol = cols[cols.length - 1]
      const visible = lastCol ? visibleEntries(lastCol, cols.length - 1, showHiddenRef.current) : []
      const entry = visible[focusedIndexRef.current]
      if (entry) openEntry(cols.length - 1, entry)
    },
  }), [goUp, openEntry, openPaths])

  useHostNav(navHandlers)

  return (
    <div>
      <div style={styles.headerRow}>
        <div style={styles.title}>File Explorer</div>
        <div style={styles.navBtns}>
          {multiSelected.size > 0 && (
            <>
              <span style={styles.selectionCount}>{multiSelected.size} selected</span>
              <IconButton onClick={copySelectedPaths} title="Copy path(s) (⌘/Ctrl+C)">⧉</IconButton>
              <IconButton onClick={clearSelection} title="Clear selection">✕</IconButton>
            </>
          )}
          {showHidden && <span style={styles.hiddenBadge}>hidden shown</span>}
          <IconButton onClick={goUp} disabled={segments.length <= 1} title="Up one level">↑</IconButton>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        {segments.map((seg, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <span
              style={i === segments.length - 1 ? { ...styles.crumb, ...styles.crumbActive } : styles.crumb}
              onClick={() => jumpToCrumb(i)}
            >
              {seg === '~' ? '~' : basename(seg)}
            </span>
            {i < segments.length - 1 && <span style={styles.crumbSep}>/</span>}
          </span>
        ))}
      </div>

      <div style={styles.columnsRow}>
        {columns.map((col, colIndex) => {
          const isLastColumn = colIndex === columns.length - 1
          const entries = visibleEntries(col, colIndex, showHidden)
          return (
            <div key={col.path} style={styles.column}>
              {col.loading && <div style={styles.muted}>Loading…</div>}
              {!col.loading && col.error && <div style={styles.error}>{col.error}</div>}
              {!col.loading && !col.error && entries.map((entry, idx) => {
                const fullPath = entryFullPath(segments.slice(0, colIndex + 1), entry.name, homeDir)
                const isFocused = isLastColumn && idx === focusedIndex
                const isMultiSelected = !entry.isDir && multiSelected.has(fullPath)
                return (
                  <ColRow
                    key={entry.name}
                    entry={entry}
                    isFocused={isFocused}
                    isMultiSelected={isMultiSelected}
                    onClick={(e) => handleRowClick(colIndex, entry, idx, e)}
                    onDoubleClick={() => handleRowDoubleClick(colIndex, entry)}
                    onDragStart={(rect) => handleRowDragStart(colIndex, entry, rect)}
                    onFocusReport={(rect) => reportRowFocus(rect, entry, fullPath)}
                  />
                )
              })}
            </div>
          )
        })}
      </div>

      {footerMode === 'hint' && multiSelected.size > 0 && (
        <div style={styles.footer}>
          <span style={styles.footerHint}><span style={styles.kbd}>d</span> delete</span>
          {multiSelected.size === 1 && (
            <span style={styles.footerHint}><span style={styles.kbd}>m</span> rename</span>
          )}
          <span style={styles.footerHint}><span style={styles.kbd}>!</span> shell</span>
        </div>
      )}

      {footerMode === 'confirm-delete' && (
        <div style={styles.footer}>
          <span style={styles.footerWarn}>
            Delete {multiSelected.size} file{multiSelected.size > 1 ? 's' : ''}?
          </span>
          <span style={styles.footerHint}>
            <span style={styles.kbd}>d</span>/<span style={styles.kbd}>y</span> confirm · <span style={styles.kbd}>esc</span> cancel
          </span>
        </div>
      )}

      {footerMode === 'rename' && (
        <form style={styles.footer} onSubmit={(e) => { e.preventDefault(); void performRename() }}>
          <span style={styles.footerHint}>Rename to</span>
          <input
            autoFocus
            style={styles.footerInput}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setFooterMode('hint') } }}
          />
        </form>
      )}

      {footerMode === 'shell' && (
        <form style={styles.footer} onSubmit={(e) => { e.preventDefault(); void performShellCommand() }}>
          <span style={styles.footerHint}>!</span>
          <input
            autoFocus
            style={styles.footerInput}
            placeholder="command — {} expands to selected path(s)"
            value={shellCommand}
            onChange={(e) => setShellCommand(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setFooterMode('hint') } }}
          />
        </form>
      )}
    </div>
  )
}
