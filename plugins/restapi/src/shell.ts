// // [plugin] jim-restapi/src/shell.ts
// import { pluginDataDir, pluginDataFile, type ExecutionContext } from "@jimcast/sdk";
//
// export type Exec = Pick<ExecutionContext, "exec">;
//
// export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
//
// // "~/x/y" -> "$HOME"'/x/y' (adjacent quoted strings = one word)
// export const shPath = (p: string) =>
//   p === "~" ? '"$HOME"' : p.startsWith("~/") ? `"$HOME"${shq(p.slice(1))}` : shq(p);
//
// // ── Storage (plugin data dir, created by the SDK) ───────────────────────────
// export const DIR = pluginDataDir();
// const F_CONFIG = pluginDataFile("config");
// const F_SELECTED = pluginDataFile("selected");
// const F_STATUS = pluginDataFile("status");
// const F_OUT = pluginDataFile("out");
//
// export const CONFIGS_DIR = `${DIR}/configs`;
// // `configs/` is a user-facing subfolder (users drop *.json files there).
// export const PRE = `mkdir -p "${CONFIGS_DIR}"`;
// export const CONFIGS_HINT = `${CONFIGS_DIR}/`;
// export const DEFAULT_VARIABLE_DIR = `${DIR}/_variables`;
//
// // Output lines kept in the right pane (used by READ_STATE and by render.ts).
// export const MAX_LINES = 300;
//
// export const setConfigCmd = (name: string) =>
//   `${PRE}; printf %s ${shq(name)} > "${F_CONFIG}"; rm -f "${F_SELECTED}" "${F_STATUS}" "${F_OUT}"`;
//
// // jq filter from a dotted path: data.access_token -> .data.access_token, items.0.id -> .items[0].id
// export const jqFilter = (path: string) =>
//   path
//     .split(".")
//     .filter(Boolean)
//     .map((s) => (/^\d+$/.test(s) ? `[${s}]` : `.${s}`))
//     .join("");
//
// export const READ_STATE = `
// c="${CONFIGS_DIR}"; mkdir -p "$c"
// n=$(cat "${F_CONFIG}" 2>/dev/null)
// [ -f "$c/$n" ] || n=$(ls -1 "$c" | grep '\\.json$' | head -1)
// echo "config=$n"
// ls -1 "$c" | grep '\\.json$' | sed 's/^/configs=/'
// echo "selected=$(cat "${F_SELECTED}" 2>/dev/null)"
// echo "status=$(cat "${F_STATUS}" 2>/dev/null)"
// [ -n "$n" ] && echo "cfg=$(tr -d '\\n' < "$c/$n")"
// echo "---"
// head -${MAX_LINES} "${F_OUT}" 2>/dev/null
// `;
//
// // Raw, untrimmed stdout of READ_STATE (parsed in data.ts).
// export async function readRawState(ctx: Exec): Promise<string> {
//   const res = await ctx.exec(READ_STATE);
//   return res.stdout;
// }
//
// // `pathWord` is an already-quoted shell word (see varPath in data.ts).
// export async function isNonEmptyFile(ctx: Exec, pathWord: string): Promise<boolean> {
//   const res = await ctx.exec(`[ -s ${pathWord} ] && echo yes`);
//   return res.stdout.trim() === "yes";
// }
