// [plugins] jimcast-react-kanban-v2/src/hooks/useKanbanWorkspace.ts
//
// Pattern: jimcast-react-rest's useRestWorkspace.ts. Owns all board/card
// state and exposes the action methods useGlobalKeyboard.ts dispatches
// into (moveFocus, openFocusedCard, newCardInFocusedColumn, etc), plus a
// few extras (createBoard/selectBoard/etc) that back kanbanCommands.ts.
//
// Focus model: NOT native DOM focus. focusedColumnIndex/focusedCardIndex
// live in React state — mirrors [core]'s own DevDashboard.tsx tracking a
// Cursor { sec, item } in state rather than relying on tab order (see the
// carry-forward doc's "Keyboard-nav UI note"). The focus ring is rendered
// off derived focusedColumnId/focusedCardId, not :focus-visible.

import { useEffect, useMemo, useRef, useState } from "react";
import { useHostStorage } from "@jimcast/react-sdk/client";
import type { Board, Card, KanbanState } from "../types";
import { addCard, createBoard, deleteBoard, deleteCard, moveCard } from "../domain/kanbanLogic";

const EMPTY_STATE: KanbanState = { boards: [] };
const STORAGE_KEY = "kanbanState";

export function useKanbanWorkspace() {
  const [state, setState] = useState<KanbanState>(EMPTY_STATE);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);

  const [focusedColumnIndex, setFocusedColumnIndex] = useState(0);
  const [focusedCardIndex, setFocusedCardIndex] = useState<number | null>(null);

  const [newCardColumnId, setNewCardColumnId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [deleteConfirmCardId, setDeleteConfirmCardId] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const newCardInputRef = useRef<HTMLInputElement>(null);

  const storage = useHostStorage();
  const hydrated = useRef(false);

  // Initial hydration — loads whatever's already in storage on mount
  // (including boards created via the CLI socket before this window was
  // ever opened) and sets hydrated.current so the poll/persist effects
  // below know it's safe to run. THIS WAS MISSING — its absence is what
  // caused "No Board Selected" even with real data in storage: with
  // hydrated.current permanently false, both other effects short-circuit
  // and state never leaves its EMPTY_STATE default.
  useEffect(() => {
    storage
      .get(STORAGE_KEY)
      .then((raw: string | null) => {
        if (raw) {
          const parsed = JSON.parse(raw) as KanbanState;
          setState(parsed);
          if (parsed.boards[0]) setCurrentBoardId(parsed.boards[0].id);
        }
      })
      .catch((err: unknown) => {
        console.error("[kanban] hydration failed", err);
      })
      .finally(() => {
        hydrated.current = true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling stopgap: backend.ts (reached via the CLI socket) writes to the
  // same storage key but has no way to push a change notification into an
  // already-open webview — there's no confirmed event channel for that.
  // Until one exists, poll periodically so CLI-driven mutations (new-board,
  // new-card, etc.) show up without requiring the window to be reopened.
  useEffect(() => {
    const POLL_MS = 1500;
    const interval = setInterval(() => {
      if (!hydrated.current) return;
      storage
        .get(STORAGE_KEY)
        .then((raw: string | null) => {
          if (!raw) return;
          const parsed = JSON.parse(raw) as KanbanState;
          setState((prev) => {
            const same = JSON.stringify(prev) === JSON.stringify(parsed);
            return same ? prev : parsed;
          });
          // If nothing was selected yet (e.g. window opened before any board
          // existed) and a board has since shown up — via CLI or otherwise —
          // select it automatically, satisfying "list-boards > 0 then show it".
          setCurrentBoardId((prevId) => (prevId ? prevId : parsed.boards[0]?.id ?? null));
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    storage.set(STORAGE_KEY, JSON.stringify(state)).catch((err: unknown) => {
      console.error("[kanban] failed to persist state", err);
    });
  }, [state]);

  const currentBoard = useMemo<Board | null>(
    () => state.boards.find((b) => b.id === currentBoardId) || null,
    [state, currentBoardId],
  );

  const columns = currentBoard?.columns ?? [];
  const focusedColumn = columns[focusedColumnIndex] ?? null;
  const focusedCard: Card | null =
    focusedColumn && focusedCardIndex !== null ? focusedColumn.cards[focusedCardIndex] ?? null : null;

  const focusedColumnId = focusedColumn?.id ?? null;
  const focusedCardId = focusedCard?.id ?? null;

  const editingCard: Card | null = useMemo(() => {
    if (!editingCardId || !currentBoard) return null;
    for (const c of currentBoard.columns) {
      const found = c.cards.find((card) => card.id === editingCardId);
      if (found) return found;
    }
    return null;
  }, [editingCardId, currentBoard]);

  function selectBoard(id: string) {
    setCurrentBoardId(id);
    setFocusedColumnIndex(0);
    setFocusedCardIndex(null);
  }

  function handleCreateBoard(name: string) {
    const { state: next, board } = createBoard(state, name || "Untitled board");
    setState(next);
    selectBoard(board.id);
    return board;
  }

  function handleDeleteBoard(id: string) {
    setState((prev) => deleteBoard(prev, id));
    if (currentBoardId === id) {
      const remaining = state.boards.filter((b) => b.id !== id);
      setCurrentBoardId(remaining[0]?.id ?? null);
      setFocusedColumnIndex(0);
      setFocusedCardIndex(null);
    }
  }

  function resolveBoardTarget(arg: string): Board | null {
    if (!arg) return currentBoard;
    const byIndex = state.boards[Number(arg) - 1];
    if (byIndex) return byIndex;
    return state.boards.find((b) => b.name.toLowerCase() === arg.trim().toLowerCase()) || null;
  }

  function moveFocus(dir: "up" | "down" | "left" | "right") {
    if (!currentBoard || columns.length === 0) return;

    if (dir === "left" || dir === "right") {
      const delta = dir === "left" ? -1 : 1;
      const nextCol = Math.max(0, Math.min(columns.length - 1, focusedColumnIndex + delta));
      setFocusedColumnIndex(nextCol);
      const targetCards = columns[nextCol]?.cards ?? [];
      setFocusedCardIndex(targetCards.length === 0 ? null : Math.min(focusedCardIndex ?? 0, targetCards.length - 1));
      return;
    }

    const cards = focusedColumn?.cards ?? [];
    if (cards.length === 0) return;
    const cur = focusedCardIndex ?? 0;
    const delta = dir === "up" ? -1 : 1;
    const next = Math.max(0, Math.min(cards.length - 1, cur + delta));
    setFocusedCardIndex(next);
  }

  function openFocusedCard() {
    if (!focusedCard) return;
    setEditingCardId(focusedCard.id);
  }

  function newCardInFocusedColumn() {
    if (!focusedColumn) return;
    setNewCardColumnId(focusedColumn.id);
    requestAnimationFrame(() => newCardInputRef.current?.focus());
  }

  function submitNewCard(title: string) {
    if (!currentBoard || !newCardColumnId || !title.trim()) {
      setNewCardColumnId(null);
      return;
    }
    const { state: next, card } = addCard(state, currentBoard.id, newCardColumnId, title.trim());
    setState(next);
    setNewCardColumnId(null);
    const colIdx = columns.findIndex((c) => c.id === newCardColumnId);
    if (colIdx >= 0) {
      setFocusedColumnIndex(colIdx);
      const newIdx = (columns[colIdx]?.cards.length ?? 1) - 1 + 1;
      setFocusedCardIndex(Math.max(0, newIdx - 1));
    }
    return card;
  }

  function cancelNewCard() {
    setNewCardColumnId(null);
  }

  function deleteFocusedCard() {
    if (!focusedCard) return;
    setDeleteConfirmCardId(focusedCard.id);
  }

  function confirmDeleteCard(cardId: string) {
    if (!currentBoard) return;
    setState((prev) => deleteCard(prev, currentBoard.id, cardId));
    setDeleteConfirmCardId(null);
    setFocusedCardIndex((idx) => (idx !== null ? Math.max(0, idx - 1) : null));
  }

  function cancelDeleteCard() {
    setDeleteConfirmCardId(null);
  }

  function moveFocusedCard(dir: "left" | "right") {
    if (!currentBoard || !focusedCard || !focusedColumn) return;
    const idx = columns.findIndex((c) => c.id === focusedColumn.id);
    const targetIdx = dir === "left" ? idx - 1 : idx + 1;
    const target = columns[targetIdx];
    if (!target) return;
    const cardId = focusedCard.id;
    setState((prev) => moveCard(prev, currentBoard.id, cardId, target.id));
    setFocusedColumnIndex(targetIdx);
    requestAnimationFrame(() => {
      setFocusedCardIndex(target.cards.length);
    });
  }

  function resolveCardTarget(arg: string): Card | null {
    if (!focusedColumn) return null;
    if (!arg) return focusedCard;
    const byIndex = focusedColumn.cards[Number(arg) - 1];
    if (byIndex) return byIndex;
    return focusedColumn.cards.find((c) => c.title.toLowerCase() === arg.trim().toLowerCase()) || null;
  }

  function renameFocusedCard(title: string) {
    if (!currentBoard || !focusedCard) return;
    setState((prev) => ({
      boards: prev.boards.map((b) =>
        b.id !== currentBoard.id
          ? b
          : {
              ...b,
              columns: b.columns.map((c) => ({
                ...c,
                cards: c.cards.map((card) => (card.id === focusedCard.id ? { ...card, title } : card)),
              })),
            },
      ),
    }));
  }

  function focusSearch() {
    setSearchActive(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function closeOrBack() {
    if (deleteConfirmCardId) return cancelDeleteCard();
    if (newCardColumnId) return cancelNewCard();
    if (editingCardId) return setEditingCardId(null);
    if (searchActive) {
      setSearchActive(false);
      setSearchQuery("");
      return;
    }
  }

  return {
    state,
    boards: state.boards,
    currentBoard,
    currentBoardId,
    columns,
    focusedColumnIndex,
    focusedCardIndex,
    focusedColumnId,
    focusedCardId,
    focusedCard,
    newCardColumnId,
    newCardInputRef,
    editingCardId,
    editingCard,
    deleteConfirmCardId,
    searchActive,
    searchQuery,
    setSearchQuery,
    searchInputRef,

    selectBoard,
    createBoard: handleCreateBoard,
    deleteBoard: handleDeleteBoard,
    resolveBoardTarget,

    moveFocus,
    openFocusedCard,
    newCardInFocusedColumn,
    submitNewCard,
    cancelNewCard,
    deleteFocusedCard,
    confirmDeleteCard,
    cancelDeleteCard,
    moveFocusedCard,
    resolveCardTarget,
    renameFocusedCard,
    focusSearch,
    closeOrBack,
    closeCardModal: () => setEditingCardId(null),
  };
}

export type KanbanWorkspace = ReturnType<typeof useKanbanWorkspace>;
