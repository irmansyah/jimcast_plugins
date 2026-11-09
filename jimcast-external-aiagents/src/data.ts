// [plugin] jimcast-external-aiagents/src/data.ts
import { readFeedRaw, type Exec } from "./shell.js";

// ── Model (the contract for a real data source) ─────────────────────────────
export type Level = "info" | "tool" | "ok" | "warn" | "error";
export type Status = "running" | "idle" | "done" | "error";

export interface LogLine { level: Level; text: string }

export interface Agent {
  id: string;
  name: string;
  icon: string;
  status: Status;
  task: string;
  progress: number; // 0..1
  logs: LogLine[];  // oldest first
}

export const LEVELS: Level[] = ["info", "tool", "ok", "warn", "error"];
export const STATUSES: Status[] = ["running", "idle", "done", "error"];

export const LOG_ROWS = 6; // lines under an agent tab

// ── Data: feed.json ─────────────────────────────────────────────────────────
export function parseFeed(raw: string): Agent[] | null {
  if (!raw.trim()) return null;
  try {
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.agents)) return null;
    return j.agents
      .filter((a: Agent) => a && typeof a.id === "string")
      .map((a: Agent): Agent => {
        const status = (STATUSES as string[]).includes(a.status) ? a.status : "idle";
        return {
          id: a.id,
          name: a.name || a.id,
          icon: a.icon || "🤖",
          status,
          task: a.task ?? "",
          progress: Number.isFinite(Number(a.progress))
            ? Math.max(0, Math.min(1, Number(a.progress)))
            : status === "done" ? 1 : 0,
          logs: (Array.isArray(a.logs) ? a.logs : [])
            .filter((l: LogLine) => l && typeof l.text === "string")
            .map((l: LogLine) => ({
              level: (LEVELS as string[]).includes(l.level) ? l.level : "info",
              text: l.text,
            }))
            .slice(-LOG_ROWS * 2),
        };
      });
  } catch {
    return null;
  }
}

// ── Data: dummy, deterministic from the clock so the log "runs" ─────────────
interface Tpl { level: Level; text: string }
interface DummyDef {
  id: string; name: string; icon: string; task: string;
  interval: number;  // seconds between log lines
  cycle: number;     // seconds per task
  offset: number;    // staggers the agents
  failEvery: number; // every Nth task fails (0 = never)
  lines: Tpl[];
}

const RUN_FRACTION = 0.85; // rest of each cycle shows done / error

const DUMMY_DEFS: DummyDef[] = [
  {
    id: "planner", name: "Planner", icon: "🧭", task: "Plan payment refactor",
    interval: 3, cycle: 75, offset: 0, failEvery: 0,
    lines: [
      { level: "info", text: "Task received" },
      { level: "tool", text: 'grep -rn "PaymentService" src/' },
      { level: "info", text: "Found 14 call sites" },
      { level: "info", text: "Drafting plan (7 steps)" },
      { level: "warn", text: "Step 4 touches the public API" },
      { level: "ok", text: "Plan ready: 7 steps" },
    ],
  },
  {
    id: "coder", name: "Coder", icon: "🛠", task: "Implement PaymentGateway",
    interval: 2, cycle: 90, offset: 20, failEvery: 0,
    lines: [
      { level: "info", text: "Step 1/7: gateway interface" },
      { level: "tool", text: "edit src/payments/gateway.ts" },
      { level: "info", text: "Adding StripeAdapter" },
      { level: "tool", text: "edit src/payments/stripe.ts" },
      { level: "warn", text: "Type error gateway.ts:42, retrying" },
      { level: "tool", text: "pnpm typecheck" },
      { level: "ok", text: "Typecheck passed" },
      { level: "info", text: "Updating call sites (14)" },
    ],
  },
  {
    id: "reviewer", name: "Reviewer", icon: "🔍", task: "Review PR #482",
    interval: 4, cycle: 100, offset: 45, failEvery: 0,
    lines: [
      { level: "info", text: "Fetching PR #482 (11 files)" },
      { level: "tool", text: "git diff main...pr-482" },
      { level: "warn", text: "No error handling stripe.ts:88" },
      { level: "warn", text: "No test for refund path" },
      { level: "ok", text: "Review posted" },
    ],
  },
  {
    id: "tester", name: "Tester", icon: "🧪", task: "Run integration suite",
    interval: 2, cycle: 80, offset: 10, failEvery: 3,
    lines: [
      { level: "tool", text: "docker compose up -d db redis" },
      { level: "tool", text: "pnpm test:integration" },
      { level: "info", text: "auth.spec 12 passed" },
      { level: "warn", text: "payments.spec flaky, retried" },
      { level: "info", text: "orders.spec 21 passed" },
      { level: "ok", text: "Suite finished: 60 passed" },
    ],
  },
];

function dummyAgent(def: DummyDef, now: number): Agent {
  const runLen = def.cycle * RUN_FRACTION;
  const at = (t: number) => {
    const local = t + def.offset;
    const phase = Math.floor(local / def.cycle);
    return { phase, pos: local - phase * def.cycle };
  };
  const failed = (phase: number) => def.failEvery > 0 && phase % def.failEvery === 0;

  const { phase, pos } = at(now);
  const running = pos < runLen;

  const logs: LogLine[] = [];
  const lastTick = Math.floor(now / def.interval);
  for (let k = 0; k < LOG_ROWS * 3 && logs.length < LOG_ROWS; k++) {
    const t = (lastTick - k) * def.interval;
    const p = at(t);
    if (p.pos < runLen) logs.push(def.lines[Math.floor(p.pos / def.interval) % def.lines.length]);
    else if (p.pos < runLen + def.interval) {
      logs.push(failed(p.phase)
        ? { level: "error", text: "Task failed: exit code 1" }
        : { level: "ok", text: "Task finished" });
    }
  }
  logs.reverse();

  return {
    id: def.id, name: def.name, icon: def.icon, task: def.task,
    status: running ? "running" : failed(phase) ? "error" : "done",
    progress: running ? pos / runLen : 1,
    logs,
  };
}

// The seam: feed.json wins; replace the body to call a plugin / API instead.
export async function loadAgents(ctx: Exec): Promise<Agent[]> {
  const raw = await readFeedRaw(ctx);
  return parseFeed(raw) ?? DUMMY_DEFS.map((d) => dummyAgent(d, Math.floor(Date.now() / 1000)));
}
