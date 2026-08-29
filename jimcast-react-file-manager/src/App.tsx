// [plugins] jimcast-react-file-manager/src/App.tsx
//
// Mirrors kanban's App.tsx: resolve the theme, build styles from it, mount
// the shell. Trivial now that useTheme (client), fileManagerStyles, and
// useHostNav (react) all exist.
//
// FileManagerShell doesn't exist yet — it's the remaining big task (the
// 633-line FileManagerPlugin.tsx split into presentation/hooks/
// useFileManagerWorkspace.ts + presentation/components/*, see
// CARRY_FORWARD.md). This file establishes the target wiring so that
// split has a concrete interface to build toward, rather than being
// designed in a vacuum.

import { useTheme } from '@jimcast/react-sdk/client'
import { fileManagerStyles } from './styles'
import { FileManagerShell } from './presentation/components/FileManagerShell'

export default function App() {
  const theme = useTheme()
  const styles = fileManagerStyles(theme)
  return <FileManagerShell styles={styles} />
}
