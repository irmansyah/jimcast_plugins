import { useEffect } from "react";
import type { UseCommandLineResult } from "@jimcast/react-sdk/react";
import type { RestWorkspace } from "./useRestWorkspace";

export function useGlobalKeyboard(
  workspace: RestWorkspace,
  cli: UseCommandLineResult,
  showHelp: boolean,
  setShowHelp: (v: boolean) => void,
) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        cli.isOpen ? cli.close() : cli.open();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        workspace.handleSend();
        return;
      }
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setShowHelp(!showHelp);
        return;
      }
      if (e.key === "Escape") {
        if (cli.isOpen) {
          e.preventDefault();
          if (workspace.deleteConfirmId) workspace.setDeleteConfirmId(null);
          cli.close();
          return;
        }
        if (showHelp) {
          setShowHelp(false);
          return;
        }
      }
      if (e.key === ":" && !isTyping && !cli.isOpen) {
        e.preventDefault();
        cli.open();
        return;
      }
      if (e.key === "n" && !isTyping && !showHelp && !cli.isOpen) {
        e.preventDefault();
        workspace.handleNew();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showHelp, workspace.requests, workspace.selectedId, cli.isOpen, workspace.deleteConfirmId]);
}
