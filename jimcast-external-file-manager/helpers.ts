// [core] frontend/src/external-plugins/file-manager/helpers.ts
//
// Pure helpers, ported from
// components/quick_tools/quickToolFileManager.helpers.ts. Fully
// self-contained — no imports from the host app's domain/hooks/
// infrastructure trees, since this file ships as part of the plugin
// bundle and won't have access to them once bundled standalone. The one
// runtime dependency that couldn't be made pure (openWithSystemPlayer's
// shell call) goes through plugin-sdk's callHost instead of widgetPort.

import { callHost } from '../../plugin-sdk/client'

export interface FileEntry {
  name:  string
  isDir: boolean
}

export interface ColumnData {
  path:    string
  entries: FileEntry[]
  loading: boolean
  error:   string | null
}

export const ALLOW_DIRECTORIES = [
  '~/.config',
  '~/Downloads',
  '~/Media',
  '~/Notes',
  '~/Pictures',
  '~/works',
]
export const ALLOWED_ROOT_NAMES = new Set(ALLOW_DIRECTORIES.map(d => d.replace(/^~\//, '')))

// Local copy of domain/widget/textUtils' `lines()` — trivial enough that
// duplicating it here beats reaching into the host tree from a plugin
// bundle that's meant to be able to ship standalone.
function lines(stdout: string): string[] {
  return stdout.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0)
}

export function parseLsEntries(stdout: string): FileEntry[] {
  return lines(stdout)
    .filter(line => line !== '.' && line !== '..')
    .map(line => {
      const isDir = line.endsWith('/')
      return { name: isDir ? line.slice(0, -1) : line, isDir }
    })
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

export function resolveHome(p: string): string {
  return (p === '~' || p.startsWith('~/')) ? `$HOME${p.slice(1)}` : p
}

export function buildPath(segments: string[]): string {
  return segments.reduce((acc, seg, i) => (i === 0 ? seg : `${acc}/${seg}`), '')
}

export function basename(path: string): string {
  return path.split(/[/\\]/).pop() || path
}

export function entryFullPath(segments: string[], name: string, homeDir: string | null): string {
  const raw = `${buildPath(segments)}/${name}`
  if (raw === '~' || raw.startsWith('~/')) {
    return homeDir ? `${homeDir}${raw.slice(1)}` : resolveHome(raw)
  }
  return raw
}

export function visibleEntries(col: ColumnData, colIndex: number, showHidden: boolean): FileEntry[] {
  let entries = col.entries
  if (!showHidden) entries = entries.filter(e => !e.name.startsWith('.'))
  if (colIndex === 0) entries = entries.filter(e => e.isDir && ALLOWED_ROOT_NAMES.has(e.name))
  return entries
}

// Audio/video extensions that get handed off to the OS's default player
// rather than previewed in-app.
export const AV_EXT = new Set([
  'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus',              // audio
  'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', '3gp', 'wmv', 'flv',  // video
])

export function isAvFile(name: string): boolean {
  const dot = name.lastIndexOf('.')
  return dot > 0 && AV_EXT.has(name.slice(dot + 1).toLowerCase())
}

// Was a direct widgetPort.shellExec call; now goes through callHost,
// which the host resolves to the same invoke_plugin_command('shellExec',
// ...) path a Rust-side handler needs to implement (see README.md in this
// directory). Same OS-fallback shell one-liner as before.
export async function openWithSystemPlayer(path: string) {
  const escaped = path.replace(/"/g, '\\"')
  try {
    await callHost<{ stdout: string; exitCode: number }>('shellExec', {
      cmd: `open "${escaped}" 2>/dev/null || xdg-open "${escaped}" 2>/dev/null || start "" "${escaped}"`,
      opts: { ignore_exit_code: true, trim_output: true },
    })
  } catch {
    // Nothing actionable client-side if every fallback is unavailable.
  }
}

// Middle-truncates a long file/dir name so the tail (usually the most
// identifying part — extension, date, suffix) stays visible.
export function truncateMiddle(name: string, headLen = 14, tailLen = 8): string {
  if (name.length <= headLen + tailLen + 3) return name
  return `${name.slice(0, headLen)}...${name.slice(name.length - tailLen)}`
}
