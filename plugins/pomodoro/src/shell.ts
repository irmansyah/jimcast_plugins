// [plugin] jim-pomodoro/src/shell.ts
//
// Shell scripts + timer state. State lives in the plugin data dir
// (pluginDataFile("state")); the SDK creates the dir, the plugin never builds the path.
//
// State is a timestamp, never a tick counter. The file holds one line:
//     <running|paused> <focus|break> <end-epoch> <total-secs> <remaining-secs>
// (no file = idle).

import { pluginDataFile, type ExecutionContext } from "@jimcast/sdk";

export const FOCUS_SECS = 25 * 60;
export const BREAK_SECS = 5 * 60;
export const URGENT_SECS = 60; // the countdown turns orange and blinks below this

export type Phase = "focus" | "break";
type RunState = "running" | "paused";

const STATE_FILE = `"${pluginDataFile("state")}"`;

// ── Shell building blocks (macOS: osascript for the notification) ───────────

/** Cancels the pending notification, if any. */
const KILL = `[ -s "$f.pid" ] && kill $(cat "$f.pid") 2>/dev/null; rm -f "$f.pid"`;

/** Starts $ph with $rem seconds left ($total is the full length): writes the
 *  state and schedules the notification. Needs $f, $now, $ph, $total, $rem. */
const LAUNCH = `
end=$((now+rem)); echo "running $ph $end $total $rem" > "$f"
if [ "$ph" = focus ]; then msg="Focus done - time for a break"; else msg="Break over - back to focus"; fi
( sleep $rem; osascript -e 'display notification "'"$msg"'" with title "Pomodoro"' ) >/dev/null 2>&1 </dev/null &
echo $! > "$f.pid"
`;

const HEAD = `f=${STATE_FILE}; now=$(date +%s)`;

/** Sets $ph/$total/$rem to the phase after $ph. */
const NEXT_PHASE = `
if [ "$ph" = focus ]; then ph=break; total=${BREAK_SECS}; else ph=focus; total=${FOCUS_SECS}; fi
rem=$total
`;

export const TOGGLE_CMD = `${HEAD}
if [ -s "$f" ]; then
  read st ph end total rem < "$f"
  if [ "$st" = running ]; then
    left=$((end-now))
    ${KILL}
    if [ "$left" -gt 0 ]; then
      echo "paused $ph 0 $total $left" > "$f"
    else
      ${NEXT_PHASE}
      ${LAUNCH}
    fi
  else
    ${LAUNCH}
  fi
else
  ph=focus; total=${FOCUS_SECS}; rem=$total
  ${LAUNCH}
fi
`;

export const SKIP_CMD = `${HEAD}
if [ -s "$f" ]; then
  read st ph end total rem < "$f"
  ${KILL}
  ${NEXT_PHASE}
  ${LAUNCH}
fi
`;

/** Start a break right away (from idle). */
export const BREAK_CMD = `${HEAD}
${KILL}
ph=break; total=${BREAK_SECS}; rem=$total
${LAUNCH}
`;

export const RESET_CMD = `${HEAD}
${KILL}
rm -f "$f"
`;

const READ_STATE = `cat ${STATE_FILE} 2>/dev/null`;

// ── State ───────────────────────────────────────────────────────────────────

export interface Timer {
  state: RunState;
  phase: Phase;
  total: number;
  remaining: number; // seconds left, 0 when finished
}

export const mmss = (secs: number) => {
  const s = Math.max(0, Math.ceil(secs));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

function parseTimer(text: string, nowSecs: number): Timer | null {
  const [st, ph, end, total, rem] = text.trim().split(/\s+/);
  if ((st !== "running" && st !== "paused") || (ph !== "focus" && ph !== "break")) return null;
  const t = Number(total);
  if (!(t > 0)) return null;
  const remaining = st === "running" ? Number(end) - nowSecs : Number(rem);
  if (!Number.isFinite(remaining)) return null;
  return { state: st, phase: ph, total: t, remaining: Math.min(t, Math.max(0, remaining)) };
}

export async function readTimer(ctx: ExecutionContext): Promise<Timer | null> {
  const res = await ctx.exec(READ_STATE);
  return res.stdout.trim() ? parseTimer(res.stdout, Date.now() / 1000) : null;
}

export const phaseName = (p: Phase) => (p === "focus" ? "Focus" : "Break");
export const nextPhaseName = (p: Phase) => (p === "focus" ? "break" : "focus");
