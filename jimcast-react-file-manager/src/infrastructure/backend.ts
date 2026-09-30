// [plugins] jimcast-react-file-manager/src/infrastructure/backend.ts

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { defineBackend, useHostStorage } from '@jimcast/react-sdk/server'
import { scoreFields, FIELD_WEIGHT, type SearchResultItem, type Document } from '@jimcast/protocol'
import manifest from '../../manifest.json'
import {
  parseLsEntries, resolveHome, buildPath, entryFullPath, visibleEntries,
  isVideoFile, truncateMiddle, ALLOW_DIRECTORIES,
} from '../domain/fileSystemLogic'
import type { ColumnData, FileEntry } from '../types'

const run = promisify(execFile)
const storage = useHostStorage()

async function listDirRaw(path: string): Promise<string> {
  const { stdout } = await run('ls', ['-p', resolveHome(path)])
  return stdout
}

async function openWithSystemPlayer(path: string): Promise<void> {
  const e = path.replace(/"/g, '\\"')
  try { await run('sh', ['-c', `open "${e}" 2>/dev/null || xdg-open "${e}" 2>/dev/null || start "" "${e}"`]) } catch { /* no opener available */ }
}

async function listDirEntries(path: string, showHidden: boolean, colIndex: number) {
  const col: ColumnData = { path, entries: parseLsEntries(await listDirRaw(path)), loading: false, error: null }
  return visibleEntries(col, colIndex, showHidden)
}

// ─── search / corpus (bodies unchanged) ────────────────────────────────────
const search = async (query: string): Promise<SearchResultItem[]> => {
  const results: SearchResultItem[] = []
  for (const e of await listDirEntries('~', false, 0)) {
    const score = scoreFields(query, [{ text: e.name, weight: FIELD_WEIGHT.label1 }])
    if (score <= 0) continue
    results.push({
      id: e.name, title: e.name, subtitle: e.isDir ? 'directory' : 'file', score,
      action: { type: 'invoke-command', command: 'list', args: { path: e.name } },
    })
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 5)
}

const TEXT_EXT = new Set(['txt', 'md', 'json', 'ts', 'tsx', 'js', 'jsx', 'yaml', 'yml', 'toml', 'csv'])
const MAX_BODY_BYTES = 50_000
const MAX_WALK_DEPTH = 6

async function readPreviewableBody(fullPath: string): Promise<string> {
  const ext = fullPath.split('.').pop()?.toLowerCase() ?? ''
  if (!TEXT_EXT.has(ext)) return ''
  try { return (await run('head', ['-c', String(MAX_BODY_BYTES), fullPath])).stdout } catch { return '' }
}

async function walk(segments: string[], depth: number, emit: (p: string, e: FileEntry) => Promise<void>): Promise<void> {
  if (depth > MAX_WALK_DEPTH) return
  const path = buildPath(segments)
  let stdout: string
  try { stdout = await listDirRaw(path) } catch { return }
  for (const entry of parseLsEntries(stdout)) {
    await emit(`${path}/${entry.name}`, entry)
    if (entry.isDir) await walk([...segments, entry.name], depth + 1, emit)
  }
}

const corpus = async (): Promise<Document[]> => {
  const docs: Document[] = []
  for (const root of ALLOW_DIRECTORIES) {
    await walk([root], 0, async (fullPath, entry) => {
      docs.push({
        id: fullPath,
        kind: entry.isDir ? 'file.directory' : 'file.entry',
        title: entry.name,
        body: entry.isDir ? '' : await readPreviewableBody(fullPath),
        metadata: { path: fullPath, isDir: entry.isDir },
        updatedAt: Date.now(), // still not a real mtime — see earlier note
      })
    })
  }
  return docs
}

// ─── everything below is what the manifest could NOT express ───────────────
defineBackend({
  manifest: manifest as any,

  // contributes.host.commands — args are already parsed/validated by the SDK.
  host: {
    list:     async ({ path }) => ({ entries: await listDirEntries((path ?? '~').trim() || '~', false, 0) }),
    home:     async () => ({ entries: await listDirEntries('~', false, 0) }),
    selected: async () => {
      const raw = await storage.get('multiSelected')
      const paths: string[] = raw ? JSON.parse(raw) : []
      return paths.length === 0 ? { ok: false, error: 'Nothing selected' } : { paths }
    },
  },
  search,
  corpus,

  // Raw RPCs the webview/host call by name. Several look unused by the frontend
  // (listDir, buildPath, entryFullPath, isVideoFile, resolveHome) — grep, then delete.
  rpc: {
    listDir:       async (a: any) => ({ entries: await listDirEntries(a.path ?? '~', a.showHidden ?? false, a.colIndex ?? 1) }),
    resolveHome:   async (a: any) => ({ path: resolveHome(a.path) }),
    buildPath:     async (a: any) => ({ path: buildPath(a.segments) }),
    entryFullPath: async (a: any) => ({ path: entryFullPath(a.segments, a.name, a.homeDir ?? null) }),
    openFile:      async (a: any) => { await openWithSystemPlayer(a.path); return {} },
    isVideoFile:   async (a: any) => ({ isVideo: isVideoFile(a.name) }),
    listRoots:     async () => ({ roots: ALLOW_DIRECTORIES }),
    renderWidget:  async () => ({
      content: {
        type: 'list',
        items: (await listDirEntries('~', false, 0)).map((e) => ({
          id: e.name, title: truncateMiddle(e.name), subtitle: e.isDir ? 'directory' : 'file',
        })),
      },
    }),
    executeCommand: async (a: any) => {
      const q = String(a.query ?? '').toLowerCase()
      if (!q) return { items: [] }
      return {
        items: (await listDirEntries('~', false, 0))
          .filter((e) => e.name.toLowerCase().includes(q))
          .map((e) => ({ id: e.name, title: truncateMiddle(e.name), subtitle: e.isDir ? 'directory' : 'file' })),
      }
    },
  },
})
