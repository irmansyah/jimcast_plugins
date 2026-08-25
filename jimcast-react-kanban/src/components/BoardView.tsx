// [plugins] jimcast-react-kanban/src/components/BoardView.tsx

import type { KanbanWorkspace } from "../hooks/useKanbanWorkspace";
import { ColumnView } from "./ColumnView";

export function BoardView({ workspace }: { workspace: KanbanWorkspace }) {
  if (!workspace.currentBoard) {
    return (
      <div className="board-empty">
        <div>No board selected.</div>
        <button onClick={() => workspace.createBoard("Untitled board")}>+ New board</button>
      </div>
    );
  }

  return (
    <div className="board">
      {workspace.columns.map((column, idx) => (
        <ColumnView
          key={column.id}
          column={column}
          columnFocused={idx === workspace.focusedColumnIndex}
          focusedCardId={idx === workspace.focusedColumnIndex ? workspace.focusedCardId : null}
          workspace={workspace}
        />
      ))}
    </div>
  );
}
