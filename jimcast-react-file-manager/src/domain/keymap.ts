// [plugins] jimcast-react-file-manager/src/domain/keymap.ts
//
// Direct port of kanban's keymap.ts — same public/config.json fetch,
// same per-action fallback to DEFAULT_KEYMAP. Actions renamed to
// file-manager's vocabulary; toggleSelection/openSelection/deleteSelection
// replace kanban's card-specific actions.

export type FileManagerAction =
  | "moveFocusUp"
  | "moveFocusDown"
  | "moveFocusLeft"
  | "moveFocusRight"
  | "toggleSelection"
  | "openSelection"
  | "deleteSelection"
  | "toggleHidden"
  | "focusSearch"
  | "closeOrBack"
  | "toggleHelp";

export type Keymap = Record<FileManagerAction, string[]>;

export const DEFAULT_KEYMAP: Keymap = {
  moveFocusUp: ["k", "ArrowUp"],
  moveFocusDown: ["j", "ArrowDown"],
  moveFocusLeft: ["h", "ArrowLeft"],
  moveFocusRight: ["l", "ArrowRight"],
  toggleSelection: [" "],
  openSelection: ["Enter"],
  deleteSelection: ["d"],
  toggleHidden: ["."],
  focusSearch: ["/"],
  closeOrBack: ["Escape"],
  toggleHelp: ["?"],
};

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

export function resolveAction(keymap: Keymap, key: string): FileManagerAction | null {
  for (const [action, keys] of Object.entries(keymap) as [FileManagerAction, string[]][]) {
    if (keys.includes(key)) return action;
  }
  return null;
}
