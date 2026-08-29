// jimcast-react-file-manager/src/presentation/components/CommandFooter.tsx
//
// The four footerMode-conditional blocks from the bottom of the original
// component, unchanged — hint (keyboard shortcut reminders),
// confirm-delete, rename (inline form), shell (inline form, {} placeholder
// hint). Escape inside either form is handled locally here (onKeyDown),
// same as the original — the global keyboard hook (useFileManagerKeyboard)
// explicitly ignores keydowns while focus is in an <input>/<textarea>, so
// this is the only place Escape-while-typing is caught.

import type { CSSProperties } from 'react'
import type { FooterMode } from '../../types'

export interface CommandFooterStyles {
  footer:      CSSProperties
  footerHint:  CSSProperties
  footerWarn:  CSSProperties
  kbd:         CSSProperties
  footerInput: CSSProperties
}

export function CommandFooter({
  footerMode, selectedCount, renameValue, shellCommand, styles,
  onRenameChange, onShellChange, onRenameSubmit, onShellSubmit, onCancel,
}: {
  footerMode:     FooterMode
  selectedCount:  number
  renameValue:    string
  shellCommand:   string
  styles:         CommandFooterStyles
  onRenameChange: (v: string) => void
  onShellChange:  (v: string) => void
  onRenameSubmit: () => void
  onShellSubmit:  () => void
  onCancel:       () => void
}) {
  if (footerMode === 'hint' && selectedCount > 0) {
    return (
      <div style={styles.footer}>
        <span style={styles.footerHint}><span style={styles.kbd}>d</span> delete</span>
        {selectedCount === 1 && (
          <span style={styles.footerHint}><span style={styles.kbd}>m</span> rename</span>
        )}
        <span style={styles.footerHint}><span style={styles.kbd}>!</span> shell</span>
      </div>
    )
  }

  if (footerMode === 'confirm-delete') {
    return (
      <div style={styles.footer}>
        <span style={styles.footerWarn}>
          Delete {selectedCount} file{selectedCount > 1 ? 's' : ''}?
        </span>
        <span style={styles.footerHint}>
          <span style={styles.kbd}>d</span>/<span style={styles.kbd}>y</span> confirm · <span style={styles.kbd}>esc</span> cancel
        </span>
      </div>
    )
  }

  if (footerMode === 'rename') {
    return (
      <form style={styles.footer} onSubmit={(e) => { e.preventDefault(); onRenameSubmit() }}>
        <span style={styles.footerHint}>Rename to</span>
        <input
          autoFocus
          style={styles.footerInput}
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onCancel() } }}
        />
      </form>
    )
  }

  if (footerMode === 'shell') {
    return (
      <form style={styles.footer} onSubmit={(e) => { e.preventDefault(); onShellSubmit() }}>
        <span style={styles.footerHint}>!</span>
        <input
          autoFocus
          style={styles.footerInput}
          placeholder="command — {} expands to selected path(s)"
          value={shellCommand}
          onChange={(e) => onShellChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onCancel() } }}
        />
      </form>
    )
  }

  return null
}
