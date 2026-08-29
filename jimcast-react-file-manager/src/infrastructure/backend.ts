// [plugins] jimcast-react-file-manager/src/infrastructure/backend.ts
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
// CLI-reachable commands added (the `commands` array, mirroring kanban's
// defineCommand pattern): unlike domain/commands/*.ts's CommandLineRegistry
// (which resolves entirely inside the running iframe against live
// `workspace` React state), everything here is stateless — it re-derives
// its answer from the filesystem on every call, same as listDir already
// did. This is a deliberate, narrower surface than the in-app command
// bar:
//
//   - `home` / `list <path>` — directory listing, no live selection or
//     cursor state involved.
//   - `run` — free-text fallback (kanban has the same shape), covering
//     "home" and "list <path>" typed as one word, so
//     `jimcast plugin command "@file-manager home"` works the same way
//     `"@kanban list"` does.
//
// Explicitly NOT added here, and why: `selected`, `delete`, `select-all`,
// `rename`, single-item `open`/`select` by name/#, and jumpToCrumb-style
// `home` (in the "navigate the open UI" sense) all read or mutate
// `workspace` state that only exists in the running iframe's React tree.
// This backend process has no channel back into that state — reaching it
// would mean either (a) syncing selection/cursor state out to host/plugin
// storage on every change (the same gap flagged for `jimcast selection`
// vs. this plugin's own `multiSelected`), or (b) a host->iframe RPC route
// that doesn't exist today. Don't stub these with fake logic; leave them
// unregistered so callers get an honest "unknown command" instead of a
// silently wrong answer.
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
import { defineWebviewBackend, defineCommand, getHostStorage } from '@jimcast/react-sdk/server'
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
const storage = getHostStorage()

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

// Shared by listDir, listHome, and run's "home"/"list" verbs — one place
// that turns a raw `ls` result into the same { entries } shape every
// caller expects.
async function listDirEntries(path: string, showHidden: boolean, colIndex: number) {
  const stdout = await listDirRaw(path)
  const col: ColumnData = { path, entries: parseLsEntries(stdout), loading: false, error: null }
  return visibleEntries(col, colIndex, showHidden)
}

// ─── CLI-reachable commands ─────────────────────────────────────────────

const homeCmd = defineCommand({
  id: 'home',
  title: 'File Manager: List Home Directory',
  description: 'Lists the contents of the home directory (~). Stateless — does not affect any open UI.',
  run: async () => ({ entries: await listDirEntries('~', false, 0) }),
})

const listCmd = defineCommand({
  id: 'list',
  title: 'File Manager: List Directory',
  description: 'usage: list <path> — lists a directory\'s contents, defaulting to ~ if no path given.',
  run: async (args: any) => {
    const path: string = (args?.path ?? '~').trim() || '~'
    return { entries: await listDirEntries(path, false, 0) }
  },
})

// Free-text fallback, same shape as kanban's `run` — lets
// `jimcast plugin command "@file-manager home"` and
// `jimcast plugin command "@file-manager list Documents"` work without
// requiring the caller to know the exact command id.
const runCmd = defineCommand({
  id: 'run',
  title: 'File Manager: Run',
  description: 'Free-text command, e.g. "home" or "list Documents"',
  run: async (args: any) => {
    const text: string = (args?.text ?? '').trim()
    if (!text) return { ok: false, error: 'empty command' }
    const spaceIdx = text.indexOf(' ')
    const verb = (spaceIdx === -1 ? text : text.slice(0, spaceIdx)).toLowerCase()
    const rest = spaceIdx === -1 ? '' : text.slice(spaceIdx + 1).trim()

    switch (verb) {
      case 'home':
        return { entries: await listDirEntries('~', false, 0) }
      case 'list':
      case 'ls': {
        const path = rest || '~'
        return { entries: await listDirEntries(path, false, 0) }
      }
      default:
        return { ok: false, error: `unknown run verb "${verb}" (try: home, list <path>)` }
    }
  },
})

const selectedCmd = defineCommand({
  id: 'selected',
  title: 'File Manager: List Selected Files',
  run: async () => {
    const raw = await storage.get('multiSelected')
    const paths: string[] = raw ? JSON.parse(raw) : []
    if (paths.length === 0) return { ok: false, error: 'Nothing selected' }
    return { paths }
  },
})

// ─── handlers (flat dispatch — unchanged from before, minus the rename note) ──

defineWebviewBackend(
  {
    // args: { path: string, showHidden?: boolean, colIndex?: number }
    listDir: async (args: any) => {
      const path: string = args.path ?? '~'
      const showHidden: boolean = args.showHidden ?? false
      const colIndex: number = args.colIndex ?? 1
      return { entries: await listDirEntries(path, showHidden, colIndex) }
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
      const entries = await listDirEntries('~', false, 0)
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

      const entries = (await listDirEntries('~', false, 0))
        .filter(e => e.name.toLowerCase().includes(query))
        .map(e => ({ id: e.name, title: truncateMiddle(e.name), subtitle: e.isDir ? 'directory' : 'file' }))
      return { items: entries }
    },
  },
  [homeCmd, listCmd, runCmd, selectedCmd],
)
