// [plugins] jimcast-react-kanban-v2/src/App.tsx
import { useEffect, useState } from "react";
import { useTheme } from "@jimcast/react-sdk/client";
import { useKanbanWorkspace } from "./hooks/useKanbanWorkspace";
import { useKanbanCommandLine } from "./hooks/useKanbanCommandLine";
import { useGlobalKeyboard } from "./hooks/useGlobalKeyboard";
import { DEFAULT_KEYMAP, loadKeymap, type Keymap } from "./domain/keymap";
import { TopBar } from "./components/TopBar";
import { BoardView } from "./components/BoardView";
import { CardModal } from "./components/CardModal";
import { CommandFooter } from "./components/CommandFooter";
import { HelpModal } from "./components/HelpModal";
import { kanbanStyles } from "./styles";

export default function App() {
  const theme = useTheme();
  const [keymap, setKeymap] = useState<Keymap | null>(null);
  useEffect(() => {
    loadKeymap().then(setKeymap);
  }, []);
  const workspace = useKanbanWorkspace();
  const cli = useKanbanCommandLine(workspace);
  const [showHelp, setShowHelp] = useState(false);
  useGlobalKeyboard(workspace, keymap ?? DEFAULT_KEYMAP, showHelp, setShowHelp);
  if (!keymap) return null; // lightweight loading state — config.json fetch is near-instant
  const zoneHint = workspace.deleteConfirmCardId
    ? "y Confirm delete   Esc/n Cancel"
    : workspace.editingCardId
    ? "Esc Close"
    : "j k / \u2191\u2193 Move   h l / \u2190\u2192 Column   \u21B5 Open   n New   d Delete   H/L Move card   ? Help";
  return (
    <div className="app-shell">
      <style>{kanbanStyles(theme.colors)}</style>
      <TopBar workspace={workspace} onShowHelp={() => setShowHelp(true)} />
      <BoardView workspace={workspace} />
      <CommandFooter cli={cli} deleteConfirmCardId={workspace.deleteConfirmCardId} zoneHint={zoneHint} />
      {workspace.editingCardId && <CardModal workspace={workspace} />}
      {showHelp && <HelpModal keymap={keymap} onClose={() => setShowHelp(false)} />}
    </div>
  );
}
