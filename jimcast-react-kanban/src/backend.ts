// [plugins] jimcast-react-kanban/src/backend.ts
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
//
// `run` (added — shell @tag support): the structured commands above all
// require fully-named args (boardId, columnId, cardId, ...) resolved from
// focus state in the interactive UI (useKanbanWorkspace.ts's
// resolveCardTarget/resolveColumnTarget), which doesn't exist here — this
// is a headless Node process with no notion of "currently focused card".
// [core]'s heuristics.rs @<plugin> <command> <rest> tag routing (see
// CARRY_FORWARD.md) sends everything after the tag verbatim as
// { text: string } — this command is [core]-agnostic about what that
// means; parsing/resolution below is 100% plugin-local, per the
// architectural constraint in CARRY_FORWARD.md ("no plugin-specific
// knowledge in [core]/[sdk]").
//
// Syntax chosen here (not derived from any existing spec — flag if a
// different convention is wanted):
//   run new <title>                        -> new card in first board's first column
//   run delete <title>                     -> delete first title-matching card, any column
//   run rename <old title> -> <new title>  -> "->" splits old/new
//   run archive <title>
//   run unarchive <title>
//   run move <title> left|right            -> shift card one column over
//   run list                               -> same shape as list-boards, for parity
//
// "First board" is used throughout since there's no current-board
// selection outside the open widget (mirrors the note on defaults in
// CARRY_FORWARD.md). If a board has zero boards/columns, each branch
// returns an explicit { ok:false, error } rather than throwing.
import { defineWebviewBackend, defineCommand } from "@jimcast/react-sdk/server";
import { getHostStorage } from "@jimcast/react-sdk/server";
import type { KanbanState, Board, Card } from "./types";
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

// ─── run: title-based lookups (headless equivalent of resolveCardTarget) ──

function findCardByTitle(board: Board, title: string): { columnId: string; card: Card } | null {
  const q = title.trim().toLowerCase();
  for (const col of board.columns) {
    const card = col.cards.find((c) => !c.archived && c.title.toLowerCase() === q);
    if (card) return { columnId: col.id, card };
  }
  return null;
}

function findArchivedCardByTitle(board: Board, title: string): { columnId: string; card: Card } | null {
  const q = title.trim().toLowerCase();
  for (const col of board.columns) {
    const card = col.cards.find((c) => c.archived && c.title.toLowerCase() === q);
    if (card) return { columnId: col.id, card };
  }
  return null;
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

// ─── run: generic free-text entry point for @kanban shell tags ──────────

const runCmd = defineCommand({
  id: "run",
  title: "Kanban: Run",
  description: 'Free-text kanban command, e.g. "new Buy milk" or "delete Buy milk"',
  run: async (args: Record<string, string>) => {
    const text = (args.text ?? "").trim();
    if (!text) return { ok: false, error: "empty command" };

    const spaceIdx = text.indexOf(" ");
    const verb = (spaceIdx === -1 ? text : text.slice(0, spaceIdx)).toLowerCase();
    const rest = spaceIdx === -1 ? "" : text.slice(spaceIdx + 1).trim();

    const state = await loadState();
    const board = state.boards[0];

    if (verb === "list") {
      return { boards: state.boards.map((b) => ({ id: b.id, name: b.name })) };
    }

    if (!board) return { ok: false, error: "no board exists — create one first" };

    switch (verb) {
      case "new":
      case "n": {
        if (!rest) return { ok: false, error: "usage: new <title>" };
        const column = board.columns[0];
        if (!column) return { ok: false, error: `board "${board.name}" has no columns` };
        const { state: next, card } = addCard(state, board.id, column.id, rest);
        await saveState(next);
        return { card };
      }

      case "delete":
      case "d": {
        if (!rest) return { ok: false, error: "usage: delete <title>" };
        const found = findCardByTitle(board, rest);
        if (!found) return { ok: false, error: `no card found for "${rest}"` };
        await saveState(deleteCard(state, board.id, found.card.id));
        return { ok: true };
      }

      case "rename": {
        const sepIdx = rest.indexOf("->");
        if (sepIdx === -1) return { ok: false, error: 'usage: rename <old title> -> <new title>' };
        const oldTitle = rest.slice(0, sepIdx).trim();
        const newTitle = rest.slice(sepIdx + 2).trim();
        if (!oldTitle || !newTitle) return { ok: false, error: 'usage: rename <old title> -> <new title>' };
        const found = findCardByTitle(board, oldTitle);
        if (!found) return { ok: false, error: `no card found for "${oldTitle}"` };
        await saveState(renameCard(state, board.id, found.card.id, newTitle));
        return { ok: true };
      }

      case "archive": {
        if (!rest) return { ok: false, error: "usage: archive <title>" };
        const found = findCardByTitle(board, rest);
        if (!found) return { ok: false, error: `no card found for "${rest}"` };
        await saveState(archiveCard(state, board.id, found.card.id, true));
        return { ok: true };
      }

      case "unarchive": {
        if (!rest) return { ok: false, error: "usage: unarchive <title>" };
        const found = findArchivedCardByTitle(board, rest);
        if (!found) return { ok: false, error: `no archived card found for "${rest}"` };
        await saveState(archiveCard(state, board.id, found.card.id, false));
        return { ok: true };
      }

      case "move": {
        const dirIdx = rest.toLowerCase().lastIndexOf(" left");
        const dirIdx2 = rest.toLowerCase().lastIndexOf(" right");
        const isLeft = dirIdx !== -1 && dirIdx === rest.length - 5;
        const isRight = dirIdx2 !== -1 && dirIdx2 === rest.length - 6;
        if (!isLeft && !isRight) return { ok: false, error: "usage: move <title> left|right" };
        const cardTitle = isLeft ? rest.slice(0, dirIdx).trim() : rest.slice(0, dirIdx2).trim();
        if (!cardTitle) return { ok: false, error: "usage: move <title> left|right" };
        const found = findCardByTitle(board, cardTitle);
        if (!found) return { ok: false, error: `no card found for "${cardTitle}"` };
        const colIdx = board.columns.findIndex((c) => c.id === found.columnId);
        const targetIdx = isLeft ? colIdx - 1 : colIdx + 1;
        const target = board.columns[targetIdx];
        if (!target) return { ok: false, error: `no column to the ${isLeft ? "left" : "right"}` };
        await saveState(moveCard(state, board.id, found.card.id, target.id));
        return { ok: true };
      }

      default:
        return { ok: false, error: `unknown run verb "${verb}" (try: new, delete, rename, archive, unarchive, move, list)` };
    }
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
  runCmd,
]);
