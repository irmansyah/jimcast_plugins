// [plugins] jimcast-react-kanban-v2/src/styles.ts
//
// Plugins run sandboxed and can't import [core]'s designSystem.ts directly,
// so this recreates the same visual language locally: a tinted-border +
// soft-background "selected surface" treatment, and a 2px accent focus
// ring — matching designSystem.ts's selectedSurface()/focusRing() shape
// (see the carry-forward doc's "Keyboard-nav UI note").
//
// Scroll containment: html/body/#root are reset and locked to 100% height
// with overflow hidden, so the document itself never scrolls or grows —
// the app always matches whatever height the host/iframe assigns it,
// rather than triggering client/index.ts's contentHeight auto-report
// (that mechanism is for hug-content widgets, not a fixed-size app).
// .board and .column both get min-height: 0, the standard flexbox fix
// that lets a flex item's own overflow:auto actually take effect instead
// of the item growing to fit its content and pushing ancestors taller.

export const kanbanStyles = `
:root {
  --kb-bg: #1b1c20;
  --kb-bg2: #232429;
  --kb-fg: #e6e6e8;
  --kb-fg2: #b8b9c0;
  --kb-fg4: #6b6c74;
  --kb-accent: #5b9dff;
  --kb-danger: #ff6b6b;
  --kb-border: #33343b;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}

#root {
  height: 100%;
}

.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--kb-bg);
  color: var(--kb-fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
  border-color: rgba(91, 157, 255, 0.55);
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
  border: 1px solid rgba(107, 108, 116, 0.33);
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
  color: var(--kb-fg2);
}

.card.focused {
  background: var(--kb-bg2);
  border-color: rgba(91, 157, 255, 0.55);
  color: var(--kb-accent);
  outline: none;
  box-shadow: 0 0 0 2px rgba(91, 157, 255, 0.33);
}

.card.delete-pending {
  border-color: rgba(255, 107, 107, 0.66);
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
  outline: none;
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
  border-bottom: 1px solid rgba(107, 108, 116, 0.18);
}

.command-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--kb-border);
  padding: 6px 12px;
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
