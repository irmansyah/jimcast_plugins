// jimcast-react-file-manager/src/domain/fileSystemLogic.ts
//
// Ported verbatim from the old [core] frontend/src/external-plugins/
// file-manager/helpers.ts, minus the one function that wasn't pure
// (openWithSystemPlayer, which called callHost — moved to
// infrastructure/backendClient.ts). Everything here has zero imports
// from React, the SDK, or Node — unit-testable in isolation, and safe to
// import from infrastructure/, hooks/, or components/ without pulling in
// any host-call machinery.
import type { ColumnData, FileEntry } from '../types'

export const ALLOW_DIRECTORIES = [
  '~/.config',
  '~/Downloads',
  '~/Media',
  '~/Notes',
  '~/Pictures',
  '~/works',
]
export const ALLOWED_ROOT_NAMES = new Set(ALLOW_DIRECTORIES.map(d => d.replace(/^~\//, '')))

// Video extensions only — these still get handed off to the OS's default
// player rather than opened in-app. Audio used to be bundled in here too
// (as AV_EXT/isAvFile), but audio now opens through the in-app popup
// viewer (core's WidgetFileViewer, via openFiles) same as images/text,
// since that viewer supports an 'audio' kind. Video has no viewer support
// yet, so it keeps the direct system-player path.
export const VIDEO_EXT = new Set([
  'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', '3gp', 'wmv', 'flv',
])

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

export function isVideoFile(name: string): boolean {
  const dot = name.lastIndexOf('.')
  return dot > 0 && VIDEO_EXT.has(name.slice(dot + 1).toLowerCase())
}

// Middle-truncates a long file/dir name so the tail (usually the most
// identifying part — extension, date, suffix) stays visible.
export function truncateMiddle(name: string, headLen = 14, tailLen = 8): string {
  if (name.length <= headLen + tailLen + 3) return name
  return `${name.slice(0, headLen)}...${name.slice(name.length - tailLen)}`
}
