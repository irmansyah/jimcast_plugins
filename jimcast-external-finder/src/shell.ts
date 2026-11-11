// [plugin] jimcast-external-finder/src/shell.ts
import type { ExecutionContext } from "@jimcast/sdk";

export type Exec = Pick<ExecutionContext, "exec" | "storage">;
/** A mutation: a shell string, or a function that works on state / runs shell. */
export type Cmd = string | ((ctx: Exec) => Promise<void>);

export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export const lines = (s: string): string[] =>
  s.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.length > 0);
export const join = (dir: string, name: string) => (dir === "/" ? `/${name}` : `${dir}/${name}`);
export const parentOf = (p: string) => (p === "/" ? "/" : p.slice(0, p.lastIndexOf("/")) || "/");
export const baseName = (p: string) => p.slice(p.lastIndexOf("/") + 1);
export const extOf = (p: string) => {
  const i = p.lastIndexOf(".");
  return i > p.lastIndexOf("/") ? p.slice(i + 1).toLowerCase() : "";
};

export const HOME = process.env.HOME ?? "/";
export const inHome = (p: string) => p === HOME || p.startsWith(HOME + "/");

export const CONFIRM_TTL_MS = 30_000;
const THUMB_PX = 480;
const THUMB_DIR = "$HOME/.jimcast/ext-finder/thumbs";

// ── state (plugin storage, one key) ─────────────────────────────────────────
export interface State {
  selected: string | null;                                  // null = nothing yet (show $HOME)
  marks: string[];
  hidden: boolean;                                          // show dotfiles
  confirmAt: number | null;                                 // when "Trash?" was asked (ms)
  clip: { mode: "copy" | "cut"; paths: string[] } | null;   // copy / cut clipboard
}
const EMPTY: State = { selected: null, marks: [], hidden: false, confirmAt: null, clip: null };

export async function loadState(ctx: Exec): Promise<State> {
  try {
    const raw: unknown = await ctx.storage.get("state");
    if (typeof raw === "string") return { ...EMPTY, ...JSON.parse(raw) };
    if (raw && typeof raw === "object") return { ...EMPTY, ...(raw as Partial<State>) };
  } catch { /* first run */ }
  return { ...EMPTY };
}
const saveState = (ctx: Exec, s: State) => ctx.storage.set("state", JSON.stringify(s));

export async function updateState(ctx: Exec, fn: (s: State) => void): Promise<State> {
  const s = await loadState(ctx);
  fn(s);
  await saveState(ctx, s);
  return s;
}
export const isConfirming = (s: State) =>
  s.marks.length > 0 && s.confirmAt !== null && Date.now() - s.confirmAt <= CONFIRM_TTL_MS;

/** Marks change -> any pending Trash prompt is void. */
const setMarks = (s: State, marks: string[]) => { s.marks = marks; s.confirmAt = null; };
const mutate = (fn: (s: State) => void): Cmd => async (ctx) => { await updateState(ctx, fn); };

export async function runCmd(ctx: Exec, cmd: Cmd): Promise<void> {
  if (typeof cmd === "string") await ctx.exec(cmd);
  else await cmd(ctx);
}
export const seq = (...cmds: Cmd[]): Cmd => async (ctx) => { for (const c of cmds) await runCmd(ctx, c); };

const DUPLICATE_WINDOW_MS = 300;
const lastRun = new Map<string, number>();

/** Runs `cmd` unless the same `key` ran within DUPLICATE_WINDOW_MS. For toggles that one
*  gesture can reach twice. The timestamp slides, so holding a key toggles once. */
export const guarded = (key: string, cmd: Cmd): Cmd => async (ctx) => {
  const now = Date.now();
  const last = lastRun.get(key);
  if (lastRun.size > 200) lastRun.clear();
  lastRun.set(key, now);
  if (last !== undefined && now - last < DUPLICATE_WINDOW_MS) return;
  await runCmd(ctx, cmd);
};

// ── raw readers (all end in `exit 0`) ───────────────────────────────────────
/** Prints d | f, then (files) size and kind. Nothing if the path does not exist. */
export const statCmd = (path: string) =>
  `p=${shq(path)}; if [ -d "$p" ]; then echo d; elif [ -e "$p" ]; then echo f; stat -f%z "$p"; file -b "$p"; fi; exit 0`;

export async function liveOf(ctx: Exec, paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const r = await ctx.exec(
    `for p in ${paths.map(shq).join(" ")}; do [ -e "$p" ] && printf '%s\\n' "$p"; done; exit 0`,
  );
  return lines(r.stdout.trim());
}

/** Folder entries (directories carry a trailing "/"), folders first, then A-Z. */
export async function listNames(ctx: Exec, dir: string, showHidden: boolean): Promise<string[]> {
  const res = await ctx.exec(`ls -1p${showHidden ? "A" : ""} ${shq(dir)} 2>/dev/null; exit 0`);
  const names = lines(res.stdout).filter((n) => showHidden || !n.startsWith("."));
  names.sort((a, b) => {
    const da = a.endsWith("/"), db = b.endsWith("/");
    return da !== db ? (da ? -1 : 1) : a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  return names;
}

export const thumbScript = (path: string) => `
p=${shq(path)}
d="${THUMB_DIR}"; mkdir -p "$d"
k=$(printf %s "$p:$(stat -f%m "$p")" | md5 -q)
f="$d/$k.jpg"
[ -s "$f" ] || sips -Z ${THUMB_PX} -s format jpeg -s formatOptions 70 "$p" --out "$f" >/dev/null 2>&1
[ -s "$f" ] && base64 -i "$f" | tr -d '\\n'
exit 0
`;

// ── navigation ──────────────────────────────────────────────────────────────
export const selectCmd = (path: string): Cmd => mutate((s) => { s.selected = path; });

/** Left = select the parent folder; never above $HOME (or "/" when already outside it). */
export const leftCmd = (path: string): Cmd => mutate((s) => {
  const t = parentOf(path);
  if (inHome(t) || t === "/") s.selected = t;
});

/** Right = folder -> select its first entry (folders first); file -> select it. */
export const rightCmd = (path: string): Cmd => async (ctx) => {
  const st = await loadState(ctx);
  const r = await ctx.exec(`if [ -d ${shq(path)} ]; then echo d; fi; exit 0`);
  let next = path;
  if (r.stdout.trim() === "d") {
    const [first] = await listNames(ctx, path, st.hidden);
    if (!first) return;
    next = join(path, first.replace(/\/$/, ""));
  }
  await updateState(ctx, (x) => { x.selected = next; });
};

export const TOGGLE_HIDDEN_CMD: Cmd = mutate((s) => { s.hidden = !s.hidden; });
export const openCmd = (path: string) => `open ${shq(path)}`;
export const revealCmd = (path: string) => `open -R ${shq(path)}`;

// ── marks ───────────────────────────────────────────────────────────────────
export const markCmd = (path: string): Cmd =>
  mutate((s) => setMarks(s, s.marks.includes(path) ? s.marks : [...s.marks, path]));
export const unmarkCmd = (path: string): Cmd =>
  mutate((s) => setMarks(s, s.marks.filter((m) => m !== path)));
export const toggleMarkCmd = (path: string): Cmd =>
  mutate((s) => setMarks(s, s.marks.includes(path) ? s.marks.filter((m) => m !== path) : [...s.marks, path]));
export const CLEAR_MARKS_CMD: Cmd = mutate((s) => setMarks(s, []));

/** All entries of `dir` marked -> unmark them; otherwise mark them all. Other folders' marks stay. */
export const selectAllCmd = (dir: string): Cmd => async (ctx) => {
  const st = await loadState(ctx);
  const paths = (await listNames(ctx, dir, st.hidden)).map((n) => join(dir, n.replace(/\/$/, "")));
  if (!paths.length) return;
  await updateState(ctx, (s) => {
    const all = paths.every((p) => s.marks.includes(p));
    setMarks(s, all
      ? s.marks.filter((m) => !paths.includes(m))
      : [...s.marks, ...paths.filter((p) => !s.marks.includes(p))]);
  });
};

// ── zip ─────────────────────────────────────────────────────────────────────
/** One item -> "<name>.zip", several -> "Archive.zip", next to the first item (numbered if taken). */
export const ZIP_MARKED_CMD: Cmd = async (ctx) => {
  const st = await loadState(ctx);
  const live = await liveOf(ctx, st.marks);
  await updateState(ctx, (s) => { s.marks = live; });
  if (!live.length) return;

  const dir = parentOf(live[0]);
  const same = live.every((p) => parentOf(p) === dir);
  const base = live.length === 1 ? baseName(live[0]) : "Archive";
  const feed = same
    ? `(cd "$dir" && printf '%s\\n' ${live.map((p) => shq(baseName(p))).join(" ")} | zip -rq "$out" -@)`
    : `printf '%s\\n' ${live.map(shq).join(" ")} | zip -rq "$out" -@`;
  const r = await ctx.exec(`
dir=${shq(dir)}; base=${shq(base)}
out="$dir/$base.zip"; i=2
while [ -e "$out" ]; do out="$dir/$base $i.zip"; i=$((i+1)); done
${feed}
`);
  if (r.exitCode === 0) await updateState(ctx, (s) => setMarks(s, []));
};

// ── trash (two steps) ───────────────────────────────────────────────────────
export const TRASH_ASK_CMD: Cmd = mutate((s) => { s.confirmAt = Date.now(); });
export const TRASH_CANCEL_CMD: Cmd = mutate((s) => { s.confirmAt = null; });

/** Consumes the confirmation (one use), refuses if stale, then trashes the marked items (recoverable). */
export const TRASH_CONFIRMED_CMD: Cmd = async (ctx) => {
  const st = await loadState(ctx);
  const ok = isConfirming(st);
  await updateState(ctx, (s) => { s.confirmAt = null; });
  if (!ok) return;
  const live = await liveOf(ctx, st.marks);
  if (!live.length) { await updateState(ctx, (s) => { s.marks = []; }); return; }
  const args = live.map(shq).join(" ");
  const r = await ctx.exec(
    `if [ -x /usr/bin/trash ]; then /usr/bin/trash ${args}; else ` +
    `osascript -e 'on run argv' -e 'repeat with p in argv' ` +
    `-e 'tell application "Finder" to delete (POSIX file (contents of p))' ` +
    `-e 'end repeat' -e 'end run' ${args}; fi`,
  );
  if (r.exitCode === 0) await updateState(ctx, (s) => { s.marks = []; });
};

// ── copy / cut / paste ──────────────────────────────────────────────────────
/** Takes the marked set if there is one, else `path` (the cursor row). */
export const yankCmd = (mode: "copy" | "cut", path: string): Cmd => async (ctx) => {
  const st = await loadState(ctx);
  const src = st.marks.length ? await liveOf(ctx, st.marks) : path ? await liveOf(ctx, [path]) : [];
  if (!src.length) return;
  await updateState(ctx, (s) => { s.clip = { mode, paths: src }; setMarks(s, []); });
};

/** Paste into `dir`. Never overwrites: clashes become "name 2.ext". Cut empties the clipboard. */
export const pasteCmd = (dir: string): Cmd => async (ctx) => {
  const st = await loadState(ctx);
  if (!st.clip || !st.clip.paths.length) return;
  const { mode, paths } = st.clip;
  await ctx.exec(`
d=${shq(dir)}; mode=${mode}
[ -d "$d" ] || exit 0
for s in ${paths.map(shq).join(" ")}; do
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
exit 0
`);
  await updateState(ctx, (s) => { if (mode === "cut") s.clip = null; s.confirmAt = null; });
};
