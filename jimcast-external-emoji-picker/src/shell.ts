// [plugin] jimcast-external-emoji-picker/src/shell.ts
//
// Storage scripts + state read. Core's emojiPicker.ts scripts, except for the
// state dir: this plugin keeps its own (`ext-emoji`) so it can run next to the
// built-in picker without sharing its Recent list.
//
//   ~/.jimcast/ext-emoji/{category,recent}   (recent = one emoji per line, newest first)

import type { ExecutionContext } from "@jimcast/sdk";

export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const DIR = "$HOME/.jimcast/ext-emoji";
const CATEGORY_FILE = `"${DIR}/category"`;
const RECENT_FILE = `"${DIR}/recent"`;
const PRE = `mkdir -p "${DIR}"`;
const RECENT_MAX = 24;

export const setCategoryCmd = (id: string) => `${PRE}; printf %s ${shq(id)} > ${CATEGORY_FILE}`;

/** Copies the emoji and moves it to the top of Recent (deduplicated, capped). */
export const copyCmd = (emoji: string) => `
${PRE}; f=${RECENT_FILE}
printf '%s\\n' ${shq(emoji)} | cat - "$f" 2>/dev/null | awk '!s[$0]++' | head -${RECENT_MAX} > "$f.tmp"; mv "$f.tmp" "$f"
printf %s ${shq(emoji)} | pbcopy
`;

const READ_STATE = `
d="${DIR}"; mkdir -p "$d"
echo "category=$(cat "$d/category" 2>/dev/null)"
[ -f "$d/recent" ] && sed 's/^/recent=/' "$d/recent"
`;

export interface PickerState { category: string; recent: string[] }

export async function readState(ctx: ExecutionContext): Promise<PickerState> {
  const res = await ctx.exec(READ_STATE);
  const st: PickerState = { category: "", recent: [] };
  for (const line of res.stdout.trim().split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i), v = line.slice(i + 1).trim();
    if (k === "category") st.category = v;
    else if (k === "recent" && v) st.recent.push(v);
  }
  return st;
}
