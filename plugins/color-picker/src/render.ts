// [plugin] jim-colorpicker/src/render.ts
//
// The color picker view: a palette selector row (optionally an action row)
// above a grid of color tiles.

import type {
  ExecutionContext,
  WidgetContent,
  WidgetGroupSection,
  WidgetItem,
} from "@jimcast/sdk";
import {
  type PickerState,
  MODE_FILE,
  SPECTRUM_ID,
  TARGET_FILE,
  VIEW_FILE,
  addCmd,
  copyCmd,
  deleteCmd,
  ensureTargetCmd,
  newProfileCmd,
  readState,
  removeCmd,
  setCmd,
  shq,
} from "./shell.js";
import {
  COLOR_SCHEMES,
  SCHEME_COLUMNS,
  SPECTRUM_COLUMNS,
  type PaletteColor,
  paletteList,
  spectrumColors,
} from "./palettes.js";

// ── Ids ─────────────────────────────────────────────────────────────────────
// Every item id starts with OWNS: it is the `owns` of the widget's cli spec.
// It must NOT start with core's `cp` prefix, or core's built-in color picker
// handlers would grab these tiles.
export const OWNS = "extcp";

/** The SAVE TO / PROFILE / ENTER row. Commented out in the original; flip to show it. */
const SHOW_ACTION_BAR = false;

// ── View: palette ───────────────────────────────────────────────────────────
interface Pal {
  blue: string; bg1: string; fg: string; fg4: string; yellow: string;
  brightGreen: string; brightRed: string;
}

function makePal(ctx: ExecutionContext): Pal {
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  return {
    blue: g("blue", "#458588"), bg1: g("bg1", "#3c3836"), fg: g("fg", "#ebdbb2"), fg4: g("fg4", "#a89984"),
    yellow: g("yellow", "#d79921"),
    brightGreen: g("brightGreen", g("green", "#b8bb26")),
    brightRed: g("brightRed", g("red", "#fb4934")),
  };
}

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

// ── Tiles ───────────────────────────────────────────────────────────────────
type Mode = "copy" | "save" | "remove";
const MODE_LABEL: Record<Mode, string> = { copy: "Copy", save: "Save", remove: "Remove" };

interface TileCtx { mode: Mode; target: string | null; freeName: string; viewProfile: string | null }

function tileItems(ctx: ExecutionContext, colors: PaletteColor[], x: TileCtx): WidgetItem[] {
  const { mode, target, freeName, viewProfile } = x;
  return colors.map(({ name, hex }, i) => {
    // Save to the target; with no target yet, create one on the fly first.
    const saveCmd = target
      ? addCmd(target, hex)
      : `${ensureTargetCmd(freeName)}\n${addCmd(freeName, hex)}`;

    let action: WidgetItem["action"];
    if (mode === "save") action = act(ctx, saveCmd);
    else if (mode === "remove" && viewProfile) action = act(ctx, removeCmd(viewProfile, hex));
    else action = act(ctx, copyCmd(hex), "dismiss");

    return {
      id: `${OWNS}:${i}`, // index, so duplicate hexes can't collide
      pinned: true,
      attribute: { label1: name ? `${name}  ${hex}` : hex },
      style: { background: hex },
      action,
      // In copy mode a single click saves; Enter / double click copies.
      clickAction: mode === "copy" ? act(ctx, saveCmd) : undefined,
    };
  });
}

// ── Content ─────────────────────────────────────────────────────────────────
function buildContent(ctx: ExecutionContext, st: PickerState): WidgetContent {
  const c = makePal(ctx);
  const all = paletteList(st.profiles);
  const viewIdx = Math.max(0, all.findIndex((p) => p.id === st.view));
  const view = all[viewIdx];
  const viewProfile = view.id.startsWith("profile:") ? view.id.slice("profile:".length) : null;

  const modes: Mode[] = ["copy", "save", ...(viewProfile ? ["remove" as Mode] : [])];
  const mode: Mode = (modes as string[]).includes(st.mode) ? (st.mode as Mode) : "copy";
  const nextMode = modes[(modes.indexOf(mode) + 1) % modes.length];

  let n = 1;
  while (st.profiles.includes(`Profile ${n}`)) n++;
  const freeName = `Profile ${n}`;

  const nextView = all[(viewIdx + 1) % all.length];
  const tIdx = st.target ? st.profiles.indexOf(st.target) : -1;
  const nextTarget = st.profiles.length ? st.profiles[(tIdx + 1) % st.profiles.length] : null;

  const modeColor = mode === "save" ? c.brightGreen : mode === "remove" ? c.brightRed : c.blue;

  // Row 1: palette selector.
  const paletteBar: WidgetItem[] = [{
    id: `${OWNS}-view`, pinned: true,
    attribute: { label1: "PALETTE", label2: view.name, label3: `${viewIdx + 1}/${all.length}`, color1: c.fg4, color2: c.fg },
    action: act(ctx, setCmd(VIEW_FILE, nextView.id)),
  }];

  // Row 2: save target, new / delete profile, ENTER mode.
  const actionBar: WidgetItem[] = [
    {
      id: `${OWNS}-target`, pinned: true,
      attribute: {
        label1: "SAVE TO", label2: st.target ?? "—", label3: st.target ? String(st.count) : undefined,
        color1: c.fg4, color2: st.target ? c.yellow : c.fg4,
      },
      action: nextTarget
        ? act(ctx, setCmd(TARGET_FILE, nextTarget))
        : act(ctx, newProfileCmd(freeName)),
    },
    {
      id: `${OWNS}-new`, pinned: true,
      attribute: { label1: "PROFILE", label2: "＋ New", color1: c.fg4, color2: c.brightGreen },
      action: act(ctx, newProfileCmd(freeName)),
    },
  ];
  if (st.target) {
    actionBar.push({
      id: `${OWNS}-del`, pinned: true,
      attribute: { label1: "PROFILE", label2: "🗑 Delete", color1: c.fg4, color2: c.brightRed },
      action: act(ctx, deleteCmd(st.target)),
    });
  }
  actionBar.push({
    id: `${OWNS}-mode`, pinned: true,
    attribute: { label1: "ENTER", label2: MODE_LABEL[mode], color1: c.fg4, color2: modeColor },
    action: act(ctx, setCmd(MODE_FILE, nextMode)),
  });

  // Tiles.
  const isSpectrum = view.id === SPECTRUM_ID;
  const colors: PaletteColor[] = isSpectrum
    ? spectrumColors()
    : viewProfile
      ? st.colors.map((hex) => ({ hex }))
      : COLOR_SCHEMES.find((p) => p.id === view.id)?.colors ?? [];

  const items = tileItems(ctx, colors, { mode, target: st.target, freeName, viewProfile });

  const body: WidgetContent = items.length
    ? { type: "tiles", columns: isSpectrum ? SPECTRUM_COLUMNS : SCHEME_COLUMNS, gap: isSpectrum ? 0 : 2, datas: items }
    : { type: "text", data: { id: `${OWNS}-empty`, attribute: {
        label1: "Empty profile. Switch palette and click colors to save them here.", color1: c.fg4 } } };

  const barStyle = { background: c.bg1, borderRadius: 8, padding: 4 };
  const sections: WidgetGroupSection[] = [
    { id: "palette", style: barStyle, content: { type: "rows", datas: paletteBar } },
    ...(SHOW_ACTION_BAR ? [{ id: "actions", style: barStyle, content: { type: "rows" as const, datas: actionBar } }] : []),
    { id: "tiles", content: body },
  ];
  return { type: "group", direction: "column", gap: 6, sections };
}

export async function renderColors(ctx: ExecutionContext): Promise<WidgetContent> {
  return buildContent(ctx, await readState(ctx));
}

// Re-exported so commands.ts has one import for the helpers it shares with render.
export { shq };
