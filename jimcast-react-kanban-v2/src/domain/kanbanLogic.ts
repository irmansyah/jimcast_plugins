// jimcast-react-kanban-v2/src/domain/kanbanLogic.ts
//
// Ported from the old jimcast-react-kanban plugin's domain/kanbanLogic.ts,
// unchanged apart from the import path — this logic has no IPC/backend
// coupling, so it's safe to reuse as-is (per the carry-forward doc's step 2).
// Pure functions: (state, ...args) -> new state. Testable without spawning
// anything, and usable from both the React workspace hook and backend.ts.

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

