// [plugins] jimcast-react-rest/src/App.tsx

import { useState } from "react";
import { useRestWorkspace } from "./hooks/useRestWorkspace";
import { useRestCommandLine } from "./hooks/useRestCommandLine";
import { useGlobalKeyboard } from "./hooks/useGlobalKeyboard";
import { TopBar } from "./components/TopBar";
import { RequestSidebar } from "./components/RequestSidebar";
import { RequestEditor } from "./components/RequestEditor";
import { ResponsePanel } from "./components/ResponsePanel";
import { CommandFooter } from "./components/CommandFooter";
import { HelpModal } from "./components/HelpModal";
import { restStyles } from "./styles";

export default function App() {
  const workspace = useRestWorkspace();
  const cli = useRestCommandLine(workspace);
  const [showHelp, setShowHelp] = useState(false);

  useGlobalKeyboard(workspace, cli, showHelp, setShowHelp);

  const zoneHint = workspace.deleteConfirmId
    ? "y Confirm delete   Esc/n Cancel"
    : workspace.activeZone === "sidebar"
    ? "j k / \u2191\u2193 Navigate   l / \u21B5 Open   n New   d Delete   ? Help"
    : workspace.activeZone === "editor"
    ? "j k / \u2191\u2193 Move field   h / Esc Back to list   \u21B5 in URL sends   ? Help"
    : "h / Esc Back to editor   j k / \u2191\u2193 Move   ? Help";

  return (
    <div className="app-shell">
      <style>{restStyles}</style>

      <TopBar onShowHelp={() => setShowHelp(true)} />
      <RequestSidebar workspace={workspace} />

      <div className="main">
        {!workspace.selectedRequest ? (
          <div className="empty-editor">
            <div>No request selected.</div>
            <button onClick={workspace.handleNew}>+ New request</button>
          </div>
        ) : (
          <>
            <RequestEditor workspace={workspace} />
            <ResponsePanel workspace={workspace} />
          </>
        )}
      </div>

      <CommandFooter cli={cli} deleteConfirmId={workspace.deleteConfirmId} zoneHint={zoneHint} />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
