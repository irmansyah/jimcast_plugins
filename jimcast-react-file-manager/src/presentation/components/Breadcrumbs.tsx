// jimcast-react-file-manager/src/presentation/components/Breadcrumbs.tsx

import type { CSSProperties } from 'react'
import { basename } from '../../domain/fileSystemLogic'

export interface BreadcrumbStyles {
  crumb:       CSSProperties
  crumbActive: CSSProperties
  crumbSep:    CSSProperties
}

export function Breadcrumbs({
  segments, styles, onJump,
}: {
  segments: string[]
  styles:   BreadcrumbStyles
  onJump:   (colIndex: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {segments.map((seg, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
          <span
            style={i === segments.length - 1 ? { ...styles.crumb, ...styles.crumbActive } : styles.crumb}
            onClick={() => onJump(i)}
          >
            {seg === '~' ? '~' : basename(seg)}
          </span>
          {i < segments.length - 1 && <span style={styles.crumbSep}>/</span>}
        </span>
      ))}
    </div>
  )
}
