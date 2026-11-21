// [plugin] jim-calculator/src/index.ts
import { createWidget, definePlugin, type WidgetItem } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime"; // Node only
import { evaluateExpression, formatDisplay, formatRaw } from "./data.js";

// Main widget: no id (its full id is the plugin id from package.json).
export const widget = createWidget({
  section: { title: "Calculator", titleShow: false, querySearchActive: false },
  renderQuery: (ctx, q) => {
    const value = evaluateExpression(q);
    if (value === null) return null;

    const expr = q.trim();
    const raw = formatRaw(value);

    const item: WidgetItem = {
      id: "calculator",
      pinned: true,
      attribute: {
        label1: `= ${formatDisplay(value)}`,
        label2: expr,
        labelRight: "↵ copy",
        color1: ctx.host.theme.colors.yellow,
        textSize1:  ctx.host.theme.typography.xl,
      },
      action: {
        run: async () => {
          await ctx.copyToClipboard(raw);
          await ctx.showToast(`Copied ${raw}`);
        },
        then: "dismiss",
      },
    };
    return { type: "list", datas: [item] };
  },
});

export const plugin = definePlugin({
  description: "Inline calculator: type an expression, press enter to copy the result.",
  widgets: [widget],
});
export default plugin;
bootstrapPlugin(plugin);
