// [plugin] jimcast-external-restapi/src/shell.ts
import type { ExecutionContext } from "@jimcast/sdk";

export type Exec = Pick<ExecutionContext, "exec">;

export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

// "~/x/y" -> "$HOME"'/x/y' (adjacent quoted strings = one word)
export const shPath = (p: string) =>
  p === "~" ? '"$HOME"' : p.startsWith("~/") ? `"$HOME"${shq(p.slice(1))}` : shq(p);

// ── Storage ─────────────────────────────────────────────────────────────────
export const DIR = "$HOME/.jimcast/ext-restapi";
export const CONFIGS_DIR = `${DIR}/configs`;
export const PRE = `mkdir -p "${CONFIGS_DIR}"`;
export const CONFIGS_HINT = "~/.jimcast/ext-restapi/configs/";
export const DEFAULT_VARIABLE_DIR = "~/.jimcast/ext-restapi/_variables";

// Output lines kept in the right pane (used by READ_STATE and by render.ts).
export const MAX_LINES = 300;

export const setConfigCmd = (name: string) =>
  `${PRE}; printf %s ${shq(name)} > "${DIR}/config"; rm -f "${DIR}/selected" "${DIR}/status" "${DIR}/out"`;

// jq filter from a dotted path: data.access_token -> .data.access_token, items.0.id -> .items[0].id
export const jqFilter = (path: string) =>
  path
    .split(".")
    .filter(Boolean)
    .map((s) => (/^\d+$/.test(s) ? `[${s}]` : `.${s}`))
    .join("");

export const READ_STATE = `
d="${DIR}"; c="${CONFIGS_DIR}"; mkdir -p "$c"
n=$(cat "$d/config" 2>/dev/null)
[ -f "$c/$n" ] || n=$(ls -1 "$c" | grep '\\.json$' | head -1)
echo "config=$n"
ls -1 "$c" | grep '\\.json$' | sed 's/^/configs=/'
echo "selected=$(cat "$d/selected" 2>/dev/null)"
echo "status=$(cat "$d/status" 2>/dev/null)"
[ -n "$n" ] && echo "cfg=$(tr -d '\\n' < "$c/$n")"
echo "---"
head -${MAX_LINES} "$d/out" 2>/dev/null
`;

// Raw, untrimmed stdout of READ_STATE (parsed in data.ts).
export async function readRawState(ctx: Exec): Promise<string> {
  const res = await ctx.exec(READ_STATE);
  return res.stdout;
}

// `pathWord` is an already-quoted shell word (see varPath in data.ts).
export async function isNonEmptyFile(ctx: Exec, pathWord: string): Promise<boolean> {
  const res = await ctx.exec(`[ -s ${pathWord} ] && echo yes`);
  return res.stdout.trim() === "yes";
}
