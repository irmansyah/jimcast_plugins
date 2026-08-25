// jimcast-react-file-manager/src/domain/selectionLogic.ts
//
// Extracted from the old FileExplorerPlugin.tsx's handleRowClick /
// selectAllInColumn / toggleFocusedSelection. Pure functions operating on
// a Set<string> of full paths — no state, no React, no SDK. The
// component/hook layer owns the actual useState<Set<string>> and calls
// these to compute the next value.
//
// Preserved a real quirk from the source rather than "fixing" it:
// selectAllInColumn/toggleFocusedSelection in the original called
// entryFullPath(segmentsRef.current, ...) — the FULL segments array, not
// sliced to colIndex+1 like handleRowClick's range-select branch does.
// This only works because both callers only ever operate on the last
// (deepest) column, where segments.length === columns.length, so
// segments.slice(0, colIndex+1) === segments for that column. Both
// selectAllFilesInColumn and toggleSelectionAtIndex below take an
// explicit colIndex and slice consistently — equivalent for the
// last-column call site, but callers MUST NOT pass a non-last colIndex
// without re-checking this assumption.

import type { ColumnData, SelectionAnchor } from '../types'
import { entryFullPath, visibleEntries } from './fileSystemLogic'

export function toggleSelection(current: Set<string>, path: string): Set<string> {
  const next = new Set(current)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  return next
}

// Shift-click: selects the contiguous visible-entry range between the
// anchor and the clicked index, replacing (not merging with) the current
// selection — matches the original's `setMultiSelected(new Set(rangePaths))`.
// Directories are dropped from the range, same as the source.
export function rangeSelect(
  col:         ColumnData,
  colIndex:    number,
  anchor:      SelectionAnchor,
  targetIdx:   number,
  showHidden:  boolean,
  segments:    string[],
  homeDir:     string | null,
): Set<string> {
  const visible = visibleEntries(col, colIndex, showHidden)
  const lo = Math.min(anchor.idx, targetIdx)
  const hi = Math.max(anchor.idx, targetIdx)
  const rangePaths = visible
    .slice(lo, hi + 1)
    .filter(e => !e.isDir)
    .map(e => entryFullPath(segments.slice(0, colIndex + 1), e.name, homeDir))
  return new Set(rangePaths)
}

// Adds every file (not directory) in the given column to the current
// selection. Original call site: always the last/deepest column — see
// header note on the segments-slicing assumption.
export function selectAllFilesInColumn(
  col:        ColumnData,
  colIndex:   number,
  showHidden: boolean,
  segments:   string[],
  homeDir:    string | null,
  current:    Set<string>,
): Set<string> {
  const visible = visibleEntries(col, colIndex, showHidden)
  const paths = visible
    .filter(e => !e.isDir)
    .map(e => entryFullPath(segments.slice(0, colIndex + 1), e.name, homeDir))
  return new Set([...current, ...paths])
}

// Toggles the single currently-focused (keyboard-navigated) entry.
// Returns null if there's nothing selectable at that index (loading,
// errored column, out-of-range index, or the entry is a directory —
// directories are never added to selection, matching the source).
export function toggleFocusedSelection(
  col:          ColumnData,
  colIndex:     number,
  focusedIdx:   number,
  showHidden:   boolean,
  segments:     string[],
  homeDir:      string | null,
  current:      Set<string>,
): { next: Set<string>; anchor: SelectionAnchor } | null {
  if (col.loading || col.error) return null
  const visible = visibleEntries(col, colIndex, showHidden)
  const entry = visible[focusedIdx]
  if (!entry || entry.isDir) return null

  const fullPath = entryFullPath(segments.slice(0, colIndex + 1), entry.name, homeDir)
  return {
    next:   toggleSelection(current, fullPath),
    anchor: { colIndex, idx: focusedIdx },
  }
}
