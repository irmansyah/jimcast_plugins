// jimcast-react-file-manager/src/presentation/hooks/useFileManagerNav.ts
//
// Wires the workspace into the host's arrow-key/activate nav protocol via
// @jimcast/react-sdk/react's useHostNav.
//
// The actual focus-movement/activate logic no longer lives here — it was
// lifted into useFileManagerWorkspace.ts's moveFocus/activateFocused so
// that vim hjkl (useFileManagerKeyboard.ts, gated on config.json's
// keybindings.mode) and the host's arrow-key protocol drive the exact
// same code path instead of maintaining two copies. This hook is now
// just a thin adapter from HostNavHandlers's {onArrow, onActivate} shape
// to those two workspace actions.
import { useMemo } from 'react'
import { useHostNav, type HostNavHandlers } from '@jimcast/react-sdk/react'
import type { FileManagerWorkspace } from './useFileManagerWorkspace'

export function useFileManagerNav(workspace: FileManagerWorkspace) {
  const { moveFocus, activateFocused } = workspace

  const navHandlers: HostNavHandlers = useMemo(() => ({
    onArrow: (dir) => moveFocus(dir),
    onActivate: () => activateFocused(),
  }), [moveFocus, activateFocused])

  useHostNav(navHandlers)
}
