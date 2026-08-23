// [plugins] jimcast-react-kanban-v2/src/components/HelpModal.tsx
//
// Phase A #1: extended to take kanbanCommands.ts's registry as an optional
// second section, so `?` (or :list/:commands, once App.tsx wires openHelp
// through — see HANDOFF.md) shows both keymap AND :command usage in one
// place, instead of :list dumping everything as a single joined toast line.
//
// `commands` is optional and defaults to an empty list so this file works
// standalone even before that wiring lands — the command section simply
// doesn't render if nothing's passed in.
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

export interface HelpCommandEntry {
  name: string;
  aliases?: string[];
  usage: string;
}

export function HelpModal({
  keymap,
  commands = [],
  onClose,
}: {
  keymap: Keymap;
  commands?: HelpCommandEntry[];
  onClose: () => void;
}) {
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

        {commands.length > 0 && (
          <>
            <h3 className="modal-section-heading">Commands</h3>
            {commands.map((cmd) => (
              <div className="help-row" key={cmd.name}>
                <span>
                  {cmd.name}
                  {cmd.aliases?.length ? (
                    <span className="help-aliases"> ({cmd.aliases.join(", ")})</span>
                  ) : null}
                </span>
                <span className="help-usage">:{cmd.usage}</span>
              </div>
            ))}
          </>
        )}

        <div className="modal-hint">Remap any of these in public/config.json · Esc to close</div>
      </div>
    </div>
  );
}
