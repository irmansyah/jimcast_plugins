// [plugins] jimcast-react-file-manager/src/App.tsx

import { useEffect } from 'react'
import type { AppViewProps } from '@jimcast/react-sdk/react'
import { fileManagerStyles } from './styles'
import { FileManagerShell } from './presentation/components/FileManagerShell'
import type { FileManagerWorkspace } from './presentation/hooks/useFileManagerWorkspace'
import type { FileManagerConfig } from './handlers'

export default function App({ workspace, commandLine, theme }: AppViewProps<FileManagerWorkspace, FileManagerConfig>) {
  const styles = fileManagerStyles(theme)

  // Mirror [core]'s globalSetup.ts::applyTokens() — see original comment: this iframe has its own document.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--color-bg',  theme.colors.bg)
    root.style.setProperty('--color-bg3', theme.colors.bg3)
    root.style.setProperty('--color-bg4', theme.colors.bg4)
    root.style.setProperty('color-scheme', theme.mode)
  }, [theme])

  return <FileManagerShell workspace={workspace} commandLine={commandLine} theme={theme} styles={styles} />
}
