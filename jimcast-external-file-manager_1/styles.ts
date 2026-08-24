// [core] frontend/src/external-plugins/file-manager/styles.ts
//
// Ported from components/quick_tools/quickToolFileManager.styles.ts.
//
// KNOWN DEBT: this still imports theme tokens from the host's
// designSystem/globalSetup, which is the one host-tree coupling this
// plugin bundle hasn't shed yet. Once this plugin actually ships as a
// separate build, these tokens need to travel a different way — e.g. the
// host posts a `themeSync` event (same envelope as `nav`) with the
// current MODE_META colors, and this file reads from a small in-plugin
// theme store fed by that event instead of importing `theme` directly.
// Left as host-coupled for now since the immediate goal is decoupling the
// *behavior* (shell/drag/nav/openFiles), not the theme system — flagging
// so it isn't mistaken for finished decoupling.
//
// Also fixes a real bug found while porting: `crumbSep` was defined but
// commented out in the original file while `QuickToolFileManager.tsx`
// line 611 still references `styles.crumbSep` live. Not a crash (styling
// an element with `undefined` is harmless in React) but the breadcrumb
// `/` separator was rendering unstyled. Restored here.

import { alpha, hairline, radius, space } from "../../designSystem"
import { fv, theme } from "../../globalSetup"

export const styles: Record<string, React.CSSProperties> = {
  headerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  navBtns: { display: 'flex', gap: space.xs, alignItems: 'center', padding: `${space.md - 2}px ${space.md}px`,
 },
  selectionCount: {
    fontSize: fv('sm'),
    color:    theme.color.brightBlue,
    fontWeight: 600,
  },
  hiddenBadge: {
    fontSize: fv('sm'),
    color:    theme.color.fg4,
  },
  title: {
    fontSize:   fv('sm'),
    fontWeight: 600,
    color:      theme.color.fg,
    padding: `${space.md - 2}px ${space.md}px`,
    fontFamily: fv('family'),
    userSelect:       'none',
    WebkitUserSelect: 'none',
  },
  crumb: {
    fontSize:     fv('sm'),
    color:        theme.color.fg4,
    cursor:       'pointer',
    borderRadius: radius.sm,
    padding: `${space.md - 2}px ${space.md}px`,
    fontFamily: fv('family'),
    userSelect:       'none',
    WebkitUserSelect: 'none',
  },
  crumbActive: {
    color:      theme.color.fg,
    fontWeight: 600,
  },
  // Restored — was commented out in the source file despite being
  // referenced live at QuickToolFileManager.tsx:611. See file header.
  crumbSep: {
    fontSize: fv('sm'),
    color:    theme.color.fg4,
    margin:   '0 1px',
    opacity:  0.6,
  },
  columnsRow: {
    display:      'flex',
    flexDirection: 'row',
    border:       hairline(theme.color.bg2),
    borderRadius: radius.md,
    overflowX:    'auto',
    height:       500,
  },
  column: {
    flex:          '0 0 300px',
    borderRight:   hairline(theme.color.bg1),
    overflowY:     'auto',
    display:       'flex',
    flexDirection: 'column',
  },
  colRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        space.xs,
    padding:    '3px 8px',
    fontSize:   fv('sm'),
    cursor:     'pointer',
    color:      theme.color.fg2,
    border:     hairline('transparent'),
    userSelect:       'none',
    WebkitUserSelect: 'none',
  },
  colRowSelected: {
    background: alpha(theme.color.brightBlue, 'muted'),
    color:      theme.color.fg,
  },
  colRowMultiSelected: {
    background: alpha(theme.color.brightGreen, 'muted'),
    color:      theme.color.fg,
  },
  colRowFocused: {
    border: hairline(alpha(theme.color.brightYellow, 'heavy')),
  },
  checkbox: {
    fontSize:   fv('sm'),
    flexShrink: 0,
    color:      theme.color.fg4,
  },
  icon: {
    fontSize:   fv('sm'),
    flexShrink: 0,
  },
  name: {
    flex:         '1 1 auto',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap',
    fontSize:     fv('sm'),
  },
  chevron: {
    marginLeft: 'auto',
    color:      theme.color.fg4,
    fontSize:   fv('sm'),
    flexShrink: 0,
  },
  muted: {
    fontSize: fv('sm'),
    color:    theme.color.fg4,
  },
  error: {
    fontSize: fv('sm'),
    color:    theme.color.brightRed,
  },
  footer: {
    display:    'flex',
    alignItems: 'center',
    gap:        space.md,
    padding:    `${space.xs}px ${space.md}px`,
    borderTop:  hairline(theme.color.bg2),
    fontSize:   fv('sm'),
  },
  footerHint: {
    color:      theme.color.fg4,
    display:    'flex',
    alignItems: 'center',
    gap:        4,
  },
  footerWarn: {
    color:      theme.color.brightRed,
    fontWeight: 600,
  },
  kbd: {
    fontFamily:   fv('family'),
    fontSize:     fv('sm'),
    padding:      '1px 5px',
    borderRadius: radius.sm,
    background:   alpha(theme.color.fg4, 'muted'),
    color:        theme.color.fg,
  },
  footerInput: {
    flex:         1,
    fontFamily:   fv('family'),
    fontSize:     fv('sm'),
    background:   'transparent',
    border:       hairline(theme.color.bg2),
    borderRadius: radius.sm,
    color:        theme.color.fg,
    padding:      '2px 6px',
    outline:      'none',
  },
}
