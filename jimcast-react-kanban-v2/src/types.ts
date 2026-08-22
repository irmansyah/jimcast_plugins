// jimcast-react-kanban-v2/src/types.ts
//
// Card/Column/Board/KanbanState shapes are inferred from every read/write
// site in the old kanban plugin's kanbanLogic.ts (that file's real source
// types.ts wasn't available to port directly). If the original had extra
// fields — timestamps, card descriptions, board color, etc — extend these
// and kanbanLogic.ts's constructors accordingly; nothing else here assumes
// the shape is closed.

export interface Card {
  id: string;
  title: string;
}

export interface Column {
  id: string;
  title: string;
  cards: Card[];
}

export interface Board {
  id: string;
  name: string;
  columns: Column[];
}

export interface KanbanState {
  boards: Board[];
}

// ─── UI-only types ──────────────────────────────────────────────────────

/** Which pane currently owns keyboard focus, mirrors rest's Zone concept. */
export type Zone = "board" | "cardModal" | "search";
