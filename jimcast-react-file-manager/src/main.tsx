// [plugins] jimcast-react-file-manager/src/main.tsx

import { createApp } from '@jimcast/react-sdk/react'
import type { PluginManifest } from '@jimcast/protocol'
import manifest from '../manifest.json'
import './index.css'
import App from './App'
import { useFileManagerWorkspace, type FileManagerWorkspace } from './presentation/hooks/useFileManagerWorkspace'
import { commandLine, actions, argResolvers, type FileManagerConfig } from './handlers'

createApp<FileManagerWorkspace, FileManagerConfig>({
  // JSON imports widen string literals, so the cast is needed for the enum/type fields.
  manifest: manifest as unknown as PluginManifest,
  useWorkspace: () => useFileManagerWorkspace(),
  // While the delete-confirm footer is showing, ONLY the "confirm-delete" layer is active.
  keyContext: (ws) => (ws.footerMode === 'confirm-delete' ? 'confirm-delete' : null),
  commandLine,
  actions,
  argResolvers,
  view: App,
})
