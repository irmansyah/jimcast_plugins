// [plugin] jim-team-presence/src/index.ts
//
// A compact Slack-style team presence board, sized for half the bar's width:
// one summary line, then one row per person (max MAX_ROWS):
//
//   ● Alice Kim · reviewing PRs            14:05
//   ● Bob · in a meeting                   09:05
//   ● Carol                                07:05
//   ○ Dave                                 22:05
//
// Dot: ● green active, ● red dnd (do not disturb), ● yellow away, ○ grey offline.
// Right side: the person's local time (from their "tz"). Enter on a row opens
// its "url" (a Slack profile / DM link, say) when it has one.
//
// Data: <plugin data dir>/team.json (~/.jimcast/plugin-data/<plugin id>/team.json),
// edited by hand or written by any script/cron. Re-read every REFRESH_SECONDS:
//
//   { "members": [
//       { "name": "Alice Kim", "status": "active", "note": "reviewing PRs",
//         "tz": "Asia/Seoul", "url": "slack://user?team=T123&id=U456" },
//       { "name": "Bob", "status": "dnd", "note": "in a meeting", "tz": "Europe/London" }
//   ] }
//
// status: active | dnd | away | offline ("online" = active, "busy" = dnd).
// Names should be unique (they are the row ids). Only http(s):// and slack://
// urls are opened.

import {
  createWidget,
  definePlugin,
  pluginDataDir,
  type ExecutionContext,
  type WidgetContent,
  type WidgetItem,
} from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime"; // Node only

type Presence = "active" | "dnd" | "away" | "offline";

interface Member {
  name: string;
  status: Presence;
  note?: string;
  tz?: string;
  url?: string;
}

// ~/.jimcast/plugin-data/<plugin id>/ (pluginDataDir() reads the env core sets at spawn).
const DIR = pluginDataDir();
const TEAM_FILE = `"${DIR}/team.json"`;

// Item-id prefix: not a core prefix while the built-in still exists.
const ITEM = "extteam";

// Half-width budget: rows beyond this collapse into "… n more".
const MAX_ROWS = 8;
// Max characters of "● name · note" (the time sits to the right of it).
const LABEL_MAX = 34;
// Local times and edits to team.json show up within this long.
const REFRESH_SECONDS = 30;

// Local stand-ins for the core design-system font sizes.
const FONT = { xs: 11, sm: 12 };

const ORDER: Presence[] = ["active", "dnd", "away", "offline"];
const ALIASES: Record<string, Presence> = {
  online: "active",
  busy: "dnd",
  "do-not-disturb": "dnd",
  dnd: "dnd",
};
const ELLIPSIS = "…";
const SAFE_URL = /^(https?|slack):\/\//;

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const truncate = (s: string, max: number) =>
  s.length <= max ? s : s.slice(0, max - 1) + ELLIPSIS;
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

function normalizeStatus(v: unknown): Presence {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if ((ORDER as string[]).includes(s)) return s as Presence;
  return ALIASES[s] ?? "offline";
}

function parseMembers(text: string): Member[] {
  const root: unknown = JSON.parse(text);
  const list = Array.isArray(root)
    ? root
    : (root as { members?: unknown } | null)?.members;
  if (!Array.isArray(list)) throw new Error('expected {"members": [...]}');

  const out: Member[] = [];
  for (const m of list) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    const name = str(o.name);
    if (!name) continue;
    out.push({
      name,
      status: normalizeStatus(o.status),
      note: str(o.note),
      tz: str(o.tz),
      url: str(o.url),
    });
  }
  return out;
}

/** "14:05" in the member's time zone; '' when there is none or it is invalid. */
function localTime(tz?: string): string {
  if (!tz) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return "";
  }
}

async function render(ctx: ExecutionContext): Promise<WidgetContent> {
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  const c = {
    green: g("green", "#98c379"),
    brightRed: g("brightRed", "#e06c75"),
    yellow: g("yellow", "#e5c07b"),
    fg4: g("fg4", "#7f848e"),
  };

  const statusColor = (s: Presence): string => {
    switch (s) {
      case "active": return c.green;
      case "dnd": return c.brightRed;
      case "away": return c.yellow;
      default: return c.fg4;
    }
  };
  const dotFor = (s: Presence) => (s === "offline" ? "○" : "●");

  const note = (id: string, text: string, color: string): WidgetContent => ({
    type: "list",
    datas: [{ id, pinned: true, attribute: { label1: text, color1: color, textSize1: FONT.sm } }],
  });

  const res = await ctx.exec(`cat ${TEAM_FILE} 2>/dev/null`);
  const text = res.stdout.trim();
  if (!text) {
    return note(`${ITEM}-empty`, "Create team.json in this plugin's data dir to list your team", c.fg4);
  }

  let members: Member[];
  try {
    members = parseMembers(text);
  } catch (e) {
    return { type: "error", message: `team.json: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!members.length) return note(`${ITEM}-none`, "team.json has no members", c.fg4);

  members.sort(
    (a, b) =>
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  const counts: Record<Presence, number> = { active: 0, dnd: 0, away: 0, offline: 0 };
  for (const m of members) counts[m.status]++;
  const summary = ORDER.filter((s) => counts[s])
    .map((s) => `${counts[s]} ${s}`)
    .join(" · ");

  const rows: WidgetItem[] = members.slice(0, MAX_ROWS).map((m) => {
    const url = m.url && SAFE_URL.test(m.url) ? m.url : null;
    const label = `${dotFor(m.status)} ${m.name}${m.note ? ` · ${m.note}` : ""}`;
    return {
      id: `${ITEM}:${m.name}`,
      attribute: {
        label1: truncate(label, LABEL_MAX),
        color1: statusColor(m.status),
        labelRight: localTime(m.tz) || undefined,
        colorRight: c.fg4,
        textSizeRight: FONT.xs,
      },
      action: url
        ? {
            run: async () => {
              await ctx.exec(`open ${shq(url)}`);
            },
            then: "dismiss" as const,
          }
        : undefined,
    };
  });

  const datas: WidgetItem[] = [
    {
      id: `${ITEM}-summary`,
      pinned: true,
      attribute: { label1: summary, color1: c.fg4, textSize1: FONT.sm },
    },
    ...rows,
  ];
  if (members.length > MAX_ROWS) {
    datas.push({
      id: `${ITEM}-more`,
      pinned: true,
      attribute: {
        label1: `${ELLIPSIS} ${members.length - MAX_ROWS} more`,
        color1: c.fg4,
        textSize1: FONT.xs,
      },
    });
  }

  return { type: "list", datas };
}

// Main widget: no id (its full id is the plugin id from package.json).
export const widget = createWidget({
  section: { title: "Team", titleShow: true },
  showIn: ["default"],
  repeat: { enable: true, seconds: REFRESH_SECONDS },
  render: (ctx) => render(ctx),
});

export const plugin = definePlugin({
  description: "Compact team presence board with local times, read from team.json.",
  widgets: [widget],
});
export default plugin;
bootstrapPlugin(plugin);
