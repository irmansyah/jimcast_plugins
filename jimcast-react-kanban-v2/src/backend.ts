// [plugins] jimcast-react-kanban-v2/src/backend.ts
import { defineWebviewBackend, defineCommand } from "@jimcast/react-sdk/server";
import { getHostStorage } from "@jimcast/react-sdk/server";
import type { KanbanState } from "./types";
import { addCard, createBoard, deleteBoard, deleteCard, moveCard, renameCard } from "./domain/kanbanLogic";

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

defineWebviewBackend({}, [listBoards, newBoard, removeBoard, newCard, deleteCardCmd, moveCardCmd, renameCardCmd]);
