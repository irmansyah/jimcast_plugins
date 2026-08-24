// jimcast-plugins/jimcast-external-file-manager/src/main.tsx
//
// Standard Vite+React entry point — was missing entirely. App.tsx existed
// but nothing ever called ReactDOM's createRoot/render on it.

import { createRoot } from 'react-dom/client'
import App from './App'

const root = document.getElementById('root')
if (!root) throw new Error('#root element not found')

createRoot(root).render(<App />)
