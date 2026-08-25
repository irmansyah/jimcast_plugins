// jimcast-react-kanban/src/domain/kanbanLogic.ts
//
// Ported from the old jimcast-react-kanban plugin's domain/kanbanLogic.ts,
// unchanged apart from the import path — this logic has no IPC/backend
// coupling, so it's safe to reuse as-is (per the carry-forward doc's step 2).
// Pure functions: (state, ...args) -> new state. Testable without spawning
// anything, and usable from both the React workspace hook and backend.ts.
//
// Phase A additions: addColumn/renameColumn/deleteColumn/moveColumn (columns
// were previously fixed to DEFAULT_COLUMNS with no way to add/rename/reorder/
// delete one — webview OR CLI), and archiveCard (soft-delete, see types.ts).
import type { Board, Card, Column, KanbanState } from "../types";
const DEFAULT_COLUMNS = ["todo", "in-progress", "done"];
function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}
export function createBoard(state: KanbanState, name: string): { state: KanbanState; board: Board } {
  const board: Board = {
    id: makeId(),
    name,
    columns: DEFAULT_COLUMNS.map((title) => ({ id: title, title, cards: [] })),
  };
  return { state: { boards: [...state.boards, board] }, board };
}
export function renameCard(state: KanbanState, boardId: string, cardId: string, title: string): KanbanState {
  return withBoard(state, boardId, (b) => ({
    ...b,
    columns: b.columns.map((c) => ({
      ...c,
      cards: c.cards.map((card) => (card.id === cardId ? { ...card, title } : card)),
    })),
  }));
}
export function deleteBoard(state: KanbanState, boardId: string): KanbanState {
  return { boards: state.boards.filter((b) => b.id !== boardId) };
}
function findBoard(state: KanbanState, boardId: string): Board {
  const board = state.boards.find((b) => b.id === boardId);
  if (!board) throw new Error(`no such board: ${boardId}`);
  return board;
}
function withBoard(state: KanbanState, boardId: string, fn: (b: Board) => Board): KanbanState {
  return { boards: state.boards.map((b) => (b.id === boardId ? fn(b) : b)) };
}
export function addCard(
  state: KanbanState,
  boardId: string,
  columnId: string,
  title: string,
): { state: KanbanState; card: Card } {
  findBoard(state, boardId); // throws if missing
  const card: Card = { id: makeId(), title };
  const next = withBoard(state, boardId, (b) => ({
    ...b,
    columns: b.columns.map((c: Column) => (c.id === columnId ? { ...c, cards: [...c.cards, card] } : c)),
  }));
  return { state: next, card };
}
export function moveCard(state: KanbanState, boardId: string, cardId: string, toColumnId: string): KanbanState {
  const board = findBoard(state, boardId);
  let moved: Card | null = null;
  const stripped = board.columns.map((c) => {
    const idx = c.cards.findIndex((card) => card.id === cardId);
    if (idx === -1) return c;
    moved = c.cards[idx];
    return { ...c, cards: c.cards.filter((card) => card.id !== cardId) };
  });
  if (!moved) throw new Error(`no such card: ${cardId}`);
  const placed = stripped.map((c) => (c.id === toColumnId ? { ...c, cards: [...c.cards, moved as Card] } : c));
  return withBoard(state, boardId, () => ({ ...board, columns: placed }));
}
export function deleteCard(state: KanbanState, boardId: string, cardId: string): KanbanState {
  return withBoard(state, boardId, (b) => ({
    ...b,
    columns: b.columns.map((c) => ({ ...c, cards: c.cards.filter((card) => card.id !== cardId) })),
  }));
}

/** Soft-delete: mark a card archived (or bring it back with archived=false).
 * Kept in storage either way — `:archived` / `:unarchive` operate on the
 * full, unfiltered card list. */
export function archiveCard(state: KanbanState, boardId: string, cardId: string, archived: boolean): KanbanState {
  return withBoard(state, boardId, (b) => ({
    ...b,
    columns: b.columns.map((c) => ({
      ...c,
      cards: c.cards.map((card) => (card.id === cardId ? { ...card, archived } : card)),
    })),
  }));
}

// ─── Column CRUD/reorder (Phase A #2) ───────────────────────────────────

export function addColumn(state: KanbanState, boardId: string, title: string): { state: KanbanState; column: Column } {
  const column: Column = { id: makeId(), title, cards: [] };
  const next = withBoard(state, boardId, (b) => ({ ...b, columns: [...b.columns, column] }));
  return { state: next, column };
}

export function renameColumn(state: KanbanState, boardId: string, columnId: string, title: string): KanbanState {
  return withBoard(state, boardId, (b) => ({
    ...b,
    columns: b.columns.map((c) => (c.id === columnId ? { ...c, title } : c)),
  }));
}

/** Deletes the column and every card in it. Callers (kanbanCommands.ts)
 * gate this behind a y/n confirm the same way delete-board/delete-card do,
 * since it's the one destructive column op. */
export function deleteColumn(state: KanbanState, boardId: string, columnId: string): KanbanState {
  return withBoard(state, boardId, (b) => ({
    ...b,
    columns: b.columns.filter((c) => c.id !== columnId),
  }));
}

/** Swaps the column with its immediate left/right neighbor. No-op (returns
 * the board unchanged) if already at that edge — mirrors how moveFocus
 * clamps rather than wraps. */
export function moveColumn(
  state: KanbanState,
  boardId: string,
  columnId: string,
  direction: "left" | "right",
): KanbanState {
  return withBoard(state, boardId, (b) => {
    const idx = b.columns.findIndex((c) => c.id === columnId);
    if (idx === -1) return b;
    const targetIdx = direction === "left" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= b.columns.length) return b;
    const columns = [...b.columns];
    [columns[idx], columns[targetIdx]] = [columns[targetIdx], columns[idx]];
    return { ...b, columns };
  });
}
