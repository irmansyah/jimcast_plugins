// [plugin] jimcast-external-calculator/src/commands.ts
import type { WidgetCliCommand, WidgetCliContext } from "@jimcast/sdk";
import { evaluateExpression, formatDisplay, formatRaw } from "./calc.js";
import { cliItem } from "./render.js";
import { copyCmd } from "./shell.js";

const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));

function parse(ctx: WidgetCliContext): { expr: string; value: number } {
  const expr = positional(ctx).join(" ").trim();
  if (!expr) throw new Error("needs an expression, e.g. 2+2*3");
  const value = evaluateExpression(expr);
  if (value === null) throw new Error(`not a calculation: ${expr}`);
  return { expr, value };
}

export const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "eval",
    args: ["expression"],
    title: "Evaluate an expression",
    async run(ctx) {
      const { expr, value } = parse(ctx);
      return `${expr} = ${formatDisplay(value)}`;
    },
  },
  {
    id: "copy",
    args: ["expression"],
    title: "Evaluate an expression and copy the result",
    async run(ctx) {
      const { value } = parse(ctx);
      const raw = formatRaw(value);
      await ctx.dispatch(cliItem(ctx, "copy", copyCmd(raw)));
      return `Copied ${raw}`;
    },
  },
];
