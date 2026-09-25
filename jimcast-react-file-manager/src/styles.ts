// [plugins] jimcast-react-file-manager/src/styles.ts

import type { CSSProperties } from 'react'
import type { ThemeContext } from '@jimcast/protocol'

function px(n: number): string {
  return `${n}px`
}

function alpha(hex: string, weight: 'muted' | 'heavy'): string {
  const suffix = weight === 'muted' ? '40' : '99'
  return `${hex}${suffix}`
}

function hairline(hex: string): string {
  return `1px solid ${hex}`
}

export function fileManagerStyles(theme: ThemeContext): Record<string, CSSProperties> {
  const c = theme.colors
  const t = theme.typography
  const s = theme.spacing

  return {
    root: {
      display:       'flex',
      flexDirection: 'column',
      fontFamily:    t.family,
    },
    headerRow: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    },
    navBtns: {
      display: 'flex', gap: px(s.gapSm), alignItems: 'center',
      padding: `${px(s.gapMd - 2)} ${px(s.gapMd)}`,
    },
    selectionCount: {
      fontSize: px(t.sm),
      color:    c.brightBlue,
      fontWeight: 600,
    },
    hiddenBadge: {
      fontSize: px(t.sm),
      color:    c.fg4,
    },
    title: {
      fontSize:   px(t.sm),
      fontWeight: 600,
      color:      c.fg,
      padding:    `${px(s.gapMd - 2)} ${px(s.gapMd)}`,
      fontFamily: t.family,
      userSelect:       'none',
      WebkitUserSelect: 'none',
    },
    crumb: {
      fontSize:     px(t.sm),
      color:        c.fg4,
      cursor:       'pointer',
      borderRadius: px(s.radiusSm),
      padding:      `${px(s.gapMd - 2)} ${px(s.gapMd)}`,
      fontFamily:   t.family,
      userSelect:       'none',
      WebkitUserSelect: 'none',
    },
    crumbActive: {
      color:      c.fg,
      fontWeight: 600,
    },
    crumbSep: {
      fontSize: px(t.sm),
      color:    c.fg4,
      margin:   '0 1px',
      opacity:  0.6,
    },
    columnsRow: {
      display:      'flex',
      flexDirection: 'row',
      border:       hairline(c.bg2),
      borderRadius: px(s.radiusMd),
      overflowX:    'auto',
      height:       500,
    },
    column: {
      flex:          '0 0 300px',
      borderRight:   hairline(c.bg1),
      overflowY:     'auto',
      display:       'flex',
      flexDirection: 'column',
    },
    colRow: {
      display:    'flex',
      alignItems: 'center',
      gap:        px(s.gapSm),
      padding:    '3px 8px',
      fontSize:   px(t.sm),
      cursor:     'pointer',
      color:      c.fg2,
      border:     hairline('transparent'),
      userSelect:       'none',
      WebkitUserSelect: 'none',
    },
    colRowSelected: {
      background: alpha(c.brightBlue, 'muted'),
      color:      c.fg,
    },
    colRowMultiSelected: {
      background: alpha(c.brightGreen, 'muted'),
      color:      c.fg,
    },
    colRowFocused: {
      border: hairline(alpha(c.brightYellow, 'heavy')),
    },
    checkbox: {
      fontSize:   px(t.sm),
      flexShrink: 0,
      color:      c.fg4,
    },
    icon: {
      fontSize:   px(t.sm),
      flexShrink: 0,
    },
    name: {
      flex:         '1 1 auto',
      overflow:     'hidden',
      textOverflow: 'ellipsis',
      whiteSpace:   'nowrap',
      fontSize:     px(t.sm),
    },
    chevron: {
      marginLeft: 'auto',
      color:      c.fg4,
      fontSize:   px(t.sm),
      flexShrink: 0,
    },
    muted: {
      fontSize: px(t.sm),
      color:    c.fg4,
    },
    error: {
      fontSize: px(t.sm),
      color:    c.brightRed,
    },
    footer: {
      display:    'flex',
      alignItems: 'center',
      gap:        px(s.gapMd),
      padding:    `${px(s.gapSm)} ${px(s.gapMd)}`,
      borderTop:  hairline(c.bg2),
      fontSize:   px(t.sm),
    },
    footerHint: {
      color:      c.fg4,
      display:    'flex',
      alignItems: 'center',
      gap:        4,
    },
    footerWarn: {
      color:      c.brightRed,
      fontWeight: 600,
    },
    kbd: {
      fontFamily:   t.family,
      fontSize:     px(t.sm),
      padding:      '1px 5px',
      borderRadius: px(s.radiusSm),
      background:   alpha(c.fg4, 'muted'),
      color:        c.fg,
    },
    footerInput: {
      flex:         1,
      fontFamily:   t.family,
      fontSize:     px(t.sm),
      background:   'transparent',
      border:       hairline(c.bg2),
      borderRadius: px(s.radiusSm),
      color:        c.fg,
      padding:      '2px 6px',
      outline:      'none',
    },
  }
}
