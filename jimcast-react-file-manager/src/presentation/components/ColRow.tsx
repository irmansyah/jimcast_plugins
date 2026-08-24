// jimcast-plugins/jimcast-external-file-manager/src/presentation/components/ColRow.tsx
//
// Kept the original's mousedown-then-move-past-threshold drag-arming
// logic verbatim — firing native drag unconditionally on mousedown would
// swallow the mouseup and break click/double-click. Also keeps the local
// useScrollIntoViewWhenSelected reimplementation (tiny enough not to need
// its own file) rather than reaching for a host hook that isn't
// available to a standalone plugin bundle.

import { useCallback, useEffect, useRef } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { truncateMiddle } from '../../domain/fileSystemLogic'
import type { FileEntry } from '../../types'

const DRAG_THRESHOLD_PX = 4

function useScrollIntoViewWhenSelected<T extends HTMLElement>(selected: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])
  return ref
}

export interface ColRowStyles {
  colRow:              CSSProperties
  colRowMultiSelected: CSSProperties
  colRowFocused:       CSSProperties
  checkbox:            CSSProperties
  icon:                CSSProperties
  name:                CSSProperties
  chevron:             CSSProperties
}

export function ColRow({
  entry, isFocused, isMultiSelected, styles, onClick, onDoubleClick, onDragStart, onFocusReport,
}: {
  entry:           FileEntry
  isFocused:       boolean
  isMultiSelected: boolean
  styles:          ColRowStyles
  onClick:         (e: MouseEvent) => void
  onDoubleClick:   (e: MouseEvent) => void
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

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    const target = e.currentTarget as HTMLElement

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    const onMove = (ev: globalThis.MouseEvent) => {
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
