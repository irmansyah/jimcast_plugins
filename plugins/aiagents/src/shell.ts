// [plugin] jim-aiagents/src/shell.ts
import { pluginDataFile, type ExecutionContext } from "@jimcast/sdk";

export type Exec = Pick<ExecutionContext, "exec">;

export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

// Plugin data dir (created by the SDK): tab, feed.json
export const TAB_FILE = `"${pluginDataFile("tab")}"`;
export const FEED_FILE = `"${pluginDataFile("feed.json")}"`;

export const ALL_ID = "all";

export const setTabCmd = (id: string) => `printf %s ${shq(id)} > ${TAB_FILE}`;

export async function readTab(ctx: Exec): Promise<string> {
  const res = await ctx.exec(`cat ${TAB_FILE} 2>/dev/null`);
  return res.stdout.trim() || ALL_ID;
}

export async function readFeedRaw(ctx: Exec): Promise<string> {
  const res = await ctx.exec(`cat ${FEED_FILE} 2>/dev/null`);
  return res.stdout;
}
