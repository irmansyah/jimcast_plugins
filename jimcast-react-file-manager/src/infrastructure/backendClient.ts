// jimcast-react-file-manager/src/infrastructure/backendClient.ts
//
// The single seam through which this plugin's hooks/components talk to
// the host. Every call that used to go through [core]'s local
// `../../plugin-sdk/client` now goes through `@jimcast/react-sdk/client`
// instead — that's the actual substance of the migration for this file.
//
// callHost's signature is identical between the two (confirmed against
// [sdk] packages/react-sdk/src/client/index.ts:
//   callHost<T>(command: string, args?: Record<string, unknown>): Promise<T>
// ), so every *body* below is a 1:1 port. reportFocusedItem and
// reportDragStarted are also both exported from the same module with
// matching signatures, so they're re-exported here rather than
// reimplemented, keeping this file the one place that imports
// '@jimcast/react-sdk/client' directly.
//
// NOT ported here: openHostNav-style nav subscription — that's
// hooks/useFileExplorerNav.ts's job.
//
// openFiles: this now round-trips correctly. The host's
// QuickToolExternalWebview.tsx intercepts the 'openFiles' command
// directly (it opens the in-app popup viewer, a pure host-UI action with
// no Rust primitive or plugin-backend command behind it) and always
// replies, so callHost('openFiles', ...) never hangs. A rejection here
// means something real — an actually-unknown command, a plugin-backend
// crash, etc. — so errors are now logged instead of silently swallowed;
// previously that swallowing was hiding the fact that 'openFiles' simply
// didn't exist as a command anywhere yet.
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

export function startDrag(paths: string[], allDirs = false): void {
  void callHost('startDrag', { paths, allDirs }).catch(() => {})
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
