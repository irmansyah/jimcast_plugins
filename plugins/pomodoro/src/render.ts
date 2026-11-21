// [plugin] jim-pomodoro/src/render.ts
//
// A small boxed countdown beside a thin progress row, then a row of buttons.
// Nature palette: green is focus, aqua (water) is break, sun-yellow is paused,
// orange is the last minute. The next sensible action is a SOLID button.
//
//   idle      [25:00]  ◷ idle                    0%   [ ▶ Focus now ] [ ☕ Break now ]
//   focus     [18:42]  ▶ Focus (green)          25%   [ ⏸ Pause ] [ ⏭ Skip ] [ ✕ Cancel ]
//   break     [03:10]  ☕ Break (aqua)           36%   [ ⏸ Pause ] [ ⏭ Skip ] [ ✕ Cancel ]
//   paused    [18:42]  ⏸ Focus · paused (yellow) 25%  [ ▶ Resume ] [ ⏭ Skip ] [ ✕ Cancel ]
//   last min  [00:42]  ▶ Focus · last minute     blinks orange once a second
//   finished  [00:00]  ✓ Focus done (blue)      100%  blinks, [ ▶ Start break ] [ ✕ Cancel ]

import type {
  ExecutionContext,
  WidgetContent,
  WidgetItem,
} from "@jimcast/sdk";
import {
  BREAK_CMD,
  FOCUS_SECS,
  RESET_CMD,
  SKIP_CMD,
  TOGGLE_CMD,
  URGENT_SECS,
  mmss,
  nextPhaseName,
  phaseName,
  readTimer,
} from "./shell.js";

// ── Ids ─────────────────────────────────────────────────────────────────────
// Every item id starts with OWNS: it is the `owns` of the widget's cli spec.
// It must NOT start with core's `pomodoro` prefix, or core's built-in
// pomodoro handlers would grab these items.
export const OWNS = "extpomo";

const TIME_SIZE = 18; // px, the countdown beside the bar
const RADIUS_MD = 8;  // was radius.md in core

// Was alpha(color, level) in core's design system; levels are guesses.
const ALPHA = { muted: 0.12, medium: 0.2, heavy: 0.35 } as const;
function alpha(color: string, level: keyof typeof ALPHA): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color; // not a plain #rrggbb: leave it opaque
  return `#${m[1]}${Math.round(ALPHA[level] * 255).toString(16).padStart(2, "0")}`;
}

// ── Actions ─────────────────────────────────────────────────────────────────
export const act = (ctx: ExecutionContext, cmd: string): NonNullable<WidgetItem["action"]> => ({
  run: async () => { await ctx.exec(cmd); },
  then: "refresh",
});

/** A button. `primary` = solid accent background (the action we want clicked);
 *  otherwise a faint tint of the accent with accent-coloured text. */
function button(
  ctx: ExecutionContext, bg: string, id: string, label: string, cmd: string, accent: string, primary: boolean,
): WidgetItem {
  return {
    id: `${OWNS}-${id}`,
    attribute: { label1: label, color1: primary ? bg : accent },
    style: { background: primary ? accent : alpha(accent, "medium"), borderRadius: 6 },
    action: act(ctx, cmd),
  };
}

/** A synthetic item, for ctx.dispatch (key actions): runs the script, then re-renders now. */
export const cliItem = (ctx: ExecutionContext, id: string, cmd: string): WidgetItem => ({
  id: `${OWNS}-cli:${id}`,
  action: act(ctx, cmd),
});

// ── Render ──────────────────────────────────────────────────────────────────
export async function renderPomodoro(ctx: ExecutionContext): Promise<WidgetContent> {
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  const c = {
    bg: g("bg", "#282828"), fg: g("fg", "#ebdbb2"), fg2: g("fg2", "#d5c4a1"), fg4: g("fg4", "#a89984"),
    brightGreen: g("brightGreen", "#b8bb26"), brightAqua: g("brightAqua", "#8ec07c"),
    brightYellow: g("brightYellow", "#fabd2f"), brightOrange: g("brightOrange", "#fe8019"),
    brightBlue: g("brightBlue", "#83a598"),
  };
  const timer = await readTimer(ctx);
  const btn = (id: string, label: string, cmd: string, accent: string, primary: boolean) =>
    button(ctx, c.bg, id, label, cmd, accent, primary);

  // Nature palette.
  const FOCUS = c.brightGreen;   // leaf
  const BREAK = c.brightAqua;    // water
  const PAUSED = c.brightYellow; // sun
  const URGENT = c.brightOrange; // last minute
  const DONE = c.brightBlue;     // sky

  let barLabel: string;
  let timeText: string;          // the countdown, boxed beside the bar
  let pct = 0;
  let accent: string;
  let pulse = false;             // blink the countdown box
  let running = false;
  let buttons: WidgetItem[];

  if (!timer) {
    barLabel = "◷ idle";
    timeText = mmss(FOCUS_SECS);
    accent = c.fg4;
    buttons = [
      btn("start", "▶ Focus now", TOGGLE_CMD, FOCUS, true),
      btn("break", "☕ Break now", BREAK_CMD, BREAK, false),
    ];
  } else {
    pct = ((timer.total - timer.remaining) / timer.total) * 100;
    const name = phaseName(timer.phase);
    const phaseColor = timer.phase === "focus" ? FOCUS : BREAK;
    const icon = timer.phase === "focus" ? "▶" : "☕";
    timeText = mmss(timer.remaining);

    if (timer.state === "paused") {
      barLabel = `⏸ ${name} · paused`;
      accent = PAUSED;
      buttons = [
        btn("toggle", "▶ Resume", TOGGLE_CMD, PAUSED, true),
        btn("skip", "⏭ Skip", SKIP_CMD, c.fg2, false),
        btn("cancel", "✕ Cancel", RESET_CMD, c.fg4, false),
      ];
    } else if (timer.remaining <= 0) {
      barLabel = `✓ ${name} done`;
      accent = DONE;
      pulse = true;
      buttons = [
        btn("toggle", `▶ Start ${nextPhaseName(timer.phase)}`, TOGGLE_CMD, DONE, true),
        btn("cancel", "✕ Cancel", RESET_CMD, c.fg4, false),
      ];
    } else {
      running = true;
      const urgent = timer.remaining <= URGENT_SECS;
      barLabel = urgent ? `${icon} ${name} · last minute` : `${icon} ${name}`;
      accent = urgent ? URGENT : phaseColor;
      pulse = urgent;
      buttons = [
        btn("toggle", "⏸ Pause", TOGGLE_CMD, phaseColor, false),
        btn("skip", "⏭ Skip", SKIP_CMD, c.fg2, false),
        btn("cancel", "✕ Cancel", RESET_CMD, c.fg4, false),
      ];
    }
  }

  // Blinks once a second (the widget re-renders every second).
  const hot = pulse && Math.floor(Date.now() / 1000) % 2 === 0;

  return {
    type: "group",
    direction: "column",
    gap: 4,
    sections: [
      {
        // Countdown box + thin progress row, side by side. Display only.
        id: "pomodoro-status",
        navigable: false,
        content: {
          type: "group",
          direction: "row",
          gap: 6,
          sections: [
            {
              // The countdown: small, tinted box with an accent border
              // (thicker while running).
              id: "pomodoro-time",
              flex: 1,
              content: {
                type: "rows",
                datas: [{
                  id: `${OWNS}-clock`,
                  pinned: true,
                  attribute: {
                    label1: timeText, color1: hot ? c.fg : accent, textSize1: TIME_SIZE,
                  },
                  style: {
                    background: alpha(accent, hot ? "heavy" : "muted"),
                    borderColor: accent,
                    borderWidth: running ? 2 : 1,
                    borderRadius: RADIUS_MD,
                    padding: "2px 0",
                  },
                }],
              },
            },
            {
              id: "pomodoro-bar",
              flex: 3,
              content: {
                type: "progress",
                datas: [{
                  id: `${OWNS}-progress`,
                  attribute: {
                    label1: barLabel, color2: accent,       // WidgetProgressBar: color2 = left label
                    labelRight: `${pct.toFixed(0)}%`, colorRight: accent,
                    color1: accent,                         // bar fill
                  },
                }],
              },
            },
          ],
        },
      },
      {
        id: "pomodoro-buttons",
        navigable: true,
        content: { type: "grid-3", datas: buttons },
      },
    ],
  };
}
