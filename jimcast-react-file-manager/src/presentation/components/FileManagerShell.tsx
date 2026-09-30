// jimcast-react-file-manager/src/presentation/components/FileManagerShell.tsx

import type { CSSProperties } from 'react'
import type { UseCommandLineResult } from '@jimcast/react-sdk/react'
import type { ThemeContext } from '@jimcast/protocol'
import { visibleEntries, entryFullPath } from '../../domain/fileSystemLogic'
import type { FileManagerWorkspace } from '../hooks/useFileManagerWorkspace'
import { IconButton } from './IconButton'
import { ColRow, type ColRowStyles } from './ColRow'
import { Breadcrumbs, type BreadcrumbStyles } from './Breadcrumbs'
import { CommandFooter, type CommandFooterStyles } from './CommandFooter'
import { CommandLineBar } from './CommandLineBar'

interface Props {
  workspace: FileManagerWorkspace
  commandLine: UseCommandLineResult
  theme: ThemeContext
  styles: Record<string, CSSProperties>
}

// State + keyboard + host-nav wiring moved to the SDK's createApp. This component is now pure view.
export function FileManagerShell({ workspace, commandLine, theme, styles }: Props) {
  const {
    homeDir, segments, columns, showHidden, focusedIndex, multiSelected,
    footerMode, renameValue, shellCommand,
    setFooterMode, setRenameValue, setShellCommand,
    goUp, jumpToCrumb, handleRowClick, handleRowDoubleClick, handleRowDragStart,
    reportRowFocus, copySelectedPaths, clearSelection,
    performRename, performShellCommand,
  } = workspace

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

      <CommandLineBar cl={commandLine} theme={theme} />

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
