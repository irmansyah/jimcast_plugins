// [plugin] jim-emojipicker/src/render.ts
//
// Category tabs above a dense tiles grid. Click / Enter copies and dismisses.

import type {
  ExecutionContext,
  WidgetContent,
  WidgetGroupSection,
  WidgetItem,
} from "@jimcast/sdk";
import { CATEGORIES, COLUMNS, RECENT_ID, type Emoji, nameOf, tabList } from "./catalog.js";
import { type PickerState, copyCmd, readState, setCategoryCmd } from "./shell.js";

// ── Ids ─────────────────────────────────────────────────────────────────────
// Every item id starts with OWNS: it is the `owns` of the widget's cli spec.
// It must NOT start with core's `em` prefix, or core's built-in emoji
// handlers would grab these tiles.
export const OWNS = "extem";

// ── Actions ─────────────────────────────────────────────────────────────────
/** Runs a script in the plugin, then asks core to `then`. */
export const act = (
  ctx: ExecutionContext, cmd: string, then: "refresh" | "dismiss" = "refresh",
): NonNullable<WidgetItem["action"]> => ({
  run: async () => { await ctx.exec(cmd); },
  then,
});

/** A synthetic item, for ctx.dispatch (CLI). */
export const cliItem = (ctx: ExecutionContext, id: string, cmd: string): WidgetItem => ({
  id: `${OWNS}-cli:${id}`,
  action: act(ctx, cmd),
});

// ── Palette ─────────────────────────────────────────────────────────────────
function makePal(ctx: ExecutionContext) {
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  return { bg1: g("bg1", "#3c3836"), bg3: g("bg3", "#665c54"), fg: g("fg", "#ebdbb2"), fg4: g("fg4", "#a89984") };
}

// ── Items ───────────────────────────────────────────────────────────────────
function emojiItems(ctx: ExecutionContext, list: Emoji[], bg: string): WidgetItem[] {
  return list.map(({ name, emoji }, i) => ({
    id: `${OWNS}:${i}`,                  // index, so a duplicate can't collide
    pinned: true,
    attribute: { label1: `${emoji}  ${name}`, image: emoji, textSize1: 20 },
    style: { background: bg },
    action: act(ctx, copyCmd(emoji), "dismiss"),
  }));
}

function buildContent(ctx: ExecutionContext, st: PickerState): WidgetContent {
  const c = makePal(ctx);
  const tabs = tabList();

  // Default: Recent if there is any, else Smileys.
  const wanted = st.category || (st.recent.length ? RECENT_ID : CATEGORIES[0].id);
  const active = tabs.find((t) => t.id === wanted) ?? tabs[1];

  const tabBar: WidgetItem[] = tabs.map((t) => ({
    id: `${OWNS}-tab:${t.id}`,
    pinned: true,
    attribute: {
      label1: t.icon,
      label2: t.id === active.id ? t.name : undefined,
      textSize1: 16,
      color2: c.fg,
    },
    style: t.id === active.id ? { background: c.bg3, borderRadius: 6 } : undefined,
    action: act(ctx, setCategoryCmd(t.id)),
  }));

  const list: Emoji[] = active.id === RECENT_ID
    ? st.recent.map((emoji) => ({ emoji, name: nameOf.get(emoji) ?? "emoji" }))
    : CATEGORIES.find((cat) => cat.id === active.id)?.emojis ?? [];

  const items = emojiItems(ctx, list, c.bg1);
  const body: WidgetContent = items.length
    ? { type: "tiles", columns: COLUMNS, gap: 2, datas: items }
    : { type: "text", data: { id: `${OWNS}-empty`, attribute: {
        label1: "Nothing here yet. Pick an emoji from another tab.", color1: c.fg4 } } };

  const barStyle = { background: c.bg1, borderRadius: 8, padding: 4 };
  const sections: WidgetGroupSection[] = [
    { id: "tabs", navigable: true, style: barStyle, content: { type: "rows", datas: tabBar } },
    { id: "emojis", navigable: true, content: body },
  ];
  return { type: "group", direction: "column", gap: 6, sections };
}

export async function renderEmoji(ctx: ExecutionContext): Promise<WidgetContent> {
  return buildContent(ctx, await readState(ctx));
}
