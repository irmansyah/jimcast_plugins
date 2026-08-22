// jimcast-react-kanban-v2/src/domain/keymap.ts
//
// Loads public/config.json (copied to dist/config.json unmodified by
// Vite, served through the same jimcast-plugin://<plugin>/ protocol that
// serves index.html/JS — see the carry-forward doc's "Why fetch works").
// A plugin with a broken/missing config.json should still be usable, not
// blank-screen, so every lookup falls back to DEFAULT_KEYMAP per-action.

export type KanbanAction =
  | "moveFocusUp"
  | "moveFocusDown"
  | "moveFocusLeft"
  | "moveFocusRight"
  | "openCard"
  | "newCard"
  | "deleteCard"
  | "moveCardLeft"
  | "moveCardRight"
  | "focusSearch"
  | "closeOrBack"
  | "toggleHelp";

export type Keymap = Record<KanbanAction, string[]>;

export const DEFAULT_KEYMAP: Keymap = {
  moveFocusUp: ["k", "ArrowUp"],
  moveFocusDown: ["j", "ArrowDown"],
  moveFocusLeft: ["h", "ArrowLeft"],
  moveFocusRight: ["l", "ArrowRight"],
  openCard: ["Enter"],
  newCard: ["n"],
  deleteCard: ["d"],
  moveCardLeft: ["H"],
  moveCardRight: ["L"],
  focusSearch: ["/"],
  closeOrBack: ["Escape"],
  toggleHelp: ["?"],
};

/** Loads public/config.json, falling back to defaults per-action if a key
 *  is missing or the fetch/parse fails outright — a plugin with a broken
 *  config.json should still be usable, not blank-screen. */
export async function loadKeymap(): Promise<Keymap> {
  try {
    const res = await fetch("./config.json");
    if (!res.ok) return DEFAULT_KEYMAP;
    const raw = await res.json();
    const merged = { ...DEFAULT_KEYMAP, ...(raw.keymap ?? {}) } as Keymap;
    return merged;
  } catch {
    return DEFAULT_KEYMAP;
  }
}

/** Reverse lookup: given a KeyboardEvent.key, find the action it triggers,
 *  or null. O(actions * keys-per-action) — fine at this scale (~12 actions). */
export function resolveAction(keymap: Keymap, key: string): KanbanAction | null {
  for (const [action, keys] of Object.entries(keymap) as [KanbanAction, string[]][]) {
    if (keys.includes(key)) return action;
  }
  return null;
}
