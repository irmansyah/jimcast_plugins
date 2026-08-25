// [plugins] jimcast-react-kanban/src/components/CardModal.tsx
//
import { useState } from "react";
import type { KanbanWorkspace } from "../hooks/useKanbanWorkspace";

export function CardModal({ workspace }: { workspace: KanbanWorkspace }) {
  const card = workspace.editingCard;
  const [draft, setDraft] = useState(card?.title ?? "");

  if (!card) return null;

  function save() {
    if (draft.trim()) workspace.renameFocusedCard(draft.trim());
    workspace.closeCardModal();
  }

  return (
    <div className="modal-backdrop" onClick={workspace.closeCardModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit card</h3>
        <input
          className="rename-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              workspace.closeCardModal();
            }
            e.stopPropagation();
          }}
        />
        <div className="modal-hint">Enter to save · Esc to close</div>
      </div>
    </div>
  );
}
