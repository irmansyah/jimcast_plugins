// jimcast-react-file-manager/src/application/columnLoading.ts
//
// Composes infrastructure/backendClient.ts (shellExec) with
// domain/fileSystemLogic.ts (parseLsEntries, buildPath, resolveHome) into
// the "load $HOME" and "load a directory column" operations. Ported from
// the two effect bodies at the top of the old FileManagerPlugin.tsx —
// the shape of each fetch is unchanged, this just gives it a name outside
// the component so useFileManagerWorkspace doesn't have to inline it.

import { shellExec } from '../infrastructure/backendClient'
import { buildPath, parseLsEntries, resolveHome } from '../domain/fileSystemLogic'
import type { ColumnData } from '../types'

export async function loadHomeDir(): Promise<string | null> {
  try {
    const { stdout } = await shellExec('echo $HOME', { trim_output: true })
    return stdout.trim()
  } catch {
    return null
  }
}

// -A so hidden entries actually come back from the shell — filtering them
// client-side (visibleEntries) only works if ls returned them in the
// first place.
export async function loadColumn(path: string): Promise<ColumnData> {
  try {
    const escaped = resolveHome(path).replace(/"/g, '\\"')
    const { stdout, exitCode } = await shellExec(
      `cd "${escaped}" 2>/dev/null && ls -1pA`,
      { ignore_exit_code: true, trim_output: true },
    )
    if (exitCode !== 0) return { path, entries: [], loading: false, error: "Can't open" }
    return { path, entries: parseLsEntries(stdout), loading: false, error: null }
  } catch {
    return { path, entries: [], loading: false, error: 'Failed to read directory' }
  }
}

// Re-fetches the *entire* column chain, not just the changed column —
// matches the original's strategy. `segments` is the full breadcrumb
// path (e.g. ['~', 'Projects', 'foo']); this loads one column per prefix.
export function loadColumns(segments: string[]): Promise<ColumnData[]> {
  const paths = segments.map((_, i) => buildPath(segments.slice(0, i + 1)))
  return Promise.all(paths.map(loadColumn))
}
