// [plugins] jimcast-react-kanban-v2/src/components/CommandFooter.tsx
//
// Rewritten against the real useCommandLine (packages/react-sdk/src/react/commandLine.ts).
// Previous version guessed a `cli.execute()` method that doesn't exist —
// that's why typed commands silently no-op'd. Real API: value/setValue
// drive the input, submit() runs it (also handles the y/n confirm
// sub-mode when pendingConfirm is set), historyUp/historyDown for arrow
// recall. isOpen/open/close aren't used here since this footer is always
// visible rather than a toggleable palette.

import type { UseCommandLineResult } from "@jimcast/react-sdk/react";

export function CommandFooter({
  cli,
  deleteConfirmCardId,
  zoneHint,
}: {
  cli: UseCommandLineResult;
  deleteConfirmCardId: string | null;
  zoneHint: string;
}) {
  const feedbackText = cli.pendingConfirm ? cli.pendingConfirm.message : cli.feedback?.text ?? null;
  const isError = !cli.pendingConfirm && cli.feedback?.type === "error";

  return (
    <div className="command-footer">
      <div className="command-footer-input-row">
        <span className="command-footer-prompt">:</span>
        <input
          value={cli.value}
          onChange={(e) => cli.setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              cli.submit();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              cli.historyUp();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              cli.historyDown();
            }
            e.stopPropagation();
          }}
          placeholder={cli.pendingConfirm ? "y/n" : "command…"}
          disabled={!!deleteConfirmCardId}
        />
      </div>
      {feedbackText && (
        <div className={`command-footer-feedback${isError ? " error" : ""}`}>{feedbackText}</div>
      )}
      <div className="command-footer-hint">{zoneHint}</div>
    </div>
  );
}
