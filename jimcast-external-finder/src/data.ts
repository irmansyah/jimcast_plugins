// [plugin] jimcast-external-finder/src/data.ts
import {
  type Exec, HOME, lines, extOf, parentOf, shq,
  loadState, isConfirming, statCmd, liveOf, thumbScript,
} from "./shell.js";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff", "heic", "heif", "ico"]);
const SVG_MAX_BYTES = 1_000_000;

export interface FinderStatus {
  home: string;
  selected: string;
  isDir: boolean;
  marked: string[];
  confirming: boolean;
  showHidden: boolean;
}

export interface FinderState {
  home: string;
  sel: string;
  isDir: boolean;
  size: number;
  kind: string;
  marks: Set<string>;
  confirming: boolean;
  showHidden: boolean;
  clip: { mode: string; count: number } | null;
}

/** Everything the render needs: stored state plus the live facts about the selection and marks. */
export async function loadFinderState(ctx: Exec): Promise<FinderState> {
  const st = await loadState(ctx);
  const [statRes, live] = await Promise.all([
    st.selected ? ctx.exec(statCmd(st.selected)) : Promise.resolve(null),
    liveOf(ctx, st.marks),
  ]);
  const info = statRes ? lines(statRes.stdout.trim()) : [];
  const exists = !!st.selected && info.length > 0;
  const sel = exists ? (st.selected as string) : HOME;
  const marks = new Set(live);
  return {
    home: HOME,
    sel,
    isDir: !exists || info[0] === "d",
    size: Number(info[1] ?? NaN),
    kind: info[2] ?? "file",
    marks,
    confirming: marks.size > 0 && isConfirming(st),
    showHidden: st.hidden,
    clip: st.clip && st.clip.paths.length ? { mode: st.clip.mode, count: st.clip.paths.length } : null,
  };
}

export async function readFinderStatus(ctx: Exec): Promise<FinderStatus> {
  const s = await loadFinderState(ctx);
  return {
    home: s.home, selected: s.sel, isDir: s.isDir,
    marked: [...s.marks], confirming: s.confirming, showHidden: s.showHidden,
  };
}

/** data: URL for a picture (thumbnail via sips, or the SVG itself), else null. */
export async function loadImageSrc(ctx: Exec, path: string, size: number): Promise<string | null> {
  const ext = extOf(path);
  let cmd: string;
  let mime: string;
  if (ext === "svg") {
    if (!(size < SVG_MAX_BYTES)) return null;
    cmd = `base64 -i ${shq(path)} | tr -d '\\n'; exit 0`;
    mime = "image/svg+xml";
  } else if (IMAGE_EXTS.has(ext)) {
    cmd = thumbScript(path);
    mime = "image/jpeg";
  } else {
    return null;
  }
  try {
    const res = await ctx.exec(cmd);
    const b64 = res.stdout.trim();
    return b64 ? `data:${mime};base64,${b64}` : null;
  } catch {
    return null;
  }
}

/** The folder shown in the path bar: parent of the selection (same rule as render). */
export async function currentFolder(ctx: Exec): Promise<string> {
  const st = await readFinderStatus(ctx);
  const base = st.selected === st.home || st.selected.startsWith(st.home + "/") ? st.home : "/";
  return st.selected === base ? base : parentOf(st.selected);
}
