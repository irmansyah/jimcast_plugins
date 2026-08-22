import type { Keymap } from "../domain/keymap";

const LABELS: Record<keyof Keymap, string> = {
  moveFocusUp: "Move focus up",
  moveFocusDown: "Move focus down",
  moveFocusLeft: "Move focus to column left",
  moveFocusRight: "Move focus to column right",
  openCard: "Open focused card",
  newCard: "New card in focused column",
  deleteCard: "Delete focused card",
  moveCardLeft: "Move focused card left",
  moveCardRight: "Move focused card right",
  focusSearch: "Focus search",
  closeOrBack: "Close / back",
  toggleHelp: "Toggle this help",
};

export function HelpModal({ keymap, onClose }: { keymap: Keymap; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Keyboard shortcuts</h3>
        {(Object.keys(keymap) as (keyof Keymap)[]).map((action) => (
          <div className="help-row" key={action}>
            <span>{LABELS[action] ?? action}</span>
            <span>
              {keymap[action].map((k) => (
                <span className="help-kbd" key={k}>
                  {k}
                </span>
              ))}
            </span>
          </div>
        ))}
        <div className="modal-hint">Remap any of these in public/config.json · Esc to close</div>
      </div>
    </div>
  );
}
