// jimcast-react-file-manager/src/presentation/components/FileManagerShell.tsx
//
// Was the monolithic FileManagerPlugin.tsx. Now: run the workspace hook,
// wire up the keyboard and host-nav hooks, render header/breadcrumbs/
// columns/footer using the pieces split into IconButton/ColRow/
// Breadcrumbs/CommandFooter. No business logic lives here — every
// callback is either a workspace action or a thin JSX-event adapter over
// one. `styles` is the Record<string, CSSProperties> from
// fileManagerStyles(theme), passed down from App.tsx.
//
// NOTE: styles is intentionally typed as the wide Record<string,
// CSSProperties> at the App.tsx boundary (fileManagerStyles's return
// type), but each leaf component (Breadcrumbs/ColRow/CommandFooter)
// declares a narrower interface listing only the specific keys it uses.
// A `[key: string]: CSSProperties` index signature does NOT prove those
// specific named keys exist, so TS correctly rejects passing the wide
// object directly — an earlier version of this file assumed otherwise
// and didn't typecheck. Casting via each component's own exported style
// interface keeps the cast checked against a real shape instead of an
// unchecked `as any`.
//
// Drag/focus reporting: ColRow only hands back a DOMRect, plus which
// column/index/entry it belongs to via the closure below — it has no
// idea what "this row's path" or "is this row part of the current
// selection" mean. That's workspace state, so handleRowDragStart /
// reportRowFocus (both owned by useFileManagerWorkspace) resolve the
// fullPath and decide internally whether to drag just this row or the
// whole multi-selection. This shell never imports backendClient
// directly — same one-seam rule the header comment on backendClient.ts
// describes.

import type { CSSProperties } from 'react'
import { visibleEntries, entryFullPath } from '../../domain/fileSystemLogic'
import { useFileManagerWorkspace } from '../hooks/useFileManagerWorkspace'
import { useFileManagerKeyboard } from '../hooks/useFileManagerKeyboard'
import { useFileManagerNav } from '../hooks/useFileManagerNav'
import { IconButton } from './IconButton'
import { ColRow, type ColRowStyles } from './ColRow'
import { Breadcrumbs, type BreadcrumbStyles } from './Breadcrumbs'
import { CommandFooter, type CommandFooterStyles } from './CommandFooter'

export function FileManagerShell({ styles }: { styles: Record<string, CSSProperties> }) {
  const workspace = useFileManagerWorkspace()
  useFileManagerKeyboard(workspace)
  useFileManagerNav(workspace)

  const {
    homeDir, segments, columns, showHidden, focusedIndex, multiSelected,
    footerMode, renameValue, shellCommand,
    setFooterMode, setRenameValue, setShellCommand,
    goUp, jumpToCrumb, handleRowClick, handleRowDoubleClick, handleRowDragStart,
    reportRowFocus, copySelectedPaths, clearSelection,
    performRename, performShellCommand,
  } = workspace

  // Widened at the App.tsx boundary, narrowed back per-component here —
  // see file header. Each cast goes through `unknown` because the wide
  // Record type and the narrow named-property interface aren't directly
  // related from TS's point of view.
  const breadcrumbStyles = styles as unknown as BreadcrumbStyles
  const colRowStyles = styles as unknown as ColRowStyles
  const footerStyles = styles as unknown as CommandFooterStyles

  return (
    <div style={styles.root}>
      <div style={styles.headerRow}>
        <div style={styles.title}>File Manager</div>
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

      <Breadcrumbs segments={segments} styles={breadcrumbStyles} onJump={jumpToCrumb} />

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
                    key={fullPath}
                    entry={entry}
                    isFocused={isFocused}
                    isMultiSelected={isMultiSelected}
                    styles={colRowStyles}
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
        styles={footerStyles}
        onRenameChange={setRenameValue}
        onShellChange={setShellCommand}
        onRenameSubmit={() => { void performRename() }}
        onShellSubmit={() => { void performShellCommand() }}
        onCancel={() => setFooterMode('hint')}
      />
    </div>
  )
}
