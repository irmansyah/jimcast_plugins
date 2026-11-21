// [plugin] jim-jtop/src/index.ts  (single file)
//
// Activity Monitor-style process list for macOS, refreshed every 2 seconds.
//
//   [ CPU ] [ Memory ]                                                     tabs
//   Process Name                      % CPU    CPU Time     PID  User      header
//   ▸ Google Chrome                    12.3     3:04.12     412  alice     list (system nav)
//     WindowServer                      8.1    41:20.55     158  _windows
//     ...
//   Google Chrome (PID 412)                                                selected process
//   Parent 1 · User alice · Running 3-04:05 · CPU 12.3% · Memory 1.2 GB
//   [ ✕ Quit ] [ ⚠ Force Quit ] [ 🔍 Sample ]                              toolbar
//   System 10.5%   User 5.3%   Idle 84.2%                                  footer
//   CPU LOAD  ▓▓▓▓░░░░░░  16%
//   Threads 2012   Processes 412
//
// Interaction:
//   system nav / arrows   move over the rows
//   click or enter        select the process (again = deselect); detail + toolbar appear
//   keys                  q quit, f force quit, i sample, o open Activity Monitor, s switch tab
//                         (q / f / i act on the focused row, or on the selected process)
//   Quit and Force Quit always ask first (a macOS dialog), and only work on your own processes.
//
// The refresh must stay fast, so the 1 second CPU sample runs in the background and each
// render reads the last finished one (at most one refresh old).
//
// State (plugin data dir, created by the SDK):
//   net  -> "<epoch> <rx-bytes> <tx-bytes>"  previous network counters (for `status`)
//   sort -> "cpu" | "mem"                    the tab (no file = cpu)
//   sel  -> pid of the selected process
//   cpu  -> last "Processes: ..." and "CPU usage: ..." lines from top
//
// CLI: `jimcast widget command jtop <status|top|sort>`

import {
  createWidget,
  definePlugin,
  pluginDataFile,
  type ExecutionContext,
  type WidgetCliCommand,
  type WidgetCliContext,
  type WidgetContent,
  type WidgetItem,
  type WidgetKeyAction,
} from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime"; // Node only

// ════════════════════════════════════════════════════════════════════════════
// Shell: scripts and state files
// ════════════════════════════════════════════════════════════════════════════

type Exec = Pick<ExecutionContext, "exec">;
type SortMode = "cpu" | "mem";

const CPU_SAMPLE_SECS = 1; // `top -l 2 -s N`: the 2nd sample is the real one
const PROC_ROWS = 15;      // processes shown

const NET_FILE = `"${pluginDataFile("net")}"`;
const SORT_FILE = `"${pluginDataFile("sort")}"`;
const SEL_FILE = `"${pluginDataFile("sel")}"`;
const CPU_FILE = `"${pluginDataFile("cpu")}"`;

const CPU_CMD = `top -l 2 -n 0 -s ${CPU_SAMPLE_SECS} 2>/dev/null | grep -E "^(Processes|CPU usage)" | tail -2`;

/** The sampling script. widget = true (the render): CPU comes from the background sample and
 *  the network baseline moves. widget = false (CLI): CPU is sampled now (slow, accurate) and
 *  the network baseline is left alone. */
const buildSample = (widget: boolean) => `nf=${NET_FILE}; sf=${SORT_FILE}; lf=${SEL_FILE}; cf=${CPU_FILE}; now=$(date +%s)
${widget ? `( ${CPU_CMD} > "$cf.$$" && mv "$cf.$$" "$cf" ) >/dev/null 2>&1 </dev/null &` : ""}
echo "##cpu"; ${widget ? `cat "$cf" 2>/dev/null` : CPU_CMD}
echo "##ncpu"; sysctl -n hw.ncpu
echo "##load"; sysctl -n vm.loadavg
echo "##memtotal"; sysctl -n hw.memsize
echo "##vm"; vm_stat
echo "##disk"; { df -k /System/Volumes/Data 2>/dev/null || df -k /; } | tail -1
echo "##net"
set -- $(netstat -ib | awk 'NF>=10 && $1 ~ /^en[0-9]+$/ && $3 ~ /^<Link/ {i+=$7; o+=$10} END{print i+0, o+0}')
rx=$1; tx=$2
pt=0; prx=0; ptx=0
[ -s "$nf" ] && read pt prx ptx < "$nf"
echo "$now $rx $tx $pt $prx $ptx"
${widget ? `echo "$now $rx $tx" > "$nf"` : ""}
echo "##sort"; cat "$sf" 2>/dev/null
echo "##sel"
sp=$(cat "$lf" 2>/dev/null)
if [ -n "$sp" ]; then
  if ps -p "$sp" >/dev/null 2>&1; then
    echo "$sp"
    ps -p "$sp" -o ppid=,user=,etime=,%cpu=,%mem=,rss=
    ps -p "$sp" -o comm=
  else rm -f "$lf"; fi
fi
echo "##procs"
if [ "$(cat "$sf" 2>/dev/null)" = mem ]; then ps -Amco pid,user,%cpu,time,rss,%mem,comm; else ps -Arco pid,user,%cpu,time,rss,%mem,comm; fi | head -n ${PROC_ROWS + 1}
`;

/** Toggles the tab between cpu and mem. */
const SORT_CMD = `sf=${SORT_FILE}
if [ "$(cat "$sf" 2>/dev/null)" = mem ]; then echo cpu > "$sf"; else echo mem > "$sf"; fi
`;

const setTabCmd = (mode: SortMode) => `echo ${mode} > ${SORT_FILE}`;

/** Selects a process; selecting the selected one again deselects it. */
const selectCmd = (pid: number) => `lf=${SEL_FILE}
if [ "$(cat "$lf" 2>/dev/null)" = ${pid} ]; then rm -f "$lf"; else echo ${pid} > "$lf"; fi
`;

/** Sets $pid (the given one, or the selected one when null) and stops unless it is a number. */
const pidPrelude = (pid: number | null) => `pid=${pid === null ? `$(cat ${SEL_FILE} 2>/dev/null)` : pid}
case "$pid" in ''|*[!0-9]*) exit 0;; esac
`;

/** Quit / Force Quit after a macOS confirmation dialog. Runs in the background so the widget
 *  does not wait for the dialog (it gives up after 30 s, which counts as Cancel). */
const killCmd = (pid: number | null, force: boolean) => {
  const verb = force ? "Force Quit" : "Quit";
  const sig = force ? "KILL" : "TERM";
  return `${pidPrelude(pid)}n=$(ps -p "$pid" -o comm= 2>/dev/null | sed 's|.*/||' | tr -d '"\\\\')
[ -n "$n" ] || exit 0
( osascript -e "display dialog \\"${verb} $n ($pid)?\\" buttons {\\"Cancel\\", \\"${verb}\\"} default button \\"Cancel\\" with icon caution giving up after 30" 2>/dev/null | grep -q "button returned:${verb}" && kill -${sig} "$pid" ) >/dev/null 2>&1 </dev/null &
`;
};

/** `sample` the process for 3 seconds and open the report. */
const sampleCmd = (pid: number | null) => `${pidPrelude(pid)}f="/tmp/jtop-sample-$pid.txt"
( sample "$pid" 3 -file "$f" >/dev/null 2>&1; [ -s "$f" ] && open "$f" ) >/dev/null 2>&1 </dev/null &
`;

const OPEN_MONITOR_CMD = `open -a "Activity Monitor"`;

async function readSort(ctx: Exec): Promise<SortMode> {
  const res = await ctx.exec(`cat ${SORT_FILE} 2>/dev/null`);
  return res.stdout.trim() === "mem" ? "mem" : "cpu";
}

// ════════════════════════════════════════════════════════════════════════════
// Data: snapshot model and parser
// ════════════════════════════════════════════════════════════════════════════

interface Proc {
  pid: number;
  user: string;
  cpu: number;    // % of one core (ps)
  time: string;   // cumulative CPU time, e.g. "3:04.12"
  rssKB: number;
  mem: number;    // % of RAM
  name: string;
}

interface Selected {
  pid: number;
  ppid: string;
  user: string;
  etime: string;  // running time
  cpu: number;
  mem: number;
  rssKB: number;
  path: string;
}

interface Snapshot {
  procTotal: number;
  threads: number;
  cpu: number | null;                          // total CPU use, 0-100
  cpuUser: number | null;
  cpuSys: number | null;
  cores: number;
  memTotal: number;                            // bytes
  memUsed: number;                             // active + wired + compressor
  memWired: number;
  memCompressed: number;
  memFree: number;
  diskUsed: number;                            // bytes
  diskTotal: number;
  netDown: number | null;                      // bytes/s, null = no baseline yet
  netUp: number | null;
  procs: Proc[];
  selected: Selected | null;
  sort: SortMode;
}

function fmtBytes(n: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = Math.max(0, n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

const fmtRate = (n: number | null) => (n === null ? "--" : `${fmtBytes(n)}/s`);

function splitSections(raw: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let cur = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("##")) { cur = line.slice(2).trim(); out[cur] = []; }
    else if (cur) out[cur].push(line);
  }
  return out;
}

const num = (s: string | undefined) => {
  const n = Number((s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function parseSnapshot(raw: string): Snapshot {
  const s = splitSections(raw);
  const first = (k: string) => (s[k] ?? []).join("\n").trim();

  // top: "Processes: 412 total, 3 running, 409 sleeping, 2012 threads"
  //      "CPU usage: 5.26% user, 10.52% sys, 84.21% idle"
  const topText = first("cpu");
  const procTotal = Number(/Processes:\s+(\d+) total/.exec(topText)?.[1] ?? 0);
  const threads = Number(/(\d+) threads/.exec(topText)?.[1] ?? 0);
  const idle = /([\d.,]+)% idle/.exec(topText);
  const cpu = idle ? Math.min(100, Math.max(0, 100 - num(idle[1]))) : null;
  const us = /([\d.,]+)% user, ([\d.,]+)% sys/.exec(topText);
  const cpuUser = us ? num(us[1]) : null;
  const cpuSys = us ? num(us[2]) : null;

  const cores = Math.max(1, Math.round(num(first("ncpu"))));

  // memory (vm_stat: "Pages free:   12345.")
  const vm = (s["vm"] ?? []).join("\n");
  const pageSize = Number(/page size of (\d+) bytes/.exec(vm)?.[1] ?? 16384);
  const pages = (name: string) => {
    const m = new RegExp(`^${name}:\\s+(\\d+)`, "mi").exec(vm);
    return m ? Number(m[1]) : 0;
  };
  const memTotal = num(first("memtotal"));
  const memWired = pages("Pages wired down") * pageSize;
  const memCompressed = pages("Pages occupied by compressor") * pageSize;
  const memUsed = Math.min(memTotal, pages("Pages active") * pageSize + memWired + memCompressed);
  const memFree = pages("Pages free") * pageSize;

  // disk: "Filesystem 1024-blocks Used Available Capacity ..." (-k, last line)
  const d = first("disk").split(/\s+/);
  const diskUsed = num(d[2]) * 1024;
  const diskTotal = (num(d[2]) + num(d[3])) * 1024;

  // net: "<now> <rx> <tx> <prevTime> <prevRx> <prevTx>"
  const [t, rx, tx, pt, prx, ptx] = first("net").split(/\s+/).map(Number);
  let netDown: number | null = null;
  let netUp: number | null = null;
  if (pt > 0 && t > pt && rx >= prx && tx >= ptx) {
    netDown = (rx - prx) / (t - pt);
    netUp = (tx - ptx) / (t - pt);
  }

  // processes: "pid user %cpu time rss %mem comm..." (skip the ps header)
  const procs: Proc[] = (s["procs"] ?? [])
    .map((line) => line.trim().split(/\s+/))
    .filter((t2) => t2.length >= 7 && /^\d+$/.test(t2[0]))
    .map((t2) => ({
      pid: Number(t2[0]), user: t2[1], cpu: num(t2[2]), time: t2[3],
      rssKB: num(t2[4]), mem: num(t2[5]), name: t2.slice(6).join(" "),
    }));

  // selected process: pid / "ppid user etime %cpu %mem rss" / path
  const sl = (s["sel"] ?? []).map((x) => x.trim()).filter(Boolean);
  let selected: Selected | null = null;
  if (sl.length >= 3 && /^\d+$/.test(sl[0])) {
    const [ppid, user, etime, scpu, smem, rss] = sl[1].split(/\s+/);
    selected = { pid: Number(sl[0]), ppid, user, etime, cpu: num(scpu), mem: num(smem), rssKB: num(rss), path: sl[2] };
  }

  return {
    procTotal, threads,
    cpu, cpuUser, cpuSys, cores,
    memTotal, memUsed, memWired, memCompressed, memFree,
    diskUsed, diskTotal,
    netDown, netUp, procs, selected,
    sort: first("sort") === "mem" ? "mem" : "cpu",
  };
}

async function loadSnapshot(ctx: Exec, widget: boolean): Promise<Snapshot> {
  const res = await ctx.exec(buildSample(widget));
  return parseSnapshot(res.stdout);
}

// ════════════════════════════════════════════════════════════════════════════
// Render
// ════════════════════════════════════════════════════════════════════════════

// Every item id starts with OWNS: it is the `owns` of the widget's cli/keys specs.
// It must not start with a core prefix.
const OWNS = "extjtop";

type Action = NonNullable<WidgetItem["action"]>;
type GroupContent = Extract<WidgetContent, { type: "group" }>;
type Section = GroupContent["sections"][number];

const act = (ctx: Exec, cmd: string, then: "refresh" | "dismiss" = "refresh"): Action => ({
  run: async () => { await ctx.exec(cmd); },
  then,
});

/** A synthetic item, for ctx.dispatch (key actions): runs the script, then re-renders now. */
const cliItem = (ctx: Exec, id: string, cmd: string): WidgetItem => ({
  id: `${OWNS}-cli:${id}`,
  action: act(ctx, cmd),
});

// Was alpha(color, level) in the design system; levels are guesses.
const ALPHA = { medium: 0.2, heavy: 0.35 } as const;
function alpha(color: string, level: keyof typeof ALPHA): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color; // not a plain #rrggbb: leave it opaque
  return `#${m[1]}${Math.round(ALPHA[level] * 255).toString(16).padStart(2, "0")}`;
}

const short = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

// ── Refresh ─────────────────────────────────────────────────────────────────
// The host should re-render every REFRESH_SECS (`repeat` below + the `widgets[]` entry in
// package.json). The watchdog is a safety net for when it does not: if no render happened for
// 1.5 periods, it asks for a refresh through ctx.dispatch (a no-op item with then: "refresh").
// While the host's repeat works, renders keep arriving and the watchdog never fires.
const REFRESH_SECS = 2;
const WATCHDOG_MS = REFRESH_SECS * 1500;

type Dispatch = (item: WidgetItem) => unknown;
let lastRender = 0;
let lastCtx: ExecutionContext | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;

function armWatchdog(ctx: ExecutionContext) {
  lastCtx = ctx;
  if (watchdog) return;
  watchdog = setInterval(() => {
    const cur = lastCtx as unknown as { dispatch?: Dispatch } | null;
    if (!cur || typeof cur.dispatch !== "function") return;
    if (Date.now() - lastRender < WATCHDOG_MS) return;
    lastRender = Date.now(); // at most one request per period, even if the render is slow
    try {
      void cur.dispatch({ id: `${OWNS}-tick`, action: { run: async () => {}, then: "refresh" } });
    } catch { /* ignore: the next tick tries again */ }
  }, 1000);
  watchdog.unref?.();
}

async function renderJtop(ctx: ExecutionContext): Promise<WidgetContent> {
  armWatchdog(ctx);
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  const c = {
    fg: g("fg", "#ebdbb2"), fg4: g("fg4", "#a89984"), bg2: g("bg2", "#2a2a2e"), bg3: g("bg3", "#38383d"),
    green: g("brightGreen", "#b8bb26"), yellow: g("brightYellow", "#fabd2f"),
    orange: g("brightOrange", "#fe8019"), red: g("brightRed", "#fb4934"),
    blue: g("brightBlue", "#83a598"),
  };
  const level = (pct: number) =>
    pct >= 90 ? c.red : pct >= 70 ? c.orange : pct >= 50 ? c.yellow : c.green;
  const panel = { background: c.bg2, borderRadius: 8, padding: 4 };

  const snap = await loadSnapshot(ctx, true);
  const cpuTab = snap.sort === "cpu";
  const pctOf = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0);
  const memPct = pctOf(snap.memUsed, snap.memTotal);

  /** Display-only line (a text section, not focusable). */
  const text = (id: string, label: string, color: string): Section => ({
    id,
    content: { type: "text", data: { id: `${OWNS}-${id}`, attribute: { label1: label, color1: color, textSize1: 12 } } },
  });

  /** A progress bar section. */
  const barSection = (id: string, label: string, pct: number): Section => ({
    id,
    content: {
      type: "progress",
      datas: [{
        id: `${OWNS}-${id}`,
        attribute: {
          label1: label, color2: level(pct),
          labelRight: `${Math.min(100, Math.max(0, pct)).toFixed(0)}%`, colorRight: level(pct),
          color1: level(pct),
        },
      }],
    },
  });

  // ── tabs ──
  const tab = (key: SortMode, label: string): WidgetItem =>
    ({
      id: `${OWNS}-tab:${key}`,
      pinned: true,
      attribute: { label1: label, color1: snap.sort === key ? c.fg : c.fg4 },
      style: snap.sort === key ? { background: c.bg3, borderRadius: 6 } : undefined,
      action: act(ctx, setTabCmd(key)),
    }) as WidgetItem;

  // ── column header (display only) ──
  const headRight = cpuTab
    ? `${"% CPU".padStart(6)}  ${"CPU Time".padStart(10)}  ${"PID".padStart(6)}  User`
    : `${"Memory".padStart(9)}  ${"% Mem".padStart(6)}  ${"PID".padStart(6)}  User`;
  const head: WidgetItem = {
    id: `${OWNS}-head`,
    attribute: { label1: "Process Name", color1: c.fg4, labelRight: headRight, colorRight: c.fg4 },
    style: { background: c.bg3, borderRadius: 4 },
  };

  // ── process list: click / enter selects ──
  const procRows: WidgetItem[] = snap.procs.length
    ? snap.procs.map((p) => {
        const isSel = snap.selected?.pid === p.pid;
        const pct = cpuTab ? p.cpu / snap.cores : p.mem; // colour by share of the whole machine
        const right = cpuTab
          ? `${p.cpu.toFixed(1).padStart(6)}  ${p.time.padStart(10)}  ${String(p.pid).padStart(6)}  ${short(p.user, 10)}`
          : `${fmtBytes(p.rssKB * 1024).padStart(9)}  ${p.mem.toFixed(1).padStart(6)}  ${String(p.pid).padStart(6)}  ${short(p.user, 10)}`;
        return {
          id: `${OWNS}-proc:${p.pid}`,
          pinned: true,
          attribute: {
            label1: `${isSel ? "▸ " : ""}${short(p.name, 30)}`, color1: c.fg,
            labelRight: right, colorRight: level(pct),
          },
          style: isSel ? { background: alpha(c.blue, "heavy"), borderRadius: 4 } : undefined,
          action: act(ctx, selectCmd(p.pid)),
        } as WidgetItem;
      })
    : [{ id: `${OWNS}-empty`, attribute: { label1: "No processes", color1: c.fg4 } }];

  const sections: Section[] = [
    { id: "jtop-tabs", navigable: true, style: panel, content: { type: "rows", datas: [tab("cpu", "CPU"), tab("mem", "Memory")] } },
    { id: "jtop-head", navigable: false, content: { type: "list", datas: [head] } },
    { id: "jtop-procs", navigable: snap.procs.length > 0, content: { type: "list", datas: procRows } },
  ];

  // ── selected process: detail + toolbar ──
  const sel = snap.selected;
  if (sel) {
    const name = sel.path.slice(sel.path.lastIndexOf("/") + 1) || `pid ${sel.pid}`;
    const button = (id: string, label: string, cmd: string, accent: string): WidgetItem => ({
      id: `${OWNS}-btn-${id}`,
      pinned: true,
      attribute: { label1: label, color1: accent },
      style: { background: alpha(accent, "medium"), borderRadius: 6 },
      action: act(ctx, cmd),
    });
    sections.push(
      text("sel-name", `${name}  (PID ${sel.pid})`, c.fg),
      text(
        "sel-info",
        `Parent ${sel.ppid} · User ${sel.user} · Running ${sel.etime} · CPU ${sel.cpu.toFixed(1)}% · Memory ${fmtBytes(sel.rssKB * 1024)}`,
        c.fg4,
      ),
      text("sel-path", short(sel.path, 80), c.fg4),
      {
        id: "jtop-toolbar",
        navigable: true,
        style: panel,
        content: {
          type: "grid-3",
          datas: [
            button("quit", "✕ Quit", killCmd(sel.pid, false), c.red),
            button("force", "⚠ Force Quit", killCmd(sel.pid, true), c.orange),
            button("sample", "🔍 Sample", sampleCmd(sel.pid), c.blue),
          ],
        },
      },
    );
  }

  // ── footer: system totals for the tab ──
  if (cpuTab) {
    sections.push(
      text(
        "foot-cpu",
        snap.cpu === null || snap.cpuUser === null || snap.cpuSys === null
          ? "System --   User --   Idle --"
          : `System ${snap.cpuSys.toFixed(1)}%   User ${snap.cpuUser.toFixed(1)}%   Idle ${(100 - snap.cpu).toFixed(1)}%`,
        c.fg4,
      ),
      barSection("foot-load", "CPU LOAD", snap.cpu ?? 0),
      text("foot-threads", `Threads ${snap.threads || "--"}   Processes ${snap.procTotal || "--"}`, c.fg4),
    );
  } else {
    sections.push(
      barSection("foot-mem", `MEMORY USED  ${fmtBytes(snap.memUsed)} of ${fmtBytes(snap.memTotal)}`, memPct),
      text(
        "foot-mem-detail",
        `Wired ${fmtBytes(snap.memWired)}   Compressed ${fmtBytes(snap.memCompressed)}   Free ${fmtBytes(snap.memFree)}`,
        c.fg4,
      ),
    );
  }
  // The clock moves on every refresh: if it stops, the repeat is not applied.
  sections.push(
    text("foot-hint", `Updated ${new Date().toLocaleTimeString("en-GB")}  ·  q quit  f force  i sample  o monitor  s tab`, c.fg4),
  );

  lastRender = Date.now();
  return { type: "group", direction: "column", gap: 4, sections };
}

// ════════════════════════════════════════════════════════════════════════════
// CLI commands and keys
// ════════════════════════════════════════════════════════════════════════════

const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "status", title: "Print CPU, memory, disk and network in one line",
    async run(ctx: WidgetCliContext) {
      // widget = false: samples CPU now and does not move the network baseline the widget uses.
      const s = await loadSnapshot(ctx, false);
      const memPct = s.memTotal > 0 ? (s.memUsed / s.memTotal) * 100 : 0;
      const diskPct = s.diskTotal > 0 ? (s.diskUsed / s.diskTotal) * 100 : 0;
      return [
        s.cpu === null ? "CPU --" : `CPU ${s.cpu.toFixed(0)}%`,
        `MEM ${fmtBytes(s.memUsed)}/${fmtBytes(s.memTotal)} (${memPct.toFixed(0)}%)`,
        `DISK ${diskPct.toFixed(0)}%`,
        `↓ ${fmtRate(s.netDown)} ↑ ${fmtRate(s.netUp)}`,
      ].join(" · ");
    },
  },
  {
    id: "top", title: "Print the top processes (sorted as in the widget)",
    async run(ctx: WidgetCliContext) {
      const s = await loadSnapshot(ctx, false);
      if (s.procs.length === 0) return "no processes";
      return s.procs
        .map((p) => `${String(p.pid).padStart(6)}  ${p.cpu.toFixed(1).padStart(5)}% cpu  ${p.mem.toFixed(1).padStart(5)}% mem  ${p.name}`)
        .join("\n");
    },
  },
  {
    id: "sort", title: "Toggle the tab (cpu <-> memory)",
    async run(ctx: WidgetCliContext) {
      await ctx.exec(SORT_CMD);
      return `sorted by ${await readSort(ctx)}`;
    },
  },
];

// Remap per widget in ~/.jimcast/keybinding.json:
//   "widgets": { "com.jimcast.plugins.jtop": { "quit": "q", "force": "f", "sample": "i" } }

/** The pid of the focused process row, or null (the commands then use the selected process). */
function focusedPid(ctx: unknown): number | null {
  const id = (ctx as { focusedItemId?: string }).focusedItemId ?? "";
  const m = /proc:(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

const KEY_ACTIONS: WidgetKeyAction[] = [
  {
    id: "sort", title: "Switch tab (CPU / Memory)", default: "s",
    run: (ctx) => ctx.dispatch(cliItem(ctx, "sort", SORT_CMD)),
  },
  {
    id: "quit", title: "Quit the focused (or selected) process", default: "q",
    run: (ctx) => ctx.dispatch(cliItem(ctx, "quit", killCmd(focusedPid(ctx), false))),
  },
  {
    id: "force", title: "Force quit the focused (or selected) process", default: "f",
    run: (ctx) => ctx.dispatch(cliItem(ctx, "force", killCmd(focusedPid(ctx), true))),
  },
  {
    id: "sample", title: "Sample the focused (or selected) process", default: "i",
    run: (ctx) => ctx.dispatch(cliItem(ctx, "sample", sampleCmd(focusedPid(ctx)))),
  },
  {
    id: "monitor", title: "Open Activity Monitor", default: "o",
    run: (ctx) => ctx.dispatch(cliItem(ctx, "monitor", OPEN_MONITOR_CMD)),
  },
];

// ════════════════════════════════════════════════════════════════════════════
// Plugin
// ════════════════════════════════════════════════════════════════════════════

export const jtopWidget = createWidget({
  section: { title: "jtop" },
  // Re-render every REFRESH_SECS. The "Updated" clock in the footer moves each time.
  // package.json must also declare it under jimcast.widgets[] (see the answer).
  repeat: { enable: true, seconds: REFRESH_SECS },

  cli:  { owns: OWNS, commands: CLI_COMMANDS },
  keys: { owns: OWNS, actions: KEY_ACTIONS },

  render: (ctx) => renderJtop(ctx),
});

export const plugin = definePlugin({
  description: "Activity Monitor-style process list: CPU / Memory tabs, select a process to quit, force quit or sample it.",
  widgets: [jtopWidget],
});

export default plugin;

bootstrapPlugin(plugin);
