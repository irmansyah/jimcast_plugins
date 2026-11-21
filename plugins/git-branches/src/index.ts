// [plugin] jim-git-branches/src/index.ts
//
// Git repos + branches. A tab per tracked repo (dirty / clean, ahead / behind),
// and the branch list of the active repo below it.
//
//   tabs     -> `rows`: ✓ clean or ●n changed, repo name, ↑ahead ↓behind
//   info     -> current branch, path, changes
//   branches -> `list` (scrolls in a fixed box), newest commit first.
//               Enter / click = checkout (a remote-only branch gets a tracking
//               branch automatically)
//   controls -> FETCH / PULL / VIEW (local | remote) / PRUNE merged / refresh
//   footer   -> last result (✓ / ✕) + key hints; while a delete is pending it
//               shows Confirm / Cancel buttons instead
//
// Stateless: state lives in ~/.jimcast/plugin-data/<plugin id>/{repos,repo,remote,msg,confirm}
//   repos   = tracked repo paths, one per line
//   repo    = the active repo        remote = flag file: list remote branches
//   msg     = last action result (line 1 = exit code, rest = output)
//   confirm = pending delete: timestamp, kind, repo, branch (30 s to confirm)
// Every action goes through gitCmd(): it runs in the repo, captures the output
// into `msg` (so a failed checkout on a dirty tree shows up in the footer) and
// never throws.
//
// Branch deletes are SAFE by default (`git branch -d`, refuses unmerged work);
// force (-D) is a separate key and a separate confirmation.
//
// Keys (remap in ~/.jimcast/keybinding.json under "widgets" -> "<plugin id>"):
//   fetch f · pull p · toggle_remote r · delete d · force_delete shift+d ·
//   prune m · confirm_delete shift+y · cancel_delete n · next_repo ] · prev_repo [
//
// CLI: `jimcast widget command git <status|repos|add|remove|scan|use|branches|
//      checkout|fetch|pull|delete|prune>`   (with the "git" alias from config.json)

import {
  createWidget,
  definePlugin,
  pluginDataDir,
  pluginId,
  type ExecutionContext,
  type WidgetCliCommand,
  type WidgetCliContext,
  type WidgetContent,
  type WidgetGroupSection,
  type WidgetItem,
  type WidgetKeyAction,
  type WidgetKeyContext,
} from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime"; // Node only

// ── Shared basics ───────────────────────────────────────────────────────────
type Exec = Pick<ExecutionContext, "exec">;
type Action = NonNullable<WidgetItem["action"]>;

// Item-id prefix and the `owns` of the cli/keys specs (not a core prefix while
// the built-in widget still exists: core uses "gb:" / "gb-").
const OWNS = "extgb";

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const act = (ctx: Exec, cmd: string, then: "refresh" | "dismiss" = "refresh"): Action => ({
  run: async () => {
    await ctx.exec(cmd);
  },
  then,
});

// Local stand-ins for theme.font.* from the core design system.
const FONT = { xs: 11, sm: 12 };

// ── Layout ──────────────────────────────────────────────────────────────────
const MAX_TABS = 5;
const TAB_NAME_MAX = 14;
const ROW_PX = 26;
const BRANCH_HEIGHT = ROW_PX * 10 + 8;
const FOOTER_H = ROW_PX + 24; // fixed, so the window height never changes
const NAME_MAX = 46;
const LINE_MAX = 80;
const CONFIRM_TTL_SECS = 30;
// Folders `scan` looks in (only those that exist; depth 3).
const SCAN_ROOTS = ["Developer", "dev", "code", "projects", "src", "work", "repos", "works"];
const PROTECTED = ["main", "master", "develop", "dev"];

// ── Storage ─────────────────────────────────────────────────────────────────
// ~/.jimcast/plugin-data/<plugin id> (pluginDataDir() reads the env core sets at
// spawn; it throws if the module is loaded outside core).
const DIR = pluginDataDir();
const REPOS_FILE = `"${DIR}/repos"`;
const REPO_FILE = `"${DIR}/repo"`;
const REMOTE_FILE = `"${DIR}/remote"`;
const MSG_FILE = `"${DIR}/msg"`;
const CONFIRM_FILE = `"${DIR}/confirm"`;
const PRE = `mkdir -p "${DIR}"`;
const ENV = `export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"`;

// Default branch of the repo in $PWD -> $base (origin/HEAD, else main/master/develop).
const BASE_SH = `
base=$(git symbolic-ref --short -q refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
if [ -z "$base" ]; then
  for x in main master develop; do
    if git show-ref --verify --quiet "refs/heads/$x"; then base=$x; break; fi
  done
fi
`;

// Runs `body` inside the repo r (branch b when given) and records the outcome in
// the msg file. Clears any pending confirmation.
const gitCmd = (r: string, body: string, b?: string) => `${ENV}; ${PRE}
r=${shq(r)}${b !== undefined ? `; b=${shq(b)}` : ""}
cd "$r" || exit 0
out=$( ( ${body} ) 2>&1 ); rc=$?
printf '%s\\n' "$rc" > ${MSG_FILE}
printf '%s\\n' "$out" | tail -3 >> ${MSG_FILE}
rm -f ${CONFIRM_FILE}
`;

const fetchCmd = (r: string) => gitCmd(r, "git fetch --all --prune");
const pullCmd = (r: string) => gitCmd(r, "git pull --ff-only");
const checkoutCmd = (r: string, b: string) => gitCmd(r, 'git checkout "$b"', b);

const setRepoCmd = (r: string) =>
  `${PRE}; printf %s ${shq(r)} > ${REPO_FILE}; rm -f ${MSG_FILE} ${CONFIRM_FILE}`;
const TOGGLE_REMOTE_CMD = `${PRE}; f=${REMOTE_FILE}; if [ -e "$f" ]; then rm -f "$f"; else : > "$f"; fi`;

// Two-step delete: ASK only records what is about to happen. CONFIRMED re-reads
// it, refuses if older than CONFIRM_TTL_SECS, and consumes it (one use).
type DeleteKind = "delete" | "force" | "merged";
const askCmd = (kind: DeleteKind, r: string, b: string) =>
  `${PRE}; printf '%s\\n%s\\n%s\\n%s\\n' "$(date +%s)" ${kind} ${shq(r)} ${shq(b)} > ${CONFIRM_FILE}`;
const CANCEL_CMD = `rm -f ${CONFIRM_FILE}`;

const CONFIRMED_CMD = `${ENV}; ${PRE}
c=${CONFIRM_FILE}
[ -s "$c" ] || exit 0
ts=$(sed -n 1p "$c"); kind=$(sed -n 2p "$c"); r=$(sed -n 3p "$c"); b=$(sed -n 4p "$c"); rm -f "$c"
[ $(( $(date +%s) - ts )) -le ${CONFIRM_TTL_SECS} ] || exit 0
cd "$r" || exit 0
${BASE_SH}
cur=$(git symbolic-ref --short -q HEAD)
case "$kind" in
  delete) out=$(git branch -d -- "$b" 2>&1); rc=$?;;
  force)  out=$(git branch -D -- "$b" 2>&1); rc=$?;;
  merged)
    [ -n "$base" ] || exit 0
    out=$(git branch --merged "$base" --format='%(refname:short)' | grep -vxF -e "$cur" -e "$base" ${PROTECTED.map((p) => `-e ${p}`).join(" ")} | xargs -n1 git branch -d 2>&1); rc=$?;;
  *) exit 0;;
esac
printf '%s\\n' "$rc" > ${MSG_FILE}
printf '%s\\n' "$out" | tail -3 >> ${MSG_FILE}
`;

// Tracking: add p; remove p; scan the usual folders.
const addCmd = (p: string) =>
  `${PRE}; f=${REPOS_FILE}; touch "$f"; grep -Fxq -- ${shq(p)} "$f" || printf '%s\\n' ${shq(p)} >> "$f"`;
const removeCmd = (p: string) => `
f=${REPOS_FILE}
[ -s "$f" ] || exit 0
grep -Fxv -- ${shq(p)} "$f" > "$f.tmp"; mv "$f.tmp" "$f"
r=$(cat ${REPO_FILE} 2>/dev/null); [ "$r" = ${shq(p)} ] && rm -f ${REPO_FILE}
`;
const SCAN_CMD = `${PRE}; f=${REPOS_FILE}; touch "$f"
for x in ${SCAN_ROOTS.map((r) => `"$HOME/${r}"`).join(" ")}; do
  [ -d "$x" ] && find "$x" -maxdepth 3 -name node_modules -prune -o -name .git -print -prune 2>/dev/null
done | sed 's#/\\.git$##' >> "$f"
awk '!s[$0]++' "$f" > "$f.tmp"; mv "$f.tmp" "$f"
`;

// ── Reading state ───────────────────────────────────────────────────────────
const READ_STATE = `
d="${DIR}"; mkdir -p "$d"
echo "repo=$(cat "$d/repo" 2>/dev/null)"
[ -e "$d/remote" ] && echo "remote=1"
if [ -f "$d/repos" ]; then
  while IFS= read -r l; do
    [ -n "$l" ] && ( [ -d "$l/.git" ] || [ -f "$l/.git" ] ) && echo "repos=$l"
  done < "$d/repos"
fi
if [ -s "$d/msg" ]; then echo "rc=$(sed -n 1p "$d/msg")"; sed -n '2,$p' "$d/msg" | sed 's/^/msg=/'; fi
c="$d/confirm"
if [ -s "$c" ]; then
  t=$(sed -n 1p "$c")
  if [ $(( $(date +%s) - t )) -le ${CONFIRM_TTL_SECS} ]; then
    echo "confirm=$(sed -n 2p "$c")|$(sed -n 3p "$c")|$(sed -n 4p "$c")"
  fi
fi
`;

interface GitState {
  repo: string | null;
  remote: boolean;
  repos: string[];
  msg: { ok: boolean; text: string } | null;
  confirm: { kind: DeleteKind; repo: string; branch: string } | null;
}

async function readState(ctx: Exec): Promise<GitState> {
  const res = await ctx.exec(READ_STATE);
  const st: GitState = { repo: null, remote: false, repos: [], msg: null, confirm: null };
  let rc: string | null = null;
  const msgLines: string[] = [];
  for (const line of res.stdout.trim().split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i),
      v = line.slice(i + 1);
    if (k === "repo" && v.trim()) st.repo = v.trim();
    else if (k === "remote") st.remote = true;
    else if (k === "repos" && v.trim()) st.repos.push(v.trim());
    else if (k === "rc") rc = v.trim();
    else if (k === "msg" && v.trim()) msgLines.push(v.trim());
    else if (k === "confirm") {
      const [kind, repo, ...rest] = v.split("|");
      if (kind === "delete" || kind === "force" || kind === "merged") {
        st.confirm = { kind, repo, branch: rest.join("|") };
      }
    }
  }
  if (rc !== null) st.msg = { ok: rc === "0", text: msgLines.join(" · ") };
  return st;
}

const resolveRepo = (st: GitState): string | null =>
  st.repo && st.repos.includes(st.repo) ? st.repo : (st.repos[0] ?? null);

interface Track {
  ahead: number;
  behind: number;
  gone: boolean;
}

function parseTrack(t: string): Track {
  return {
    ahead: Number(/ahead (\d+)/.exec(t)?.[1] ?? 0),
    behind: Number(/behind (\d+)/.exec(t)?.[1] ?? 0),
    gone: t.includes("gone"),
  };
}

const trackText = (t: Track) =>
  t.gone
    ? "gone"
    : [t.ahead ? `↑${t.ahead}` : "", t.behind ? `↓${t.behind}` : ""].filter(Boolean).join(" ");

interface TabInfo {
  path: string;
  name: string;
  cur: string;
  dirty: number;
  track: Track;
}

const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1) || path;
const tilde = (path: string, home: string) =>
  home && (path === home || path.startsWith(home + "/")) ? "~" + path.slice(home.length) : path;
const short = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

const tabScript = (path: string) => `${ENV}
cd ${shq(path)} 2>/dev/null || exit 0
br=$(git symbolic-ref --short -q HEAD || git rev-parse --short HEAD 2>/dev/null)
echo "cur=$br"
echo "dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
echo "track=$(git for-each-ref --format='%(upstream:track)' "refs/heads/$br" 2>/dev/null)"
`;

async function readTab(ctx: Exec, path: string): Promise<TabInfo> {
  const res = await ctx.exec(tabScript(path));
  const t: TabInfo = {
    path,
    name: nameOf(path),
    cur: "?",
    dirty: 0,
    track: { ahead: 0, behind: 0, gone: false },
  };
  for (const line of res.stdout.trim().split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i),
      v = line.slice(i + 1);
    if (k === "cur") t.cur = v.trim() || "?";
    else if (k === "dirty") t.dirty = Number(v) || 0;
    else if (k === "track") t.track = parseTrack(v);
  }
  return t;
}

interface Branch {
  name: string;
  remote: string | null;
  track: Track;
  when: string;
  author: string;
  subject: string;
  current: boolean;
  merged: boolean;
}
interface RepoDetail {
  cur: string;
  dirty: number;
  base: string;
  branches: Branch[];
  prunable: number;
}

const repoScript = (path: string) => `${ENV}
cd ${shq(path)} 2>/dev/null || exit 0
echo "cur=$(git symbolic-ref --short -q HEAD || git rev-parse --short HEAD 2>/dev/null)"
echo "dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
${BASE_SH}
echo "base=$base"
if [ -n "$base" ]; then git branch --merged "$base" --format='%(refname:short)' 2>/dev/null | sed 's/^/merged=/'; fi
git for-each-ref --sort=-committerdate --format='b=%(refname)|%(upstream:track)|%(committerdate:relative)|%(authorname)|%(contents:subject)' refs/heads refs/remotes 2>/dev/null
`;

async function readRepo(ctx: Exec, path: string): Promise<RepoDetail> {
  const res = await ctx.exec(repoScript(path));
  const d: RepoDetail = { cur: "?", dirty: 0, base: "", branches: [], prunable: 0 };
  const merged = new Set<string>();
  const raw: { ref: string; track: string; when: string; author: string; subject: string }[] = [];

  for (const line of res.stdout.trim().split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i),
      v = line.slice(i + 1);
    if (k === "cur") d.cur = v.trim() || "?";
    else if (k === "dirty") d.dirty = Number(v) || 0;
    else if (k === "base") d.base = v.trim();
    else if (k === "merged" && v.trim()) merged.add(v.trim());
    else if (k === "b") {
      const [ref, track = "", when = "", author = "", ...subject] = v.split("|");
      raw.push({ ref, track, when, author, subject: subject.join("|") });
    }
  }

  const locals = new Set(
    raw.filter((r) => r.ref.startsWith("refs/heads/")).map((r) => r.ref.slice("refs/heads/".length)),
  );
  for (const r of raw) {
    let name: string,
      remote: string | null = null;
    if (r.ref.startsWith("refs/heads/")) name = r.ref.slice("refs/heads/".length);
    else if (r.ref.startsWith("refs/remotes/") && !r.ref.endsWith("/HEAD")) {
      const rest = r.ref.slice("refs/remotes/".length);
      remote = rest.slice(0, rest.indexOf("/"));
      name = rest.slice(rest.indexOf("/") + 1);
      if (locals.has(name)) continue; // already listed as a local branch
    } else continue;
    d.branches.push({
      name,
      remote,
      track: parseTrack(r.track),
      when: r.when,
      author: r.author,
      subject: r.subject,
      current: remote === null && name === d.cur,
      merged: remote === null && merged.has(name),
    });
  }
  d.prunable = d.branches.filter(
    (b) => b.merged && !b.current && b.name !== d.base && !PROTECTED.includes(b.name),
  ).length;
  return d;
}

// ── Palette ─────────────────────────────────────────────────────────────────
function palette(ctx: ExecutionContext) {
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  return {
    bg: g("bg", "#1e2127"),
    bg2: g("bg2", "#282c34"),
    bg3: g("bg3", "#3e4451"),
    fg: g("fg", "#abb2bf"),
    fg4: g("fg4", "#7f848e"),
    yellow: g("yellow", "#e5c07b"),
    brightGreen: g("brightGreen", "#98c379"),
    brightRed: g("brightRed", "#ff6b6b"),
    blue: g("blue", "#61afef"),
    purple: g("purple", "#c678dd"),
  };
}
type Palette = ReturnType<typeof palette>;

// ── Sections ────────────────────────────────────────────────────────────────
const barStyle = (c: Palette) => ({ background: c.bg2, borderRadius: 8, padding: 4 });

function tabsSection(ctx: Exec, c: Palette, tabs: TabInfo[], active: string): WidgetGroupSection {
  const datas: WidgetItem[] = tabs.map((t) => {
    const arrows = trackText(t.track);
    return {
      id: `${OWNS}-tab:${t.path}`,
      pinned: true,
      attribute: {
        label1: t.dirty ? `●${t.dirty}` : "✓",
        color1: t.dirty ? c.yellow : c.brightGreen,
        label2: short(t.name, TAB_NAME_MAX),
        color2: t.path === active ? c.fg : c.fg4,
        label3: arrows || undefined,
        color3: t.track.gone ? c.brightRed : c.fg4,
      },
      style: t.path === active ? { background: c.bg3, borderRadius: 6 } : undefined,
      action: act(ctx, setRepoCmd(t.path)),
    };
  });
  return { id: "tabs", navigable: true, style: barStyle(c), content: { type: "rows", datas } };
}

function infoItem(
  c: Palette,
  path: string,
  d: RepoDetail,
  home: string,
  total: number,
  pos: number,
): WidgetItem {
  const cur = d.branches.find((b) => b.current);
  const bits = [d.dirty ? `●${d.dirty} changed` : "clean", cur ? trackText(cur.track) : ""]
    .filter(Boolean)
    .join(" · ");
  return {
    id: `${OWNS}-info`,
    pinned: true,
    attribute: {
      label1: `⎇ ${short(d.cur, NAME_MAX)}`,
      color1: c.yellow,
      textSize1: FONT.sm,
      label2: `${tilde(path, home)}${total > 1 ? `  (${pos}/${total})` : ""}`,
      color2: c.fg4,
      labelRight: bits,
      colorRight: d.dirty ? c.yellow : c.fg4,
      textSizeRight: FONT.xs,
    },
  };
}

function branchesSection(
  ctx: Exec,
  c: Palette,
  path: string,
  d: RepoDetail,
  remote: boolean,
  info: WidgetItem,
): WidgetGroupSection {
  const shown = d.branches.filter((b) => (b.remote !== null) === remote);

  const datas: WidgetItem[] = shown.map((b) => {
    const right = b.remote ? b.remote : b.merged && !b.current ? "merged" : trackText(b.track);
    return {
      id: `${OWNS}:${b.remote ? "r" : "l"}:${b.name}`,
      pinned: true,
      attribute: {
        label1: `${b.current ? "● " : ""}${short(b.name, NAME_MAX)}`,
        color1: b.current ? c.yellow : b.merged ? c.fg4 : c.fg,
        label2: short([b.when, b.author, b.subject].filter(Boolean).join(" · "), LINE_MAX),
        color2: c.fg4,
        labelRight: right || undefined,
        colorRight: b.track.gone ? c.brightRed : c.fg4,
      },
      action: b.current ? act(ctx, ":") : act(ctx, checkoutCmd(path, b.name)),
    };
  });
  if (!datas.length) {
    datas.push({
      id: `${OWNS}-none`,
      pinned: true,
      attribute: {
        label1: remote ? "No remote-only branches (press FETCH)." : "No branches.",
        color1: c.fg4,
      },
    });
  }

  return {
    id: "branches",
    navigable: true,
    height: BRANCH_HEIGHT,
    style: { background: c.bg, borderRadius: 8, padding: 4 },
    content: {
      type: "group",
      direction: "column",
      gap: 4,
      sections: [
        { id: "branch-info", navigable: false, content: { type: "list", datas: [info] } },
        { id: "branch-list", navigable: true, content: { type: "list", datas } },
      ],
    },
  };
}

function controlsSection(
  ctx: Exec,
  c: Palette,
  path: string | null,
  remote: boolean,
  prunable: number,
): WidgetGroupSection {
  const datas: WidgetItem[] = [];
  if (path) {
    datas.push(
      {
        id: `${OWNS}-fetch`,
        pinned: true,
        attribute: { label1: "FETCH", label2: "⟳ all", color1: c.fg4, color2: c.blue },
        action: act(ctx, fetchCmd(path)),
      },
      {
        id: `${OWNS}-pull`,
        pinned: true,
        attribute: { label1: "PULL", label2: "↓ ff-only", color1: c.fg4, color2: c.brightGreen },
        action: act(ctx, pullCmd(path)),
      },
      {
        id: `${OWNS}-view`,
        pinned: true,
        attribute: {
          label1: "VIEW",
          label2: remote ? "remote" : "local",
          color1: c.fg4,
          color2: remote ? c.purple : c.fg,
        },
        action: act(ctx, TOGGLE_REMOTE_CMD),
      },
      {
        id: `${OWNS}-prune`,
        pinned: true,
        attribute: {
          label1: "PRUNE",
          label2: `🧹 ${prunable} merged`,
          color1: c.fg4,
          color2: prunable ? c.brightRed : c.fg4,
        },
        action: prunable ? act(ctx, askCmd("merged", path, "")) : act(ctx, ":"),
      },
    );
  } else {
    datas.push({
      id: `${OWNS}-scan`,
      pinned: true,
      attribute: { label1: "REPOS", label2: "🔍 Scan", color1: c.fg4, color2: c.brightGreen },
      action: act(ctx, SCAN_CMD),
    });
  }
  datas.push({
    id: `${OWNS}-refresh`,
    pinned: true,
    attribute: { label1: "STATUS", label2: "⟳", color1: c.fg4, color2: c.fg },
    action: act(ctx, ":"),
  });

  return { id: "controls", navigable: true, style: barStyle(c), content: { type: "rows", datas } };
}

const keyHints = (labels: Record<string, string>, items: [string, string][]) =>
  items
    .filter(([id]) => labels[id])
    .map(([id, text]) => `${labels[id]} ${text}`)
    .join(" · ");

const CONFIRM_TEXT: Record<DeleteKind, (b: string) => string> = {
  delete: (b) => `Delete ${short(b, 28)}`,
  force: (b) => `FORCE delete ${short(b, 22)}`,
  merged: () => "Delete merged branches",
};

/// One fixed-height row: last result + key hints, or Confirm / Cancel while a
/// delete is pending (Cancel is last, so a clamped cursor can never land on Confirm).
function footerSection(
  ctx: Exec,
  c: Palette,
  st: GitState,
  labels: Record<string, string>,
): WidgetGroupSection {
  const style = barStyle(c);
  const withKey = (text: string, id: string) => (labels[id] ? `${text} (${labels[id]})` : text);

  if (st.confirm) {
    const datas: WidgetItem[] = [
      {
        id: `${OWNS}-act:confirm`,
        pinned: true,
        attribute: {
          label1: withKey(CONFIRM_TEXT[st.confirm.kind](st.confirm.branch), "confirm_delete"),
          color1: c.brightRed,
        },
        action: act(ctx, CONFIRMED_CMD),
      },
      {
        id: `${OWNS}-act:cancel`,
        pinned: true,
        attribute: { label1: withKey("Cancel", "cancel_delete"), color1: c.blue },
        action: act(ctx, CANCEL_CMD),
      },
    ];
    return {
      id: "footer",
      height: FOOTER_H,
      scrollable: false,
      navigable: true,
      style,
      content: { type: "grid-3", datas },
    };
  }

  const hint = keyHints(labels, [
    ["fetch", "fetch"],
    ["pull", "pull"],
    ["delete", "delete"],
    ["prune", "prune"],
    ["toggle_remote", "remote"],
  ]);
  return {
    id: "footer",
    height: FOOTER_H,
    scrollable: false,
    navigable: false,
    style,
    content: {
      type: "list",
      datas: [
        {
          id: `${OWNS}-status`,
          pinned: true,
          attribute: {
            label1: st.msg
              ? `${st.msg.ok ? "✓" : "✕"} ${short(st.msg.text || "done", 70)}`
              : "Enter: checkout",
            color1: st.msg ? (st.msg.ok ? c.brightGreen : c.brightRed) : c.fg4,
            textSize1: FONT.sm,
            labelRight: hint || undefined,
            colorRight: c.fg4,
            textSizeRight: FONT.xs,
          },
        },
      ],
    },
  };
}

// ── Render ──────────────────────────────────────────────────────────────────
async function render(ctx: ExecutionContext): Promise<WidgetContent> {
  const c = palette(ctx);
  const [st, labels, homeRes] = await Promise.all([
    readState(ctx),
    ctx.keyLabels(pluginId()) as Promise<Record<string, string>>,
    ctx.exec('echo "$HOME"'),
  ]);
  const home = homeRes.stdout.trim();
  const active = resolveRepo(st);

  if (!active) {
    return {
      type: "group",
      direction: "column",
      gap: 6,
      sections: [
        {
          id: "empty",
          navigable: false,
          content: {
            type: "text",
            data: {
              id: `${OWNS}-empty`,
              attribute: {
                label1:
                  "No repos tracked. Press Scan, or run `jimcast widget command git add <path>`.",
                color1: c.fg4,
              },
            },
          },
        },
        controlsSection(ctx, c, null, false, 0),
      ],
    };
  }

  // Tab window follows the active repo.
  const idx = st.repos.indexOf(active);
  const start = Math.max(0, Math.min(idx - Math.floor(MAX_TABS / 2), st.repos.length - MAX_TABS));
  const visible = st.repos.slice(start, start + MAX_TABS);

  const [tabs, detail] = await Promise.all([
    Promise.all(visible.map((p) => readTab(ctx, p))),
    readRepo(ctx, active),
  ]);
  const info = infoItem(c, active, detail, home, st.repos.length, idx + 1);

  return {
    type: "group",
    direction: "column",
    gap: 6,
    sections: [
      tabsSection(ctx, c, tabs, active),
      branchesSection(ctx, c, active, detail, st.remote, info),
      controlsSection(ctx, c, active, st.remote, detail.prunable),
      footerSection(ctx, c, st, labels),
    ],
  };
}

// ═══ CLI: `jimcast widget command git <command> [args...]` ══════════════════
const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));
const hasFlag = (ctx: WidgetCliContext, f: string) => ctx.args.includes(f);

// A synthetic item that runs `cmd` through the normal dispatch path.
const gitItem = (ctx: Exec, id: string, cmd: string): WidgetItem => ({
  id: `${OWNS}-cli:${id}`,
  action: act(ctx, cmd),
});

async function needRepo(ctx: Exec): Promise<{ st: GitState; repo: string }> {
  const st = await readState(ctx);
  const repo = resolveRepo(st);
  if (!repo)
    throw new Error(
      "no repos tracked: run `jimcast widget command git add <path>` or `... git scan`",
    );
  return { st, repo };
}

async function lastMessage(ctx: Exec): Promise<string> {
  const { msg } = await readState(ctx);
  if (!msg) return "done";
  if (!msg.ok) throw new Error(msg.text || "failed");
  return msg.text || "done";
}

function matchRepo(st: GitState, q: string): string {
  const n = Number(q);
  const hit =
    (Number.isInteger(n) ? st.repos[n - 1] : undefined) ??
    st.repos.find((r) => r === q) ??
    st.repos.find((r) => nameOf(r) === q) ??
    st.repos.find((r) => nameOf(r).startsWith(q));
  if (!hit) throw new Error(`no such repo: ${q} (see \`jimcast widget command git repos\`)`);
  return hit;
}

const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "status",
    title: "Active repo, its branch and changes",
    description: "--json for machine-readable output",
    async run(ctx) {
      const { st, repo } = await needRepo(ctx);
      const d = await readRepo(ctx, repo);
      const cur = d.branches.find((b) => b.current);
      const out = {
        repo,
        branch: d.cur,
        dirty: d.dirty,
        ahead: cur?.track.ahead ?? 0,
        behind: cur?.track.behind ?? 0,
        prunable: d.prunable,
        view: st.remote ? "remote" : "local",
      };
      if (hasFlag(ctx, "--json")) return out;
      return [
        `repo     ${repo}`,
        `branch   ${d.cur}`,
        `changes  ${d.dirty}`,
        `sync     ${trackText(cur?.track ?? { ahead: 0, behind: 0, gone: false }) || "in sync"}`,
        `merged   ${d.prunable} can be pruned`,
      ].join("\n");
    },
  },
  {
    id: "repos",
    title: "List tracked repos (the tabs)",
    async run(ctx) {
      const st = await readState(ctx);
      if (!st.repos.length) return "(none)";
      const active = resolveRepo(st);
      return st.repos.map((r, i) => `${r === active ? "*" : " "} ${i + 1}\t${r}`).join("\n");
    },
  },
  {
    id: "add",
    args: ["[path]"],
    title: "Track a repo (default: the repo containing the current directory)",
    async run(ctx) {
      const given = positional(ctx)[0];
      const dir = given
        ? given.startsWith("/")
          ? given
          : `${ctx.cwd ?? "/"}/${given}`
        : (ctx.cwd ?? "/");
      const res = await ctx.exec(`${ENV}; git -C ${shq(dir)} rev-parse --show-toplevel`);
      const top = res.stdout.trim();
      if (res.exitCode !== 0 || !top) throw new Error(`not a git repo: ${dir}`);
      await ctx.dispatch(gitItem(ctx, "add", addCmd(top)));
      return `Tracking ${top}`;
    },
  },
  {
    id: "remove",
    args: ["[name|number|path]"],
    title: "Stop tracking a repo (default: the active one)",
    async run(ctx) {
      const { st, repo } = await needRepo(ctx);
      const q = positional(ctx)[0];
      const target = q ? matchRepo(st, q) : repo;
      await ctx.dispatch(gitItem(ctx, "remove", removeCmd(target)));
      return `Removed ${target}`;
    },
  },
  {
    id: "scan",
    title: `Find repos under ${SCAN_ROOTS.map((r) => `~/${r}`).join(", ")} (depth 3) and track them`,
    async run(ctx) {
      await ctx.dispatch(gitItem(ctx, "scan", SCAN_CMD));
      return `${(await readState(ctx)).repos.length} repos tracked`;
    },
  },
  {
    id: "use",
    args: ["name|number"],
    title: "Switch the active repo",
    async run(ctx) {
      const { st } = await needRepo(ctx);
      const q = positional(ctx)[0];
      if (!q) throw new Error("use needs a repo name or number");
      const target = matchRepo(st, q);
      await ctx.dispatch(gitItem(ctx, "use", setRepoCmd(target)));
      return `Showing ${target}`;
    },
  },
  {
    id: "branches",
    args: ["[--remote]"],
    title: "List branches of the active repo",
    async run(ctx) {
      const { repo } = await needRepo(ctx);
      const remote = hasFlag(ctx, "--remote");
      const d = await readRepo(ctx, repo);
      const rows = d.branches.filter((b) => (b.remote !== null) === remote);
      return rows.length
        ? rows
            .map(
              (b) =>
                `${b.current ? "*" : " "} ${b.name}\t${trackText(b.track)}${b.merged && !b.current ? " merged" : ""}\t${b.when}`,
            )
            .join("\n")
        : "(none)";
    },
  },
  {
    id: "checkout",
    args: ["branch"],
    title: "Check out a branch in the active repo",
    async run(ctx) {
      const { repo } = await needRepo(ctx);
      const b = positional(ctx)[0];
      if (!b) throw new Error("checkout needs a branch name");
      await ctx.dispatch(gitItem(ctx, "checkout", checkoutCmd(repo, b)));
      return lastMessage(ctx);
    },
  },
  {
    id: "fetch",
    title: "git fetch --all --prune",
    async run(ctx) {
      const { repo } = await needRepo(ctx);
      await ctx.dispatch(gitItem(ctx, "fetch", fetchCmd(repo)));
      return lastMessage(ctx);
    },
  },
  {
    id: "pull",
    title: "git pull --ff-only",
    async run(ctx) {
      const { repo } = await needRepo(ctx);
      await ctx.dispatch(gitItem(ctx, "pull", pullCmd(repo)));
      return lastMessage(ctx);
    },
  },
  {
    id: "delete",
    args: ["branch", "[--force]", "[--yes|--cancel]"],
    title: "Delete a local branch (safe -d unless --force)",
    description:
      "Without --yes it only asks (the footer shows Confirm / Cancel). --yes asks and confirms.",
    async run(ctx) {
      if (hasFlag(ctx, "--cancel")) {
        await ctx.dispatch(gitItem(ctx, "delete-cancel", CANCEL_CMD));
        return "Delete cancelled.";
      }
      const { repo } = await needRepo(ctx);
      const b = positional(ctx)[0];
      if (!b) throw new Error("delete needs a branch name");
      const kind: DeleteKind = hasFlag(ctx, "--force") ? "force" : "delete";
      if (!hasFlag(ctx, "--yes")) {
        await ctx.dispatch(gitItem(ctx, "delete-ask", askCmd(kind, repo, b)));
        return `Delete ${b}${kind === "force" ? " (FORCE)" : ""}? Re-run with --yes to confirm, or --cancel.`;
      }
      await ctx.dispatch(
        gitItem(ctx, "delete", `${askCmd(kind, repo, b)}\n${CONFIRMED_CMD}`),
      );
      return lastMessage(ctx);
    },
  },
  {
    id: "prune",
    args: ["[--yes|--cancel]"],
    title: "Delete local branches already merged into the default branch",
    description: `Never touches the current branch, the default branch, or ${PROTECTED.join("/")}.`,
    async run(ctx) {
      if (hasFlag(ctx, "--cancel")) {
        await ctx.dispatch(gitItem(ctx, "prune-cancel", CANCEL_CMD));
        return "Prune cancelled.";
      }
      const { repo } = await needRepo(ctx);
      if (!hasFlag(ctx, "--yes")) {
        const d = await readRepo(ctx, repo);
        await ctx.dispatch(gitItem(ctx, "prune-ask", askCmd("merged", repo, "")));
        return `Delete ${d.prunable} merged branch(es)? Re-run with --yes to confirm, or --cancel.`;
      }
      await ctx.dispatch(
        gitItem(ctx, "prune", `${askCmd("merged", repo, "")}\n${CONFIRMED_CMD}`),
      );
      return lastMessage(ctx);
    },
  },
];

// ═══ Keys ═══════════════════════════════════════════════════════════════════
// Every action goes through ctx.dispatch, so the widget re-renders exactly as
// for a click.
const branchOf = (id?: string | null) => {
  const prefix = `${OWNS}:l:`;
  return id && id.startsWith(prefix) ? id.slice(prefix.length) : null;
};

const keepFocus = (ctx: WidgetKeyContext) =>
  ctx.focusedItemId ? { focus: { id: ctx.focusedItemId } } : undefined;

async function activeRepo(ctx: Exec): Promise<{ st: GitState; repo: string } | null> {
  const st = await readState(ctx);
  const repo = resolveRepo(st);
  return repo ? { st, repo } : null;
}

async function cycleRepo(ctx: WidgetKeyContext, step: 1 | -1) {
  const a = await activeRepo(ctx);
  if (!a || a.st.repos.length < 2) return;
  const n = a.st.repos.length;
  const next = a.st.repos[(a.st.repos.indexOf(a.repo) + step + n) % n];
  await ctx.dispatch(gitItem(ctx, "cycle", setRepoCmd(next)));
}

const askDelete =
  (kind: DeleteKind): WidgetKeyAction["run"] =>
  async (ctx) => {
    const a = await activeRepo(ctx);
    if (!a) return;
    const b = kind === "merged" ? "" : branchOf(ctx.focusedItemId);
    if (b === null) return; // not on a local branch row
    await ctx.dispatch(gitItem(ctx, "ask", askCmd(kind, a.repo, b)), keepFocus(ctx));
  };

const KEY_ACTIONS: WidgetKeyAction[] = [
  {
    id: "fetch",
    title: "Fetch all remotes (prune)",
    default: "f",
    async run(ctx) {
      const a = await activeRepo(ctx);
      if (!a) return;
      await ctx.dispatch(gitItem(ctx, "fetch", fetchCmd(a.repo)), keepFocus(ctx));
    },
  },
  {
    id: "pull",
    title: "Pull (fast-forward only)",
    default: "p",
    async run(ctx) {
      const a = await activeRepo(ctx);
      if (!a) return;
      await ctx.dispatch(gitItem(ctx, "pull", pullCmd(a.repo)), keepFocus(ctx));
    },
  },
  {
    id: "toggle_remote",
    title: "Show local / remote branches",
    default: "r",
    run: (ctx) => ctx.dispatch(gitItem(ctx, "view", TOGGLE_REMOTE_CMD)),
  },
  {
    id: "delete",
    title: "Delete the branch under the cursor (asks first)",
    default: "d",
    run: askDelete("delete"),
  },
  {
    id: "force_delete",
    title: "FORCE delete the branch under the cursor (asks first)",
    default: "shift+d",
    run: askDelete("force"),
  },
  {
    id: "prune",
    title: "Delete branches already merged (asks first)",
    default: "m",
    run: askDelete("merged"),
  },
  {
    id: "confirm_delete",
    title: "Confirm the pending delete",
    default: "shift+y",
    async run(ctx) {
      if (!(await readState(ctx)).confirm) return;
      await ctx.dispatch(gitItem(ctx, "confirm", CONFIRMED_CMD));
    },
  },
  {
    id: "cancel_delete",
    title: "Cancel the pending delete",
    default: "n",
    async run(ctx) {
      if (!(await readState(ctx)).confirm) return;
      await ctx.dispatch(gitItem(ctx, "cancel", CANCEL_CMD));
    },
  },
  { id: "next_repo", title: "Next repo", default: "]", run: (ctx) => cycleRepo(ctx, 1) },
  { id: "prev_repo", title: "Previous repo", default: "[", run: (ctx) => cycleRepo(ctx, -1) },
];

// ═══ Plugin ═════════════════════════════════════════════════════════════════
// Main widget: no id (its full id is the plugin id from package.json).
export const widget = createWidget({
  section: {
    title: "Git",
    titleShow: true,
    navigationActive: true,
    querySearchActive: false,
  },
  showIn: ["default"],
  cli: { owns: OWNS, commands: CLI_COMMANDS },
  keys: { owns: OWNS, actions: KEY_ACTIONS },
  render: (ctx) => render(ctx),
});

export const plugin = definePlugin({
  description: "Git repos as tabs with a branch list: checkout, fetch, pull, safe delete and prune",
  widgets: [widget],
});
export default plugin;
bootstrapPlugin(plugin);
