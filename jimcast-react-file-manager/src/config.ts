// [plugins] jimcast-react-file-manager/src/config.ts
//
// Static app config, bundled at build time (Vite handles the JSON import;
// TS needs "resolveJsonModule": true in tsconfig.json for this to
// typecheck — add it under compilerOptions if it's not already there).
import rawConfig from '../config.json'

export type KeybindingMode = 'normal' | 'vim'

interface AppConfig {
  keybindings?: {
    mode?: string
  }
}

const config = rawConfig as AppConfig

export const keybindingMode: KeybindingMode =
  config.keybindings?.mode === 'vim' ? 'vim' : 'normal'
