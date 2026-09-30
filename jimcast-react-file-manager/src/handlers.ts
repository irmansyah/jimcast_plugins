// [plugins] jimcast-react-file-manager/src/handlers.ts

import type { CommandLineHandler, ArgResolvers, ActionHandler } from '@jimcast/react-sdk/react'
import type { FileManagerWorkspace } from './presentation/hooks/useFileManagerWorkspace'
import { resolveEntryTarget } from './domain/resolveEntryTarget'
import { basename, visibleEntries } from './domain/fileSystemLogic'

type S = FileManagerWorkspace
type H = CommandLineHandler<S>

const ok = (message?: string) => ({ ok: true as const, message })
const fail = (message: string) => ({ ok: false as const, message })

export interface FileManagerConfig { keyMode: 'normal' | 'vim' }

// ── arg resolvers ──────────────────────────────────────────────────────────
export const argResolvers: ArgResolvers<S> = {
  entry: (v, ws) => resolveEntryTarget(ws, v),
  entryOrPath: (v, ws) => {
    const t = resolveEntryTarget(ws, v)
    return t ? { path: t.path, entry: t.entry } : { path: v, entry: null }
  },
}

// ── ":" commands ───────────────────────────────────────────────────────────
export const commandLine: Record<string, H> = {
  up: ({ state }) => {
    if (state.segments.length <= 1) return fail('Already at root')
    state.goUp(); return ok('Moved up one level')
  },
  home: ({ state }) => { state.jumpToCrumb(0); return ok('Jumped to home') },

  open: ({ args, state }) => {
    const targets = args.targets as { path: string; entry: { name: string; isDir: boolean } | null }[]
    const first = targets[0]
    if (targets.length === 1 && first?.entry) {
      state.openEntry(state.columns.length - 1, first.entry)
      return ok(`Opening "${first.entry.name}"`)
    }
    state.selectAndOpenPaths(targets.map((t) => t.path))
    return ok(`Opened and selected ${targets.length} file(s)`)
  },

  select: ({ args, state }) => { state.selectEntry(args.target.index); return ok(`Selected "${args.target.entry.name}"`) },
  'select-all': ({ state }) => { state.selectAllInColumn(); return ok('Selected all in column') },
  'select-match': ({ args, state }) => {
    const n = state.selectMatchingInColumn(args.pattern)
    return n === 0 ? fail(`No files match "${args.pattern}"`) : ok(`Selected ${n} file(s) matching "${args.pattern}"`)
  },
  selected: ({ state }) => {
    const paths = Array.from(state.multiSelected)
    return paths.length === 0 ? fail('Nothing selected') : ok(paths.join('\n'))
  },
  'clear-selection': ({ state }) => { state.clearSelection(); return ok('Selection cleared') },
  copy: ({ state }) => {
    const n = state.multiSelected.size
    if (n === 0) return fail('Nothing selected')
    state.copySelectedPaths(); return ok(`Copied ${n} path(s)`)
  },

  // Uses performDeleteWith(paths) — NOT selectEntry()+performDelete(). With `delete! foo` the
  // confirm resolves instantly, before React re-renders, so performDelete would read a stale selection.
  delete: async ({ args, state, ctx }) => {
    const paths = args.target ? [args.target.path as string] : Array.from(state.multiSelected)
    if (paths.length === 0) return fail('Nothing selected')
    if (!(await ctx.confirm(`Delete ${paths.length} item(s)?`))) return ok('Delete cancelled')
    await state.performDeleteWith(paths)
    return ok(`Deleted ${paths.length} item(s)`)
  },
  rename: async ({ args, state }) => {
    await state.performRenameWith(args.target.path, args.newName)
    return ok(`Renamed to "${args.newName}"`)
  },
  run: async ({ args, state }) => {
    await state.performShellCommandWith(args.cmd, Array.from(state.multiSelected))
    return ok(`Ran "${args.cmd}"`)
  },

  'toggle-hidden': ({ state }) => { state.setShowHidden((h: boolean) => !h); return ok('Toggled hidden files') },
  list: ({ ctx }) => { ctx.notify({ type: 'ok', text: ctx.usage() }); return ok('Listing commands…') },
}

// ── key actions (ported 1:1 from the old useFileManagerKeyboard) ───────────
// `return false` = guard failed, key not consumed (same as the old early-returns without preventDefault).
export const actions: Record<string, ActionHandler<S>> = {
  moveUp:    ({ state }) => state.moveFocus('ArrowUp'),
  moveDown:  ({ state }) => state.moveFocus('ArrowDown'),
  moveLeft:  ({ state }) => state.moveFocus('ArrowLeft'),
  moveRight: ({ state }) => state.moveFocus('ArrowRight'),
  activate:  ({ state }) => state.activateFocused(),

  // vim "l": on a FILE it activates (like Enter); on a directory it moves right.
  vimRight: ({ state }) => {
    const cols = state.columnsRef.current
    const last = cols[cols.length - 1]
    if (last && !last.loading && !last.error) {
      const entry = visibleEntries(last, cols.length - 1, state.showHiddenRef.current)[state.focusedIndexRef.current]
      if (entry && !entry.isDir) { state.activateFocused(); return }
    }
    state.moveFocus('ArrowRight')
  },

  toggleSelection: ({ state }) => state.toggleFocusedSelection(),
  selectAll:       ({ state }) => state.selectAllInColumn(),
  copyPaths: ({ state }) => {
    if (state.multiSelectedRef.current.size === 0) return false
    state.copySelectedPaths()
  },

  deleteSelection: ({ state }) => {
    if (state.multiSelectedRef.current.size === 0 || state.footerModeRef.current !== 'hint') return false
    state.setFooterMode('confirm-delete')
  },
  renameSelection: ({ state }) => {
    const sel = state.multiSelectedRef.current
    const only = Array.from(sel)[0]
    if (sel.size !== 1 || only === undefined || state.footerModeRef.current !== 'hint') return false
    state.setRenameValue(basename(only))
    state.setFooterMode('rename')
  },
  shellOnSelection: ({ state }) => {
    if (state.multiSelectedRef.current.size === 0 || state.footerModeRef.current !== 'hint') return false
    state.setShellCommand('')
    state.setFooterMode('shell')
  },
  toggleHidden: ({ state }) => { state.setShowHidden((h: boolean) => !h); state.setFocusedIndex(0) },

  // modal layer "confirm-delete"
  confirmDelete: ({ state }) => { void state.performDelete() },
  cancelConfirm: ({ state }) => state.setFooterMode('hint'),
}
