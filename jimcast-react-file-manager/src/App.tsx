// [plugins] jimcast-react-file-manager/src/App.tsx
//
// Mirrors kanban's App.tsx: resolve the theme, build styles from it, mount
// the shell. Trivial now that useTheme (client), fileExplorerStyles, and
// useHostNav (react) all exist.
//
// FileExplorerShell doesn't exist yet — it's the remaining big task (the
// 633-line FileExplorerPlugin.tsx split into presentation/hooks/
// useFileExplorerWorkspace.ts + presentation/components/*, see
// CARRY_FORWARD.md). This file establishes the target wiring so that
// split has a concrete interface to build toward, rather than being
// designed in a vacuum.

import { useTheme } from '@jimcast/react-sdk/client'
import { fileExplorerStyles } from './styles'
import { FileExplorerShell } from './presentation/components/FileExplorerShell'

export default function App() {
  const theme = useTheme()
  const styles = fileExplorerStyles(theme)
  return <FileExplorerShell styles={styles} />
}
