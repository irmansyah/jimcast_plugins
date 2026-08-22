import type React from "react";
import type { RestWorkspace } from "../hooks/useRestWorkspace";

export function RequestSidebar({ workspace }: { workspace: RestWorkspace }) {
  const { requests, selectedId, focusedIndex, deleteConfirmId, listRefs } = workspace;

  function onListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    const key = e.key;
    if (deleteConfirmId) {
      if (key === "y" || key === "Y") {
        e.preventDefault();
        workspace.handleDelete(deleteConfirmId);
      } else if (key === "Escape" || key === "n" || key === "N") {
        e.preventDefault();
        workspace.setDeleteConfirmId(null);
      }
      return;
    }
    if (key === "ArrowDown" || key === "j") {
      e.preventDefault();
      workspace.moveFocus(1);
    } else if (key === "ArrowUp" || key === "k") {
      e.preventDefault();
      workspace.moveFocus(-1);
    } else if (key === "Enter" || key === "e" || key === "l" || key === "ArrowRight") {
      e.preventDefault();
      const req = requests[focusedIndex];
      if (req) workspace.selectRequest(req.id, focusedIndex, true);
    } else if (key === "d" || key === "Delete") {
      e.preventDefault();
      const req = requests[focusedIndex];
      if (req) workspace.setDeleteConfirmId(req.id);
    }
  }

  return (
    <div className="sidebar">
      <div className="sidebar-head">
        <h2>Requests</h2>
        <button className="new-btn" title="New request (n)" onClick={workspace.handleNew}>
          +
        </button>
      </div>
      {requests.length === 0 ? (
        <div className="empty-list">No requests yet. Press n or click + to add one.</div>
      ) : (
        <ul className="req-list" role="listbox" aria-label="Saved requests" onKeyDown={onListKeyDown}>
          {requests.map((r, idx) => (
            <li key={r.id}>
              <div
                ref={(el) => (listRefs.current[idx] = el)}
                role="option"
                aria-selected={r.id === selectedId}
                tabIndex={idx === focusedIndex ? 0 : -1}
                data-active={idx === focusedIndex}
                className={`req-item ${r.method} ${r.id === selectedId ? "selected" : ""}`}
                onFocus={() => {
                  workspace.setFocusedIndex(idx);
                  workspace.setActiveZone("sidebar");
                }}
                onClick={() => workspace.selectRequest(r.id, idx, true)}
              >
                <span className="accent-bar" />
                <div className="req-row1">
                  <span className={`method-badge ${r.method}`}>{r.method}</span>
                  <span className="req-name">{r.name || "Untitled request"}</span>
                </div>
                <span className="req-url">{r.url || "no url set"}</span>
                {deleteConfirmId === r.id && (
                  <div className="confirm-row">
                    <span>Delete this request?</span>
                    <span>
                      <kbd>y</kbd> yes <kbd>n</kbd> no
                    </span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
