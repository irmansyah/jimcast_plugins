// jimcast-react-file-manager/src/infrastructure/backend.ts
//
// Replaces the old hand-rolled readline/NDJSON dispatch loop with
// @jimcast/react-sdk/server's defineWebviewBackend, which owns the single
// stdin reader for the process and disambiguates inbound host->plugin
// requests from replies to our own callHost() calls via hostRpc's
// resolvePending() — something the old loop never had to do because it
// never called callHost() itself.
//
// defineWebviewBackend's WebviewBackendDefinition shape
// ({ [command]: (args) => unknown | Promise<unknown> }) is exactly what
// the old flat `handlers` table already was, so every handler body below
// is an unmodified port — no reshaping needed, confirmed against the real
// signature this time (not guessed).
//
// NOT using the `commands` (CommandDefinition[]) sugar param — the old
// backend never had per-command metadata/arg-specs, just this flat
// dispatch table, so there's nothing to gain from it yet. Worth revisiting
// if the host ever wants to auto-discover this plugin's commands via
// LIST_COMMANDS_ID without a manifest field.
//
// isAvFile -> isVideoFile rename: fileSystemLogic.ts split its old
// AV_EXT (audio+video) into VIDEO_EXT only, now that audio opens through
// the host's in-app popup viewer (via openFiles, a host-UI-only call
// intercepted in QuickToolExternalWebview.tsx — never reaches this
// process) instead of the OS system player. openFile below is
// unchanged — it's the single-video-file system-player path, called
// only when fileOpening.ts's isVideoFile check matches.
//
// NOTE: if anything else in this codebase still calls
// callHost('isAvFile', ...) expecting audio to also report true, that
// call site needs to move to the openFiles/viewer path instead — this
// handler's semantics changed from "is this AV" to "is this video".

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { defineWebviewBackend } from '@jimcast/react-sdk/server'
import {
  parseLsEntries,
  resolveHome,
  buildPath,
  entryFullPath,
  visibleEntries,
  isVideoFile,
  truncateMiddle,
  ALLOW_DIRECTORIES,
} from '../domain/fileSystemLogic'
import type { ColumnData } from '../types'

const run = promisify(execFile)

// ─── shell helpers ───────────────────────────────────────────────────────
// PATH is already the resolved login-shell PATH — build_sandbox_env
// (plugin_runtime.rs) sets it before spawning this process. Unchanged
// from the old backend.ts.

async function listDirRaw(path: string): Promise<string> {
  const { stdout } = await run('ls', ['-p', resolveHome(path)])
  return stdout
}

async function openWithSystemPlayer(path: string): Promise<void> {
  const escaped = path.replace(/"/g, '\\"')
  const cmd = `open "${escaped}" 2>/dev/null || xdg-open "${escaped}" 2>/dev/null || start "" "${escaped}"`
  try {
    await run('sh', ['-c', cmd])
  } catch {
    // Nothing actionable client-side if every OS-opener fallback is unavailable.
  }
}

// ─── handlers ─────────────────────────────────────────────────────────────

defineWebviewBackend({
  // args: { path: string, showHidden?: boolean, colIndex?: number }
  listDir: async (args: any) => {
    const path: string = args.path ?? '~'
    const showHidden: boolean = args.showHidden ?? false
    const colIndex: number = args.colIndex ?? 1

    const stdout = await listDirRaw(path)
    const col: ColumnData = { path, entries: parseLsEntries(stdout), loading: false, error: null }
    return { entries: visibleEntries(col, colIndex, showHidden) }
  },

  // args: { path: string }
  resolveHome: async (args: any) => ({ path: resolveHome(args.path) }),

  // args: { segments: string[] }
  buildPath: async (args: any) => ({ path: buildPath(args.segments) }),

  // args: { segments: string[], name: string, homeDir: string | null }
  entryFullPath: async (args: any) => ({
    path: entryFullPath(args.segments, args.name, args.homeDir ?? null),
  }),

  // args: { path: string } — video-only now; see file header.
  openFile: async (args: any) => {
    await openWithSystemPlayer(args.path)
    return {}
  },

  // args: { name: string } — renamed from isAvFile; video-only now.
  isVideoFile: async (args: any) => ({ isVideo: isVideoFile(args.name) }),

  // Roots shown at column 0 — mirrors domain/fileSystemLogic.ts's
  // ALLOW_DIRECTORIES so the webview doesn't need its own copy.
  listRoots: async () => ({ roots: ALLOW_DIRECTORIES }),

  // Host widget contract — see PluginService::render_widget. Shape below
  // is a minimal placeholder; UNVERIFIED against the real widget content
  // schema (domain/widget/types.ts in [core]) — confirm before relying on
  // it rendering correctly in WidgetSlot. Carried over unchanged from the
  // old backend.ts, where this same caveat applied.
  renderWidget: async () => {
    const stdout = await listDirRaw('~')
    const col: ColumnData = { path: '~', entries: parseLsEntries(stdout), loading: false, error: null }
    const entries = visibleEntries(col, 0, false)
    return {
      content: {
        type: 'list',
        items: entries.map(e => ({
          id: e.name,
          title: truncateMiddle(e.name),
          subtitle: e.isDir ? 'directory' : 'file',
        })),
      },
    }
  },

  // Command-bar fan-out contract — see PluginService::query_all, which
  // calls "executeCommand" on every enabled plugin and expects
  // { items: [...] } back.
  executeCommand: async (args: any) => {
    const query: string = (args.query ?? '').toLowerCase()
    if (!query) return { items: [] }

    const stdout = await listDirRaw('~')
    const col: ColumnData = { path: '~', entries: parseLsEntries(stdout), loading: false, error: null }
    const items = visibleEntries(col, 0, false)
      .filter(e => e.name.toLowerCase().includes(query))
      .map(e => ({ id: e.name, title: truncateMiddle(e.name), subtitle: e.isDir ? 'directory' : 'file' }))
    return { items }
  },
})
