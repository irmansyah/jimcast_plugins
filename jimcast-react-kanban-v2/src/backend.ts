// [plugins] jimcast-react-kanban-v2/src/backend.ts
//
// Phase A #4: added new-column/rename-column/delete-column/move-column and
// archive-card/unarchive-card so the CLI socket path stays symmetric with
// the webview's new :new-column/:rename-column/:delete-column/:move-column/
// :archive/:unarchive commands — this file previously only covered
// board/card CRUD, no column ops and no archive/unarchive at all.
//
// NOT added here: a `search` command. Search is inherently a webview-only,
// live-rendering concept (it filters what's currently on screen) — there's
// nothing meaningful for a stateless CLI invocation to return for "search
// the board", so backend.ts intentionally stays asymmetric on that one
// command. Flag if that assumption turns out wrong.
import { defineWebviewBackend, defineCommand } from "@jimcast/react-sdk/server";
import { getHostStorage } from "@jimcast/react-sdk/server";
import type { KanbanState } from "./types";
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
  renameCard,
  renameColumn,
} from "./domain/kanbanLogic";
const storage = getHostStorage();
const STORAGE_KEY = "kanbanState";
const EMPTY_STATE: KanbanState = { boards: [] };
async function loadState(): Promise<KanbanState> {
  const raw = await storage.get(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as KanbanState) : EMPTY_STATE;
}
async function saveState(state: KanbanState): Promise<void> {
  await storage.set(STORAGE_KEY, JSON.stringify(state));
}
const listBoards = defineCommand({
  id: "list-boards",
  title: "Kanban: List Boards",
  run: async () => {
    const state = await loadState();
    return { boards: state.boards.map((b) => ({ id: b.id, name: b.name })) };
  },
});
const newBoard = defineCommand({
  id: "new-board",
  title: "Kanban: New Board",
  run: async (args: Record<string, string>) => {
    const state = await loadState();
    const { state: next, board } = createBoard(state, args.name?.trim() || "Untitled board");
    await saveState(next);
    return { board };
  },
});
const removeBoard = defineCommand({
  id: "delete-board",
  title: "Kanban: Delete Board",
  run: async (args: Record<string, string>) => {
    if (!args.boardId) return { ok: false, error: "boardId is required" };
    const state = await loadState();
    await saveState(deleteBoard(state, args.boardId));
    return { ok: true };
  },
});
const newCard = defineCommand({
  id: "new-card",
  title: "Kanban: New Card",
  run: async (args: Record<string, string>) => {
    if (!args.boardId || !args.columnId || !args.title) {
      return { ok: false, error: "boardId, columnId, and title are required" };
    }
    const state = await loadState();
    const { state: next, card } = addCard(state, args.boardId, args.columnId, args.title);
    await saveState(next);
    return { card };
  },
});
const deleteCardCmd = defineCommand({
  id: "delete-card",
  title: "Kanban: Delete Card",
  run: async (args: Record<string, string>) => {
    if (!args.boardId || !args.cardId) return { ok: false, error: "boardId and cardId are required" };
    const state = await loadState();
    await saveState(deleteCard(state, args.boardId, args.cardId));
    return { ok: true };
  },
});
const moveCardCmd = defineCommand({
  id: "move-card",
  title: "Kanban: Move Card",
  run: async (args: Record<string, string>) => {
    if (!args.boardId || !args.cardId || !args.toColumnId) {
      return { ok: false, error: "boardId, cardId, and toColumnId are required" };
    }
    const state = await loadState();
    await saveState(moveCard(state, args.boardId, args.cardId, args.toColumnId));
    return { ok: true };
  },
});
const renameCardCmd = defineCommand({
  id: "rename-card",
  title: "Kanban: Rename Card",
  run: async (args: Record<string, string>) => {
    if (!args.boardId || !args.cardId || !args.title) {
      return { ok: false, error: "boardId, cardId, and title are required" };
    }
    const state = await loadState();
    await saveState(renameCard(state, args.boardId, args.cardId, args.title));
    return { ok: true };
  },
});

// ─── Column commands (Phase A #4) ────────────────────────────────────────

const newColumn = defineCommand({
  id: "new-column",
  title: "Kanban: New Column",
  run: async (args: Record<string, string>) => {
    if (!args.boardId || !args.title) return { ok: false, error: "boardId and title are required" };
    const state = await loadState();
    const { state: next, column } = addColumn(state, args.boardId, args.title);
    await saveState(next);
    return { column };
  },
});
const renameColumnCmd = defineCommand({
  id: "rename-column",
  title: "Kanban: Rename Column",
  run: async (args: Record<string, string>) => {
    if (!args.boardId || !args.columnId || !args.title) {
      return { ok: false, error: "boardId, columnId, and title are required" };
    }
    const state = await loadState();
    await saveState(renameColumn(state, args.boardId, args.columnId, args.title));
    return { ok: true };
  },
});
const deleteColumnCmd = defineCommand({
  id: "delete-column",
  title: "Kanban: Delete Column",
  run: async (args: Record<string, string>) => {
    if (!args.boardId || !args.columnId) return { ok: false, error: "boardId and columnId are required" };
    const state = await loadState();
    await saveState(deleteColumn(state, args.boardId, args.columnId));
    return { ok: true };
  },
});
const moveColumnCmd = defineCommand({
  id: "move-column",
  title: "Kanban: Move Column",
  run: async (args: Record<string, string>) => {
    if (!args.boardId || !args.columnId || !args.direction) {
      return { ok: false, error: "boardId, columnId, and direction ('left'|'right') are required" };
    }
    if (args.direction !== "left" && args.direction !== "right") {
      return { ok: false, error: "direction must be 'left' or 'right'" };
    }
    const state = await loadState();
    await saveState(moveColumn(state, args.boardId, args.columnId, args.direction));
    return { ok: true };
  },
});

// ─── Archive / unarchive (Phase A #2) ────────────────────────────────────

const archiveCardCmd = defineCommand({
  id: "archive-card",
  title: "Kanban: Archive Card",
  run: async (args: Record<string, string>) => {
    if (!args.boardId || !args.cardId) return { ok: false, error: "boardId and cardId are required" };
    const state = await loadState();
    await saveState(archiveCard(state, args.boardId, args.cardId, true));
    return { ok: true };
  },
});
const unarchiveCardCmd = defineCommand({
  id: "unarchive-card",
  title: "Kanban: Unarchive Card",
  run: async (args: Record<string, string>) => {
    if (!args.boardId || !args.cardId) return { ok: false, error: "boardId and cardId are required" };
    const state = await loadState();
    await saveState(archiveCard(state, args.boardId, args.cardId, false));
    return { ok: true };
  },
});

defineWebviewBackend({}, [
  listBoards,
  newBoard,
  removeBoard,
  newCard,
  deleteCardCmd,
  moveCardCmd,
  renameCardCmd,
  newColumn,
  renameColumnCmd,
  deleteColumnCmd,
  moveColumnCmd,
  archiveCardCmd,
  unarchiveCardCmd,
]);
