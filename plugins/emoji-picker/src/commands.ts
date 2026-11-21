// [plugin] jim-emoji-picker/src/commands.ts
//
// CLI: `jimcast widget command com.jimcast.plugins.emoji <list|use|search|copy>`
// Port of core's EMOJI_COMMANDS. Everything goes through ctx.dispatch, so the
// picker re-renders exactly as if a tile or tab had been selected.

import type { WidgetCliCommand, WidgetCliContext } from "@jimcast/sdk";
import { allEmojis, findTab, tabList } from "./catalog.js";
import { copyCmd, setCategoryCmd } from "./shell.js";
import { cliItem } from "./render.js";

const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));

export const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "list", title: "List category ids you can pass to `use`",
    async run() {
      return tabList().map((t) => `${t.id}\t${t.icon} ${t.name}`).join("\n");
    },
  },
  {
    id: "use", args: ["category"], title: "Show a category (e.g. food, recent)",
    async run(ctx) {
      const q = positional(ctx).join(" ");
      if (!q) throw new Error("use needs a category");
      const t = findTab(q);
      if (!t) throw new Error(`unknown category: ${q} (see \`com.jimcast.plugins.emoji list\`)`);
      await ctx.dispatch(cliItem(ctx, "use", setCategoryCmd(t.id)));
      return `Showing ${t.name}`;
    },
  },
  {
    id: "search", args: ["word"], title: "Search emoji by name",
    async run(ctx) {
      const q = positional(ctx).join(" ").toLowerCase();
      if (!q) throw new Error("search needs a word");
      const hits = allEmojis().filter((e) => e.name.includes(q));
      return hits.length ? hits.map((e) => `${e.emoji}\t${e.name}`).join("\n") : "(no match)";
    },
  },
  {
    id: "copy", args: ["name|emoji"], title: "Copy an emoji (by exact name or the emoji itself) and add it to Recent",
    async run(ctx) {
      const q = positional(ctx).join(" ").toLowerCase();
      if (!q) throw new Error("copy needs a name or an emoji");
      const hit = allEmojis().find((e) => e.name === q || e.emoji === q);
      if (!hit) throw new Error(`unknown emoji: ${q} (try \`com.jimcast.plugins.emoji search ${q}\`)`);
      await ctx.dispatch(cliItem(ctx, "copy", copyCmd(hit.emoji)));
      return `Copied ${hit.emoji}`;
    },
  },
];
