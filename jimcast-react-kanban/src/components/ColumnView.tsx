// [plugins] jimcast-react-kanban/src/components/ColumnView.tsx

import { useState } from "react";
import type { Column } from "../types";
import type { KanbanWorkspace } from "../hooks/useKanbanWorkspace";
import { CardItem } from "./CardItem";

export function ColumnView({
  column,
  columnFocused,
  focusedCardId,
  workspace,
}: {
  column: Column;
  columnFocused: boolean;
  focusedCardId: string | null;
  workspace: KanbanWorkspace;
}) {
  const [draft, setDraft] = useState("");
  const isNewCardOpen = workspace.newCardColumnId === column.id;

  function submit() {
    workspace.submitNewCard(draft);
    setDraft("");
  }

  return (
    <div className={`column${columnFocused ? " focused" : ""}`}>
      <div className="column-title">
        <span>{column.title}</span>
        <span>{column.cards.length}</span>
      </div>
      <div className="column-cards">
        {column.cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            focused={card.id === focusedCardId}
            deletePending={card.id === workspace.deleteConfirmCardId}
            onClick={() => workspace.openFocusedCard()}
          />
        ))}
        {isNewCardOpen && (
          <input
            ref={workspace.newCardInputRef}
            className="new-card-input"
            placeholder="New card title…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setDraft("");
                workspace.cancelNewCard();
              }
              e.stopPropagation();
            }}
          />
        )}
      </div>
    </div>
  );
}
