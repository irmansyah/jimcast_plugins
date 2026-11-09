// [plugin] jimcast-external-aiagents/src/shell.ts
import type { ExecutionContext } from "@jimcast/sdk";

export type Exec = Pick<ExecutionContext, "exec">;

export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const DIR = "$HOME/.jimcast/ext-aiagents";
export const TAB_FILE = `"${DIR}/tab"`;
export const FEED_FILE = `"${DIR}/feed.json"`;

export const ALL_ID = "all";

export const setTabCmd = (id: string) =>
  `mkdir -p "${DIR}"; printf %s ${shq(id)} > ${TAB_FILE}`;

export async function readTab(ctx: Exec): Promise<string> {
  const res = await ctx.exec(`cat ${TAB_FILE} 2>/dev/null`);
  return res.stdout.trim() || ALL_ID;
}

export async function readFeedRaw(ctx: Exec): Promise<string> {
  const res = await ctx.exec(`cat ${FEED_FILE} 2>/dev/null`);
  return res.stdout;
}
