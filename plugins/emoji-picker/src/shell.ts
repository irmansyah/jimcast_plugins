// [plugin] jim-emojipicker/src/shell.ts
//
// Storage scripts + state read. State lives in the plugin data dir:
//   category, recent   (recent = one emoji per line, newest first)
// The SDK creates the dir.

import { pluginDataFile, type ExecutionContext } from "@jimcast/sdk";

export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const CATEGORY_FILE = `"${pluginDataFile("category")}"`;
const RECENT_FILE = `"${pluginDataFile("recent")}"`;
const RECENT_MAX = 24;

export const setCategoryCmd = (id: string) => `printf %s ${shq(id)} > ${CATEGORY_FILE}`;

/** Copies the emoji and moves it to the top of Recent (deduplicated, capped). */
export const copyCmd = (emoji: string) => `
f=${RECENT_FILE}
printf '%s\\n' ${shq(emoji)} | cat - "$f" 2>/dev/null | awk '!s[$0]++' | head -${RECENT_MAX} > "$f.tmp"; mv "$f.tmp" "$f"
printf %s ${shq(emoji)} | pbcopy
`;

const READ_STATE = `
echo "category=$(cat ${CATEGORY_FILE} 2>/dev/null)"
[ -f ${RECENT_FILE} ] && sed 's/^/recent=/' ${RECENT_FILE}
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
