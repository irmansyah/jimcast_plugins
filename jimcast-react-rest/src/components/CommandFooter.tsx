import { useEffect, useRef } from "react";
import type { UseCommandLineResult } from "@jimcast/react-sdk/react";

export function CommandFooter({
  cli,
  zoneHint,
}: {
  cli: UseCommandLineResult;
  deleteConfirmId: string | null;
  zoneHint: string;
}) {
  const commandInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cli.isOpen) requestAnimationFrame(() => commandInputRef.current?.focus());
  }, [cli.isOpen]);

  return (
    <div className="footer">
      {cli.isOpen ? (
        <div className="command-bar">
          <span className="command-prompt">:</span>
          <input
            ref={commandInputRef}
            className="command-input"
            value={cli.value}
            onChange={(e) => cli.setValue(e.target.value)}
            placeholder={
              cli.pendingConfirm
                ? "type y to confirm, n to cancel"
                : "new | open <name> | send | method POST | header X-Api-Key abc"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                cli.submit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cli.close();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                cli.historyUp();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                cli.historyDown();
              }
            }}
          />
        </div>
      ) : (
        <div
          className="footer-hint"
          role="button"
          tabIndex={0}
          onClick={cli.open}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              cli.open();
            }
          }}
        >
          <span
            className="zone-hint"
            style={cli.feedback ? { color: cli.feedback.type === "error" ? "var(--delete)" : "var(--accent)" } : undefined}
          >
            {cli.feedback ? cli.feedback.text : zoneHint}
          </span>
          <span className="cmd-affordance">
            <kbd>:</kbd> or <kbd>⌘K</kbd> for commands
          </span>
        </div>
      )}
    </div>
  );
}
