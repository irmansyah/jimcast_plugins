// [plugins] jimcast-react-file-manager/src/infrastructure/backendClient.ts

import { callHost, reportFocusedItem, reportDragStarted } from '@jimcast/react-sdk/client'

export { reportFocusedItem, reportDragStarted }

export interface ShellExecResult {
  stdout:   string
  exitCode: number
}

export interface ShellExecOpts {
  ignore_exit_code?: boolean
  trim_output?:      boolean
}

export async function shellExec(cmd: string, opts: ShellExecOpts = {}): Promise<ShellExecResult> {
  return callHost<ShellExecResult>('shellExec', { cmd, opts })
}

export function openPaths(paths: string[]): void {
  void callHost('openFiles', { paths }).catch((err) => {
    console.error('[file-manager] openFiles failed', err)
  })
}

export function startDrag(paths: string[], rect: DOMRect, allDirs = false): void {
  reportDragStarted(paths, {
    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
  })
  void allDirs
}

// Was helpers.ts::openWithSystemPlayer. Moved here (rather than staying
// in domain/) because it makes a host call — the actual shell one-liner
// and its OS-fallback chain (open -> xdg-open -> start) are unchanged
// from the original. Video-only now — see fileOpening.ts.
export async function openWithSystemPlayer(path: string): Promise<void> {
  const escaped = path.replace(/"/g, '\\"')
  try {
    await callHost<ShellExecResult>('shellExec', {
      cmd: `open "${escaped}" 2>/dev/null || xdg-open "${escaped}" 2>/dev/null || start "" "${escaped}"`,
      opts: { ignore_exit_code: true, trim_output: true },
    })
  } catch (err) {
    console.error('[file-manager] openWithSystemPlayer failed', err)
  }
}
