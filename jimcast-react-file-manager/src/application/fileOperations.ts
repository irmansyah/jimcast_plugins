// jimcast-react-file-manager/src/application/fileOperations.ts
//
// The three side-effecting file operations (delete/rename/run-shell),
// each composing infrastructure/backendClient.ts's shellExec with a bit
// of path-quoting logic. UI-level validation (empty input, rename-to-
// same-name no-op) stays in the hook that calls these — these assume
// they're only invoked with already-valid input, the same division the
// original component had between its keyboard-driven state machine and
// the shellExec calls themselves.

import { shellExec } from '../infrastructure/backendClient'
import { basename } from '../domain/fileSystemLogic'

function quote(path: string): string {
  return `"${path.replace(/"/g, '\\"')}"`
}

// trash-first, rm -rf fallback only if trash isn't installed — unchanged
// from the original.
export async function deleteFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const quoted = paths.map(quote).join(' ')
  await shellExec(`trash ${quoted} 2>/dev/null || rm -rf ${quoted}`, { ignore_exit_code: true })
}

// Returns the new full path so the caller can update selection state to
// point at it.
export async function renameFile(oldPath: string, newName: string): Promise<string> {
  const dir = oldPath.slice(0, oldPath.length - basename(oldPath).length)
  const newPath = `${dir}${newName}`
  await shellExec(`mv ${quote(oldPath)} ${quote(newPath)}`, { ignore_exit_code: true })
  return newPath
}

// {} expands to the selected paths; appended at the end if absent —
// unchanged from the original.
export async function runShellCommand(cmd: string, selectedPaths: string[]): Promise<void> {
  const filesArg = selectedPaths.map(quote).join(' ')
  const finalCmd = cmd.includes('{}') ? cmd.replace(/\{\}/g, filesArg) : `${cmd} ${filesArg}`
  await shellExec(finalCmd, { ignore_exit_code: true })
}
