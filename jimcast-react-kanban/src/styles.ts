// [plugins] jimcast-react-kanban/src/styles.ts
//
// Plugins run sandboxed and can't import [core]'s designSystem.ts directly,
// so this recreates the same visual language locally: a tinted-border +
// soft-background "selected surface" treatment, and a 2px accent focus
// ring — matching designSystem.ts's selectedSurface()/focusRing() shape
// (see the carry-forward doc's "Keyboard-nav UI note").
//
// Now driven by the real host theme via @jimcast/react-sdk's useTheme()
// hook instead of hand-picked --kb-* hex values — see App.tsx for the
// call site. kanbanStyles is a function of ThemeColors so it re-renders
// the injected <style> tag whenever the host's 'theme' postMessage
// updates it (see client/theme.ts).
//
// --kb-* variable -> ThemeColors field mapping (pick by role, not by eye):
//   --kb-bg      -> colors.bg          base background
//   --kb-bg2     -> colors.bg1         raised surfaces (columns, modals)
//   --kb-fg      -> colors.fg          primary text
//   --kb-fg2     -> colors.fg2         secondary text (card body)
//   --kb-fg4     -> colors.fg4         muted text / placeholders
//   --kb-accent  -> colors.brightBlue  focus / selection / primary action
//   --kb-danger  -> colors.brightRed   delete-confirm state
//   --kb-border  -> colors.bg3         hairline borders
//
// Sizing: .app-shell is pinned to 100vh (was hug-content max-height:500px).
// Since the host caps the iframe at 500px in both directions
// (WidgetExpandable.tsx maxHeight + QuickToolExternalWebview.tsx
// MAX_HEIGHT/DEFAULT_HEIGHT), 100vh settles at a stable fixed 500px rather
// than hugging variable content — this is what lets .command-footer's
// margin-top: auto actually glue it to the bottom instead of sitting
// directly under a short board. .board and .column keep min-height: 0,
// the standard flexbox fix that lets a flex item's own overflow:auto
// actually take effect instead of the item growing to fit its content
// and pushing ancestors taller.
//
// Font: matches [core] globalSetup.ts's font.family stack directly.
// Custom properties set on the host document's :root (--font-family,
// --fs-*) do NOT cross into this sandboxed iframe's own document, so
// var(--font-family) can't be used here the way [core] components use
// it — this is a plain hardcoded copy of the same stack, same pattern
// as the --kb-* color recreation above. If font scale (FONT_SCALE) needs
// to follow the user's config too, that value isn't currently included
// in the 'theme' postMessage payload (only themeName is) — see
// globalSetup.ts's sendThemeToWindow — and would need to be added there
// first.

import type { ThemeColors } from "@jimcast/protocol";

// Mirrors designSystem.ts's hex-alpha-suffix alpha() helper — plugins
// can't import that file directly (sandboxed, see header above), so this
// is a local, minimal re-implementation of the same convention. Assumes
// theme colors are 6-digit hex strings, matching every palette in
// packages/protocol/src/themes/*.ts.
function alpha(color: string, hexSuffix: string): string {
  return `${color}${hexSuffix}`;
}

// Matches [core] frontend/src/globalSetup.ts's computeFont().family exactly.
const KB_FONT_FAMILY = '"JetBrains Mono", "FiraCode Nerd Font", "Fira Code", monospace';

export function kanbanStyles(colors: ThemeColors): string {
  const bg = colors.bg;
  const bg2 = colors.bg1;
  const fg = colors.fg;
  const fg2 = colors.fg2;
  const fg4 = colors.fg4;
  const accent = colors.brightBlue;
  const danger = colors.brightRed;
  const border = colors.bg3;

  return `
:root {
  --kb-bg: ${bg};
  --kb-bg2: ${bg2};
  --kb-fg: ${fg};
  --kb-fg2: ${fg2};
  --kb-fg4: ${fg4};
  --kb-accent: ${accent};
  --kb-danger: ${danger};
  --kb-border: ${border};
  --kb-font: ${KB_FONT_FAMILY};
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#root {
  display: flex;
}

.app-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background: var(--kb-bg);
  color: var(--kb-fg);
  font-family: var(--kb-font);
  font-size: 13px;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--kb-border);
  flex-shrink: 0;
}

.topbar-title { font-weight: 600; letter-spacing: 0.02em; }
.topbar-help-btn {
  background: transparent;
  border: 1px solid var(--kb-border);
  color: var(--kb-fg2);
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--kb-font);
}
.topbar-help-btn:hover { border-color: var(--kb-accent); color: var(--kb-accent); }

.board-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--kb-fg4);
}
.board-empty button {
  background: var(--kb-accent);
  color: #0d1117;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-weight: 600;
  font-family: var(--kb-font);
}

.board {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 0;
}

.column {
  display: flex;
  flex-direction: column;
  width: 260px;
  min-width: 260px;
  background: var(--kb-bg2);
  border: 1px solid var(--kb-border);
  border-radius: 6px;
  padding: 8px;
  gap: 6px;
  min-height: 0;
}

.column.focused {
  border-color: ${alpha(accent, "8C")};
}

.column-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--kb-fg4);
  padding: 2px 4px 6px;
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
}

.column-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  min-height: 0;
}

.card {
  background: var(--kb-bg);
  border: 1px solid ${alpha(fg4, "55")};
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
  color: var(--kb-fg2);
}

.card.focused {
  background: var(--kb-bg2);
  border-color: ${alpha(accent, "8C")};
  color: var(--kb-accent);
  outline: none;
  box-shadow: 0 0 0 2px ${alpha(accent, "55")};
}

.card.delete-pending {
  border-color: ${alpha(danger, "A8")};
  color: var(--kb-danger);
}

.new-card-input, .rename-input {
  width: 100%;
  background: var(--kb-bg);
  border: 1px solid var(--kb-accent);
  border-radius: 4px;
  padding: 6px 8px;
  color: var(--kb-fg);
  font-size: 13px;
  font-family: var(--kb-font);
  outline: none;
}

.add-card-btn {
  background: transparent;
  border: 1px dashed ${alpha(fg4, "55")};
  border-radius: 4px;
  padding: 6px 8px;
  color: var(--kb-fg4);
  font-size: 12px;
  font-family: var(--kb-font);
  cursor: pointer;
  text-align: left;
  flex-shrink: 0;
}
.add-card-btn:hover {
  border-color: var(--kb-accent);
  color: var(--kb-accent);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.modal {
  background: var(--kb-bg2);
  border: 1px solid var(--kb-border);
  border-radius: 8px;
  padding: 16px;
  min-width: 320px;
  max-width: 480px;
  font-family: var(--kb-font);
}

.modal h3 { margin: 0 0 10px; font-size: 14px; }
.modal-hint { color: var(--kb-fg4); font-size: 11px; margin-top: 10px; }

.help-kbd {
  display: inline-block;
  background: var(--kb-bg);
  border: 1px solid var(--kb-border);
  border-radius: 3px;
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  margin-right: 4px;
}

.help-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid ${alpha(fg4, "2E")};
}

.command-footer {
  flex-shrink: 0;
  margin-top: auto;
  border-top: 1px solid var(--kb-border);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.command-footer-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.command-footer-prompt { color: var(--kb-fg4); }

.command-footer input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--kb-fg);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
}

.command-footer-feedback {
  font-size: 11px;
  color: var(--kb-fg4);
}
.command-footer-feedback.error { color: var(--kb-danger); }

.command-footer-hint {
  font-size: 11px;
  color: var(--kb-fg4);
}
`;
}
