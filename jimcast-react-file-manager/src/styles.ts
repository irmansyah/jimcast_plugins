// [plugins] jimcast-react-file-manager/src/styles.ts
//
// Deliberately diverges from kanban's styles.ts pattern: kanban's tree is
// built on CSS classes + one injected <style> string, but
// FileExplorerPlugin.tsx uses React.CSSProperties objects passed directly
// as `style={...}` props throughout (e.g. `style={styles.crumb}`).
// Converting the component to class-based styling too is out of scope for
// this migration — the goal is the SDK swap + architecture split, not a
// styling-system rewrite. So this stays a
// Record<string, React.CSSProperties> factory, just now a function of
// ThemeContext instead of a static object built from
// designSystem/globalSetup imports.
//
// Field mapping from the old designSystem/globalSetup tokens to
// @jimcast/protocol's ThemeContext:
//   fv('sm')      -> px(t.sm)            (was a token helper, now a raw number + px())
//   fv('family')  -> t.family             (already a plain string, no unit)
//   space.xs      -> s.gapSm              (old scale had xs/sm/md/lg; ThemeSpacing only has sm/md/lg)
//   space.md      -> s.gapMd
//   radius.sm/md  -> s.radiusSm / s.radiusMd
//   theme.color.X -> c.X                  (ThemeColors field names match 1:1 — bg, fg, fg2, fg4,
//                                           bg1, bg2, brightBlue, brightGreen, brightYellow, brightRed, etc.)
//   hairline(c)   -> local hairline(c) below (same as kanban precedent — not importable from a plugin)
//   alpha(c, w)   -> local alpha(c, w) below, APPROXIMATED (see note)
//
// Two approximations, flagged rather than silently guessed away:
//
// 1. alpha() — designSystem.ts's exact alpha-suffix percentages for
//    'muted'/'heavy' were never shown (same gap kanban's own local alpha()
//    helper had to work around). Using 25%/60% opacity (hex suffixes
//    '40'/'99') as reasonable defaults. Adjust here if the real values
//    turn out to read differently.
// 2. space.xs -> s.gapSm — lossy: the old 4-tier scale collapses onto
//    ThemeSpacing's 3-tier gapSm/gapMd/gapLg, so there's no tier smaller
//    than gapSm to fall back to if this reads too spacious in the UI.
//
// Also assumes ThemeColors/ThemeTypography/ThemeSpacing and the `px`
// helper get added to @jimcast/protocol's root src/index.ts export line —
// currently only resolveTheme/defaultTheme/ThemeContext are exported at
// root (same root-export gap flagged for catppuccinTheme etc. last
// session). If that hasn't landed, these imports need a deep path instead
// (@jimcast/protocol/themes/theme) — unconfirmed whether the package's
// exports map even allows that.
//
// `root` (added below): the plugin's outer container, previously
// unstyled (FileExplorerShell.tsx's top-level <div> had no `style` prop
// at all). Caps the plugin's total height at 500px with its own
// vertical scroll, independent of columnsRow's fixed 500px column-list
// height — if the header/breadcrumbs/footer push total content past
// 500px, the root scrolls rather than the plugin growing unbounded.

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

export function fileExplorerStyles(theme: ThemeContext): Record<string, CSSProperties> {
  const c = theme.colors
  const t = theme.typography
  const s = theme.spacing

  return {
    root: {
      display:       'flex',
      flexDirection: 'column',
      maxHeight:     500,
      overflowY:     'auto',
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
