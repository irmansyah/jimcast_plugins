// [plugins] jimcast-react-kanban/src/hooks/useKanbanWorkspace.ts
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
//
// Phase A additions:
//   - column ops (createColumn/renameColumn/deleteColumn/moveColumn) and
//     resolveColumnTarget, backing the new :new-column/:rename-column/
//     :delete-column/:move-column commands.
//   - archiveFocusedCard/unarchiveCard + resolveArchivedCardTarget, backing
//     :archive/:unarchive/:archived.
//   - visibleColumns: derived from `columns`, with archived cards always
//     stripped and (when searchActive) a further title-match filter. This
//     was previously dead state — searchQuery was set by focusSearch()/`/`
//     but nothing read it. NOTE: BoardView.tsx needs to render
//     `workspace.visibleColumns` instead of `workspace.columns` for this to
//     actually show up — that file wasn't available this session, so the
//     swap isn't made for you. It should be a one-line prop change.
//   - runSearch/clearSearch: like focusSearch, but for the :search command
//     (sets the query without needing to also move DOM focus into the
//     search input, since focus is already on the command line).
//
// Phase B additions (mouse-driven, column/card-scoped variants):
//   - newCardInColumn(columnId): like newCardInFocusedColumn, but for a
//     specific column regardless of current keyboard focus — needed by
//     ColumnView's "+ add card" button, which can be clicked on any
//     column, not just the focused one. Also moves keyboard focus to
//     that column so the two focus models (mouse click, keyboard state)
//     stay in sync instead of drifting apart.
//   - renameCard(cardId, title): like renameFocusedCard, but for a
//     specific card by id — needed by ColumnView's inline rename input,
//     which can be opened via double-click on any card, not just the
//     focused one.

import { useEffect, useMemo, useRef, useState } from "react";
import { useHostStorage } from "@jimcast/react-sdk/client";
import type { Board, Card, Column, KanbanState } from "../types";
import {
  addCard,
  addColumn,
  archiveCard,
  createBoard,
  deleteBoard,
  deleteCard,
  deleteColumn,
  moveCard,
  moveColumn,
  renameColumn,
} from "../domain/kanbanLogic";

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

  // Archived cards are always hidden from the board; a search query (when
  // active) further filters to title matches. BoardView.tsx should render
  // this instead of `columns` — see file-header note.
  const visibleColumns = useMemo<Column[]>(() => {
    const q = searchActive ? searchQuery.trim().toLowerCase() : "";
    return columns.map((c) => ({
      ...c,
      cards: c.cards.filter((card) => !card.archived && (!q || card.title.toLowerCase().includes(q))),
    }));
  }, [columns, searchActive, searchQuery]);

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

  // ─── Column resolution + ops (Phase A) ─────────────────────────────────

  function resolveColumnTarget(arg: string): Column | null {
    if (!currentBoard) return null;
    if (!arg || !arg.trim()) return focusedColumn;
    const byIndex = columns[Number(arg) - 1];
    if (byIndex) return byIndex;
    return columns.find((c) => c.title.toLowerCase() === arg.trim().toLowerCase()) || null;
  }

  function handleCreateColumn(title: string): Column | null {
    if (!currentBoard) return null;
    const { state: next, column } = addColumn(state, currentBoard.id, title);
    setState(next);
    return column;
  }

  function handleRenameColumn(columnId: string, title: string) {
    if (!currentBoard) return;
    setState((prev) => renameColumn(prev, currentBoard.id, columnId, title));
  }

  function handleDeleteColumn(columnId: string) {
    if (!currentBoard) return;
    setState((prev) => deleteColumn(prev, currentBoard.id, columnId));
    setFocusedColumnIndex((idx) => Math.max(0, Math.min(idx, columns.length - 2)));
    setFocusedCardIndex(null);
  }

  function handleMoveColumn(columnId: string, dir: "left" | "right") {
    if (!currentBoard) return;
    const idx = columns.findIndex((c) => c.id === columnId);
    setState((prev) => moveColumn(prev, currentBoard.id, columnId, dir));
    if (idx !== -1 && idx === focusedColumnIndex) {
      setFocusedColumnIndex(dir === "left" ? Math.max(0, idx - 1) : Math.min(columns.length - 1, idx + 1));
    }
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

  // Mouse-driven variant of newCardInFocusedColumn — opens the new-card
  // input for an explicit column (e.g. the column the "+" button was
  // clicked in), and moves keyboard focus there too so state stays
  // consistent regardless of which input method drove it.
  function newCardInColumn(columnId: string) {
    const idx = columns.findIndex((c) => c.id === columnId);
    if (idx === -1) return;
    setFocusedColumnIndex(idx);
    setFocusedCardIndex(null);
    setNewCardColumnId(columnId);
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
    const visible = focusedColumn.cards.filter((c) => !c.archived);
    if (!arg) return focusedCard && !focusedCard.archived ? focusedCard : null;
    const byIndex = visible[Number(arg) - 1];
    if (byIndex) return byIndex;
    return visible.find((c) => c.title.toLowerCase() === arg.trim().toLowerCase()) || null;
  }

  // Archived cards are deliberately excluded from resolveCardTarget above,
  // so :unarchive needs its own resolver that looks across the *whole*
  // board (not just the focused column — you archived it from wherever it
  // was, but might not still be focused there).
  function resolveArchivedCardTarget(arg: string): Card | null {
    if (!currentBoard) return null;
    const archived = columns.flatMap((c) => c.cards.filter((card) => card.archived));
    if (!arg || !arg.trim()) return archived[0] ?? null;
    const byIndex = archived[Number(arg) - 1];
    if (byIndex) return byIndex;
    return archived.find((c) => c.title.toLowerCase() === arg.trim().toLowerCase()) || null;
  }

  function archivedCards(): Card[] {
    return columns.flatMap((c) => c.cards.filter((card) => card.archived));
  }

  function archiveFocusedCard() {
    if (!currentBoard || !focusedCard) return;
    setState((prev) => archiveCard(prev, currentBoard.id, focusedCard.id, true));
  }

  function unarchiveCard(cardId: string) {
    if (!currentBoard) return;
    setState((prev) => archiveCard(prev, currentBoard.id, cardId, false));
  }

  function renameFocusedCard(title: string) {
    if (!currentBoard || !focusedCard) return;
    renameCard(focusedCard.id, title);
  }

  // Mouse-driven variant of renameFocusedCard — renames a specific card
  // by id (e.g. from ColumnView's inline rename input on double-click),
  // regardless of current keyboard focus.
  function renameCard(cardId: string, title: string) {
    if (!currentBoard || !title.trim()) return;
    setState((prev) => ({
      boards: prev.boards.map((b) =>
        b.id !== currentBoard.id
          ? b
          : {
              ...b,
              columns: b.columns.map((c) => ({
                ...c,
                cards: c.cards.map((card) => (card.id === cardId ? { ...card, title: title.trim() } : card)),
              })),
            },
      ),
    }));
  }

  function focusSearch() {
    setSearchActive(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  // Sets the search query without moving DOM focus — used by the :search
  // command, since the command line already has focus at that point.
  function runSearch(query: string) {
    setSearchActive(true);
    setSearchQuery(query);
  }

  function clearSearch() {
    setSearchActive(false);
    setSearchQuery("");
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
    visibleColumns,
    focusedColumnIndex,
    focusedCardIndex,
    focusedColumnId,
    focusedCardId,
    focusedColumn,
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

    resolveColumnTarget,
    createColumn: handleCreateColumn,
    renameColumn: handleRenameColumn,
    deleteColumn: handleDeleteColumn,
    moveColumn: handleMoveColumn,

    moveFocus,
    openFocusedCard,
    newCardInFocusedColumn,
    newCardInColumn,
    submitNewCard,
    cancelNewCard,
    deleteFocusedCard,
    confirmDeleteCard,
    cancelDeleteCard,
    moveFocusedCard,
    resolveCardTarget,
    renameFocusedCard,
    renameCard,

    resolveArchivedCardTarget,
    archivedCards,
    archiveFocusedCard,
    unarchiveCard,

    focusSearch,
    runSearch,
    clearSearch,
    closeOrBack,
    closeCardModal: () => setEditingCardId(null),
  };
}

export type KanbanWorkspace = ReturnType<typeof useKanbanWorkspace>;
