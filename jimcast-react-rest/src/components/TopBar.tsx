export function TopBar({ onShowHelp }: { onShowHelp: () => void }) {
  return (
    <div className="topbar">
      <div className="brand">
        <span className="dot" />
        rest/kb
      </div>
      <button className="help-btn" onClick={onShowHelp}>
        ? shortcuts
      </button>
    </div>
  );
}
