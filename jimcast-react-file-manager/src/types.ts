// jimcast-plugins/jimcast-external-file-manager/src/types.ts
//
// Pure types shared across domain/application/infrastructure/components.
// No SDK or React imports — this file must stay leaf-level.

export interface FileEntry {
  name:  string
  isDir: boolean
}

export interface ColumnData {
  path:    string
  entries: FileEntry[]
  loading: boolean
  error:   string | null
}

export type FooterMode = 'hint' | 'confirm-delete' | 'rename' | 'shell'

// Anchor for shift-click range selection — colIndex + the index within
// that column's *visible* entries at the moment the anchor was set.
export interface SelectionAnchor {
  colIndex: number
  idx:      number
}
