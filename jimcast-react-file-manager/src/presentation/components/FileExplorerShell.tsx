// jimcast-plugins/jimcast-external-file-manager/src/presentation/components/FileExplorerShell.tsx
//
// Was the monolithic FileExplorerPlugin.tsx. Now: run the workspace hook,
// wire up the keyboard and host-nav hooks, render header/breadcrumbs/
// columns/footer using the pieces split into IconButton/ColRow/
// Breadcrumbs/CommandFooter. No business logic lives here — every
// callback is either a workspace action or a thin JSX-event adapter over
// one. `styles` is the Record<string, CSSProperties> from
// fileExplorerStyles(theme), passed down from App.tsx.
//
// Passing the full `styles` object into ColRow/Breadcrumbs/CommandFooter
// (each of which types its `styles` prop as a narrower interface of just
// the keys it uses) works without a cast: Record<string, CSSProperties>
// structurally satisfies any interface whose properties are all
// CSSProperties, since the index signature guarantees each named key is
// present at that type.

import type { CSSProperties } from 'react'
import { visibleEntries, entryFullPath } from '../../domain/fileSystemLogic'
import { useFileExplorerWorkspace } from '../hooks/useFileExplorerWorkspace'
import { useFileExplorerKeyboard } from '../hooks/useFileExplorerKeyboard'
import { useFileExplorerNav } from '../hooks/useFileExplorerNav'
import { IconButton } from './IconButton'
import { ColRow } from './ColRow'
import { Breadcrumbs } from './Breadcrumbs'
import { CommandFooter } from './CommandFooter'

export function FileExplorerShell({ styles }: { styles: Record<string, CSSProperties> }) {
  const workspace = useFileExplorerWorkspace()
  useFileExplorerKeyboard(workspace)
  useFileExplorerNav(workspace)

  const {
    homeDir, segments, columns, showHidden, focusedIndex, multiSelected,
    footerMode, renameValue, shellCommand,
    setFooterMode, setRenameValue, setShellCommand,
    goUp, jumpToCrumb, handleRowClick, handleRowDoubleClick, handleRowDragStart,
    reportRowFocus, copySelectedPaths, clearSelection,
    performRename, performShellCommand,
  } = workspace

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

      <Breadcrumbs segments={segments} styles={styles} onJump={jumpToCrumb} />

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
                    styles={styles}
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

      <CommandFooter
        footerMode={footerMode}
        selectedCount={multiSelected.size}
        renameValue={renameValue}
        shellCommand={shellCommand}
        styles={styles}
        onRenameChange={setRenameValue}
        onShellChange={setShellCommand}
        onRenameSubmit={() => { void performRename() }}
        onShellSubmit={() => { void performShellCommand() }}
        onCancel={() => setFooterMode('hint')}
      />
    </div>
  )
}
