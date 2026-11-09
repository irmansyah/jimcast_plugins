// [plugin] jimcast-external-calculator/src/render.ts
import type { ExecutionContext, WidgetContent, WidgetItem } from "@jimcast/sdk";
import { formatDisplay, formatRaw } from "./calc.js";
import { copyCmd } from "./shell.js";

export const OWNS = "extcalc";   // item-id prefix, not a core prefix
export const SPEC_ID = "xcalc";  // CLI spec id, not a core name

type Exec = Pick<ExecutionContext, "exec">;
type Action = NonNullable<WidgetItem["action"]>;

export const act = (ctx: Exec, cmd: string, then: "refresh" | "dismiss" = "refresh"): Action =>
  ({ run: async () => { await ctx.exec(cmd); }, then });

export const cliItem = (ctx: Exec, id: string, cmd: string): WidgetItem =>
  ({ id: `${OWNS}-cli:${id}`, action: act(ctx, cmd) });

const FONT_XS = 11;           // local stand-in for theme.font.xs
const FONT_HIGHLIGHT1 = 22;   // local stand-in for theme.font.hightlight1 (value unknown)

function palette(ctx: ExecutionContext) {
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const g = (k: string, fb: string) => raw[k] ?? fb;
  return {
    yellow: g("yellow", "#d79921"),
    fg4: g("fg4", "#a89984"),
  };
}

/**
 * Result row, ported 1:1 from renderQuery. Toast is dropped; the dismiss mapping
 * replaces port.dismissCommandBar().
 * TODO: unused until core passes the query to external widgets (renderQuery).
 */
export function resultItem(ctx: ExecutionContext, value: number, expr: string): WidgetItem {
  const c = palette(ctx);
  return {
    id: `${OWNS}-result`,
    pinned: true,
    attribute: {
      label1: `= ${formatDisplay(value)}`,
      label2: expr,
      labelRight: "↵ copy",
      color1: c.yellow,
      textSize1: FONT_HIGHLIGHT1,
    },
    action: act(ctx, copyCmd(formatRaw(value)), "dismiss"),
  };
}

// TODO: query-reactive render. Until then the widget shows a hint; use the CLI.
export async function render(ctx: ExecutionContext): Promise<WidgetContent> {
  const c = palette(ctx);
  return {
    type: "list",
    datas: [{
      id: `${OWNS}-hint`,
      pinned: true,
      attribute: {
        label1: "Query-based calculation not available yet",
        label2: `jimcast widget command ${SPEC_ID} eval "2+2*3"`,
        color1: c.fg4,
        textSize1: FONT_XS,
      },
    }],
  };
}
