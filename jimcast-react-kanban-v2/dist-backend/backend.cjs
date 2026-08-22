"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/@jimcast+react-sdk@file+..+..+jimcast-sdk+packages+react-sdk_react@18.3.1/node_modules/@jimcast/react-sdk/dist/server.mjs
var readline = __toESM(require("node:readline"), 1);

// node_modules/.pnpm/@jimcast+protocol@file+..+..+jimcast-sdk+packages+protocol/node_modules/@jimcast/protocol/dist/index.mjs
function createStorage(send) {
  return {
    async get(key) {
      return (await send("storage_get", { key })).value;
    },
    async set(key, value) {
      await send("storage_set", {
        key,
        value
      });
    },
    async delete(key) {
      await send("storage_delete", { key });
    },
    async has(key) {
      return (await send("storage_has", { key })).exists;
    },
    async keys(options) {
      return (await send("storage_keys", { prefix: options?.prefix ?? null })).keys;
    },
    async clear() {
      await send("storage_clear", {});
    }
  };
}

// node_modules/.pnpm/@jimcast+react-sdk@file+..+..+jimcast-sdk+packages+react-sdk_react@18.3.1/node_modules/@jimcast/react-sdk/dist/server.mjs
var pending = /* @__PURE__ */ new Map();
var seq = 0;
function resolvePending(msg) {
  if (!msg || typeof msg !== "object" || !msg.id) return false;
  const p = pending.get(msg.id);
  if (!p) return false;
  pending.delete(msg.id);
  if (msg.error) p.reject(new Error(msg.error));
  else p.resolve(msg.result);
  return true;
}
function callHost(command, args = {}) {
  const id = `h${++seq}`;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    process.stdout.write(JSON.stringify({ id, command, args }) + "\n");
  });
}
var LIST_COMMANDS_ID = "__jimcast_list_commands__";
function defineCommand(definition) {
  return definition;
}
function toCommandMeta(commands) {
  return commands.map(({ id, title, description, args }) => ({
    id,
    title,
    description,
    args: args ?? []
  }));
}
var instance = null;
function getHostStorage() {
  if (!instance) {
    instance = createStorage((method, params) => callHost(method, params));
  }
  return instance;
}
var started = false;
function defineWebviewBackend(handlers, commands = []) {
  if (started) {
    console.error("[jimcast/react-sdk] defineWebviewBackend() called more than once \u2014 ignoring");
    return;
  }
  started = true;
  const dispatch = { ...handlers };
  for (const cmd of commands) {
    if (cmd.id === LIST_COMMANDS_ID) {
      console.error(`[jimcast/react-sdk] command id "${LIST_COMMANDS_ID}" is reserved \u2014 skipping`);
      continue;
    }
    if (dispatch[cmd.id]) {
      console.error(`[jimcast/react-sdk] command "${cmd.id}" collides with an existing handler \u2014 skipping`);
      continue;
    }
    dispatch[cmd.id] = (args) => cmd.run(args ?? {});
  }
  if (commands.length > 0) {
    dispatch[LIST_COMMANDS_ID] = () => toCommandMeta(commands);
  }
  function respond(id, result) {
    process.stdout.write(JSON.stringify({ id, result }) + "\n");
  }
  function respondErr(id, error) {
    process.stdout.write(JSON.stringify({ id, error }) + "\n");
  }
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (resolvePending(msg)) return;
    if (!msg.command) return;
    const handler = dispatch[msg.command];
    if (!handler) return respondErr(msg.id, `unknown command: ${msg.command}`);
    try {
      respond(msg.id, await handler(msg.args ?? {}));
    } catch (e) {
      respondErr(msg.id, e instanceof Error ? e.message : String(e));
    }
  });
}

// src/domain/kanbanLogic.ts
var DEFAULT_COLUMNS = ["todo", "in-progress", "done"];
function makeId() {
  return Math.random().toString(36).slice(2, 10);
}
function createBoard(state, name) {
  const board = {
    id: makeId(),
    name,
    columns: DEFAULT_COLUMNS.map((title) => ({ id: title, title, cards: [] }))
  };
  return { state: { boards: [...state.boards, board] }, board };
}
function renameCard(state, boardId, cardId, title) {
  return withBoard(state, boardId, (b) => ({
    ...b,
    columns: b.columns.map((c) => ({
      ...c,
      cards: c.cards.map((card) => card.id === cardId ? { ...card, title } : card)
    }))
  }));
}
function deleteBoard(state, boardId) {
  return { boards: state.boards.filter((b) => b.id !== boardId) };
}
function findBoard(state, boardId) {
  const board = state.boards.find((b) => b.id === boardId);
  if (!board) throw new Error(`no such board: ${boardId}`);
  return board;
}
function withBoard(state, boardId, fn) {
  return { boards: state.boards.map((b) => b.id === boardId ? fn(b) : b) };
}
function addCard(state, boardId, columnId, title) {
  findBoard(state, boardId);
  const card = { id: makeId(), title };
  const next = withBoard(state, boardId, (b) => ({
    ...b,
    columns: b.columns.map((c) => c.id === columnId ? { ...c, cards: [...c.cards, card] } : c)
  }));
  return { state: next, card };
}
function moveCard(state, boardId, cardId, toColumnId) {
  const board = findBoard(state, boardId);
  let moved = null;
  const stripped = board.columns.map((c) => {
    const idx = c.cards.findIndex((card) => card.id === cardId);
    if (idx === -1) return c;
    moved = c.cards[idx];
    return { ...c, cards: c.cards.filter((card) => card.id !== cardId) };
  });
  if (!moved) throw new Error(`no such card: ${cardId}`);
  const placed = stripped.map((c) => c.id === toColumnId ? { ...c, cards: [...c.cards, moved] } : c);
  return withBoard(state, boardId, () => ({ ...board, columns: placed }));
}
function deleteCard(state, boardId, cardId) {
  return withBoard(state, boardId, (b) => ({
    ...b,
    columns: b.columns.map((c) => ({ ...c, cards: c.cards.filter((card) => card.id !== cardId) }))
  }));
}

// src/backend.ts
var storage = getHostStorage();
var STORAGE_KEY = "kanbanState";
var EMPTY_STATE = { boards: [] };
async function loadState() {
  const raw = await storage.get(STORAGE_KEY);
  return raw ? JSON.parse(raw) : EMPTY_STATE;
}
async function saveState(state) {
  await storage.set(STORAGE_KEY, JSON.stringify(state));
}
var listBoards = defineCommand({
  id: "list-boards",
  title: "Kanban: List Boards",
  run: async () => {
    const state = await loadState();
    return { boards: state.boards.map((b) => ({ id: b.id, name: b.name })) };
  }
});
var newBoard = defineCommand({
  id: "new-board",
  title: "Kanban: New Board",
  run: async (args) => {
    const state = await loadState();
    const { state: next, board } = createBoard(state, args.name?.trim() || "Untitled board");
    await saveState(next);
    return { board };
  }
});
var removeBoard = defineCommand({
  id: "delete-board",
  title: "Kanban: Delete Board",
  run: async (args) => {
    if (!args.boardId) return { ok: false, error: "boardId is required" };
    const state = await loadState();
    await saveState(deleteBoard(state, args.boardId));
    return { ok: true };
  }
});
var newCard = defineCommand({
  id: "new-card",
  title: "Kanban: New Card",
  run: async (args) => {
    if (!args.boardId || !args.columnId || !args.title) {
      return { ok: false, error: "boardId, columnId, and title are required" };
    }
    const state = await loadState();
    const { state: next, card } = addCard(state, args.boardId, args.columnId, args.title);
    await saveState(next);
    return { card };
  }
});
var deleteCardCmd = defineCommand({
  id: "delete-card",
  title: "Kanban: Delete Card",
  run: async (args) => {
    if (!args.boardId || !args.cardId) return { ok: false, error: "boardId and cardId are required" };
    const state = await loadState();
    await saveState(deleteCard(state, args.boardId, args.cardId));
    return { ok: true };
  }
});
var moveCardCmd = defineCommand({
  id: "move-card",
  title: "Kanban: Move Card",
  run: async (args) => {
    if (!args.boardId || !args.cardId || !args.toColumnId) {
      return { ok: false, error: "boardId, cardId, and toColumnId are required" };
    }
    const state = await loadState();
    await saveState(moveCard(state, args.boardId, args.cardId, args.toColumnId));
    return { ok: true };
  }
});
var renameCardCmd = defineCommand({
  id: "rename-card",
  title: "Kanban: Rename Card",
  run: async (args) => {
    if (!args.boardId || !args.cardId || !args.title) {
      return { ok: false, error: "boardId, cardId, and title are required" };
    }
    const state = await loadState();
    await saveState(renameCard(state, args.boardId, args.cardId, args.title));
    return { ok: true };
  }
});
defineWebviewBackend({}, [listBoards, newBoard, removeBoard, newCard, deleteCardCmd, moveCardCmd, renameCardCmd]);
//# sourceMappingURL=backend.cjs.map
