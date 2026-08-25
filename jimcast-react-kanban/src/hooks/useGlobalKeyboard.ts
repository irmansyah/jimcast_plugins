// [plugins] jimcast-react-kanban/src/hooks/useGlobalKeyboard.ts

import { useEffect } from "react";
import { resolveAction, type Keymap } from "../domain/keymap";
import type { KanbanWorkspace } from "./useKanbanWorkspace";

export function useGlobalKeyboard(
  workspace: KanbanWorkspace,
  keymap: Keymap,
  showHelp: boolean,
  setShowHelp: (v: boolean) => void,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable;
      const action = resolveAction(keymap, e.key);
      if (!action) return;
      if (typing && action !== "closeOrBack") return; // let text fields type normally

      // Delete confirmation intercepts y/n/Escape before anything else, so
      // a card whose title happens to be "n" doesn't clash with cancel.
      if (workspace.deleteConfirmCardId) {
        if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          workspace.confirmDeleteCard(workspace.deleteConfirmCardId);
          return;
        }
        if (action === "closeOrBack" || e.key === "n" || e.key === "N") {
          e.preventDefault();
          workspace.cancelDeleteCard();
          return;
        }
        return;
      }

      if (showHelp) {
        if (action === "closeOrBack" || action === "toggleHelp") {
          e.preventDefault();
          setShowHelp(false);
        }
        return;
      }

      e.preventDefault();
      switch (action) {
        case "moveFocusUp":
          workspace.moveFocus("up");
          break;
        case "moveFocusDown":
          workspace.moveFocus("down");
          break;
        case "moveFocusLeft":
          workspace.moveFocus("left");
          break;
        case "moveFocusRight":
          workspace.moveFocus("right");
          break;
        case "openCard":
          workspace.openFocusedCard();
          break;
        case "newCard":
          workspace.newCardInFocusedColumn();
          break;
        case "deleteCard":
          workspace.deleteFocusedCard();
          break;
        case "moveCardLeft":
          workspace.moveFocusedCard("left");
          break;
        case "moveCardRight":
          workspace.moveFocusedCard("right");
          break;
        case "focusSearch":
          workspace.focusSearch();
          break;
        case "closeOrBack":
          workspace.closeOrBack();
          break;
        case "toggleHelp":
          setShowHelp(true);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [workspace, keymap, showHelp, setShowHelp]);
}
