// [plugin] jimcast-external-color-picker/src/shell.ts
//
// Storage scripts + state reads. These are core's colorPicker.ts scripts,
// except for the state dir: this plugin keeps its own (`ext-colorpicker`) so it
// can run next to the built-in picker without sharing its profiles.
//
// State lives in ~/.jimcast/ext-colorpicker/{view,target,mode,profiles/<name>,trash/}
// (profile file = one #rrggbb per line).

import type { ExecutionContext } from "@jimcast/sdk";

export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export const SPECTRUM_ID = "spectrum";

const DIR = "$HOME/.jimcast/ext-colorpicker";
export const VIEW_FILE = `"${DIR}/view"`;
export const TARGET_FILE = `"${DIR}/target"`;
export const MODE_FILE = `"${DIR}/mode"`;
const PRE = `mkdir -p "${DIR}/profiles"`;

// "$HOME/.../profiles/"'Profile 1'  (adjacent quoted strings = one word)
const profilePath = (name: string) => `"${DIR}/profiles/"${shq(name)}`;

export const cleanName = (s: string) =>
  s.replace(/[^A-Za-z0-9 _.-]/g, "").replace(/^[.\s]+/, "").trim().slice(0, 32);

const HEX = /^#?([0-9a-f]{6})$/i;
export const normHex = (s: string): string | null => {
  const m = HEX.exec(s.trim());
  return m ? `#${m[1].toLowerCase()}` : null;
};

export const setCmd = (file: string, value: string) => `${PRE}; printf %s ${shq(value)} > ${file}`;

/** Copy a color to the macOS clipboard. */
export const copyCmd = (hex: string) => `printf %s ${shq(hex)} | pbcopy`;

// Create the profile, make it the save target, switch ENTER to Save.
export const newProfileCmd = (name: string) =>
  `${PRE}; touch ${profilePath(name)}; printf %s ${shq(name)} > ${TARGET_FILE}; printf save > ${MODE_FILE}`;

// Make sure a target profile exists WITHOUT touching the ENTER mode.
export const ensureTargetCmd = (name: string) =>
  `${PRE}; touch ${profilePath(name)}; printf %s ${shq(name)} > ${TARGET_FILE}`;

export const addCmd = (name: string, hex: string) => `
${PRE}; f=${profilePath(name)}; touch "$f"
grep -Fxq -- ${shq(hex)} "$f" || printf '%s\\n' ${shq(hex)} >> "$f"
`;

export const removeCmd = (name: string, hex: string) => `
f=${profilePath(name)}
[ -f "$f" ] || exit 0
grep -Fxv -- ${shq(hex)} "$f" > "$f.tmp"; mv "$f.tmp" "$f"
`;

// Moves to trash (recoverable) and resets target / view if they pointed at it.
export const deleteCmd = (name: string) => `
${PRE}; mkdir -p "${DIR}/trash"
f=${profilePath(name)}
[ -f "$f" ] && mv "$f" "${DIR}/trash/"${shq(name)}".$(date +%s)"
t=$(cat ${TARGET_FILE} 2>/dev/null); [ "$t" = ${shq(name)} ] && rm -f ${TARGET_FILE}
v=$(cat ${VIEW_FILE} 2>/dev/null); [ "$v" = ${shq("profile:" + name)} ] && printf spectrum > ${VIEW_FILE}
`;

// Prints key=value lines: view, target, mode, profile=<name>..., color=<hex>...
// (contents of the viewed profile, if it is one), count=<n> (size of target).
const READ_STATE = `
d="${DIR}"; mkdir -p "$d/profiles"
echo "view=$(cat "$d/view" 2>/dev/null)"
echo "target=$(cat "$d/target" 2>/dev/null)"
echo "mode=$(cat "$d/mode" 2>/dev/null)"
ls -1 "$d/profiles" | sed 's/^/profile=/'
v=$(cat "$d/view" 2>/dev/null)
case "$v" in profile:*) n="$d/profiles/$(printf %s "$v" | cut -c9-)"; [ -f "$n" ] && sed 's/^/color=/' "$n";; esac
t=$(cat "$d/target" 2>/dev/null)
[ -n "$t" ] && [ -f "$d/profiles/$t" ] && echo "count=$(grep -c . "$d/profiles/$t")"
`;

export interface PickerState {
  view: string;
  target: string | null;
  mode: string;
  profiles: string[];
  colors: string[]; // contents of the viewed profile
  count: number;    // colors in the target profile
}

export async function readState(ctx: ExecutionContext): Promise<PickerState> {
  const res = await ctx.exec(READ_STATE);
  const st: PickerState = { view: SPECTRUM_ID, target: null, mode: "copy", profiles: [], colors: [], count: 0 };
  for (const line of res.stdout.trim().split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i), v = line.slice(i + 1).trim();
    if (k === "view" && v) st.view = v;
    else if (k === "target" && v) st.target = v;
    else if (k === "mode" && v) st.mode = v;
    else if (k === "profile" && v) st.profiles.push(v);
    else if (k === "color") { const h = normHex(v); if (h) st.colors.push(h); }
    else if (k === "count") st.count = Number(v) || 0;
  }
  if (st.target && !st.profiles.includes(st.target)) st.target = null;
  return st;
}
