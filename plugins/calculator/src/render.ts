// [plugin] jim-calculator/src/render.ts
import type { ExecutionContext, WidgetContent, WidgetItem } from "@jimcast/sdk";
import { evaluateExpression, formatDisplay, formatRaw } from "./data.js";

// theme.font.hightlight1 from the design system. TODO: the real value was not pasted; confirm.
const FONT_HIGHLIGHT1 = 20;

/**
 * Builds the result row for a query, or null if the query is not a calculation.
 * Port of the built-in `renderQuery` body.
 */
export function resultItem(ctx: ExecutionContext, q: string): WidgetItem | null {
  const value = evaluateExpression(q);
  if (value === null) return null;

  const colors = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const yellow = colors["yellow"] ?? "#e5c07b";

  const expr = q.trim();
  const raw = formatRaw(value);
  void raw;

  return {
    id: "calc-result",
    pinned: true,
    attribute: {
      label1: `= ${formatDisplay(value)}`,
      label2: expr,
      labelRight: "↵ copy",
      color1: yellow,
      textSize1: FONT_HIGHLIGHT1,
    },
    action: {
      run: async () => {
        // TODO: built-in did port.copyToClipboard(raw) + port.showToast(`Copied ${raw}`).
        // No SDK call for either is known; ask which one exists. Do not invent one.
      },
      then: "dismiss", // was port.dismissCommandBar()
    },
  } as WidgetItem;
}

// TODO: the built-in used renderQuery(context, q), which the SDK does not support yet.
// Until the plugin gets the query text, the widget renders an empty list.
// When a query API exists: return { type: "list", datas: [resultItem(ctx, q)] } for non-null results.
export async function render(_ctx: ExecutionContext): Promise<WidgetContent> {
  return { type: "list", datas: [] } as WidgetContent;
}
