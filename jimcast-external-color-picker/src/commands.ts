// [plugin] jimcast-external-color-picker/src/commands.ts
//
// CLI: `jimcast widget command xcolors <status|list|use|new|delete|add|remove>`
// Port of core's COLOR_COMMANDS. Everything goes through ctx.dispatch, so the
// picker re-renders exactly as if a tile or button had been selected.

import type { WidgetCliCommand, WidgetCliContext } from "@jimcast/sdk";
import {
  VIEW_FILE,
  addCmd,
  cleanName,
  deleteCmd,
  newProfileCmd,
  normHex,
  readState,
  removeCmd,
  setCmd,
} from "./shell.js";
import { findPalette, paletteList } from "./palettes.js";
import { cliItem } from "./render.js";

const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));

function hexArgs(ctx: WidgetCliContext): string[] {
  const out = positional(ctx).map((a) => {
    const h = normHex(a);
    if (!h) throw new Error(`not a #rrggbb color: ${a}`);
    return h;
  });
  if (!out.length) throw new Error("pass at least one #rrggbb color");
  return out;
}

export const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "status", title: "Current palette, save target and profiles", description: "--json for machine-readable output",
    async run(ctx) {
      const st = await readState(ctx);
      if (ctx.args.includes("--json")) return st;
      return [
        `palette   ${st.view}`,
        `save to   ${st.target ?? "(none)"}${st.target ? ` (${st.count} colors)` : ""}`,
        `enter     ${st.mode}`,
        `profiles  ${st.profiles.join(", ") || "(none)"}`,
      ].join("\n");
    },
  },
  {
    id: "list", title: "List palette ids you can pass to `use`",
    async run(ctx) {
      const st = await readState(ctx);
      return paletteList(st.profiles).map((p) => `${p.id}\t${p.name}`).join("\n");
    },
  },
  {
    id: "use", args: ["palette"], title: 'Show a palette (id or name, e.g. nord, "Profile 1")',
    async run(ctx) {
      const q = positional(ctx).join(" ");
      if (!q) throw new Error("use needs a palette id or name");
      const st = await readState(ctx);
      const p = findPalette(q, st.profiles);
      if (!p) throw new Error(`unknown palette: ${q} (see \`xcolors list\`)`);
      await ctx.dispatch(cliItem(ctx, "use", setCmd(VIEW_FILE, p.id)));
      return `Showing ${p.name}`;
    },
  },
  {
    id: "new", args: ["name"], title: "Create a profile and make it the save target",
    async run(ctx) {
      const name = cleanName(positional(ctx).join(" "));
      if (!name) throw new Error("new needs a name (letters, digits, space, _ . -)");
      await ctx.dispatch(cliItem(ctx, "new", newProfileCmd(name)));
      return `Created ${name}`;
    },
  },
  {
    id: "delete", args: ["[name]"], title: "Move a profile to the trash (default: the save target)",
    async run(ctx) {
      const st = await readState(ctx);
      const name = cleanName(positional(ctx).join(" ")) || st.target;
      if (!name || !st.profiles.includes(name)) throw new Error("no such profile");
      await ctx.dispatch(cliItem(ctx, "delete", deleteCmd(name)));
      return `Moved ${name} to ~/.jimcast/ext-colorpicker/trash`;
    },
  },
  {
    id: "add", args: ["#rrggbb..."], title: "Add colors to the save target",
    async run(ctx) {
      const st = await readState(ctx);
      if (!st.target) throw new Error("no save target: run `xcolors new <name>` first");
      for (const hex of hexArgs(ctx)) await ctx.dispatch(cliItem(ctx, "add", addCmd(st.target, hex)));
      return `Saved to ${st.target}`;
    },
  },
  {
    id: "remove", args: ["#rrggbb..."], title: "Remove colors from the save target",
    async run(ctx) {
      const st = await readState(ctx);
      if (!st.target) throw new Error("no save target");
      for (const hex of hexArgs(ctx)) await ctx.dispatch(cliItem(ctx, "remove", removeCmd(st.target, hex)));
      return `Removed from ${st.target}`;
    },
  },
];
