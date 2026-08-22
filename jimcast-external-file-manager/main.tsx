// [core] frontend/src/external-plugins/file-manager/main.tsx
//
// Standalone mount entry — this is what `jimcast-plugin://file-manager/`
// actually needs to serve once this bundle is built and registered as a
// real plugin. NOT wired to anything yet: I don't have visibility into
// this repo's build tooling or how `jimcast-plugin://` resolves to served
// files, so treat this as a stub showing the shape, not a working entry
// point. Needs pairing with whatever bundles/serves plugin content today.

import { createRoot } from 'react-dom/client'
import { FileExplorerPlugin } from './FileExplorerPlugin'

const container = document.getElementById('root')
if (!container) {
  throw new Error('[file-manager plugin] #root element not found')
}
createRoot(container).render(<FileExplorerPlugin />)
