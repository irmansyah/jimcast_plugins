// [plugins] jimcast-react-file-manager/src/App.tsx

import { useEffect } from 'react'
import { useTheme } from '@jimcast/react-sdk/client'
import { fileManagerStyles } from './styles'
import { FileManagerShell } from './presentation/components/FileManagerShell'

export default function App() {
  const theme = useTheme()
  const styles = fileManagerStyles(theme)

  // Mirror [core]'s globalSetup.ts::applyTokens(): this iframe has its own
  // document, so the host's CSS variables (set on ITS document) never
  // reach here. Without this, index.css's scrollbar rules (which read
  // these same variable names) have nothing to resolve against and every
  // scroll area in this plugin falls back to the default browser/webview
  // scrollbar instead of following the active theme.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--color-bg',  theme.colors.bg)
    root.style.setProperty('--color-bg3', theme.colors.bg3)
    root.style.setProperty('--color-bg4', theme.colors.bg4)
    root.style.setProperty('color-scheme', theme.mode)
  }, [theme])

  return <FileManagerShell styles={styles} />
}
