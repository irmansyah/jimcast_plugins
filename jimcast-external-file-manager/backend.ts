// [core] frontend/src/external-plugins/file-manager/backend.ts
//
// Node-side command handler — this is what plugin_runtime.rs::spawn_plugin
// actually execs (via package.json's "main"), talking NDJSON over
// stdin/stdout per domain::plugin::protocol. Separate from main.tsx
// (webview UI, loaded in an iframe over postMessage) and from
// plugin-sdk/client.ts (which is the WEBVIEW's host-caller, not this
// process's — this file has no use for it).
//
// Reuses helpers.ts's pure functions, but does NOT reuse
// helpers.ts::openWithSystemPlayer as-is: that function imports callHost
// from plugin-sdk/client.ts, which speaks postMessage and assumes a
// `window` — neither exists in this Node process. The "shell" capability
// declared in package.json's jimcast.capabilities means this process can
// just exec directly instead of round-tripping through the host for it.
//
// Single stdin reader, single responsibility: this process currently only
// RECEIVES requests (host -> plugin) and never INITIATES its own (plugin
// -> host) — no storage/ui calls needed for file listing, so there's no
// hostRpc.ts here and no reader-collision concern to worry about. If a
// future command needs e.g. persisted "recent paths", introduce hostRpc.ts
// then and merge its reply-resolution into this same reader rather than
// giving it a second stdin listener.

import * as readline from 'node:readline'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  parseLsEntries,
  resolveHome,
  buildPath,
  entryFullPath,
  visibleEntries,
  isAvFile,
  truncateMiddle,
  ALLOW_DIRECTORIES,
  type ColumnData,
} from './helpers'

const run = promisify(execFile)

type IpcRequest = { id: string; command: string; args: Record<string, any> }

function respond(id: string, result: unknown) {
  process.stdout.write(JSON.stringify({ id, result }) + '\n')
}
function respondErr(id: string, error: string) {
  process.stdout.write(JSON.stringify({ id, error }) + '\n')
}

// ─── shell helpers ───────────────────────────────────────────────────────
// PATH is already the resolved login-shell PATH — build_sandbox_env
// (plugin_runtime.rs) sets it before spawning this process.

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

// ─── command handlers ────────────────────────────────────────────────────

const handlers: Record<string, (args: any) => Promise<unknown>> = {
  // args: { path: string, showHidden?: boolean, colIndex?: number }
  listDir: async (args) => {
    const path: string = args.path ?? '~'
    const showHidden: boolean = args.showHidden ?? false
    const colIndex: number = args.colIndex ?? 1

    const stdout = await listDirRaw(path)
    const col: ColumnData = { path, entries: parseLsEntries(stdout), loading: false, error: null }
    return { entries: visibleEntries(col, colIndex, showHidden) }
  },

  // args: { path: string }
  resolveHome: async (args) => ({ path: resolveHome(args.path) }),

  // args: { segments: string[] }
  buildPath: async (args) => ({ path: buildPath(args.segments) }),

  // args: { segments: string[], name: string, homeDir: string | null }
  entryFullPath: async (args) => ({
    path: entryFullPath(args.segments, args.name, args.homeDir ?? null),
  }),

  // args: { path: string }
  openFile: async (args) => {
    await openWithSystemPlayer(args.path)
    return {}
  },

  // args: { name: string }
  isAvFile: async (args) => ({ isAv: isAvFile(args.name) }),

  // Roots shown at column 0 — mirrors helpers.ts::ALLOW_DIRECTORIES so the
  // webview doesn't need its own copy of the allowlist.
  listRoots: async () => ({ roots: ALLOW_DIRECTORIES }),

  // Host widget contract — see PluginService::render_widget. Shape below
  // is a minimal placeholder; UNVERIFIED against the real widget content
  // schema (domain/widget/types.ts) — confirm before relying on it
  // rendering correctly in WidgetSlot.
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
  executeCommand: async (args) => {
    const query: string = (args.query ?? '').toLowerCase()
    if (!query) return { items: [] }

    const stdout = await listDirRaw('~')
    const col: ColumnData = { path: '~', entries: parseLsEntries(stdout), loading: false, error: null }
    const items = visibleEntries(col, 0, false)
      .filter(e => e.name.toLowerCase().includes(query))
      .map(e => ({ id: e.name, title: truncateMiddle(e.name), subtitle: e.isDir ? 'directory' : 'file' }))
    return { items }
  },
}

// ─── stdio dispatch loop ─────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin })
rl.on('line', async (line) => {
  if (!line.trim()) return

  let req: IpcRequest
  try {
    req = JSON.parse(line)
  } catch {
    // Malformed line — matches the host's tolerance for "sent non-JSON"
    // (plugin_runtime.rs logs and continues rather than crashing).
    return
  }

  if (!req.command) return

  const handler = handlers[req.command]
  if (!handler) return respondErr(req.id, `unknown command: ${req.command}`)

  try {
    respond(req.id, await handler(req.args ?? {}))
  } catch (e) {
    respondErr(req.id, e instanceof Error ? e.message : String(e))
  }
})
