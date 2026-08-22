import type { KanbanWorkspace } from "../hooks/useKanbanWorkspace";

export function TopBar({ workspace, onShowHelp }: { workspace: KanbanWorkspace; onShowHelp: () => void }) {
  return (
    <div className="topbar">
      <div className="topbar-title">{workspace.currentBoard ? workspace.currentBoard.name : "REACT KANBAN"}</div>
      <button className="topbar-help-btn" onClick={onShowHelp}>
        ? Help
      </button>
    </div>
  );
}
