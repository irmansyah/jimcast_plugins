export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Keyboard shortcuts</h3>
        {[
          ["j k / ↓↑", "Move down/up (list rows or form fields)"],
          ["l / →", "Enter — open request from list"],
          ["h / ←", "Back — return to the request list"],
          ["Enter", "Open focused request · sends when in the URL field"],
          ["n", "New request"],
          ["d / Delete", "Delete focused request (then y to confirm)"],
          ["⌘/Ctrl + Enter", "Send from anywhere, including Body"],
          [": or ⌘K", "Open command line"],
          ["Esc", "Back a level / close dialogs"],
          ["Tab / Shift+Tab", "Move between fields"],
          ["?", "Toggle this help"],
        ].map(([k, d]) => (
          <div className="shortcut-row" key={k}>
            <span>{d}</span>
            <kbd>{k}</kbd>
          </div>
        ))}
        <h3 style={{ marginTop: 18 }}>Command line</h3>
        {[
          [":new [name]", "Create a request"],
          [":open <name|#>", "Open a request by name or list position"],
          [":send [name|#]", "Send current (or named) request"],
          [":method GET", "Set method on open request"],
          [":url <url>", "Set URL on open request"],
          [":name <text>", "Rename open request"],
          [":header <k> <v>", "Add/update a header"],
          [":body <text>", "Set the request body"],
          [":delete [name|#]", "Delete (asks to confirm — add ! to skip)"],
          [":clear", "Clear the response panel"],
        ].map(([k, d]) => (
          <div className="shortcut-row" key={k}>
            <span>{d}</span>
            <kbd>{k}</kbd>
          </div>
        ))}
        <button className="modal-close" onClick={onClose}>
          Close (Esc)
        </button>
      </div>
    </div>
  );
}
