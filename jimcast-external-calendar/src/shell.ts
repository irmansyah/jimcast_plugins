// [plugin] jimcast-external-calendar/src/shell.ts
//
// Shell scripts + state reads. State lives in ~/.jimcast/calendar/.
//
// NOTE: keep "{" and "}" out of these scripts: "{p}" is the only placeholder
// (see fill).

import type { ExecutionContext } from "@jimcast/sdk";

export const shq = (s: string) => "'" + s.replace(/'/g, "'\\''") + "'";

/** Replaces "{p}" with the shell-quoted path. */
export const fill = (cmd: string, p?: string) => (p === undefined ? cmd : cmd.split("{p}").join(shq(p)));

/** Runs a script (with optional "{p}") and returns trimmed stdout. */
export async function sh(ctx: ExecutionContext, cmd: string, p?: string): Promise<string> {
  const r = await ctx.exec(fill(cmd, p));
  return r.stdout.trim();
}

// ── State ───────────────────────────────────────────────────────────────────

const DIR = '"$HOME/.jimcast/calendar"';
const COUNT_FILE = '"$HOME/.jimcast/calendar/count"';

export const INCREMENT_CMD = "mkdir -p " + DIR + "; n=$(cat " + COUNT_FILE + " 2>/dev/null); echo $((n+1)) > " + COUNT_FILE;
export const RESET_CMD = "mkdir -p " + DIR + "; echo 0 > " + COUNT_FILE;

export async function readCount(ctx: ExecutionContext): Promise<number> {
  return Number(await sh(ctx, "cat " + COUNT_FILE + " 2>/dev/null")) || 0;
}
