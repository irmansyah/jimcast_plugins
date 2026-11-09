// [plugin] jimcast-external-finder/src/shell.ts
//
// Shell scripts + state reads. These are core's finder.ts scripts, unchanged
// except for the state files: this plugin keeps its own (`ext-finder-*`) so it
// can run next to the built-in Finder without sharing its selection or marks.
//
// NOTE: keep `{` / `}` out of these scripts — `{p}` is the only placeholder
// (see `fill`).

import type { ExecutionContext } from "@jimcast/sdk";

export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
export const join = (dir: string, name: string) => (dir === "/" ? `/${name}` : `${dir}/${name}`);
export const parentOf = (p: string) => (p === "/" ? "/" : p.slice(0, p.lastIndexOf("/")) || "/");
export const extOf = (p: string) => {
  const i = p.lastIndexOf(".");
  return i > p.lastIndexOf("/") ? p.slice(i + 1).toLowerCase() : "";
};
export const lines = (s: string) => s.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.length > 0);

/** Replaces `{p}` with the shell-quoted path. */
export const fill = (cmd: string, p?: string) => (p === undefined ? cmd : cmd.split("{p}").join(shq(p)));

/** Runs a script (with optional `{p}`) and returns trimmed stdout. Errors are ignored, like core's finder. */
export async function sh(ctx: ExecutionContext, cmd: string, p?: string): Promise<string> {
  const r = await ctx.exec(fill(cmd, p));
  return r.stdout.trim();
}

// ── State files ─────────────────────────────────────────────────────────────

const STATE_FILE   = '"$HOME/.jimcast/ext-finder-path"';
const HIDDEN_FILE  = '"$HOME/.jimcast/ext-finder-hidden"';
const CLIP_FILE    = '"$HOME/.jimcast/ext-finder-clipboard"';
const MARKS_FILE   = '"$HOME/.jimcast/ext-finder-marked"';
const CONFIRM_FILE = '"$HOME/.jimcast/ext-finder-confirm"';
export const CONFIRM_TTL_SECS = 30;

export const READ_STATE = `
p=$(cat ${STATE_FILE} 2>/dev/null)
[ -z "$p" ] && p="$HOME"
[ -e "$p" ] || p="$HOME"
echo "$HOME"; echo "$p"
if [ -d "$p" ]; then echo d; else echo f; stat -f%z "$p"; file -b "$p"; fi
`;

// Select = make {p} the selection.
export const SELECT_CMD = `printf %s {p} > ${STATE_FILE}`;

// Left = select the parent folder; never above $HOME.
export const LEFT_CMD = `
t=$(dirname {p})
case "$t" in "$HOME"|"$HOME"/*|/) printf %s "$t" > ${STATE_FILE};; esac
`;

// Right = folder -> select its first entry (folders first); file -> select it.
export const RIGHT_CMD = `
p={p}
if [ -d "$p" ]; then
  if [ -e ${HIDDEN_FILE} ]; then all=$(ls -1pA "$p"); else all=$(ls -1p "$p" | grep -v '^\\.'); fi
  first=$(printf '%s\\n' "$all" | grep '/$' | head -1)
  [ -z "$first" ] && first=$(printf '%s\\n' "$all" | head -1)
  [ -n "$first" ] && printf %s "$p/$(printf %s "$first" | sed 's:/$::')" > ${STATE_FILE}
else
  printf %s "$p" > ${STATE_FILE}
fi
`;

// ── Marks ───────────────────────────────────────────────────────────────────

// Idempotent counterparts of the Space toggle (which only flips).
export const MARK_CMD = `
f=${MARKS_FILE}; p={p}
mkdir -p "$HOME/.jimcast"; touch "$f"; rm -f ${CONFIRM_FILE}
grep -Fxq -- "$p" "$f" || printf '%s\\n' "$p" >> "$f"
`;
export const UNMARK_CMD = `
f=${MARKS_FILE}; p={p}
[ -s "$f" ] || exit 0
rm -f ${CONFIRM_FILE}
grep -Fxv -- "$p" "$f" > "$f.tmp"; mv "$f.tmp" "$f"
`;
export const TOGGLE_MARK_CMD = `
f=${MARKS_FILE}; p={p}
mkdir -p "$HOME/.jimcast"; touch "$f"; rm -f ${CONFIRM_FILE}
if grep -Fxq -- "$p" "$f"; then
  grep -Fxv -- "$p" "$f" > "$f.tmp"; mv "$f.tmp" "$f"
else
  printf '%s\\n' "$p" >> "$f"
fi
`;

// Read for display: only entries that still exist.
export const READ_MARKS = `
f=${MARKS_FILE}
[ -s "$f" ] || exit 0
while IFS= read -r l; do [ -e "$l" ] && printf '%s\\n' "$l"; done < "$f"
`;

// Start of every action: drop entries that no longer exist; stop if none left.
const PRUNE_MARKS = `
f=${MARKS_FILE}
[ -s "$f" ] || exit 0
while IFS= read -r l; do [ -e "$l" ] && printf '%s\\n' "$l"; done < "$f" > "$f.tmp"; mv "$f.tmp" "$f"
[ -s "$f" ] || exit 0
`;

export const CLEAR_MARKS_CMD = `mkdir -p "$HOME/.jimcast"; : > ${MARKS_FILE}; rm -f ${CONFIRM_FILE}`;

// One item -> "<name>.zip", several -> "Archive.zip", next to the first item
// (numbered if the name is taken).
export const ZIP_MARKED_CMD = `${PRUNE_MARKS}
dir=$(dirname "$(head -1 "$f")")
same=1
while IFS= read -r l; do [ "$(dirname "$l")" = "$dir" ] || same=0; done < "$f"
n=$(wc -l < "$f" | tr -d ' ')
if [ "$n" = 1 ]; then base=$(basename "$(head -1 "$f")"); else base="Archive"; fi
out="$dir/$base.zip"; i=2
while [ -e "$out" ]; do out="$dir/$base $i.zip"; i=$((i+1)); done
if [ "$same" = 1 ]; then
  (cd "$dir" && while IFS= read -r l; do basename "$l"; done < "$f" | zip -rq "$out" -@)
else
  zip -rq "$out" -@ < "$f"
fi
: > "$f"; rm -f ${CONFIRM_FILE}
`;

// Moves to the Trash (recoverable) via Finder — never rm.
export const TRASH_MARKED_CMD = `${PRUNE_MARKS}
tr '\\n' '\\0' < "$f" | xargs -0 osascript -e 'on run argv' -e 'repeat with p in argv' -e 'tell application "Finder" to delete (POSIX file (contents of p))' -e 'end repeat' -e 'end run' && : > "$f"
`;

// Two-step Trash: ask only records a timestamp; confirm re-checks it.
export const TRASH_ASK_CMD = `mkdir -p "$HOME/.jimcast"; date +%s > ${CONFIRM_FILE}`;
export const TRASH_CANCEL_CMD = `rm -f ${CONFIRM_FILE}`;
export const TRASH_CONFIRMED_CMD = `
c=${CONFIRM_FILE}
[ -s "$c" ] || exit 0
t=$(cat "$c"); rm -f "$c"
[ $(( $(date +%s) - t )) -le ${CONFIRM_TTL_SECS} ] || exit 0
${TRASH_MARKED_CMD}`;

export const READ_CONFIRM = `
c=${CONFIRM_FILE}
[ -s "$c" ] || exit 0
t=$(cat "$c")
[ $(( $(date +%s) - t )) -le ${CONFIRM_TTL_SECS} ] && echo 1
`;

// ── Hidden files ────────────────────────────────────────────────────────────

export const TOGGLE_HIDDEN_CMD = `
f=${HIDDEN_FILE}
mkdir -p "$HOME/.jimcast"
if [ -e "$f" ]; then rm -f "$f"; else : > "$f"; fi
`;
export const READ_HIDDEN = `[ -e ${HIDDEN_FILE} ] && echo 1`;

// ── Copy / cut / paste ──────────────────────────────────────────────────────

/** Copy / cut take the marked set if there is one, else {p} (the cursor row). */
export const yankCmd = (mode: "copy" | "cut") => `
f=${MARKS_FILE}; c=${CLIP_FILE}; p={p}
mkdir -p "$HOME/.jimcast"
src=""
if [ -s "$f" ]; then
  src=$(while IFS= read -r l; do [ -e "$l" ] && printf '%s\\n' "$l"; done < "$f")
else
  [ -n "$p" ] && [ -e "$p" ] && src="$p"
fi
[ -n "$src" ] || exit 0
( echo ${mode}; printf '%s\\n' "$src" ) > "$c"
: > "$f"; rm -f ${CONFIRM_FILE}
`;

// Paste into {p} (a folder). Never overwrites: clashes become "name 2.ext".
export const PASTE_CMD = `
c=${CLIP_FILE}; d={p}
[ -s "$c" ] || exit 0
[ -d "$d" ] || exit 0
mode=$(head -1 "$c")
tail -n +2 "$c" | while IFS= read -r s; do
  [ -e "$s" ] || continue
  case "$d/" in "$s"/*) continue;; esac
  if [ "$mode" = cut ] && [ "$(dirname "$s")" = "$d" ]; then continue; fi
  n=$(basename "$s")
  ext=$(printf %s "$n" | sed -n 's/^..*\\(\\.[^.]*\\)$/\\1/p')
  base=$(printf %s "$n" | sed 's/^\\(..*\\)\\.[^.]*$/\\1/')
  t="$d/$n"; i=2
  while [ -e "$t" ]; do t="$d/$base $i$ext"; i=$((i+1)); done
  if [ "$mode" = cut ]; then mv "$s" "$t"; else cp -R "$s" "$t"; fi
done
[ "$mode" = cut ] && : > "$c"
rm -f ${CONFIRM_FILE}
`;

// Prints the mode (copy|cut), then the number of paths. Nothing when empty.
export const READ_CLIP = `
c=${CLIP_FILE}
[ -s "$c" ] || exit 0
head -1 "$c"
tail -n +2 "$c" | wc -l | tr -d ' '
`;

// ── Image thumbnails (sips, cached by path + mtime) ─────────────────────────

export const THUMB_PX = 480;
export const thumbScript = (path: string) => `
p=${shq(path)}
d="$HOME/.jimcast/thumbs"; mkdir -p "$d"
k=$(printf %s "$p:$(stat -f%m "$p")" | md5 -q)
f="$d/$k.jpg"
[ -s "$f" ] || sips -Z ${THUMB_PX} -s format jpeg -s formatOptions 70 "$p" --out "$f" >/dev/null 2>&1
[ -s "$f" ] && base64 -i "$f" | tr -d '\\n'
`;

// ── Status ──────────────────────────────────────────────────────────────────

export interface FinderStatus {
  home:       string;
  selected:   string;
  isDir:      boolean;
  size:       number;
  kind:       string;
  marked:     string[];
  confirming: boolean;
  showHidden: boolean;
  clip:       { mode: string; count: number } | null;
}

export async function readStatus(ctx: ExecutionContext): Promise<FinderStatus> {
  const [stateOut, marksOut, confirmOut, hiddenOut, clipOut] = await Promise.all([
    sh(ctx, READ_STATE), sh(ctx, READ_MARKS), sh(ctx, READ_CONFIRM), sh(ctx, READ_HIDDEN), sh(ctx, READ_CLIP),
  ]);
  const state  = lines(stateOut);
  const marked = lines(marksOut);
  const clipL  = lines(clipOut);
  const home   = state[0] || "/";
  return {
    home,
    selected:   state[1] || home,
    isDir:      state[2] !== "f",
    size:       Number(state[3] ?? NaN),
    kind:       state[4] ?? "file",
    marked,
    confirming: marked.length > 0 && confirmOut.trim() === "1",
    showHidden: hiddenOut.trim() === "1",
    clip:       clipL.length >= 2 ? { mode: clipL[0], count: Number(clipL[1]) || 0 } : null,
  };
}
